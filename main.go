package main

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   LINE SIDE BOARD — MES API Server (Go)                                 ║
// ║   Database : mesdb  on  MES-PostgreSQL                                  ║
// ║   DB User  : mesapp                                                     ║
// ║   Prepared by: Yashwanta Thakur                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// ── Exact schema used ────────────────────────────────────────────────────────
//
//   production_log
//   ┌────────────────────┬──────────────────────────┐
//   │ id                 │ bigint PK                │
//   │ event_ts           │ timestamptz  DEFAULT now()│
//   │ resource_id        │ text NOT NULL            │
//   │ part_number        │ text NOT NULL            │
//   │ operator_name      │ text                     │
//   │ shift_number       │ integer NOT NULL         │
//   │ good_count         │ integer DEFAULT 0        │
//   │ scrap_count        │ integer DEFAULT 0        │
//   │ cycle_time_seconds │ numeric                  │
//   │ notes              │ text                     │
//   │ confirmed_by       │ text  ← added on startup │
//   │ confirmed_at       │ timestamptz ← added too  │
//   └────────────────────┴──────────────────────────┘
//
//   downtime_log
//   ┌───────────────┬─────────────────────────────────┐
//   │ id            │ bigint PK                       │
//   │ start_ts      │ timestamptz NOT NULL            │
//   │ end_ts        │ timestamptz  (nullable = open)  │
//   │ resource_id   │ text NOT NULL                   │
//   │ reason_code   │ text NOT NULL                   │
//   │ reason_detail │ text                            │
//   │ operator_name │ text                            │
//   └───────────────┴─────────────────────────────────┘
//
//   open_issues
//   ┌─────────────────┬──────────────────────────────────┐
//   │ id              │ bigint PK                        │
//   │ created_ts      │ timestamptz DEFAULT now()        │
//   │ status          │ text DEFAULT 'open'              │
//   │ severity        │ text DEFAULT 'medium'            │
//   │ resource_id     │ text NOT NULL                    │
//   │ issue_type      │ text NOT NULL                    │
//   │ description     │ text NOT NULL                    │
//   │ acknowledged_by │ text                             │
//   │ closed_ts       │ timestamptz                      │
//   └─────────────────┴──────────────────────────────────┘
//
// ── Build & run ───────────────────────────────────────────────────────────────
//   go mod tidy
//   go build -o lsb-api main.go
//   ./lsb-api
//
// ── Endpoints ─────────────────────────────────────────────────────────────────
//   GET  /api/health
//   GET  /api/production?resource=WM15&shift=2
//   GET  /api/kpis?resource=WM15&shift=2
//   GET  /api/productivity?resource=WM15&shift=2
//   GET  /api/issues?resource=WM15
//   GET  /api/downtime?resource=WM15
//   POST /api/confirm    {"resource":"WM15","hourStart":7,"operator":"Name"}
//   POST /api/downtime   {"resource":"WM15","code":"PM","minutes":15,"comment":"...","operator":"Name"}

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/joho/godotenv"
)

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIG  (all values come from .env)
// ═══════════════════════════════════════════════════════════════════════════════

type Config struct {
	// PostgreSQL
	DBHost  string
	DBPort  string
	DBName  string
	DBUser  string
	DBPass  string

	// HTTP server
	Port       string
	CORSSubnet string

	// MES / plant
	ResourceID   string
	PartNumber   string
	OperatorName string
	JPHTarget    int
	ShiftNum     int

	// Table names (keep defaults — they match your schema)
	ProdTable   string // production_log
	DTTable     string // downtime_log
	IssuesTable string // open_issues
}

var (
	cfg Config
	db  *sql.DB
)

func loadConfig() Config {
	_ = godotenv.Load(".env")

	str := func(k, d string) string {
		if v := os.Getenv(k); v != "" {
			return v
		}
		return d
	}
	num := func(k string, d int) int {
		if v := os.Getenv(k); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				return n
			}
		}
		return d
	}

	return Config{
		DBHost:       str("DB_HOST",       "127.0.0.1"),
		DBPort:       str("DB_PORT",       "5432"),
		DBName:       str("DB_NAME",       "mesdb"),
		DBUser:       str("DB_USER",       "mesapp"),
		DBPass:       str("DB_PASS",       ""),
		Port:         str("PORT",          "3001"),
		CORSSubnet:   str("CORS_SUBNET",   "192.168.1.0"),
		ResourceID:   str("RESOURCE_ID",   "WM15"),
		PartNumber:   str("PART_NUMBER",   "BMW1000D-360"),
		OperatorName: str("OPERATOR_NAME", "Yashwanta Thakur"),
		JPHTarget:    num("JPH_TARGET",    23),
		ShiftNum:     num("SHIFT_NUM",     2),
		ProdTable:    str("PROD_TABLE",    "production_log"),
		DTTable:      str("DT_TABLE",      "downtime_log"),
		IssuesTable:  str("ISSUES_TABLE",  "open_issues"),
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RESPONSE TYPES  (what LineSideBoard.jsx expects)
// ═══════════════════════════════════════════════════════════════════════════════

// ProductionRow — one entry per hour, aggregated from event_ts
type ProductionRow struct {
	HourStart    int     `json:"hour_start"`
	HourEnd      int     `json:"hour_end"`
	HourLabel    string  `json:"hour_label"`
	PartNumber   string  `json:"part_number"`
	OperatorName string  `json:"operator_name"`
	PlanAccum    int     `json:"plan_accum"`    // cumulative JPH target
	ActualAccum  int     `json:"actual_accum"`  // cumulative good_count
	GoodCount    int     `json:"good_count"`    // this hour only
	ScrapCount   int     `json:"scrap_count"`
	CycleTime    float64 `json:"avg_cycle_time_seconds"`
	PartsGap     int     `json:"parts_gap"`     // good - JPH for this hour
	Notes        string  `json:"notes"`
	ConfirmedBy  string  `json:"confirmed_by"`
}

// KPIRow — shift-level totals
type KPIRow struct {
	TotalActual    int     `json:"total_actual"`
	TotalPlan      int     `json:"total_plan"`
	TotalScrap     int     `json:"total_scrap"`
	TotalRework    int     `json:"total_rework"`        // schema has no rework → 0
	TotalEvents    int     `json:"total_events"`
	HoursWorked    int     `json:"hours_worked"`
	AvgCycle       float64 `json:"avg_cycle_time_seconds"`
	EfficiencyPct  string  `json:"efficiency_pct"`
	FirstPassYield string  `json:"first_pass_yield_pct"`
}

// ProductivityRow — hourly good_count vs JPH target (for bar chart)
type ProductivityRow struct {
	HourStart int    `json:"hour_start"`
	HourLabel string `json:"hour_label"`
	Actual    int    `json:"actual"`
	Target    int    `json:"target"`
}

// IssueRow — open_issues mapped: severity→priority, status capitalised
type IssueRow struct {
	ID             int    `json:"id"`
	Description    string `json:"description"`
	IssueType      string `json:"issue_type"`
	Priority       string `json:"priority"`        // from severity column
	Status         string `json:"status"`
	AcknowledgedBy string `json:"acknowledged_by"`
	CreatedAt      string `json:"created_at"`
}

// DowntimeRow — downtime_log with duration calculated from start_ts/end_ts
type DowntimeRow struct {
	ID           int    `json:"id"`
	StartTS      string `json:"start_ts"`
	EndTS        string `json:"end_ts"`
	DurationMin  int    `json:"duration_min"`
	ReasonCode   string `json:"reason_code"`
	ReasonDetail string `json:"reason_detail"`
	OperatorName string `json:"operator_name"`
	IsOpen       bool   `json:"is_open"`         // true when end_ts is NULL
}

// POST request bodies
type ConfirmRequest struct {
	Resource  string `json:"resource"`
	HourStart int    `json:"hourStart"`
	Operator  string `json:"operator"`
}

type DowntimeRequest struct {
	Resource string `json:"resource"`
	Code     string `json:"code"`
	Minutes  int    `json:"minutes"`
	Comment  string `json:"comment"`
	Operator string `json:"operator"`
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

func connectDB() (*sql.DB, error) {
	port, _ := strconv.Atoi(cfg.DBPort)
	if port == 0 {
		port = 5432
	}

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, port, cfg.DBUser, cfg.DBPass, cfg.DBName,
	)

	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf(
			"cannot reach PostgreSQL at %s:%d/%s as user '%s'\n  error: %w",
			cfg.DBHost, port, cfg.DBName, cfg.DBUser, err,
		)
	}
	return conn, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMA MIGRATION
//  Adds confirmed_by + confirmed_at to production_log if not already present.
//  Safe to run on every startup — uses IF NOT EXISTS checks.
// ═══════════════════════════════════════════════════════════════════════════════

func migrateSchema() {
	stmts := []struct{ name, sql string }{
		{
			"add confirmed_by to " + cfg.ProdTable,
			fmt.Sprintf(`
				DO $$ BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE  table_schema = 'public'
						AND    table_name   = '%s'
						AND    column_name  = 'confirmed_by'
					) THEN
						ALTER TABLE %s ADD COLUMN confirmed_by TEXT;
						RAISE NOTICE 'Column confirmed_by added to %s';
					END IF;
				END $$;`, cfg.ProdTable, cfg.ProdTable, cfg.ProdTable),
		},
		{
			"add confirmed_at to " + cfg.ProdTable,
			fmt.Sprintf(`
				DO $$ BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE  table_schema = 'public'
						AND    table_name   = '%s'
						AND    column_name  = 'confirmed_at'
					) THEN
						ALTER TABLE %s ADD COLUMN confirmed_at TIMESTAMPTZ;
						RAISE NOTICE 'Column confirmed_at added to %s';
					END IF;
				END $$;`, cfg.ProdTable, cfg.ProdTable, cfg.ProdTable),
		},
	}

	for _, m := range stmts {
		if _, err := db.Exec(m.sql); err != nil {
			log.Printf("[MIGRATE] %-45s  WARN: %v", m.name, err)
		} else {
			log.Printf("[MIGRATE] %-45s  OK", m.name)
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.Split(fwd, ",")[0]
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

func auditLog(action, detail, ip string) {
	log.Printf("[AUDIT] action=%-22s  ip=%-16s  %s", action, ip, detail)
}

func nullFloat64(n sql.NullFloat64) float64 {
	if n.Valid {
		return n.Float64
	}
	return 0
}

func nullString(n sql.NullString) string {
	if n.Valid {
		return n.String
	}
	return ""
}

func nullTime(n sql.NullTime) string {
	if n.Valid {
		return n.Time.Format(time.RFC3339)
	}
	return ""
}

// title converts "high" → "High", "MEDIUM" → "Medium"
func title(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/health
// ═══════════════════════════════════════════════════════════════════════════════

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := db.Ping(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"status":  "db_error",
			"message": err.Error(),
		})
		return
	}

	// Quick live query: count today's production events
	var todayCount int
	db.QueryRow(fmt.Sprintf(
		`SELECT COUNT(*) FROM %s WHERE event_ts::date = CURRENT_DATE`,
		cfg.ProdTable,
	)).Scan(&todayCount)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":              "ok",
		"server":              "LSB API (Go)",
		"db_driver":           "postgres",
		"db_host":             cfg.DBHost + ":" + cfg.DBPort,
		"db_name":             cfg.DBName,
		"db_user":             cfg.DBUser,
		"resource_id":         cfg.ResourceID,
		"jph_target":          cfg.JPHTarget,
		"shift":               cfg.ShiftNum,
		"today_events_in_db":  todayCount,
		"server_time":         time.Now().UTC().Format(time.RFC3339),
		"version":             "2.0.0",
		// Shows the board exactly how columns are mapped
		"column_map": map[string]string{
			"production_log.good_count":    "→ board: actual_accum / good_count",
			"production_log.scrap_count":   "→ board: scrap_count",
			"production_log.event_ts":      "→ board: grouped by EXTRACT(HOUR)",
			"production_log.cycle_time_seconds": "→ board: avg_cycle_time_seconds",
			"downtime_log.reason_code":     "→ board: reason_code / code",
			"downtime_log.start_ts/end_ts": "→ board: duration_min (calculated)",
			"open_issues.severity":         "→ board: priority (capitalised)",
			"open_issues.status":           "→ board: status (capitalised)",
		},
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/production
//
//  Groups production_log by EXTRACT(HOUR FROM event_ts) for today.
//  Builds cumulative plan_accum and actual_accum across hours.
//
//  Query params:
//    resource  (default: RESOURCE_ID from .env)
//    shift     (default: SHIFT_NUM from .env)
// ═══════════════════════════════════════════════════════════════════════════════

func handleProduction(w http.ResponseWriter, r *http.Request) {
	resource := firstOf(r.URL.Query().Get("resource"), cfg.ResourceID)
	shift    := intOrDefault(r.URL.Query().Get("shift"), cfg.ShiftNum)

	rows, err := db.Query(fmt.Sprintf(`
		SELECT
			EXTRACT(HOUR FROM event_ts)::INTEGER             AS hr,
			COALESCE(MAX(part_number),        $1)            AS part_number,
			COALESCE(MAX(operator_name),      '')            AS operator_name,
			COALESCE(SUM(good_count),         0)::INTEGER    AS good_this_hour,
			COALESCE(SUM(scrap_count),        0)::INTEGER    AS scrap_this_hour,
			COALESCE(AVG(cycle_time_seconds), 0.0)           AS avg_cycle,
			COALESCE(STRING_AGG(DISTINCT notes, ' | ')
			         FILTER (WHERE notes IS NOT NULL), '')   AS notes,
			COALESCE(MAX(confirmed_by),       '')            AS confirmed_by
		FROM %s
		WHERE resource_id  = $2
		  AND shift_number = $3
		  AND event_ts::date = CURRENT_DATE
		GROUP BY EXTRACT(HOUR FROM event_ts)
		ORDER BY hr ASC`,
		cfg.ProdTable,
	), cfg.PartNumber, resource, shift)
	if err != nil {
		log.Printf("[ERROR] production query: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	// Collect raw per-hour data
	type rawHour struct {
		hr          int
		part        string
		operator    string
		good        int
		scrap       int
		avgCycle    sql.NullFloat64
		notes       string
		confirmedBy string
	}
	var hourData []rawHour

	for rows.Next() {
		var h rawHour
		if err := rows.Scan(
			&h.hr, &h.part, &h.operator,
			&h.good, &h.scrap,
			&h.avgCycle,
			&h.notes, &h.confirmedBy,
		); err != nil {
			log.Printf("[ERROR] production scan: %v", err)
			continue
		}
		hourData = append(hourData, h)
	}

	// Build response with cumulative totals
	jph       := cfg.JPHTarget
	cumActual := 0
	cumPlan   := 0
	var result []ProductionRow

	for _, h := range hourData {
		cumActual += h.good
		cumPlan   += jph

		result = append(result, ProductionRow{
			HourStart:    h.hr,
			HourEnd:      h.hr + 1,
			HourLabel:    fmt.Sprintf("%02d:00 – %02d:00", h.hr, h.hr+1),
			PartNumber:   h.part,
			OperatorName: h.operator,
			PlanAccum:    cumPlan,
			ActualAccum:  cumActual,
			GoodCount:    h.good,
			ScrapCount:   h.scrap,
			CycleTime:    nullFloat64(h.avgCycle),
			PartsGap:     h.good - jph,  // positive = ahead, negative = behind
			Notes:        h.notes,
			ConfirmedBy:  h.confirmedBy,
		})
	}
	if result == nil {
		result = []ProductionRow{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"resource":   resource,
		"shift":      shift,
		"jph_target": jph,
		"rows":       result,
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/kpis
// ═══════════════════════════════════════════════════════════════════════════════

func handleKPIs(w http.ResponseWriter, r *http.Request) {
	resource := firstOf(r.URL.Query().Get("resource"), cfg.ResourceID)
	shift    := intOrDefault(r.URL.Query().Get("shift"), cfg.ShiftNum)

	var totalGood, totalScrap, totalEvents, hoursWorked int
	var avgCycle sql.NullFloat64

	err := db.QueryRow(fmt.Sprintf(`
		SELECT
			COALESCE(SUM(good_count),         0)::INTEGER   AS total_good,
			COALESCE(SUM(scrap_count),        0)::INTEGER   AS total_scrap,
			COUNT(*)::INTEGER                               AS total_events,
			COALESCE(AVG(cycle_time_seconds), 0.0)          AS avg_cycle,
			COUNT(DISTINCT EXTRACT(HOUR FROM event_ts))
			  ::INTEGER                                     AS hours_worked
		FROM %s
		WHERE resource_id  = $1
		  AND shift_number = $2
		  AND event_ts::date = CURRENT_DATE`,
		cfg.ProdTable,
	), resource, shift).Scan(
		&totalGood, &totalScrap, &totalEvents, &avgCycle, &hoursWorked,
	)
	if err != nil {
		log.Printf("[ERROR] kpis: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	totalPlan := hoursWorked * cfg.JPHTarget
	if totalPlan == 0 {
		totalPlan = cfg.JPHTarget // avoid divide-by-zero when no data yet
	}

	efficiency := 0.0
	if totalPlan > 0 {
		efficiency = float64(totalGood) / float64(totalPlan) * 100
	}

	fpyPct := 100.0
	if total := totalGood + totalScrap; total > 0 {
		fpyPct = float64(totalGood) / float64(total) * 100
	}

	writeJSON(w, http.StatusOK, KPIRow{
		TotalActual:    totalGood,
		TotalPlan:      totalPlan,
		TotalScrap:     totalScrap,
		TotalRework:    0, // no rework column in schema
		TotalEvents:    totalEvents,
		HoursWorked:    hoursWorked,
		AvgCycle:       nullFloat64(avgCycle),
		EfficiencyPct:  fmt.Sprintf("%.1f", efficiency),
		FirstPassYield: fmt.Sprintf("%.1f", fpyPct),
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/productivity
//  Per-hour good_count vs JPH target — feeds the bar chart
// ═══════════════════════════════════════════════════════════════════════════════

func handleProductivity(w http.ResponseWriter, r *http.Request) {
	resource := firstOf(r.URL.Query().Get("resource"), cfg.ResourceID)
	shift    := intOrDefault(r.URL.Query().Get("shift"), cfg.ShiftNum)

	rows, err := db.Query(fmt.Sprintf(`
		SELECT
			EXTRACT(HOUR FROM event_ts)::INTEGER   AS hr,
			COALESCE(SUM(good_count), 0)::INTEGER  AS actual
		FROM %s
		WHERE resource_id  = $1
		  AND shift_number = $2
		  AND event_ts::date = CURRENT_DATE
		GROUP BY EXTRACT(HOUR FROM event_ts)
		ORDER BY hr ASC`,
		cfg.ProdTable,
	), resource, shift)
	if err != nil {
		log.Printf("[ERROR] productivity: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []ProductivityRow
	for rows.Next() {
		var p ProductivityRow
		p.Target = cfg.JPHTarget
		if err := rows.Scan(&p.HourStart, &p.Actual); err != nil {
			continue
		}
		p.HourLabel = fmt.Sprintf("%02d:00", p.HourStart)
		result = append(result, p)
	}
	if result == nil {
		result = []ProductivityRow{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"jph_target": cfg.JPHTarget,
		"rows":       result,
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/issues
//
//  Column mapping:
//    open_issues.severity   → IssueRow.Priority  (capitalised)
//    open_issues.status     → IssueRow.Status    (capitalised)
//    open_issues.issue_type → IssueRow.IssueType
//  Filter: status != 'closed'  (your DB stores lowercase)
// ═══════════════════════════════════════════════════════════════════════════════

func handleIssues(w http.ResponseWriter, r *http.Request) {
	resource := firstOf(r.URL.Query().Get("resource"), cfg.ResourceID)

	rows, err := db.Query(fmt.Sprintf(`
		SELECT
			id,
			description,
			issue_type,
			severity,
			status,
			COALESCE(acknowledged_by, ''),
			created_ts
		FROM %s
		WHERE resource_id = $1
		  AND LOWER(status) != 'closed'
		ORDER BY
			CASE LOWER(severity)
				WHEN 'critical' THEN 1
				WHEN 'high'     THEN 2
				WHEN 'medium'   THEN 3
				ELSE 4
			END,
			created_ts DESC`,
		cfg.IssuesTable,
	), resource)
	if err != nil {
		log.Printf("[WARN] issues query: %v", err)
		writeJSON(w, http.StatusOK, map[string]interface{}{"rows": []IssueRow{}})
		return
	}
	defer rows.Close()

	var result []IssueRow
	for rows.Next() {
		var issue IssueRow
		var createdTS time.Time
		if err := rows.Scan(
			&issue.ID,
			&issue.Description,
			&issue.IssueType,
			&issue.Priority,       // severity column
			&issue.Status,
			&issue.AcknowledgedBy,
			&createdTS,
		); err != nil {
			log.Printf("[ERROR] issues scan: %v", err)
			continue
		}
		issue.Priority  = title(issue.Priority) // high → High
		issue.Status    = title(issue.Status)   // open → Open
		issue.CreatedAt = createdTS.Format(time.RFC3339)
		result = append(result, issue)
	}
	if result == nil {
		result = []IssueRow{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"rows": result})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: GET /api/downtime
//
//  Returns today's downtime events for a resource.
//  duration_min is calculated from start_ts and end_ts.
//  is_open = true when end_ts is NULL (event still running).
// ═══════════════════════════════════════════════════════════════════════════════

func handleDowntimeGET(w http.ResponseWriter, r *http.Request) {
	resource := firstOf(r.URL.Query().Get("resource"), cfg.ResourceID)

	rows, err := db.Query(fmt.Sprintf(`
		SELECT
			id,
			start_ts,
			end_ts,
			EXTRACT(EPOCH FROM
				(COALESCE(end_ts, NOW()) - start_ts)
			)::INTEGER / 60                          AS duration_min,
			reason_code,
			COALESCE(reason_detail,  ''),
			COALESCE(operator_name,  ''),
			(end_ts IS NULL)                         AS is_open
		FROM %s
		WHERE resource_id    = $1
		  AND start_ts::date = CURRENT_DATE
		ORDER BY start_ts DESC`,
		cfg.DTTable,
	), resource)
	if err != nil {
		log.Printf("[ERROR] downtime GET: %v", err)
		writeJSON(w, http.StatusOK, map[string]interface{}{"rows": []DowntimeRow{}})
		return
	}
	defer rows.Close()

	var result []DowntimeRow
	for rows.Next() {
		var d DowntimeRow
		var startTS time.Time
		var endTS   sql.NullTime
		if err := rows.Scan(
			&d.ID, &startTS, &endTS,
			&d.DurationMin,
			&d.ReasonCode, &d.ReasonDetail, &d.OperatorName,
			&d.IsOpen,
		); err != nil {
			log.Printf("[ERROR] downtime scan: %v", err)
			continue
		}
		d.StartTS = startTS.Format(time.RFC3339)
		d.EndTS   = nullTime(endTS)
		result = append(result, d)
	}
	if result == nil {
		result = []DowntimeRow{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"rows": result})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: POST /api/confirm
//
//  Sets confirmed_by + confirmed_at on ALL production_log rows
//  that match: resource_id = resource AND HOUR(event_ts) = hourStart AND today.
//
//  confirmed_by and confirmed_at columns are added by migrateSchema().
// ═══════════════════════════════════════════════════════════════════════════════

func handleConfirm(w http.ResponseWriter, r *http.Request) {
	var req ConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON — expected {resource, hourStart, operator}")
		return
	}
	if req.Resource == "" {
		writeError(w, http.StatusBadRequest, "missing field: resource")
		return
	}
	if req.HourStart < 0 || req.HourStart > 23 {
		writeError(w, http.StatusBadRequest, "hourStart must be 0–23")
		return
	}
	if req.Operator == "" {
		writeError(w, http.StatusBadRequest, "missing field: operator")
		return
	}

	res, err := db.Exec(fmt.Sprintf(`
		UPDATE %s
		SET
			confirmed_by = $1,
			confirmed_at = NOW()
		WHERE resource_id = $2
		  AND EXTRACT(HOUR FROM event_ts)::INTEGER = $3
		  AND event_ts::date = CURRENT_DATE`,
		cfg.ProdTable,
	), req.Operator, req.Resource, req.HourStart)
	if err != nil {
		log.Printf("[ERROR] confirm UPDATE: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	rowsUpdated, _ := res.RowsAffected()
	auditLog("CONFIRM_PRODUCTION",
		fmt.Sprintf("resource=%s hour=%02d:00 operator=%q rows_updated=%d",
			req.Resource, req.HourStart, req.Operator, rowsUpdated),
		clientIP(r))

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "ok",
		"resource":     req.Resource,
		"hour_start":   req.HourStart,
		"hour_label":   fmt.Sprintf("%02d:00 – %02d:00", req.HourStart, req.HourStart+1),
		"operator":     req.Operator,
		"rows_updated": rowsUpdated,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER: POST /api/downtime
//
//  Inserts into downtime_log using your exact schema columns:
//    start_ts      = NOW() - (minutes * interval '1 minute')
//    end_ts        = NOW()
//    resource_id   = resource
//    reason_code   = code
//    reason_detail = comment
//    operator_name = operator
//
//  Returns the new row id.
// ═══════════════════════════════════════════════════════════════════════════════

func handleDowntimePOST(w http.ResponseWriter, r *http.Request) {
	var req DowntimeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON — expected {resource, code, minutes, comment, operator}")
		return
	}
	if req.Resource == "" {
		writeError(w, http.StatusBadRequest, "missing field: resource")
		return
	}
	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "missing field: code")
		return
	}
	if req.Minutes <= 0 {
		writeError(w, http.StatusBadRequest, "minutes must be > 0")
		return
	}
	if req.Operator == "" {
		writeError(w, http.StatusBadRequest, "missing field: operator")
		return
	}

	var newID int
	err := db.QueryRow(fmt.Sprintf(`
		INSERT INTO %s
			(start_ts, end_ts, resource_id, reason_code, reason_detail, operator_name)
		VALUES
			(
				NOW() - ($1::INTEGER * INTERVAL '1 minute'),
				NOW(),
				$2, $3, $4, $5
			)
		RETURNING id`,
		cfg.DTTable,
	), req.Minutes, req.Resource, req.Code, req.Comment, req.Operator).Scan(&newID)
	if err != nil {
		log.Printf("[ERROR] downtime INSERT: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	auditLog("LOG_DOWNTIME",
		fmt.Sprintf("resource=%s code=%s minutes=%d operator=%q new_id=%d",
			req.Resource, req.Code, req.Minutes, req.Operator, newID),
		clientIP(r))

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"id":        newID,
		"resource":  req.Resource,
		"code":      req.Code,
		"minutes":   req.Minutes,
		"operator":  req.Operator,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ── /api/downtime — routes GET and POST to separate handlers ──────────────────

func handleDowntime(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleDowntimeGET(w, r)
	case http.MethodPost:
		handleDowntimePOST(w, r)
	case http.MethodOptions:
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "use GET or POST")
	}
}

// ── 404 ───────────────────────────────────────────────────────────────────────

func handleNotFound(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]interface{}{
		"error": "endpoint not found",
		"endpoints": []string{
			"GET  /api/health",
			"GET  /api/production?resource=WM15&shift=2",
			"GET  /api/kpis?resource=WM15&shift=2",
			"GET  /api/productivity?resource=WM15&shift=2",
			"GET  /api/issues?resource=WM15",
			"GET  /api/downtime?resource=WM15",
			"POST /api/confirm  { resource, hourStart, operator }",
			"POST /api/downtime { resource, code, minutes, comment, operator }",
		},
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		sub    := cfg.CORSSubnet

		// Allow: empty origin, localhost, 127.x, or matching plant subnet
		allowed := origin == "" ||
			strings.Contains(origin, "localhost") ||
			strings.Contains(origin, "127.0.0.1") ||
			(sub != "" && len(sub) > 0 &&
				strings.Contains(origin, sub[:strings.LastIndex(sub, ".")]))

		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[HTTP] %-5s %-30s  %s  %v",
			r.Method, r.URL.RequestURI(), clientIP(r), time.Since(start))
	})
}

func guard(fn http.HandlerFunc, method string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method && r.Method != http.MethodOptions {
			writeError(w, http.StatusMethodNotAllowed,
				fmt.Sprintf("endpoint requires %s, got %s", method, r.Method))
			return
		}
		fn(w, r)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MISC UTILS
// ═══════════════════════════════════════════════════════════════════════════════

func firstOf(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func intOrDefault(s string, d int) int {
	if n, err := strconv.Atoi(s); err == nil && n > 0 {
		return n
	}
	return d
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

func newRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health",        guard(handleHealth,       "GET"))
	mux.HandleFunc("/api/production",    guard(handleProduction,   "GET"))
	mux.HandleFunc("/api/kpis",          guard(handleKPIs,         "GET"))
	mux.HandleFunc("/api/productivity",  guard(handleProductivity, "GET"))
	mux.HandleFunc("/api/issues",        guard(handleIssues,       "GET"))
	mux.HandleFunc("/api/downtime",      handleDowntime)   // GET + POST
	mux.HandleFunc("/api/confirm",       guard(handleConfirm,      "POST"))
	mux.HandleFunc("/",                  handleNotFound)
	return logMiddleware(corsMiddleware(mux))
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STARTUP BANNER
// ═══════════════════════════════════════════════════════════════════════════════

func printBanner() {
	line := func(label, value string) {
		fmt.Printf("║  %-18s %-47s║\n", label, value)
	}
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════════════╗")
	fmt.Println("║         LINE SIDE BOARD — MES API Server  (Go · PostgreSQL)         ║")
	fmt.Println("╠══════════════════════════════════════════════════════════════════════╣")
	line("DB Host:",     cfg.DBHost+":"+cfg.DBPort)
	line("Database:",    cfg.DBName)
	line("DB User:",     cfg.DBUser)
	line("API Port:",    cfg.Port)
	line("Resource ID:", cfg.ResourceID)
	line("JPH Target:",  strconv.Itoa(cfg.JPHTarget))
	line("Shift:",       strconv.Itoa(cfg.ShiftNum))
	fmt.Println("╠══════════════════════════════════════════════════════════════════════╣")
	fmt.Println("║  Schema mapping (mesdb real column → API response)                  ║")
	fmt.Println("║  production_log.good_count      → actual_accum                      ║")
	fmt.Println("║  production_log.scrap_count     → scrap_count                       ║")
	fmt.Println("║  production_log.event_ts        → grouped by EXTRACT(HOUR)          ║")
	fmt.Println("║  downtime_log.reason_code       → reason_code / code                ║")
	fmt.Println("║  downtime_log.start_ts & end_ts → duration_min (computed)           ║")
	fmt.Println("║  open_issues.severity           → priority  (High/Medium/Low)       ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Printf("  GET  http://0.0.0.0:%s/api/health\n", cfg.Port)
	fmt.Printf("  GET  http://0.0.0.0:%s/api/production?resource=%s&shift=%d\n",
		cfg.Port, cfg.ResourceID, cfg.ShiftNum)
	fmt.Printf("  GET  http://0.0.0.0:%s/api/kpis\n", cfg.Port)
	fmt.Printf("  GET  http://0.0.0.0:%s/api/issues\n", cfg.Port)
	fmt.Printf("  GET  http://0.0.0.0:%s/api/downtime\n", cfg.Port)
	fmt.Printf("  POST http://0.0.0.0:%s/api/confirm\n", cfg.Port)
	fmt.Printf("  POST http://0.0.0.0:%s/api/downtime\n", cfg.Port)
	fmt.Println()
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	cfg = loadConfig()

	log.Printf("Connecting to PostgreSQL: %s@%s:%s/%s",
		cfg.DBUser, cfg.DBHost, cfg.DBPort, cfg.DBName)

	var err error
	db, err = connectDB()
	if err != nil {
		log.Fatalf("\n[FATAL] %v\n\nCheck your .env file:\n  DB_HOST=%s\n  DB_PORT=%s\n  DB_NAME=%s\n  DB_USER=%s\n  DB_PASS=<correct password>\n",
			err, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser)
	}
	defer db.Close()

	log.Printf("✓ Connected to mesdb on MES-PostgreSQL (PostgreSQL 17.7)")

	migrateSchema()
	printBanner()

	srv := &http.Server{
		Addr:         "0.0.0.0:" + cfg.Port,
		Handler:      newRouter(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Server ready on :%s — waiting for requests...", cfg.Port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("[FATAL] server: %v", err)
	}
}
