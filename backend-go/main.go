package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"lsb-api/db"
	"lsb-api/handlers"
	"lsb-api/llm"
	"lsb-api/middleware"
)

const version = "2.0"

func configFilePath() string {
	candidates := []string{filepath.Join("config", ".env"), filepath.Join("..", "config", ".env")}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return filepath.Join("config", ".env")
}

// loadConfigEnv intentionally uses only the standard library so deployment
// does not depend on dotenv behavior or the process working directory.
func loadConfigEnv() (string, error) {
	path := configFilePath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		example := strings.TrimSuffix(path, ".env") + ".env.example"
		data, readErr := os.ReadFile(example)
		if readErr != nil {
			return path, readErr
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return path, err
		}
		if err := os.WriteFile(path, data, 0o600); err != nil {
			return path, err
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return path, err
	}
	for _, line := range strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if key != "" {
			if err := os.Setenv(key, value); err != nil {
				return path, err
			}
		}
	}
	return path, nil
}

func appMode() string {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("LSB_MODE")))
	if mode == "" {
		return "unconfigured"
	}
	return mode
}

func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	handlers.HandleHealth(w, nil)
}

func mockStations() []map[string]any {
	return []map[string]any{
		{"resource_id": "WM15", "part_number": "BMW1000D-360", "status": "running", "efficiency_pct": 91.8, "actual": 169, "target": 184, "shift": 2, "operator": "Yashwanta Thakur"},
		{"resource_id": "WM16", "part_number": "BMW1000D-361", "status": "running", "efficiency_pct": 88.6, "actual": 163, "target": 184, "shift": 2, "operator": "James Okonkwo"},
		{"resource_id": "WM17", "part_number": "BMW1000D-360", "status": "downtime", "efficiency_pct": 62.5, "actual": 115, "target": 184, "shift": 2, "operator": "Sarah Mbeki"},
		{"resource_id": "WM18", "part_number": "BMW1000D-362", "status": "running", "efficiency_pct": 94.0, "actual": 173, "target": 184, "shift": 2, "operator": "Priya Sharma"},
		{"resource_id": "WM19", "part_number": "BMW1000D-361", "status": "idle", "efficiency_pct": 0.0, "actual": 0, "target": 184, "shift": 2, "operator": "Unassigned"},
		{"resource_id": "WM20", "part_number": "BMW1000D-360", "status": "running", "efficiency_pct": 86.4, "actual": 159, "target": 184, "shift": 2, "operator": "Carlos Diaz"},
		{"resource_id": "WM21", "part_number": "BMW1000D-362", "status": "running", "efficiency_pct": 97.3, "actual": 179, "target": 184, "shift": 2, "operator": "Amina Yusuf"},
		{"resource_id": "WM22", "part_number": "BMW1000D-360", "status": "running", "efficiency_pct": 82.1, "actual": 151, "target": 184, "shift": 2, "operator": "Tom Adeyemi"},
		{"resource_id": "WM23", "part_number": "BMW1000D-361", "status": "downtime", "efficiency_pct": 71.2, "actual": 131, "target": 184, "shift": 2, "operator": "Fatima Al-Rashid"},
		{"resource_id": "WM24", "part_number": "BMW1000D-362", "status": "running", "efficiency_pct": 90.2, "actual": 166, "target": 184, "shift": 2, "operator": "Daniel Mensah"},
	}
}

func mockProductionStatus() []map[string]any {
	stations := mockStations()
	result := make([]map[string]any, 0, len(stations))
	for index, station := range stations {
		result = append(result, map[string]any{
			"resource_id": station["resource_id"], "status": station["status"],
			"current_part": station["part_number"], "next_part": fmt.Sprintf("BMW1000D-%03d", 360+((index+1)%3)),
			"planned": station["target"], "actual": station["actual"], "efficiency_pct": station["efficiency_pct"],
			"cycle_time_sec": 151.0 + float64(index)*1.8, "operator": station["operator"],
		})
	}
	return result
}

func mockHourlyProduction(resource string) []map[string]any {
	actuals := []int{22, 24, 21, 23, 20, 25, 22, 19}
	rows := make([]map[string]any, 0, len(actuals))
	for index, actual := range actuals {
		scrap := 0
		if index == 2 || index == 6 {
			scrap = 1
		}
		rows = append(rows, map[string]any{
			"id": index + 1, "resource_id": resource, "hour": 14 + index,
			"part_number": "BMW1000D-360", "operator": "Yashwanta Thakur",
			"plan": 23, "target": 23, "actual": actual, "good_count": actual - scrap,
			"scrap_count": scrap, "gap": actual - 23, "cycle_time_sec": 3600.0 / float64(actual),
			"efficiency_pct": float64(actual) / 23.0 * 100, "notes": "MARS demo production", "confirmed": index < 6,
		})
	}
	return rows
}

func mockIssueAnalytics(resource string, days int) []map[string]any {
	types := []string{"Equipment", "Quality", "Production", "Material", "Equipment", "Quality", "Safety", "Production", "Equipment", "Quality", "Material", "Production", "Equipment", "Quality", "Equipment", "Material", "Production", "Quality"}
	severities := []string{"critical", "major", "major", "minor", "major", "critical", "minor", "minor", "major", "major", "major", "major", "minor", "minor", "critical", "minor", "major", "major"}
	statuses := []string{"resolved", "in_progress", "open", "resolved", "resolved", "resolved", "closed", "resolved", "resolved", "closed", "resolved", "resolved", "closed", "resolved", "resolved", "closed", "resolved", "resolved"}
	offsets := []int{0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 23, 27, 35, 45, 70}
	descriptions := map[string]string{
		"Equipment":  "MARS equipment alarm affected the machining cycle",
		"Quality":    "MARS quality trend exceeded the configured control limit",
		"Production": "MARS production output fell below the hourly target",
		"Material":   "MARS material buffer reached the replenishment threshold",
		"Safety":     "MARS safety inspection notification requires follow-up",
	}

	now := time.Now().UTC()
	result := make([]map[string]any, 0, len(types))
	for index, issueType := range types {
		if offsets[index] >= days {
			continue
		}
		raisedAt := now.AddDate(0, 0, -offsets[index]).Add(-time.Duration((index%4)+1) * time.Hour)
		updatedAt := raisedAt
		if statuses[index] == "resolved" || statuses[index] == "closed" {
			updatedAt = raisedAt.Add(time.Duration((index%7)+1) * time.Hour)
		} else if statuses[index] == "in_progress" {
			updatedAt = raisedAt.Add(2 * time.Hour)
		}
		result = append(result, map[string]any{
			"id": 9000 + index, "resource": resource, "resource_id": resource,
			"issue_type": issueType, "severity": severities[index], "description": descriptions[issueType],
			"status": statuses[index], "raised_by": "MARS", "acknowledged_by": "Presentation Team",
			"raised_at": raisedAt.Format(time.RFC3339), "updated_at": updatedAt.Format(time.RFC3339),
		})
	}
	return result
}

func mockOEECauses(days int) []map[string]any {
	causes := []map[string]any{
		{"cause_text": "Spindle overload alarm", "cause_type": "Maintenance", "occurrences": 8, "total_dt_min": 126},
		{"cause_text": "Insert wear / tool change", "cause_type": "Tool", "occurrences": 7, "total_dt_min": 84},
		{"cause_text": "Material replenishment delay", "cause_type": "Production", "occurrences": 5, "total_dt_min": 72},
		{"cause_text": "Coolant pressure low", "cause_type": "Maintenance", "occurrences": 4, "total_dt_min": 58},
		{"cause_text": "Extended model changeover", "cause_type": "Production", "occurrences": 3, "total_dt_min": 46},
	}
	if days <= 7 {
		return causes[:3]
	}
	return causes
}

func inlineMock(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	if resource == "" {
		resource = "WM15"
	}
	switch r.URL.Path {
	case "/api/kpis":
		jsonResponse(w, http.StatusOK, map[string]any{"resource": resource, "shift": 2, "date": time.Now().Format("2006-01-02"), "plan": 184, "actual": 176, "good_count": 174, "scrap_count": 2, "efficiency_pct": 95.7, "fpy_pct": 98.9, "avg_cycle_sec": 153.2, "hours_worked": 8, "open_issues": 3, "jph_target": 23, "operator_name": "Yashwanta Thakur"})
	case "/api/stations":
		jsonResponse(w, http.StatusOK, mockStations())
	case "/api/downtime":
		jsonResponse(w, http.StatusOK, map[string]any{"events": []map[string]any{
			{"id": 1, "reason_code": "Equipment Failure", "minutes": 28, "comment": "Spindle overload reset and verified", "start_ts": time.Now().Add(-4 * time.Hour).Format(time.RFC3339), "logged_by": "MARS"},
			{"id": 2, "reason_code": "Tooling Change", "minutes": 14, "comment": "Scheduled insert replacement", "start_ts": time.Now().Add(-2 * time.Hour).Format(time.RFC3339), "logged_by": "MARS"},
			{"id": 3, "reason_code": "Quality Hold", "minutes": 9, "comment": "First-piece dimensional verification", "start_ts": time.Now().Add(-time.Hour).Format(time.RFC3339), "logged_by": "MARS"},
		}, "total_mins": 51, "resource": resource, "date": time.Now().Format("2006-01-02")})
	case "/api/shipping/status":
		jsonResponse(w, http.StatusOK, map[string]any{
			"parts_shipped_today":  1280,
			"shipment_count":       3,
			"pending_trucks":       2,
			"loaded_trucks":        1,
			"shipping_dock_status": "ACTIVE",
			"on_time_rate_pct":     94.7,
			"next_shipment":        "WO-20260817-01 · 16:00",
			"delivery_eta":         time.Now().AddDate(0, 0, 1).Format("2006-01-02") + " 08:00",
			"customer_deliveries": []map[string]any{
				{"work_order": "WO-20260817-01", "customer": "BMW AG Leipzig", "part_number": "BMW1000D-360", "qty": 184, "ship_by": "16:00", "status": "IN_TRANSIT", "delivery_date": time.Now().AddDate(0, 0, 1).Format("2006-01-02")},
				{"work_order": "WO-20260816-03", "customer": "BMW Group", "part_number": "BMW2000E-180", "qty": 160, "ship_by": "14:00", "status": "ONTIME", "delivery_date": time.Now().Format("2006-01-02")},
				{"work_order": "WO-20260817-02", "customer": "BMW Dingolfing", "part_number": "BMW1000D-361", "qty": 92, "ship_by": "20:00", "status": "PENDING", "delivery_date": time.Now().AddDate(0, 0, 1).Format("2006-01-02")},
				{"work_order": "WO-20260815-02", "customer": "MINI Oxford", "part_number": "BMW3000F-240", "qty": 140, "ship_by": "12:00", "status": "LATE", "delivery_date": time.Now().Format("2006-01-02")},
			},
		})
	case "/api/production/status":
		jsonResponse(w, http.StatusOK, mockProductionStatus())
	case "/api/weekly":
		jsonResponse(w, http.StatusOK, map[string]any{"resource": "WM15", "days": []any{}})
	case "/api/production", "/api/productivity":
		jsonResponse(w, http.StatusOK, mockHourlyProduction(resource))
	case "/api/issues":
		jsonResponse(w, http.StatusOK, []map[string]any{
			{"id": 101, "resource_id": resource, "issue_type": "Quality", "severity": "major", "description": "Bore diameter trending toward upper control limit", "status": "in_progress", "raised_by": "MARS", "acknowledged_by": "Quality Lead", "raised_at": time.Now().Add(-3 * time.Hour).Format(time.RFC3339), "updated_at": time.Now().Add(-time.Hour).Format(time.RFC3339)},
			{"id": 102, "resource_id": resource, "issue_type": "Production", "severity": "minor", "description": "Hourly output below target after changeover", "status": "open", "raised_by": "MARS", "acknowledged_by": "Shift Supervisor", "raised_at": time.Now().Add(-90 * time.Minute).Format(time.RFC3339), "updated_at": time.Now().Add(-90 * time.Minute).Format(time.RFC3339)},
			{"id": 103, "resource_id": resource, "issue_type": "Equipment", "severity": "critical", "description": "Intermittent spindle overload alarm under investigation", "status": "open", "raised_by": "MARS", "acknowledged_by": "Maintenance", "raised_at": time.Now().Add(-45 * time.Minute).Format(time.RFC3339), "updated_at": time.Now().Add(-30 * time.Minute).Format(time.RFC3339)},
		})
	case "/api/issues/analytics":
		days, parseErr := strconv.Atoi(r.URL.Query().Get("days"))
		if parseErr != nil || days <= 0 || days > 365 {
			days = 30
		}
		jsonResponse(w, http.StatusOK, mockIssueAnalytics(resource, days))
	case "/api/issues/oee-causes":
		days, parseErr := strconv.Atoi(r.URL.Query().Get("days"))
		if parseErr != nil || days <= 0 || days > 365 {
			days = 30
		}
		jsonResponse(w, http.StatusOK, mockOEECauses(days))
	case "/api/mars/production":
		jsonResponse(w, http.StatusOK, mockHourlyProduction(resource))
	case "/api/mars/quality":
		jsonResponse(w, http.StatusOK, []map[string]any{{"defect_code": "DIM-BORE", "count": 3, "total_qty": 176, "last_inspector": "QA Lead", "last_ts": time.Now().Add(-35 * time.Minute).Format(time.RFC3339)}, {"defect_code": "SURFACE", "count": 1, "total_qty": 176, "last_inspector": "QA Lead", "last_ts": time.Now().Add(-2 * time.Hour).Format(time.RFC3339)}})
	case "/api/mars/schedule":
		jsonResponse(w, http.StatusOK, []map[string]any{{"work_order": "WO-20260817-01", "part_number": "BMW1000D-360", "revision": "C", "scheduled_date": time.Now().Format("2006-01-02"), "planned_qty": 184}, {"work_order": "WO-20260817-02", "part_number": "BMW1000D-361", "revision": "B", "scheduled_date": time.Now().AddDate(0, 0, 1).Format("2006-01-02"), "planned_qty": 184}})
	case "/api/mars/kpis":
		jsonResponse(w, http.StatusOK, map[string]any{"planned_qty": 184, "actual_qty": 176, "scrap_qty": 2, "fpy_pct": 98.9, "oee_pct": 88.4, "work_order": "WO-20260817-01", "part_number": "BMW1000D-360", "revision": "C"})
	case "/api/robotpress", "/api/robot-press", "/api/robotpress/history":
		jsonResponse(w, http.StatusOK, map[string]any{
			"peak_force_kn":      16.42,
			"pass_fail":          "PASS",
			"force_min_kn":       12.0,
			"force_max_kn":       18.0,
			"program":            "P-360-BMW",
			"alarm_code":         "",
			"alarm_desc":         "",
			"cycles_today":       847,
			"passes_today":       842,
			"fails_today":        5,
			"pass_rate_pct":      99.41,
			"min_force_today_kn": 13.21,
			"max_force_today_kn": 17.88,
			"avg_force_today_kn": 15.73,
			"last_poll_ts":       time.Now().UTC().Format(time.RFC3339),
			"pendant_online":     true,
		})
	default:
		jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "id": 0})
	}
}

func mockOrLive(live http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch appMode() {
		case "mock":
			inlineMock(w, r)
		case "production":
			live(w, r)
		default:
			jsonResponse(w, http.StatusOK, map[string]string{"status": "unconfigured"})
		}
	}
}

func modeAPIHandler(w http.ResponseWriter, r *http.Request) {
	switch appMode() {
	case "mock":
		inlineMock(w, r)
	case "production":
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "API route not found"})
	default:
		jsonResponse(w, http.StatusOK, map[string]string{"status": "unconfigured"})
	}
}

type statusResponseWriter struct {
	http.ResponseWriter
	statusCode  int
	wroteHeader bool
}

func (w *statusResponseWriter) WriteHeader(statusCode int) {
	if w.wroteHeader {
		return
	}
	w.statusCode = statusCode
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *statusResponseWriter) Write(body []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		response := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(response, r)
		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status_code", response.statusCode,
			"duration_ms", time.Since(started).Milliseconds(),
			"remote_addr", r.RemoteAddr,
		)
	})
}

func main() {
	path, err := loadConfigEnv()
	if logPath := strings.TrimSpace(os.Getenv("LOG_FILE")); logPath != "" {
		logFile, logErr := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if logErr != nil {
			slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
			slog.Error("log file unavailable", "path", logPath, "error", logErr)
		} else {
			defer logFile.Close()
			slog.SetDefault(slog.New(slog.NewJSONHandler(logFile, nil)))
		}
	} else {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	}
	if os.Getenv("DB_HOST") != "" {
		db.Connect()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		if err := handlers.EnsureOEEAnomalySchema(ctx); err != nil {
			slog.Error("OEE anomaly schema setup failed", "error", err)
		}
		cancel()
	}
	if os.Getenv("LSB_DB_SERVER") != "" {
		if err := db.ConnectMSSQL(); err != nil {
			slog.Warn("MSSQL connection failed at startup", "error", err)
		}
	}
	if err := llm.LoadConfig(); err != nil {
		slog.Warn("LLM configuration unavailable", "error", err)
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := handlers.CheckLLM(ctx); err != nil {
			slog.Warn("LLM server unreachable at startup", "error", err)
		}
		cancel()
	}
	if err != nil {
		slog.Error("configuration load failed", "error", err)
	} else {
		slog.Info("configuration loaded", "path", path)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/setup/demo", handleSetupDemo)
	mux.HandleFunc("/api/setup/configure-mssql", handleSetupConfigureMSSQL)
	mux.HandleFunc("/api/setup/configure-postgres", handleSetupConfigurePostgres)
	mux.HandleFunc("/api/setup/import-excel", handleSetupImportExcel)
	mux.HandleFunc("/api/oee/entries", handleOEEEntries)
	mux.HandleFunc("/api/kpis", mockOrLive(handlers.HandleKPIs))
	mux.HandleFunc("/api/production", mockOrLive(handlers.HandleProduction))
	mux.HandleFunc("/api/confirm", mockOrLive(handlers.HandleConfirm))
	mux.HandleFunc("/api/productivity", mockOrLive(handlers.HandleProductivity))
	mux.HandleFunc("/api/issues", mockOrLive(handlers.HandleIssues))
	mux.HandleFunc("/api/issues/raise", mockOrLive(handlers.HandleRaiseIssue))
	mux.HandleFunc("/api/issues/analytics", mockOrLive(handlers.HandleIssuesAnalytics))
	mux.HandleFunc("/api/issues/oee-causes", mockOrLive(handlers.HandleOEECauses))
	mux.HandleFunc("/api/stations", mockOrLive(handlers.GetStations))
	mux.HandleFunc("/api/production/status", mockOrLive(handlers.GetProductionStatus))
	mux.HandleFunc("/api/shipping/status", mockOrLive(handlers.GetShippingStatus))
	mux.HandleFunc("/api/weekly", mockOrLive(handlers.GetWeekly))
	mux.HandleFunc("/api/downtime", mockOrLive(handlers.GetDowntime))
	mux.HandleFunc("/api/llm/log-analysis", handlers.HandleLogAnalysis)
	mux.HandleFunc("/api/llm/anomalies", handlers.HandleOEEAnomalies)
	mux.HandleFunc("/api/llm/remediate", handlers.HandleRemediate)
	mux.HandleFunc("/api/llm/digest/list", handlers.HandleDigestList)
	mux.HandleFunc("/api/llm/digest", handlers.HandleDigest)
	mux.HandleFunc("/api/", modeAPIHandler)
	mux.Handle("/", http.FileServer(http.Dir("./static")))

	port := os.Getenv("PORT")
	if _, err := strconv.Atoi(port); err != nil {
		port = "3001"
	}
	slog.Info("Line Side Board API listening", "version", version, "port", port, "mode", appMode())
	handlers.StartLogAnalyzer(context.Background())
	handlers.StartOEEAnomalyDetector(context.Background())
	handlers.StartDailyDigest(context.Background())
	if err := http.ListenAndServe(":"+port, requestLogger(middleware.CORS(mux))); err != nil {
		slog.Error("server stopped", "error", err)
	}
}
