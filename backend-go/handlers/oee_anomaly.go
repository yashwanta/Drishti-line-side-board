package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"time"

	"lsb-api/db"
	"lsb-api/llm"
)

const (
	anomalyInterval = 15 * time.Minute
	anomalyTableDDL = `CREATE TABLE IF NOT EXISTS oee_anomalies (
  id           SERIAL PRIMARY KEY,
  station      TEXT NOT NULL,
  oee_value    NUMERIC(5,2),
  mean_value   NUMERIC(5,2),
  std_dev      NUMERIC(5,2),
  deviation    NUMERIC(5,2),
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  llm_explanation TEXT
)`
	anomalySystemPrompt = `You are an OEE (Overall Equipment Effectiveness) analyst for a
manufacturing plant. When given an anomalous OEE reading, write
2-3 sentences explaining the most likely operational cause and
what the shift supervisor should physically check on the line.
Be concise and practical. Use plain text only, no formatting.`
)

type oeeReading struct {
	Station    string
	OEEValue   float64
	RecordedAt time.Time
}

type OEEAnomaly struct {
	ID             int64     `json:"id"`
	Station        string    `json:"station"`
	OEEValue       float64   `json:"oee_value"`
	MeanValue      float64   `json:"mean_value"`
	StdDev         float64   `json:"std_dev"`
	Deviation      float64   `json:"deviation"`
	DetectedAt     time.Time `json:"detected_at"`
	LLMExplanation string    `json:"llm_explanation"`
}

// EnsureOEEAnomalySchema creates the Task 13 table for configured databases.
func EnsureOEEAnomalySchema(ctx context.Context) error {
	if db.Pool == nil {
		return sql.ErrConnDone
	}
	if _, err := db.Pool.ExecContext(ctx, anomalyTableDDL); err != nil {
		return fmt.Errorf("create oee_anomalies table: %w", err)
	}
	return nil
}

// HandleOEEAnomalies handles GET /api/llm/anomalies?hours=24.
func HandleOEEAnomalies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if db.Pool == nil {
		writeError(w, http.StatusServiceUnavailable, "PostgreSQL is not configured")
		return
	}

	hours := 24
	if value := r.URL.Query().Get("hours"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			writeError(w, http.StatusBadRequest, "hours must be a positive integer")
			return
		}
		hours = parsed
	}
	if hours > 168 {
		hours = 168
	}

	rows, err := db.Pool.QueryContext(r.Context(), `
		SELECT id, station, oee_value, mean_value, std_dev, deviation,
		       detected_at, COALESCE(llm_explanation, '')
		FROM oee_anomalies
		WHERE detected_at > NOW() - ($1 * INTERVAL '1 hour')
		ORDER BY detected_at DESC`, hours)
	if err != nil {
		slog.Error("query OEE anomalies failed", "error", err)
		writeError(w, http.StatusInternalServerError, "unable to query OEE anomalies")
		return
	}
	defer rows.Close()

	anomalies := make([]OEEAnomaly, 0)
	for rows.Next() {
		var anomaly OEEAnomaly
		if err := rows.Scan(&anomaly.ID, &anomaly.Station, &anomaly.OEEValue,
			&anomaly.MeanValue, &anomaly.StdDev, &anomaly.Deviation,
			&anomaly.DetectedAt, &anomaly.LLMExplanation); err != nil {
			slog.Error("scan OEE anomaly failed", "error", err)
			writeError(w, http.StatusInternalServerError, "unable to read OEE anomalies")
			return
		}
		anomalies = append(anomalies, anomaly)
	}
	if err := rows.Err(); err != nil {
		slog.Error("iterate OEE anomalies failed", "error", err)
		writeError(w, http.StatusInternalServerError, "unable to read OEE anomalies")
		return
	}
	writeJSON(w, anomalies)
}

// StartOEEAnomalyDetector starts the 15-minute anomaly detection loop.
func StartOEEAnomalyDetector(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(anomalyInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if db.Pool == nil {
					continue
				}
				if err := DetectOEEAnomalies(ctx); err != nil {
					slog.Warn("OEE anomaly detection failed", "error", err)
				}
			}
		}
	}()
}

// DetectOEEAnomalies scans readings and stores newly explained anomalies.
func DetectOEEAnomalies(ctx context.Context) error {
	if db.Pool == nil {
		return sql.ErrConnDone
	}
	rows, err := db.Pool.QueryContext(ctx, `
		SELECT cell AS station, oee_pct AS oee_value, created_at AS recorded_at
		FROM oee_entries
		WHERE created_at > NOW() - INTERVAL '48 hours'
		ORDER BY cell, created_at DESC`)
	if err != nil {
		return fmt.Errorf("query OEE readings: %w", err)
	}
	defer rows.Close()

	readingsByStation := make(map[string][]oeeReading)
	for rows.Next() {
		var reading oeeReading
		if err := rows.Scan(&reading.Station, &reading.OEEValue, &reading.RecordedAt); err != nil {
			return fmt.Errorf("scan OEE reading: %w", err)
		}
		readingsByStation[reading.Station] = append(readingsByStation[reading.Station], reading)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate OEE readings: %w", err)
	}

	for station, readings := range readingsByStation {
		for _, reading := range readings {
			mean, stdDev, count := rollingStats(readings, reading.RecordedAt)
			if count < 2 || stdDev == 0 {
				continue
			}
			deviation := (reading.OEEValue - mean) / stdDev
			if math.Abs(deviation) <= 2 {
				continue
			}

			duplicate, err := recentAnomalyExists(ctx, station)
			if err != nil {
				return err
			}
			if duplicate {
				continue
			}

			userPrompt := fmt.Sprintf(
				"Station: %s.\nCurrent OEE reading: %.2f%%.\n24-hour average for this station: %.2f%%.\nStandard deviation: %.2f%%.\nDeviation from mean: %.2f standard deviations.\nTime of reading: %s.",
				station, reading.OEEValue, mean, stdDev, deviation, reading.RecordedAt.Format(time.RFC3339),
			)
			explanation, err := llm.Ask(ctx, anomalySystemPrompt, userPrompt)
			if err != nil {
				return fmt.Errorf("explain anomaly for %s: %w", station, err)
			}
			if _, err := db.Pool.ExecContext(ctx, `
				INSERT INTO oee_anomalies
				  (station, oee_value, mean_value, std_dev, deviation, llm_explanation)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				station, reading.OEEValue, mean, stdDev, deviation, explanation); err != nil {
				return fmt.Errorf("insert OEE anomaly for %s: %w", station, err)
			}
		}
	}
	return nil
}

func rollingStats(readings []oeeReading, at time.Time) (float64, float64, int) {
	windowStart := at.Add(-24 * time.Hour)
	values := make([]float64, 0, len(readings))
	for _, reading := range readings {
		if reading.RecordedAt.Before(windowStart) || reading.RecordedAt.After(at) {
			continue
		}
		values = append(values, reading.OEEValue)
	}
	if len(values) == 0 {
		return 0, 0, 0
	}
	var sum float64
	for _, value := range values {
		sum += value
	}
	mean := sum / float64(len(values))
	var squaredDifferences float64
	for _, value := range values {
		difference := value - mean
		squaredDifferences += difference * difference
	}
	return mean, math.Sqrt(squaredDifferences / float64(len(values))), len(values)
}

func recentAnomalyExists(ctx context.Context, station string) (bool, error) {
	var exists bool
	if err := db.Pool.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM oee_anomalies
			WHERE station = $1
			  AND detected_at > NOW() - INTERVAL '30 minutes'
		)`, station).Scan(&exists); err != nil {
		return false, fmt.Errorf("check recent anomaly for %s: %w", station, err)
	}
	return exists, nil
}
