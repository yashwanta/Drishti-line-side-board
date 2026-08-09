package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"

	"lsb-api/db"
	"lsb-api/llm"
)

const digestSystemPrompt = `You are writing a daily operational health report for a plant IT
manager and shift supervisor. Write in clear plain English using
short paragraphs. Do not use bullet points or markdown formatting.
Structure your report with these sections, each starting on a new
line with the section name followed by a colon:
System Health, OEE Summary, Anomalies Detected, Top Errors,
Recommended Actions for Today.
Keep the entire report under 400 words. Be direct and practical.`

type digestOEESummary struct {
	Station    string
	AverageOEE float64
	MinimumOEE float64
	MaximumOEE float64
	EntryCount int
}

type digestAnomalySummary struct {
	Total            int
	WorstDeviation   float64
	AffectedStations []string
}

type digestLogSummary struct {
	GoLines []string
}

type digestSourceData struct {
	Health       HealthSnapshot
	OEE          []digestOEESummary
	OEEError     error
	Anomalies    digestAnomalySummary
	AnomalyError error
	Logs         digestLogSummary
	LogsError    error
}

// StartDailyDigest starts the minute-based daily digest scheduler.
func StartDailyDigest(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		lastGeneratedDate := ""
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				date := now.Format("2006-01-02")
				if now.Format("15:04") != digestFireTime() || lastGeneratedDate == date {
					continue
				}
				if err := generateDailyDigest(ctx, now); err != nil {
					slog.Warn("daily health digest generation failed", "error", err)
					continue
				}
				lastGeneratedDate = date
				slog.Info("daily health digest generated", "date", date)
			}
		}
	}()
}

func digestFireTime() string {
	configured := strings.TrimSpace(os.Getenv("DIGEST_TIME"))
	if configured == "" {
		return "06:00"
	}
	if parsed, err := time.Parse("15:04", configured); err == nil && parsed.Format("15:04") == configured {
		return configured
	}
	slog.Warn("invalid DIGEST_TIME; using default", "value", configured, "default", "06:00")
	return "06:00"
}

func generateDailyDigest(ctx context.Context, generatedAt time.Time) error {
	data := gatherDigestData(ctx)
	summary := buildDigestSummary(data)
	digest, err := llm.Ask(ctx, digestSystemPrompt, summary)
	if err != nil {
		return fmt.Errorf("generate daily digest with LLM: %w", err)
	}

	logDir := filepath.Join(projectRoot(), "logs")
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return fmt.Errorf("create digest directory: %w", err)
	}
	path := filepath.Join(logDir, "digest-"+generatedAt.Format("2006-01-02")+".txt")
	if err := os.WriteFile(path, []byte(strings.TrimSpace(digest)+"\n"), 0o600); err != nil {
		return fmt.Errorf("write daily digest: %w", err)
	}
	return nil
}

func gatherDigestData(ctx context.Context) digestSourceData {
	var data digestSourceData
	var wait sync.WaitGroup
	wait.Add(4)

	go func() {
		defer wait.Done()
		data.OEE, data.OEEError = queryDigestOEE(ctx)
	}()
	go func() {
		defer wait.Done()
		data.Anomalies, data.AnomalyError = queryDigestAnomalies(ctx)
	}()
	go func() {
		defer wait.Done()
		data.Logs, data.LogsError = readDigestLogs()
	}()
	go func() {
		defer wait.Done()
		data.Health = CurrentHealthStatus()
	}()

	wait.Wait()
	return data
}

func queryDigestOEE(ctx context.Context) ([]digestOEESummary, error) {
	if db.Pool == nil {
		return nil, errors.New("PostgreSQL is not configured")
	}
	rows, err := db.Pool.QueryContext(ctx, `
		SELECT cell AS station,
		       ROUND(AVG(oee_pct), 1)::DOUBLE PRECISION AS avg_oee,
		       ROUND(MIN(oee_pct), 1)::DOUBLE PRECISION AS min_oee,
		       ROUND(MAX(oee_pct), 1)::DOUBLE PRECISION AS max_oee,
		       COUNT(*) AS entry_count
		FROM oee_entries
		WHERE created_at > NOW() - INTERVAL '24 hours'
		GROUP BY cell ORDER BY cell`)
	if err != nil {
		return nil, fmt.Errorf("query digest OEE summary: %w", err)
	}
	defer rows.Close()

	result := make([]digestOEESummary, 0)
	for rows.Next() {
		var station digestOEESummary
		if err := rows.Scan(&station.Station, &station.AverageOEE, &station.MinimumOEE, &station.MaximumOEE, &station.EntryCount); err != nil {
			return nil, fmt.Errorf("scan digest OEE summary: %w", err)
		}
		result = append(result, station)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate digest OEE summary: %w", err)
	}
	return result, nil
}

func queryDigestAnomalies(ctx context.Context) (digestAnomalySummary, error) {
	var result digestAnomalySummary
	if db.Pool == nil {
		return result, errors.New("PostgreSQL is not configured")
	}
	err := db.Pool.QueryRowContext(ctx, `
		SELECT COUNT(*) AS total_anomalies,
		       COALESCE(MAX(ABS(deviation)), 0)::DOUBLE PRECISION AS worst_deviation,
		       COALESCE(ARRAY_AGG(DISTINCT station) FILTER (WHERE station IS NOT NULL), ARRAY[]::TEXT[])
		FROM oee_anomalies
		WHERE detected_at > NOW() - INTERVAL '24 hours'`).Scan(
		&result.Total, &result.WorstDeviation, pq.Array(&result.AffectedStations),
	)
	if err != nil {
		return result, fmt.Errorf("query digest anomaly summary: %w", err)
	}
	if result.AffectedStations == nil {
		result.AffectedStations = []string{}
	}
	return result, nil
}

func readDigestLogs() (digestLogSummary, error) {
	root := projectRoot()
	var result digestLogSummary
	var failures []string
	for _, source := range []struct {
		name   string
		target *[]string
	}{
		{name: "lsb-go-error.log", target: &result.GoLines},
	} {
		lines, err := readLastLines(filepath.Join(root, "logs", source.name), 100)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			failures = append(failures, source.name+": "+err.Error())
			continue
		}
		*source.target = lines
	}
	if len(failures) > 0 {
		return result, errors.New(strings.Join(failures, "; "))
	}
	return result, nil
}

func buildDigestSummary(data digestSourceData) string {
	var summary strings.Builder
	fmt.Fprintf(&summary, "System Health:\nMode: %s\nLLM: %s\n\n", data.Health.Mode, data.Health.LLM)
	summary.WriteString("OEE Summary:\n")
	if data.OEEError != nil {
		fmt.Fprintf(&summary, "Unavailable: %s\n", data.OEEError)
	} else if len(data.OEE) == 0 {
		summary.WriteString("No OEE entries in the last 24 hours.\n")
	} else {
		summary.WriteString("Station | Average | Minimum | Maximum | Entries\n")
		for _, station := range data.OEE {
			fmt.Fprintf(&summary, "%s | %.1f%% | %.1f%% | %.1f%% | %d\n", station.Station, station.AverageOEE, station.MinimumOEE, station.MaximumOEE, station.EntryCount)
		}
	}

	summary.WriteString("\nAnomalies Detected:\n")
	if data.AnomalyError != nil {
		fmt.Fprintf(&summary, "Unavailable: %s\n", data.AnomalyError)
	} else {
		fmt.Fprintf(&summary, "Count: %d\nWorst deviation: %.2f standard deviations\nAffected stations: %s\n",
			data.Anomalies.Total, data.Anomalies.WorstDeviation, strings.Join(data.Anomalies.AffectedStations, ", "))
	}

	summary.WriteString("\nTop Errors:\n")
	fmt.Fprintf(&summary, "LSB-Go error lines: %d\n", len(data.Logs.GoLines))
	if data.LogsError != nil {
		fmt.Fprintf(&summary, "Log read warning: %s\n", data.LogsError)
	}
	if len(data.Logs.GoLines) > 0 {
		summary.WriteString("LSB-Go log excerpt:\n" + strings.Join(data.Logs.GoLines, "\n") + "\n")
	}
	return summary.String()
}

// HandleDigest returns a requested digest or its pending schedule.
func HandleDigest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	date := strings.TrimSpace(r.URL.Query().Get("date"))
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	if parsed, err := time.Parse("2006-01-02", date); err != nil || parsed.Format("2006-01-02") != date {
		writeError(w, http.StatusBadRequest, "date must use YYYY-MM-DD format")
		return
	}
	content, err := os.ReadFile(filepath.Join(projectRoot(), "logs", "digest-"+date+".txt"))
	if errors.Is(err, os.ErrNotExist) {
		jsonResponseWithStatus(w, http.StatusAccepted, map[string]string{"status": "pending", "scheduled_at": digestFireTime()})
		return
	}
	if err != nil {
		slog.Error("read daily digest failed", "date", date, "error", err)
		writeError(w, http.StatusInternalServerError, "unable to read digest")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

// HandleDigestList returns available digest dates newest first.
func HandleDigestList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	entries, err := os.ReadDir(filepath.Join(projectRoot(), "logs"))
	if errors.Is(err, os.ErrNotExist) {
		writeJSON(w, []string{})
		return
	}
	if err != nil {
		slog.Error("list daily digests failed", "error", err)
		writeError(w, http.StatusInternalServerError, "unable to list digests")
		return
	}
	dates := make([]string, 0)
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasPrefix(name, "digest-") || !strings.HasSuffix(name, ".txt") {
			continue
		}
		date := strings.TrimSuffix(strings.TrimPrefix(name, "digest-"), ".txt")
		if parsed, err := time.Parse("2006-01-02", date); err == nil && parsed.Format("2006-01-02") == date {
			dates = append(dates, date)
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(dates)))
	writeJSON(w, dates)
}

func jsonResponseWithStatus(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
