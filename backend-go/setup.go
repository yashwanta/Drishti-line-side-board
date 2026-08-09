package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"lsb-api/db"

	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"
)

type setupDBConfig struct {
	Server   string `json:"server"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type setupPostgresConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
}

var importRateLimit = struct {
	mu     sync.Mutex
	counts map[string][]time.Time
}{counts: make(map[string][]time.Time)}

func currentDBConfig() setupDBConfig {
	port, _ := strconv.Atoi(os.Getenv("LSB_DB_PORT"))
	if port == 0 {
		port = 1433
	}
	return setupDBConfig{os.Getenv("LSB_DB_SERVER"), port, os.Getenv("LSB_DB_NAME"), os.Getenv("LSB_DB_USER"), os.Getenv("LSB_DB_PASSWORD")}
}

func updateConfigEnv(updates map[string]string) error {
	path := configFilePath()
	values := make(map[string]string)
	order := make([]string, 0)
	if data, err := os.ReadFile(path); err == nil {
		for _, line := range strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			if _, exists := values[key]; !exists {
				order = append(order, key)
			}
			values[key] = strings.TrimSpace(value)
		}
	}
	for key, value := range updates {
		if _, exists := values[key]; !exists {
			order = append(order, key)
		}
		values[key] = value
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	var output strings.Builder
	output.WriteString("# Drishti Line Side Board runtime configuration\n")
	for _, key := range order {
		fmt.Fprintf(&output, "%s=%s\n", key, values[key])
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, []byte(output.String()), 0o600); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

func openSQLServer(config setupDBConfig) (*sql.DB, error) {
	if strings.TrimSpace(config.Server) == "" || strings.TrimSpace(config.Database) == "" || strings.TrimSpace(config.Username) == "" {
		return nil, fmt.Errorf("server, database, and username are required")
	}
	if config.Port <= 0 || config.Port > 65535 {
		return nil, fmt.Errorf("port must be between 1 and 65535")
	}
	target := &url.URL{Scheme: "sqlserver", User: url.UserPassword(config.Username, config.Password), Host: fmt.Sprintf("%s:%d", config.Server, config.Port)}
	query := target.Query()
	query.Set("database", config.Database)
	query.Set("encrypt", envOr("LSB_DB_ENCRYPT", "true"))
	query.Set("TrustServerCertificate", envOr("LSB_DB_TRUST_SERVER_CERTIFICATE", "true"))
	target.RawQuery = query.Encode()
	return sql.Open("sqlserver", target.String())
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func handleSetupDemo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := updateConfigEnv(map[string]string{"LSB_MODE": "mock"}); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "mode": "mock"})
}

func handleSetupConfigureMSSQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var config setupDBConfig
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&config); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid connection settings"})
		return
	}
	if config.Port == 0 {
		config.Port = 1433
	}
	database, err := openSQLServer(config)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer database.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := updateConfigEnv(map[string]string{
		"LSB_DB_SERVER": config.Server, "LSB_DB_PORT": strconv.Itoa(config.Port),
		"LSB_DB_NAME": config.Database, "LSB_DB_USER": config.Username, "LSB_DB_PASSWORD": config.Password,
	}); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "message": fmt.Sprintf("Connected to %s on %s", config.Database, config.Server)})
}

func handleSetupConfigurePostgres(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if strings.TrimSpace(os.Getenv("LSB_DB_SERVER")) == "" {
		jsonResponse(w, http.StatusConflict, map[string]any{"ok": false, "error": "configure MSSQL connection first (Step 1)"})
		return
	}

	var body setupPostgresConfig
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid connection settings"})
		return
	}
	if body.Port == 0 {
		body.Port = 5432
	}
	if strings.TrimSpace(body.Host) == "" || strings.TrimSpace(body.Database) == "" || strings.TrimSpace(body.Username) == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "host, database, and username are required"})
		return
	}
	if body.Port <= 0 || body.Port > 65535 {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "port must be between 1 and 65535"})
		return
	}

	dsn := fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=disable",
		body.Host, body.Port, body.Database, body.Username, body.Password)
	pgDB, err := sql.Open("postgres", dsn)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer pgDB.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if err := pgDB.PingContext(ctx); err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := ensurePostgresSchema(ctx, pgDB); err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": "connected but schema creation failed: " + err.Error()})
		return
	}

	if err := updateConfigEnv(map[string]string{
		"DB_HOST": body.Host,
		"DB_PORT": strconv.Itoa(body.Port),
		"DB_NAME": body.Database,
		"DB_USER": body.Username,
		"DB_PASS": body.Password,
	}); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := updateConfigEnv(map[string]string{"LSB_MODE": "production"}); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	db.Connect()
	jsonResponse(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": fmt.Sprintf("Connected to %s on %s. Schema ready. Production mode enabled.", body.Database, body.Host),
	})
}

func ensurePostgresSchema(ctx context.Context, database *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS production_log (
			id BIGSERIAL PRIMARY KEY,
			resource_id VARCHAR(50) NOT NULL,
			shift_num INT NOT NULL,
			event_ts TIMESTAMPTZ NOT NULL,
			part_number VARCHAR(100),
			operator_name VARCHAR(100),
			good_count INT NOT NULL DEFAULT 0,
			scrap_count INT NOT NULL DEFAULT 0,
			cycle_time_sec NUMERIC(10,2),
			notes TEXT,
			confirmed BOOLEAN NOT NULL DEFAULT FALSE,
			confirmed_by VARCHAR(100),
			confirmed_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_production_log_resource_shift_event
			ON production_log (resource_id, shift_num, event_ts)`,
		`CREATE TABLE IF NOT EXISTS issues (
			id BIGSERIAL PRIMARY KEY,
			resource_id VARCHAR(50) NOT NULL,
			issue_type VARCHAR(100),
			severity VARCHAR(20) NOT NULL DEFAULT 'minor',
			description TEXT,
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			raised_by VARCHAR(100),
			acknowledged_by VARCHAR(100),
			raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_issues_resource_status_raised
			ON issues (resource_id, status, raised_at)`,
		`CREATE TABLE IF NOT EXISTS oee_entries (
			id BIGSERIAL PRIMARY KEY,
			entry_date DATE NOT NULL,
			shift INT NOT NULL,
			cell VARCHAR(100) NOT NULL,
			part_number VARCHAR(100),
			tool_dt_min INT NOT NULL DEFAULT 0,
			top_tool_issue VARCHAR(500),
			maint_dt_min INT NOT NULL DEFAULT 0,
			top_maint_issue VARCHAR(500),
			prod_dt_min INT NOT NULL DEFAULT 0,
			top_prod_issue VARCHAR(500),
			parts_reported INT NOT NULL DEFAULT 0,
			target_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0,
			actual_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0,
			scrap INT NOT NULL DEFAULT 0,
			rework INT NOT NULL DEFAULT 0,
			availability_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			performance_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			quality_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			oee_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_oee_entries_date_shift_cell
			ON oee_entries (entry_date, shift, cell)`,
		`CREATE TABLE IF NOT EXISTS oee_anomalies (
  id           SERIAL PRIMARY KEY,
  station      TEXT NOT NULL,
  oee_value    NUMERIC(5,2),
  mean_value   NUMERIC(5,2),
  std_dev      NUMERIC(5,2),
  deviation    NUMERIC(5,2),
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  llm_explanation TEXT
)`,
	}
	for _, statement := range statements {
		if _, err := database.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func odbcValue(value string) string { return "{" + strings.ReplaceAll(value, "}", "}}") + "}" }

func odbcConnection(config setupDBConfig) string {
	return fmt.Sprintf("DRIVER={ODBC Driver 18 for SQL Server};SERVER=%s,%d;DATABASE=%s;UID=%s;PWD=%s;Encrypt=yes;TrustServerCertificate=yes",
		config.Server, config.Port, odbcValue(config.Database), odbcValue(config.Username), odbcValue(config.Password))
}

func importScriptPath() (string, error) {
	for _, candidate := range []string{filepath.Join("scripts", "import_excel.py"), filepath.Join("..", "scripts", "import_excel.py")} {
		absolute, _ := filepath.Abs(candidate)
		if _, err := os.Stat(absolute); err == nil {
			return absolute, nil
		}
	}
	return "", fmt.Errorf("scripts/import_excel.py was not found")
}

func handleSetupImportExcel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if appMode() != "production" {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "configure a production database first"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid or oversized upload"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil || !strings.EqualFold(filepath.Ext(header.Filename), ".xlsx") {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "an .xlsx file is required"})
		return
	}
	defer file.Close()
	if header.Size == 0 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "uploaded file is empty"})
		return
	}

	remoteIP := r.RemoteAddr
	if host, _, splitErr := net.SplitHostPort(r.RemoteAddr); splitErr == nil {
		remoteIP = host
	}
	now := time.Now()
	cutoff := now.Add(-time.Minute)
	importRateLimit.mu.Lock()
	recent := importRateLimit.counts[remoteIP][:0]
	for _, requestedAt := range importRateLimit.counts[remoteIP] {
		if requestedAt.After(cutoff) {
			recent = append(recent, requestedAt)
		}
	}
	recent = append(recent, now)
	importRateLimit.counts[remoteIP] = recent
	tooManyRequests := len(recent) > 3
	importRateLimit.mu.Unlock()
	if tooManyRequests {
		jsonResponse(w, http.StatusTooManyRequests, map[string]string{"error": "too many import requests — wait one minute"})
		return
	}

	temp, err := os.CreateTemp("", "lsb-oee-*.xlsx")
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	path := temp.Name()
	defer os.Remove(path)
	if _, err := io.Copy(temp, file); err != nil {
		temp.Close()
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_ = temp.Close()
	script, err := importScriptPath()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, envOr("LSB_PYTHON", "python"), script, path, odbcConnection(currentDBConfig()))
	var stderr bytes.Buffer
	command.Stderr = &stderr
	stdout, err := command.Output()
	if err != nil {
		message := strings.TrimSpace(stderr.String())
		if json.Valid(stdout) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write(stdout)
			return
		}
		if message == "" {
			message = err.Error()
		}
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": message})
		return
	}
	if !json.Valid(stdout) {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Excel importer returned invalid JSON"})
		return
	}
	slog.Info("Excel import completed", "file_name", header.Filename, "remote_addr", r.RemoteAddr)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(stdout)
}

func handleOEEEntries(w http.ResponseWriter, r *http.Request) {
	if appMode() != "production" {
		if r.Method == http.MethodGet {
			jsonResponse(w, http.StatusOK, []any{})
			return
		}
		if r.Method == http.MethodPost {
			jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "id": 0})
			return
		}
	}
	database := db.Pool
	if database == nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "PostgreSQL connection is not initialized"})
		return
	}
	if r.Method == http.MethodGet {
		rows, err := database.QueryContext(r.Context(), `SELECT id, entry_date::TEXT, shift, COALESCE(cell,''), COALESCE(part_number,''), COALESCE(tool_dt_min,0), COALESCE(top_tool_issue,''), COALESCE(maint_dt_min,0), COALESCE(top_maint_issue,''), COALESCE(prod_dt_min,0), COALESCE(top_prod_issue,''), COALESCE(parts_reported,0), COALESCE(target_cycle_sec,0), COALESCE(actual_cycle_sec,0), COALESCE(scrap,0), COALESCE(rework,0), COALESCE(availability_pct,0), COALESCE(performance_pct,0), COALESCE(quality_pct,0), COALESCE(oee_pct,0) FROM oee_entries ORDER BY entry_date DESC, shift DESC, id DESC`)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		entries := make([]map[string]any, 0)
		for rows.Next() {
			var id int64
			var date, cell, part, toolIssue, maintIssue, prodIssue string
			var shift, toolDT, maintDT, prodDT, parts, scrap, rework int
			var targetCycle, actualCycle, availability, performance, quality, oee float64
			if err := rows.Scan(&id, &date, &shift, &cell, &part, &toolDT, &toolIssue, &maintDT, &maintIssue, &prodDT, &prodIssue, &parts, &targetCycle, &actualCycle, &scrap, &rework, &availability, &performance, &quality, &oee); err != nil {
				jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			entries = append(entries, map[string]any{"id": id, "date": date, "shift": strconv.Itoa(shift), "cell": cell, "partNumber": part, "toolDT": toolDT, "topToolIssue": toolIssue, "maintDT": maintDT, "topMaintIssue": maintIssue, "prodDT": prodDT, "topProdIssue": prodIssue, "partsReported": parts, "targetCycleTime": targetCycle, "actualCycleTime": actualCycle, "scrap": scrap, "rework": rework, "availability": availability, "performance": performance, "quality": quality, "oee": oee, "synced": true})
		}
		if err := rows.Err(); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, entries)
		return
	}
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var entry map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&entry); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid OEE entry"})
		return
	}
	var id int64
	err := database.QueryRowContext(r.Context(), `INSERT INTO oee_entries (entry_date,shift,cell,part_number,tool_dt_min,top_tool_issue,maint_dt_min,top_maint_issue,prod_dt_min,top_prod_issue,parts_reported,target_cycle_sec,actual_cycle_sec,scrap,rework,availability_pct,performance_pct,quality_pct,oee_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
		text(entry["date"]), integer(entry["shift"]), text(entry["cell"]), text(entry["partNumber"]), integer(entry["toolDT"]), text(entry["topToolIssue"]), integer(entry["maintDT"]), text(entry["topMaintIssue"]), integer(entry["prodDT"]), text(entry["topProdIssue"]), integer(entry["partsReported"]), decimal(entry["targetCycleTime"]), decimal(entry["actualCycleTime"]), integer(entry["scrap"]), integer(entry["rework"]), decimal(entry["availability"]), decimal(entry["performance"]), decimal(entry["quality"]), decimal(entry["oee"])).Scan(&id)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	slog.Info("OEE entry written",
		"cell", text(entry["cell"]),
		"shift", integer(entry["shift"]),
		"date", text(entry["date"]),
		"id", id,
	)
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}
func text(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}
func integer(value any) int {
	result, _ := strconv.Atoi(strings.TrimSpace(text(value)))
	return result
}
func decimal(value any) float64 {
	result, _ := strconv.ParseFloat(strings.TrimSpace(text(value)), 64)
	return result
}
