package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
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
	mode := appMode()
	if mode == "production" {
		jsonResponse(w, http.StatusOK, map[string]any{"status": "ok", "mode": mode, "db": os.Getenv("LSB_DB_NAME"), "version": version})
		return
	}
	if mode == "mock" {
		jsonResponse(w, http.StatusOK, map[string]any{"status": "ok", "mode": mode, "version": version})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"status": "unconfigured", "mode": "unconfigured", "version": version})
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func javaPath(apiPath string) string {
	switch apiPath {
	case "/api/kpis", "/api/mars/kpis":
		return "/mars/kpis"
	case "/api/production", "/api/mars/production":
		return "/mars/production"
	case "/api/mars/quality":
		return "/mars/quality"
	case "/api/mars/schedule":
		return "/mars/schedule"
	case "/api/robotpress", "/api/robot-press":
		return "/robotpress"
	case "/api/robotpress/history":
		return "/robotpress/history"
	default:
		return apiPath
	}
}

func proxyToJava(w http.ResponseWriter, r *http.Request) {
	base := strings.TrimRight(os.Getenv("LSB_JAVA_URL"), "/")
	if base == "" {
		base = "http://localhost:8080"
	}
	target := base + javaPath(r.URL.Path)
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}
	request, err := http.NewRequestWithContext(r.Context(), r.Method, target, r.Body)
	if err != nil {
		jsonResponse(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	request.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	response, err := (&http.Client{Timeout: 15 * time.Second}).Do(request)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "Java SQL Server service unavailable"})
		return
	}
	defer response.Body.Close()
	w.Header().Set("Content-Type", response.Header.Get("Content-Type"))
	w.WriteHeader(response.StatusCode)
	_, _ = io.Copy(w, response.Body)
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
	case "production":
		proxyToJava(w, r)
	case "mock":
		inlineMock(w, r)
	default:
		jsonResponse(w, http.StatusOK, map[string]string{"status": "unconfigured"})
	}
}

func main() {
	path, err := loadConfigEnv()
	if err != nil {
		log.Printf("[config] %v", err)
	} else {
		log.Printf("[config] loaded %s", path)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", cors(healthHandler))
	mux.HandleFunc("/api/health", cors(healthHandler))
	mux.HandleFunc("/api/setup/demo", cors(handleSetupDemo))
	mux.HandleFunc("/api/setup/test-connection", cors(handleSetupTestConnection))
	mux.HandleFunc("/api/setup/import-excel", cors(handleSetupImportExcel))
	mux.HandleFunc("/api/oee/entries", cors(handleOEEEntries))
	mux.HandleFunc("/api/", cors(modeAPIHandler))
	mux.Handle("/", http.FileServer(http.Dir("./static")))

	port := os.Getenv("PORT")
	if _, err := strconv.Atoi(port); err != nil {
		port = "3001"
	}
	log.Printf("[main] Line Side Board API v%s listening on :%s (mode=%s)", version, port, appMode())
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(fmt.Errorf("server: %w", err))
	}
}
