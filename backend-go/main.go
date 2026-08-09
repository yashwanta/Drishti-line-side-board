package main

import (
	"context"
	"encoding/json"
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

func inlineMock(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/kpis":
		jsonResponse(w, http.StatusOK, map[string]any{"resource": "WM15", "shift": 2, "date": time.Now().Format("2006-01-02"), "plan": 184, "actual": 150, "good_count": 150, "scrap_count": 5, "efficiency_pct": 81.5, "fpy_pct": 96.8, "avg_cycle_sec": 154.8, "hours_worked": 8, "open_issues": 4, "jph_target": 23})
	case "/api/stations":
		jsonResponse(w, http.StatusOK, []map[string]any{{"resource_id": "WM15", "part_number": "BMW1000D-360", "status": "running", "efficiency_pct": 81.5, "actual": 150, "target": 184, "shift": 2, "operator": "Yashwanta Thakur"}})
	case "/api/downtime":
		jsonResponse(w, http.StatusOK, map[string]any{"events": []any{}, "total_mins": 0, "resource": "WM15", "date": time.Now().Format("2006-01-02")})
	case "/api/shipping/status":
		jsonResponse(w, http.StatusOK, map[string]any{"parts_shipped_today": 1280, "shipment_count": 3, "pending_trucks": 2, "loaded_trucks": 1, "shipping_dock_status": "ACTIVE", "on_time_rate_pct": 94.7, "customer_deliveries": []any{}})
	case "/api/production/status":
		jsonResponse(w, http.StatusOK, []map[string]any{{"resource_id": "WM15", "status": "running", "current_part": "BMW1000D-360", "planned": 184, "actual": 150, "efficiency_pct": 81.5, "cycle_time_sec": 154.8}})
	case "/api/weekly":
		jsonResponse(w, http.StatusOK, map[string]any{"resource": "WM15", "days": []any{}})
	case "/api/production", "/api/productivity", "/api/issues", "/api/mars/production", "/api/mars/quality", "/api/mars/schedule":
		jsonResponse(w, http.StatusOK, []any{})
	case "/api/mars/kpis":
		jsonResponse(w, http.StatusOK, map[string]any{})
	case "/api/robotpress", "/api/robot-press", "/api/robotpress/history":
		jsonResponse(w, http.StatusOK, map[string]any{"status": "ONLINE", "resource_id": "WM15"})
	default:
		jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "id": 0})
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
	mux.HandleFunc("/api/kpis", handlers.HandleKPIs)
	mux.HandleFunc("/api/production", handlers.HandleProduction)
	mux.HandleFunc("/api/confirm", handlers.HandleConfirm)
	mux.HandleFunc("/api/productivity", handlers.HandleProductivity)
	mux.HandleFunc("/api/issues", handlers.HandleIssues)
	mux.HandleFunc("/api/issues/raise", handlers.HandleRaiseIssue)
	mux.HandleFunc("/api/stations", handlers.GetStations)
	mux.HandleFunc("/api/production/status", handlers.GetProductionStatus)
	mux.HandleFunc("/api/shipping/status", handlers.GetShippingStatus)
	mux.HandleFunc("/api/weekly", handlers.GetWeekly)
	mux.HandleFunc("/api/downtime", handlers.GetDowntime)
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
