package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/denisenkom/go-mssqldb"
)

type setupDBConfig struct {
	Server   string `json:"server"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
}

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

func handleSetupTestConnection(w http.ResponseWriter, r *http.Request) {
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
	if err := ensureSetupOEESchema(ctx, database); err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": "connected, but could not initialize OEE storage: " + err.Error()})
		return
	}
	if err := updateConfigEnv(map[string]string{
		"LSB_MODE": "production", "LSB_DB_SERVER": config.Server, "LSB_DB_PORT": strconv.Itoa(config.Port),
		"LSB_DB_NAME": config.Database, "LSB_DB_USER": config.Username, "LSB_DB_PASSWORD": config.Password,
	}); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "message": fmt.Sprintf("Connected to %s on %s", config.Database, config.Server)})
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
	database, err := openSQLServer(currentDBConfig())
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer database.Close()
	if r.Method == http.MethodGet {
		rows, err := database.QueryContext(r.Context(), `SELECT id, CONVERT(varchar(10), entry_date, 23), shift, COALESCE(cell,''), COALESCE(part_number,''), COALESCE(tool_dt_min,0), COALESCE(top_tool_issue,''), COALESCE(maint_dt_min,0), COALESCE(top_maint_issue,''), COALESCE(prod_dt_min,0), COALESCE(top_prod_issue,''), COALESCE(parts_reported,0), COALESCE(target_cycle_sec,0), COALESCE(actual_cycle_sec,0), COALESCE(scrap,0), COALESCE(rework,0), COALESCE(availability_pct,0), COALESCE(performance_pct,0), COALESCE(quality_pct,0), COALESCE(oee_pct,0) FROM oee_entries ORDER BY entry_date DESC, shift DESC, id DESC`)
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
	err = database.QueryRowContext(r.Context(), `INSERT INTO oee_entries (entry_date,shift,cell,part_number,tool_dt_min,top_tool_issue,maint_dt_min,top_maint_issue,prod_dt_min,top_prod_issue,parts_reported,target_cycle_sec,actual_cycle_sec,scrap,rework,availability_pct,performance_pct,quality_pct,oee_pct) VALUES (@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14,@p15,@p16,@p17,@p18,@p19); SELECT CONVERT(bigint, SCOPE_IDENTITY());`,
		text(entry["date"]), integer(entry["shift"]), text(entry["cell"]), text(entry["partNumber"]), integer(entry["toolDT"]), text(entry["topToolIssue"]), integer(entry["maintDT"]), text(entry["topMaintIssue"]), integer(entry["prodDT"]), text(entry["topProdIssue"]), integer(entry["partsReported"]), decimal(entry["targetCycleTime"]), decimal(entry["actualCycleTime"]), integer(entry["scrap"]), integer(entry["rework"]), decimal(entry["availability"]), decimal(entry["performance"]), decimal(entry["quality"]), decimal(entry["oee"])).Scan(&id)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func ensureSetupOEESchema(ctx context.Context, database *sql.DB) error {
	_, err := database.ExecContext(ctx, `IF OBJECT_ID('dbo.oee_entries', 'U') IS NULL BEGIN CREATE TABLE dbo.oee_entries (id BIGINT IDENTITY(1,1) PRIMARY KEY, entry_date DATE NOT NULL, shift INT NOT NULL, cell NVARCHAR(100) NOT NULL, part_number NVARCHAR(100) NULL, tool_dt_min INT NOT NULL DEFAULT 0, top_tool_issue NVARCHAR(500) NULL, maint_dt_min INT NOT NULL DEFAULT 0, top_maint_issue NVARCHAR(500) NULL, prod_dt_min INT NOT NULL DEFAULT 0, top_prod_issue NVARCHAR(500) NULL, parts_reported INT NOT NULL DEFAULT 0, target_cycle_sec DECIMAL(12,3) NOT NULL DEFAULT 0, actual_cycle_sec DECIMAL(12,3) NOT NULL DEFAULT 0, scrap INT NOT NULL DEFAULT 0, rework INT NOT NULL DEFAULT 0, availability_pct DECIMAL(8,3) NOT NULL DEFAULT 0, performance_pct DECIMAL(8,3) NOT NULL DEFAULT 0, quality_pct DECIMAL(8,3) NOT NULL DEFAULT 0, oee_pct DECIMAL(8,3) NOT NULL DEFAULT 0, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()) END`)
	return err
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
