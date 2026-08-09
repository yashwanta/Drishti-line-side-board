package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"lsb-api/db"
)

const marsQueryTimeout = 10 * time.Second

type marsStation struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Line string `json:"line"`
}

type marsProductionStatus struct {
	Station  string `json:"station"`
	Target   int    `json:"target"`
	Actual   int    `json:"actual"`
	Variance int    `json:"variance"`
}

type marsShippingStatus struct {
	Scheduled int `json:"scheduled"`
	Shipped   int `json:"shipped"`
	Pending   int `json:"pending"`
}

type marsWeeklyProduction struct {
	Date            string `json:"date"`
	ProductionCount int    `json:"production_count"`
}

type marsDowntimeEvent struct {
	Station        string    `json:"station"`
	Reason         string    `json:"reason"`
	DurationMinute int       `json:"duration_minutes"`
	StartedAt      time.Time `json:"started_at"`
}

// GetStations returns active stations represented in MARS production data.
func GetStations(w http.ResponseWriter, r *http.Request) {
	if !prepareMARSRequest(w, r) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), marsQueryTimeout)
	defer cancel()

	rows, err := db.MSSQLPool.QueryContext(ctx, `
		SELECT ResourceID AS id,
		       ResourceID AS name,
		       '' AS line
		FROM dbo.ProductionLog
		WHERE ResourceID IS NOT NULL
		GROUP BY ResourceID
		ORDER BY ResourceID`)
	if err != nil {
		writeMARSQueryError(w, "stations", err)
		return
	}
	defer rows.Close()

	stations := make([]marsStation, 0)
	for rows.Next() {
		var station marsStation
		if err := rows.Scan(&station.ID, &station.Name, &station.Line); err != nil {
			writeMARSQueryError(w, "stations scan", err)
			return
		}
		stations = append(stations, station)
	}
	if err := rows.Err(); err != nil {
		writeMARSQueryError(w, "stations iteration", err)
		return
	}
	writeJSON(w, stations)
}

// GetProductionStatus returns current-shift target and actual counts by station.
func GetProductionStatus(w http.ResponseWriter, r *http.Request) {
	if !prepareMARSRequest(w, r) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), marsQueryTimeout)
	defer cancel()

	shift := integerSetting(r.URL.Query().Get("shift"), os.Getenv("SHIFT_NUM"), 2)
	jphTarget := integerSetting("", os.Getenv("JPH_TARGET"), 23)
	target := jphTarget * 8
	rows, err := db.MSSQLPool.QueryContext(ctx, `
		SELECT ResourceID AS station,
		       @p1 AS target,
		       COALESCE(SUM(GoodQty), 0) AS actual,
		       COALESCE(SUM(GoodQty), 0) - @p1 AS variance
		FROM dbo.ProductionLog
		WHERE ShiftNum = @p2
		  AND EventTS >= CAST(GETDATE() AS DATE)
		  AND EventTS < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
		GROUP BY ResourceID
		ORDER BY ResourceID`, target, shift)
	if err != nil {
		writeMARSQueryError(w, "production status", err)
		return
	}
	defer rows.Close()

	statuses := make([]marsProductionStatus, 0)
	for rows.Next() {
		var status marsProductionStatus
		if err := rows.Scan(&status.Station, &status.Target, &status.Actual, &status.Variance); err != nil {
			writeMARSQueryError(w, "production status scan", err)
			return
		}
		statuses = append(statuses, status)
	}
	if err := rows.Err(); err != nil {
		writeMARSQueryError(w, "production status iteration", err)
		return
	}
	writeJSON(w, statuses)
}

// GetShippingStatus returns today's scheduled, shipped, and pending quantities.
func GetShippingStatus(w http.ResponseWriter, r *http.Request) {
	if !prepareMARSRequest(w, r) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), marsQueryTimeout)
	defer cancel()

	// TODO: confirm table name with DBA — placeholder used
	row := db.MSSQLPool.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(PartQty), 0) AS scheduled,
		       COALESCE(SUM(CASE WHEN TruckStatus IN ('LOADED', 'SHIPPED') THEN PartQty ELSE 0 END), 0) AS shipped,
		       COALESCE(SUM(CASE WHEN TruckStatus NOT IN ('LOADED', 'SHIPPED') OR TruckStatus IS NULL THEN PartQty ELSE 0 END), 0) AS pending
		FROM dbo.ShippingLog
		WHERE ShipDate >= CAST(GETDATE() AS DATE)
		  AND ShipDate < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))`)
	var status marsShippingStatus
	if err := row.Scan(&status.Scheduled, &status.Shipped, &status.Pending); err != nil {
		writeMARSQueryError(w, "shipping status", err)
		return
	}
	writeJSON(w, status)
}

// GetWeekly returns seven daily production totals for the current week.
func GetWeekly(w http.ResponseWriter, r *http.Request) {
	if !prepareMARSRequest(w, r) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), marsQueryTimeout)
	defer cancel()

	now := time.Now()
	daysSinceMonday := (int(now.Weekday()) + 6) % 7
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-daysSinceMonday, 0, 0, 0, 0, now.Location())
	weekEnd := weekStart.AddDate(0, 0, 7)
	rows, err := db.MSSQLPool.QueryContext(ctx, `
		SELECT CAST(EventTS AS DATE) AS production_date,
		       COALESCE(SUM(GoodQty), 0) AS production_count
		FROM dbo.ProductionLog
		WHERE EventTS >= @p1 AND EventTS < @p2
		GROUP BY CAST(EventTS AS DATE)
		ORDER BY production_date`, weekStart, weekEnd)
	if err != nil {
		writeMARSQueryError(w, "weekly production", err)
		return
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var date time.Time
		var count int
		if err := rows.Scan(&date, &count); err != nil {
			writeMARSQueryError(w, "weekly production scan", err)
			return
		}
		counts[date.Format("2006-01-02")] = count
	}
	if err := rows.Err(); err != nil {
		writeMARSQueryError(w, "weekly production iteration", err)
		return
	}

	week := make([]marsWeeklyProduction, 0, 7)
	for offset := 0; offset < 7; offset++ {
		date := weekStart.AddDate(0, 0, offset).Format("2006-01-02")
		week = append(week, marsWeeklyProduction{Date: date, ProductionCount: counts[date]})
	}
	writeJSON(w, week)
}

// GetDowntime returns MARS downtime events recorded in the last 24 hours.
func GetDowntime(w http.ResponseWriter, r *http.Request) {
	if !prepareMARSRequest(w, r) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), marsQueryTimeout)
	defer cancel()

	// TODO: confirm table name with DBA — placeholder used
	rows, err := db.MSSQLPool.QueryContext(ctx, `
		SELECT ResourceID AS station,
		       COALESCE(ReasonCode, '') AS reason,
		       DATEDIFF(MINUTE, StartTS, COALESCE(EndTS, GETDATE())) AS duration_minutes,
		       StartTS AS started_at
		FROM dbo.DowntimeLog
		WHERE StartTS >= DATEADD(HOUR, -24, GETDATE())
		ORDER BY StartTS DESC`)
	if err != nil {
		writeMARSQueryError(w, "downtime", err)
		return
	}
	defer rows.Close()

	events := make([]marsDowntimeEvent, 0)
	for rows.Next() {
		var event marsDowntimeEvent
		if err := rows.Scan(&event.Station, &event.Reason, &event.DurationMinute, &event.StartedAt); err != nil {
			writeMARSQueryError(w, "downtime scan", err)
			return
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		writeMARSQueryError(w, "downtime iteration", err)
		return
	}
	writeJSON(w, events)
}

func prepareMARSRequest(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeMARSResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return false
	}
	if db.MSSQLPool == nil {
		writeMARSResponse(w, http.StatusServiceUnavailable, map[string]string{
			"error": "MSSQL not configured",
			"hint":  "complete setup wizard step 1",
		})
		return false
	}
	return true
}

func writeMARSQueryError(w http.ResponseWriter, operation string, err error) {
	slog.Error("MSSQL query failed", "operation", operation, "error", err)
	writeMARSResponse(w, http.StatusBadGateway, map[string]string{
		"error":  "MSSQL query failed",
		"detail": err.Error(),
	})
}

func writeMARSResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func integerSetting(primary, secondary string, fallback int) int {
	for _, value := range []string{primary, secondary} {
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}
