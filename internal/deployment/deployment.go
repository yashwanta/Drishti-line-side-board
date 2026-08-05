package deployment

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/denisenkom/go-mssqldb"
)

const Version = "2.0"

type DBConfig struct {
	Server   string `json:"server"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func Mode() string {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("LSB_MODE")))
	if mode == "" {
		return "unconfigured"
	}
	return mode
}

func ConfigPath() string {
	candidates := []string{
		filepath.Join("config", ".env"),
		filepath.Join("..", "config", ".env"),
	}
	if executable, err := os.Executable(); err == nil {
		dir := filepath.Dir(executable)
		candidates = append(candidates,
			filepath.Join(dir, "config", ".env"),
			filepath.Join(dir, "..", "config", ".env"),
		)
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return filepath.Join("config", ".env")
}

func EnsureAndLoadEnv() (string, error) {
	path := ConfigPath()
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		example := strings.TrimSuffix(path, ".env") + ".env.example"
		data, readErr := os.ReadFile(example)
		if readErr != nil {
			return path, fmt.Errorf("read %s: %w", example, readErr)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return path, err
		}
		if err := os.WriteFile(path, data, 0o600); err != nil {
			return path, err
		}
	}
	return path, LoadEnvFile(path)
}

func LoadEnvFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
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
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if key != "" {
			if err := os.Setenv(key, value); err != nil {
				return err
			}
		}
	}
	return nil
}

func UpdateEnv(path string, updates map[string]string) error {
	values := make(map[string]string)
	order := make([]string, 0)
	if data, err := os.ReadFile(path); err == nil {
		for _, line := range strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n") {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" || strings.HasPrefix(trimmed, "#") {
				continue
			}
			key, value, ok := strings.Cut(trimmed, "=")
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
	if len(order) == 0 {
		for key := range values {
			order = append(order, key)
		}
		sort.Strings(order)
	}
	var output strings.Builder
	output.WriteString("# Drishti Line Side Board runtime configuration\n")
	for _, key := range order {
		output.WriteString(key)
		output.WriteByte('=')
		output.WriteString(values[key])
		output.WriteByte('\n')
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

func CurrentDBConfig() DBConfig {
	port, _ := strconv.Atoi(os.Getenv("LSB_DB_PORT"))
	if port == 0 {
		port = 1433
	}
	return DBConfig{
		Server:   strings.TrimSpace(os.Getenv("LSB_DB_SERVER")),
		Port:     port,
		Database: strings.TrimSpace(os.Getenv("LSB_DB_NAME")),
		Username: strings.TrimSpace(os.Getenv("LSB_DB_USER")),
		Password: os.Getenv("LSB_DB_PASSWORD"),
	}
}

func validateDBConfig(config DBConfig) error {
	if config.Server == "" || config.Database == "" || config.Username == "" {
		return errors.New("server, database, and username are required")
	}
	if config.Port <= 0 || config.Port > 65535 {
		return errors.New("port must be between 1 and 65535")
	}
	return nil
}

func sqlServerURL(config DBConfig) string {
	target := &url.URL{
		Scheme: "sqlserver",
		User:   url.UserPassword(config.Username, config.Password),
		Host:   fmt.Sprintf("%s:%d", config.Server, config.Port),
	}
	query := target.Query()
	query.Set("database", config.Database)
	query.Set("encrypt", envDefault("LSB_DB_ENCRYPT", "true"))
	query.Set("TrustServerCertificate", envDefault("LSB_DB_TRUST_SERVER_CERTIFICATE", "true"))
	target.RawQuery = query.Encode()
	return target.String()
}

func openSQLServer(config DBConfig) (*sql.DB, error) {
	if err := validateDBConfig(config); err != nil {
		return nil, err
	}
	return sql.Open("sqlserver", sqlServerURL(config))
}

func envDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func HandleDemo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := UpdateEnv(ConfigPath(), map[string]string{"LSB_MODE": "mock"}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mode": "mock"})
}

func HandleTestConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var config DBConfig
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&config); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid connection settings"})
		return
	}
	if config.Port == 0 {
		config.Port = 1433
	}
	database, err := openSQLServer(config)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer database.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := ensureOEESchema(ctx, database); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": "connected, but could not initialize OEE storage: " + err.Error()})
		return
	}
	updates := map[string]string{
		"LSB_MODE":        "production",
		"LSB_DB_SERVER":   config.Server,
		"LSB_DB_PORT":     strconv.Itoa(config.Port),
		"LSB_DB_NAME":     config.Database,
		"LSB_DB_USER":     config.Username,
		"LSB_DB_PASSWORD": config.Password,
	}
	if err := UpdateEnv(ConfigPath(), updates); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "message": fmt.Sprintf("Connected to %s on %s", config.Database, config.Server),
	})
}

func HandleImportExcel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if Mode() != "production" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "configure a production database first"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid or oversized upload"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "xlsx file is required"})
		return
	}
	defer file.Close()
	if !strings.EqualFold(filepath.Ext(header.Filename), ".xlsx") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "only .xlsx files are accepted"})
		return
	}
	temp, err := os.CreateTemp("", "lsb-oee-*.xlsx")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err := io.Copy(temp, file); err != nil {
		temp.Close()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := temp.Close(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	script, err := resolveProjectFile(filepath.Join("scripts", "import_excel.py"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	python := envDefault("LSB_PYTHON", "python")
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, python, script, tempPath, odbcConnectionString(CurrentDBConfig()))
	var stderr bytes.Buffer
	command.Stderr = &stderr
	stdout, err := command.Output()
	if err != nil {
		if json.Valid(stdout) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write(stdout)
			return
		}
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": message})
		return
	}
	if !json.Valid(stdout) {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Excel importer returned invalid JSON"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(stdout)
}

func resolveProjectFile(relative string) (string, error) {
	candidates := []string{relative, filepath.Join("..", relative)}
	if executable, err := os.Executable(); err == nil {
		dir := filepath.Dir(executable)
		candidates = append(candidates, filepath.Join(dir, relative), filepath.Join(dir, "..", relative))
	}
	for _, candidate := range candidates {
		if absolute, err := filepath.Abs(candidate); err == nil {
			if _, err := os.Stat(absolute); err == nil {
				return absolute, nil
			}
		}
	}
	return "", fmt.Errorf("%s was not found", relative)
}

func odbcValue(value string) string {
	return "{" + strings.ReplaceAll(value, "}", "}}") + "}"
}

func odbcConnectionString(config DBConfig) string {
	return fmt.Sprintf(
		"DRIVER={ODBC Driver 18 for SQL Server};SERVER=%s,%d;DATABASE=%s;UID=%s;PWD=%s;Encrypt=yes;TrustServerCertificate=yes",
		config.Server, config.Port, odbcValue(config.Database), odbcValue(config.Username), odbcValue(config.Password),
	)
}

func HandleOEEEntries(w http.ResponseWriter, r *http.Request) {
	if Mode() != "production" {
		if r.Method == http.MethodGet {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		if r.Method == http.MethodPost {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": 0})
			return
		}
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	database, err := openSQLServer(CurrentDBConfig())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer database.Close()
	if r.Method == http.MethodGet {
		handleGetOEEEntries(w, r, database)
		return
	}
	handleSaveOEEEntry(w, r, database)
}

type shiftNotePayload struct {
	ResourceID string `json:"resource_id"`
	Shift      int    `json:"shift"`
	Date       string `json:"date"`
	Text       string `json:"text"`
	Category   string `json:"category"`
}

// HandleNotes requires this SQL Server table:
//
//	CREATE TABLE shift_notes (
//	    id          INT IDENTITY PRIMARY KEY,
//	    resource_id VARCHAR(20),
//	    shift       INT,
//	    note_date   DATE,
//	    category    VARCHAR(50),
//	    note_text   VARCHAR(1000),
//	    created_at  DATETIME DEFAULT GETDATE()
//	);
func HandleNotes(w http.ResponseWriter, r *http.Request) {
	if Mode() != "production" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "production database mode is required"})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	database, err := openSQLServer(CurrentDBConfig())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer database.Close()

	if r.Method == http.MethodGet {
		handleGetNotes(w, r, database)
		return
	}
	handlePostNote(w, r, database)
}

func handleGetNotes(w http.ResponseWriter, r *http.Request, database *sql.DB) {
	resource := strings.TrimSpace(r.URL.Query().Get("resource"))
	shift, err := strconv.Atoi(r.URL.Query().Get("shift"))
	date := strings.TrimSpace(r.URL.Query().Get("date"))
	if resource == "" || shift <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "resource and shift are required"})
		return
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date must use YYYY-MM-DD"})
		return
	}
	rows, err := database.QueryContext(r.Context(), `
		SELECT id, resource_id, shift, CONVERT(varchar(10), note_date, 23),
		       COALESCE(category, 'General'), note_text, created_at
		FROM shift_notes
		WHERE resource_id = @p1 AND shift = @p2 AND note_date = @p3
		ORDER BY created_at DESC, id DESC`, resource, shift, date)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	notes := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var resourceID, noteDate, category, noteText string
		var noteShift int
		var createdAt time.Time
		if err := rows.Scan(&id, &resourceID, &noteShift, &noteDate, &category, &noteText, &createdAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		notes = append(notes, map[string]any{
			"id": id, "resource_id": resourceID, "shift": noteShift, "date": noteDate,
			"category": category, "text": noteText, "created_at": createdAt.Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, notes)
}

func handlePostNote(w http.ResponseWriter, r *http.Request, database *sql.DB) {
	var payload shiftNotePayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid note"})
		return
	}
	payload.ResourceID = strings.TrimSpace(payload.ResourceID)
	payload.Text = strings.TrimSpace(payload.Text)
	payload.Category = strings.TrimSpace(payload.Category)
	if payload.Category == "" {
		payload.Category = "General"
	}
	if payload.ResourceID == "" || payload.Shift <= 0 || payload.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "resource_id, shift, and text are required"})
		return
	}
	if _, err := time.Parse("2006-01-02", payload.Date); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date must use YYYY-MM-DD"})
		return
	}
	if len(payload.ResourceID) > 20 || len(payload.Category) > 50 || len(payload.Text) > 1000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "note exceeds database field limits"})
		return
	}
	var id int64
	err := database.QueryRowContext(r.Context(), `
		INSERT INTO shift_notes (resource_id, shift, note_date, category, note_text)
		OUTPUT INSERTED.id
		VALUES (@p1, @p2, @p3, @p4, @p5)`,
		payload.ResourceID, payload.Shift, payload.Date, payload.Category, payload.Text,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func ensureOEESchema(ctx context.Context, database *sql.DB) error {
	_, err := database.ExecContext(ctx, `
		IF OBJECT_ID('dbo.oee_entries', 'U') IS NULL
		BEGIN
			CREATE TABLE dbo.oee_entries (
				id BIGINT IDENTITY(1,1) PRIMARY KEY,
				entry_date DATE NOT NULL,
				shift INT NOT NULL,
				cell NVARCHAR(100) NOT NULL,
				part_number NVARCHAR(100) NULL,
				tool_dt_min INT NOT NULL DEFAULT 0,
				top_tool_issue NVARCHAR(500) NULL,
				maint_dt_min INT NOT NULL DEFAULT 0,
				top_maint_issue NVARCHAR(500) NULL,
				prod_dt_min INT NOT NULL DEFAULT 0,
				top_prod_issue NVARCHAR(500) NULL,
				parts_reported INT NOT NULL DEFAULT 0,
				target_cycle_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
				actual_cycle_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
				scrap INT NOT NULL DEFAULT 0,
				rework INT NOT NULL DEFAULT 0,
				availability_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
				performance_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
				quality_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
				oee_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
				created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
			)
		END`)
	return err
}

func handleGetOEEEntries(w http.ResponseWriter, r *http.Request, database *sql.DB) {
	rows, err := database.QueryContext(r.Context(), `
		SELECT id, CONVERT(varchar(10), entry_date, 23), shift, COALESCE(cell, ''),
		       COALESCE(part_number, ''), COALESCE(tool_dt_min, 0), COALESCE(top_tool_issue, ''),
		       COALESCE(maint_dt_min, 0), COALESCE(top_maint_issue, ''), COALESCE(prod_dt_min, 0),
		       COALESCE(top_prod_issue, ''), COALESCE(parts_reported, 0), COALESCE(target_cycle_sec, 0),
		       COALESCE(actual_cycle_sec, 0), COALESCE(scrap, 0), COALESCE(rework, 0),
		       COALESCE(availability_pct, 0), COALESCE(performance_pct, 0),
		       COALESCE(quality_pct, 0), COALESCE(oee_pct, 0)
		FROM oee_entries ORDER BY entry_date DESC, shift DESC, id DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	entries := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var date, cell, part, topTool, topMaint, topProd string
		var shift, toolDT, maintDT, prodDT, parts, scrap, rework int
		var targetCycle, actualCycle, availability, performance, quality, oee float64
		if err := rows.Scan(&id, &date, &shift, &cell, &part, &toolDT, &topTool, &maintDT, &topMaint, &prodDT, &topProd, &parts, &targetCycle, &actualCycle, &scrap, &rework, &availability, &performance, &quality, &oee); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		entries = append(entries, map[string]any{
			"id": id, "date": date, "shift": strconv.Itoa(shift), "cell": cell, "partNumber": part,
			"toolDT": toolDT, "topToolIssue": topTool, "maintDT": maintDT, "topMaintIssue": topMaint,
			"prodDT": prodDT, "topProdIssue": topProd, "partsReported": parts,
			"targetCycleTime": targetCycle, "actualCycleTime": actualCycle, "scrap": scrap, "rework": rework,
			"availability": availability, "performance": performance, "quality": quality, "oee": oee, "synced": true,
		})
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func handleSaveOEEEntry(w http.ResponseWriter, r *http.Request, database *sql.DB) {
	var entry map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&entry); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid OEE entry"})
		return
	}
	var id int64
	err := database.QueryRowContext(r.Context(), `
		INSERT INTO oee_entries (
			entry_date, shift, cell, part_number, tool_dt_min, top_tool_issue,
			maint_dt_min, top_maint_issue, prod_dt_min, top_prod_issue,
			parts_reported, target_cycle_sec, actual_cycle_sec, scrap, rework,
			availability_pct, performance_pct, quality_pct, oee_pct
		) VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, @p15, @p16, @p17, @p18, @p19);
		SELECT CONVERT(bigint, SCOPE_IDENTITY());`,
		stringValue(entry["date"]), intValue(entry["shift"]), stringValue(entry["cell"]), stringValue(entry["partNumber"]),
		intValue(entry["toolDT"]), stringValue(entry["topToolIssue"]), intValue(entry["maintDT"]), stringValue(entry["topMaintIssue"]),
		intValue(entry["prodDT"]), stringValue(entry["topProdIssue"]), intValue(entry["partsReported"]), floatValue(entry["targetCycleTime"]),
		floatValue(entry["actualCycleTime"]), intValue(entry["scrap"]), intValue(entry["rework"]), floatValue(entry["availability"]),
		floatValue(entry["performance"]), floatValue(entry["quality"]), floatValue(entry["oee"]),
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}

func intValue(value any) int {
	parsed, _ := strconv.Atoi(strings.TrimSpace(stringValue(value)))
	return parsed
}

func floatValue(value any) float64 {
	parsed, _ := strconv.ParseFloat(strings.TrimSpace(stringValue(value)), 64)
	return parsed
}

func HealthPayload(mode string) map[string]any {
	if mode == "production" {
		return map[string]any{"status": "ok", "mode": "production", "db": os.Getenv("LSB_DB_NAME"), "version": Version}
	}
	if mode == "unconfigured" {
		return map[string]any{"status": "unconfigured", "mode": "unconfigured", "version": Version}
	}
	return map[string]any{"status": "ok", "mode": "mock", "version": Version}
}
