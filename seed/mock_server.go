// Standalone mock API server — serves fake shift data so the dashboard works
// without a PostgreSQL connection.
//
// Run:  go run ./seed/mock_server.go
// Then: cd frontend && npm run dev
//
// Serves on :3001 (same port the Vite proxy expects).
package main

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"lsb-api/internal/deployment"
)

// ── helpers ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
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

func qp(r *http.Request, key, def string) string {
	if v := r.URL.Query().Get(key); v != "" {
		return v
	}
	return def
}

type historyVariation struct {
	date           string
	rng            *rand.Rand
	efficiencyDrop float64
	outputFactor   float64
}

func historyForRequest(r *http.Request, salt string) (*historyVariation, bool) {
	date := strings.TrimSpace(r.URL.Query().Get("date"))
	selected, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return nil, false
	}
	todayStart, _ := time.ParseInLocation("2006-01-02", time.Now().Format("2006-01-02"), time.Local)
	if !selected.Before(todayStart) {
		return nil, false
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(date + "|" + salt))
	rng := rand.New(rand.NewSource(int64(hash.Sum64())))
	return &historyVariation{
		date: date, rng: rng,
		efficiencyDrop: 5 + rng.Float64()*5,
		outputFactor:   0.90 + rng.Float64()*0.05,
	}, true
}

func historicalPayload(r *http.Request, salt string, value any) any {
	variation, historical := historyForRequest(r, salt)
	if !historical {
		return value
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var cloned any
	if err := json.Unmarshal(encoded, &cloned); err != nil {
		return value
	}
	adjustHistoricalValue(cloned, variation)
	return cloned
}

func adjustHistoricalValue(value any, variation *historyVariation) {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			adjustHistoricalValue(item, variation)
		}
	case map[string]any:
		for key, item := range typed {
			normalized := strings.ToLower(key)
			switch number := item.(type) {
			case float64:
				switch normalized {
				case "efficiency_pct", "oee_pct", "on_time_rate_pct", "pass_rate_pct":
					typed[key] = round1(clampFloat(number-variation.efficiencyDrop, 0, 100))
				case "actual", "actual_qty", "actualqty", "good_count", "parts_shipped_today", "cycles_today", "passes_today":
					typed[key] = math.Round(number * variation.outputFactor)
				case "cycle_time_sec", "avg_cycle_sec":
					if number > 0 {
						typed[key] = round1(number + variation.rng.Float64()*2)
					}
				}
			case string:
				if len(number) >= 10 {
					if _, err := time.Parse("2006-01-02", number[:10]); err == nil {
						typed[key] = variation.date + number[10:]
					}
				}
			}
			adjustHistoricalValue(typed[key], variation)
		}
		if plan, ok := typed["plan"].(float64); ok {
			if actual, ok := typed["actual"].(float64); ok {
				typed["gap"] = plan - actual
			}
		}
	}
}

// ── station master list ────────────────────────────────────────────────────────

type StationSummary struct {
	ResourceID string  `json:"resource_id"`
	PartNumber string  `json:"part_number"`
	Status     string  `json:"status"` // running | downtime | idle
	Efficiency float64 `json:"efficiency_pct"`
	Actual     int     `json:"actual"`
	Target     int     `json:"target"`
	Shift      int     `json:"shift"`
	Operator   string  `json:"operator"`
}

var stationList = []StationSummary{
	{"WM15", "BMW1000D-360", "running", 81.5, 150, 184, 2, "Yashwanta Thakur"},
	{"WM16", "BMW2000E-180", "running", 94.2, 173, 184, 2, "James Okonkwo"},
	{"WM17", "BMW1000D-360", "downtime", 52.7, 97, 184, 2, "Sarah Mbeki"},
	{"WM18", "BMW3000F-240", "running", 87.6, 161, 184, 2, "Priya Sharma"},
	{"WM19", "BMW2000E-180", "idle", 0.0, 0, 184, 2, ""},
	{"WM20", "BMW3000F-240", "running", 91.3, 168, 184, 2, "Carlos Diaz"},
	{"WM21", "BMW1500C-120", "running", 96.8, 178, 184, 2, "Nina Vogel"},
	{"WM22", "BMW1500C-120", "running", 88.0, 162, 184, 2, "Tom Adeyemi"},
	{"WM23", "BMW2500D-300", "downtime", 43.5, 80, 184, 2, "Fatima Al-Rashid"},
	{"WM24", "BMW1000D-360", "running", 92.1, 169, 184, 2, "Liang Wei"},
}

func stationMeta(resourceID string) StationSummary {
	for _, s := range stationList {
		if s.ResourceID == resourceID {
			return s
		}
	}
	return StationSummary{ResourceID: resourceID, PartNumber: "UNKNOWN", Status: "idle", Shift: 2}
}

// ── shared types ──────────────────────────────────────────────────────────────

type ProductionRow struct {
	Hour        int     `json:"hour"`
	PartNumber  string  `json:"part_number"`
	Operator    string  `json:"operator"`
	Plan        int     `json:"plan"`
	Actual      int     `json:"actual"`
	GoodCount   int     `json:"good_count"`
	ScrapCount  int     `json:"scrap_count"`
	Gap         int     `json:"gap"`
	CycleTime   float64 `json:"cycle_time_sec"`
	Notes       string  `json:"notes"`
	Confirmed   bool    `json:"confirmed"`
	ConfirmedBy string  `json:"confirmed_by"`
	ConfirmedAt string  `json:"confirmed_at"`
}

type ProductivityHour struct {
	Hour      int     `json:"hour"`
	Target    int     `json:"target"`
	Actual    int     `json:"actual"`
	Gap       int     `json:"gap"`
	EffPct    float64 `json:"efficiency_pct"`
	ScrapRate float64 `json:"scrap_rate_pct"`
}

type Issue struct {
	ID             int    `json:"id"`
	Resource       string `json:"resource"`
	IssueType      string `json:"issue_type"`
	Severity       string `json:"severity"`
	Description    string `json:"description"`
	Status         string `json:"status"`
	RaisedBy       string `json:"raised_by"`
	AcknowledgedBy string `json:"acknowledged_by"`
	RaisedAt       string `json:"raised_at"`
	UpdatedAt      string `json:"updated_at"`
}

type DowntimeEvent struct {
	ID         int    `json:"id"`
	Resource   string `json:"resource"`
	ReasonCode string `json:"reason_code"`
	Minutes    int    `json:"minutes"`
	Comment    string `json:"comment"`
	StartTS    string `json:"start_ts"`
	LoggedBy   string `json:"logged_by"`
}

type KPIResponse struct {
	Resource    string  `json:"resource"`
	Shift       int     `json:"shift"`
	Date        string  `json:"date"`
	Plan        int     `json:"plan"`
	Actual      int     `json:"actual"`
	GoodCount   int     `json:"good_count"`
	ScrapCount  int     `json:"scrap_count"`
	Efficiency  float64 `json:"efficiency_pct"`
	FPY         float64 `json:"fpy_pct"`
	AvgCycle    float64 `json:"avg_cycle_sec"`
	HoursWorked float64 `json:"hours_worked"`
	OpenIssues  int     `json:"open_issues"`
	JphTarget   int     `json:"jph_target"`
	UpdatedAt   string  `json:"updated_at"`
}

type kpiDriftState struct {
	value     KPIResponse
	baseCycle float64
}

// liveMockState owns all values that drift between refreshes. The RNG is also
// guarded by the mutex because math/rand.Rand is not safe for concurrent use.
type liveMockState struct {
	mu               sync.Mutex
	rng              *rand.Rand
	kpis             map[string]kpiDriftState
	productionStatus []ProductionStatus
}

var liveState = liveMockState{
	rng:  rand.New(rand.NewSource(time.Now().UnixNano())),
	kpis: make(map[string]kpiDriftState),
}

type WeeklySummary struct {
	Date       string  `json:"date"`
	Day        string  `json:"day"`
	Plan       int     `json:"plan"`
	Actual     int     `json:"actual"`
	GoodCount  int     `json:"good_count"`
	ScrapCount int     `json:"scrap_count"`
	Efficiency float64 `json:"efficiency_pct"`
	Downtime   int     `json:"downtime_mins"`
	Shipments  int     `json:"shipments"`
	Shipped    int     `json:"parts_shipped"`
}

func weeklyData(resource, anchorDate string) []WeeklySummary {
	anchor, err := time.ParseInLocation("2006-01-02", anchorDate, time.Local)
	if err != nil {
		anchor = time.Now()
		anchorDate = anchor.Format("2006-01-02")
	}
	weekdayOffset := (int(anchor.Weekday()) + 6) % 7
	start := anchor.AddDate(0, 0, -weekdayOffset)
	actuals := []int{1382, 1419, 1344, 1456, 1398, 1427, 1168}
	scrap := []int{18, 14, 23, 11, 16, 13, 27}
	downtime := []int{42, 28, 76, 19, 37, 24, 91}
	shipments := []int{4, 5, 4, 6, 5, 5, 3}
	shipped := []int{1180, 1320, 1240, 1480, 1360, 1420, 1280}
	plan := 1472
	offset := 0
	for _, c := range resource {
		offset += int(c)
	}
	offset = offset%41 - 20

	hash := fnv.New64a()
	_, _ = hash.Write([]byte(anchorDate + "|weekly|" + resource))
	rng := rand.New(rand.NewSource(int64(hash.Sum64())))
	todayStart, _ := time.ParseInLocation("2006-01-02", time.Now().Format("2006-01-02"), time.Local)
	factor := 1.0
	if anchor.Before(todayStart) {
		factor = 0.90 + rng.Float64()*0.05
	}

	rows := make([]WeeklySummary, 7)
	for i := range rows {
		date := start.AddDate(0, 0, i)
		actual := int(math.Round(float64(actuals[i]+offset) * factor))
		rows[i] = WeeklySummary{
			Date: date.Format("2006-01-02"), Day: date.Format("Mon"), Plan: plan,
			Actual: actual, GoodCount: actual - scrap[i], ScrapCount: scrap[i],
			Efficiency: round1(float64(actual) / float64(plan) * 100),
			Downtime:   downtime[i], Shipments: shipments[i], Shipped: int(math.Round(float64(shipped[i]) * factor)),
		}
	}
	return rows
}

// ── WM15 detailed data ────────────────────────────────────────────────────────

var today = time.Now().Format("2006-01-02")

var wm15Production = []ProductionRow{
	{Hour: 14, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 1, Gap: 0, CycleTime: 154.2, Notes: "", Confirmed: true, ConfirmedBy: "Yashwanta Thakur", ConfirmedAt: today + "T14:58:22Z"},
	{Hour: 15, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 157.8, Notes: "", Confirmed: true, ConfirmedBy: "Yashwanta Thakur", ConfirmedAt: today + "T15:59:10Z"},
	{Hour: 16, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 2, Gap: 2, CycleTime: 159.1, Notes: "Tooling adjustment — insert wear on station 3", Confirmed: false},
	{Hour: 17, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "EQ breakdown — press pendant fault F034, 45 min lost", Confirmed: false},
	{Hour: 18, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 148.5, Notes: "Recovered — full hour running after reset", Confirmed: true, ConfirmedBy: "Yashwanta Thakur", ConfirmedAt: today + "T18:57:44Z"},
	{Hour: 19, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 1, Gap: 0, CycleTime: 152.3, Notes: "", Confirmed: true, ConfirmedBy: "Yashwanta Thakur", ConfirmedAt: today + "T19:58:01Z"},
	{Hour: 20, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.7, Notes: "", Confirmed: false},
	{Hour: 21, PartNumber: "BMW1000D-360", Operator: "Yashwanta Thakur", Plan: 23, Actual: 15, GoodCount: 15, ScrapCount: 1, Gap: 8, CycleTime: 155.0, Notes: "Shift winding down", Confirmed: false},
}

var wm15Productivity = []ProductivityHour{
	{Hour: 14, Target: 23, Actual: 23, Gap: 0, EffPct: 100.0, ScrapRate: 4.2},
	{Hour: 15, Target: 23, Actual: 22, Gap: 1, EffPct: 95.7, ScrapRate: 0.0},
	{Hour: 16, Target: 23, Actual: 21, Gap: 2, EffPct: 91.3, ScrapRate: 8.7},
	{Hour: 17, Target: 23, Actual: 0, Gap: 23, EffPct: 0.0, ScrapRate: 0.0},
	{Hour: 18, Target: 23, Actual: 24, Gap: -1, EffPct: 104.3, ScrapRate: 0.0},
	{Hour: 19, Target: 23, Actual: 23, Gap: 0, EffPct: 100.0, ScrapRate: 4.2},
	{Hour: 20, Target: 23, Actual: 22, Gap: 1, EffPct: 95.7, ScrapRate: 0.0},
	{Hour: 21, Target: 23, Actual: 15, Gap: 8, EffPct: 65.2, ScrapRate: 6.3},
}

var wm15Issues = []Issue{
	{ID: 1, Resource: "WM15", IssueType: "Maintenance", Severity: "critical", Description: "Air press pendant showing intermittent fault F034 — requires immediate inspection", Status: "in_progress", RaisedBy: "Yashwanta Thakur", AcknowledgedBy: "Maintenance Team", RaisedAt: today + "T17:14:00Z", UpdatedAt: today + "T17:45:00Z"},
	{ID: 2, Resource: "WM15", IssueType: "Quality", Severity: "major", Description: "Elevated scrap on BMW1000D-360 — bore diameter OOT (+0.03mm), batch QC hold raised", Status: "open", RaisedBy: "QA Lead", RaisedAt: today + "T16:05:00Z", UpdatedAt: today + "T16:05:00Z"},
	{ID: 3, Resource: "WM15", IssueType: "Production", Severity: "major", Description: "BMW1000D-360 raw stock critically low — approx. 2hr supply remaining, material request sent", Status: "open", RaisedBy: "Supervisor", AcknowledgedBy: "Store", RaisedAt: today + "T19:30:00Z", UpdatedAt: today + "T19:35:00Z"},
	{ID: 4, Resource: "WM15", IssueType: "Safety", Severity: "minor", Description: "Oil residue near robot arm base — housekeeping required before next shift", Status: "open", RaisedBy: "Yashwanta Thakur", RaisedAt: today + "T20:15:00Z", UpdatedAt: today + "T20:15:00Z"},
}

var wm15Downtime = []DowntimeEvent{
	{ID: 1, Resource: "WM15", ReasonCode: "EQ", Minutes: 45, Comment: "Press pendant fault F034 — emergency stop triggered, reset + inspection performed", StartTS: today + "T17:12:00+00:00", LoggedBy: "Yashwanta Thakur"},
	{ID: 2, Resource: "WM15", ReasonCode: "PM", Minutes: 12, Comment: "Tool change — insert replacement station 3 (scheduled)", StartTS: today + "T15:45:00+00:00", LoggedBy: "Yashwanta Thakur"},
	{ID: 3, Resource: "WM15", ReasonCode: "QA", Minutes: 8, Comment: "First article inspection hold — new blank batch verification", StartTS: today + "T14:32:00+00:00", LoggedBy: "QA Lead"},
}

// ── per-station data generator (for all stations except WM15) ─────────────────

// Predefined per-station scenarios to keep data varied and realistic
type stationScenario struct {
	prodRows []ProductionRow
	dtEvents []DowntimeEvent
	issues   []Issue
}

var stationScenarios = map[string]stationScenario{
	"WM16": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 152.1, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T14:57:00Z"},
			{Hour: 15, Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 149.5, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T15:58:00Z"},
			{Hour: 16, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.2, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T16:58:30Z"},
			{Hour: 17, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 1, Gap: 1, CycleTime: 156.8, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T17:59:00Z"},
			{Hour: 18, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 152.4, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T18:58:00Z"},
			{Hour: 19, Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 148.7, Confirmed: true, ConfirmedBy: "James Okonkwo", ConfirmedAt: today + "T19:57:00Z"},
			{Hour: 20, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.0, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 17, GoodCount: 17, ScrapCount: 0, Gap: 6, CycleTime: 152.3, Notes: "Running — shift continues"},
		},
		dtEvents: []DowntimeEvent{
			{ID: 10, Resource: "WM16", ReasonCode: "PM", Minutes: 8, Comment: "Coolant level top-up (scheduled)", StartTS: today + "T16:10:00+00:00", LoggedBy: "James Okonkwo"},
		},
		issues: []Issue{
			{ID: 10, Resource: "WM16", IssueType: "Quality", Severity: "minor", Description: "Single scrap at hour 17 — dimensional deviation under investigation", Status: "open", RaisedBy: "James Okonkwo", RaisedAt: today + "T17:55:00Z", UpdatedAt: today + "T17:55:00Z"},
		},
	},
	"WM17": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.7, Confirmed: true, ConfirmedBy: "Sarah Mbeki", ConfirmedAt: today + "T14:59:00Z"},
			{Hour: 15, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 2, Gap: 2, CycleTime: 158.9, Notes: "Scrap uptick — surface finish OOT", Confirmed: true, ConfirmedBy: "Sarah Mbeki", ConfirmedAt: today + "T15:58:00Z"},
			{Hour: 16, Plan: 23, Actual: 18, GoodCount: 18, ScrapCount: 3, Gap: 5, CycleTime: 162.3, Notes: "Coolant contamination — flush required", Confirmed: false},
			{Hour: 17, Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "Machine down — coolant system fault, awaiting maintenance", Confirmed: false},
			{Hour: 18, Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "Still down — parts on order", Confirmed: false},
			{Hour: 19, Plan: 23, Actual: 12, GoodCount: 12, ScrapCount: 1, Gap: 11, CycleTime: 155.0, Notes: "Partial recovery — maintenance cleared 18:45", Confirmed: false},
			{Hour: 20, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 0, Gap: 2, CycleTime: 156.1, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 155.4, Confirmed: false},
		},
		dtEvents: []DowntimeEvent{
			{ID: 20, Resource: "WM17", ReasonCode: "EQ", Minutes: 105, Comment: "Coolant system fault — pump seal failure, emergency replacement", StartTS: today + "T17:00:00+00:00", LoggedBy: "Sarah Mbeki"},
			{ID: 21, Resource: "WM17", ReasonCode: "QA", Minutes: 18, Comment: "Scrap investigation hold — surface finish review", StartTS: today + "T15:30:00+00:00", LoggedBy: "QA Lead"},
		},
		issues: []Issue{
			{ID: 20, Resource: "WM17", IssueType: "Maintenance", Severity: "critical", Description: "Coolant pump seal failure — 105 min downtime, replacement fitted, monitoring", Status: "in_progress", RaisedBy: "Sarah Mbeki", AcknowledgedBy: "Maintenance", RaisedAt: today + "T17:05:00Z", UpdatedAt: today + "T18:50:00Z"},
			{ID: 21, Resource: "WM17", IssueType: "Quality", Severity: "major", Description: "Surface finish OOT on BMW1000D-360 — linked to coolant contamination, batch quarantined", Status: "open", RaisedBy: "QA Lead", RaisedAt: today + "T15:30:00Z", UpdatedAt: today + "T15:30:00Z"},
		},
	},
	"WM18": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.8, Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T14:58:00Z"},
			{Hour: 15, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.9, Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T15:59:00Z"},
			{Hour: 16, Plan: 23, Actual: 20, GoodCount: 20, ScrapCount: 1, Gap: 3, CycleTime: 159.5, Notes: "Brief tooling check at 16:20", Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T16:59:00Z"},
			{Hour: 17, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.1, Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T17:58:00Z"},
			{Hour: 18, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 155.7, Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T18:59:00Z"},
			{Hour: 19, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.4, Confirmed: true, ConfirmedBy: "Priya Sharma", ConfirmedAt: today + "T19:57:00Z"},
			{Hour: 20, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.2, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 16, GoodCount: 16, ScrapCount: 0, Gap: 7, CycleTime: 154.8, Notes: "Shift winding down"},
		},
		dtEvents: []DowntimeEvent{
			{ID: 30, Resource: "WM18", ReasonCode: "PM", Minutes: 15, Comment: "Tooling change — planned insert replacement at 16:20", StartTS: today + "T16:20:00+00:00", LoggedBy: "Priya Sharma"},
		},
		issues: []Issue{},
	},
	"WM20": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.5, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 15, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 157.1, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 16, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.0, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 17, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 1, Gap: 2, CycleTime: 158.3, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 18, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.8, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 19, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.6, Confirmed: true, ConfirmedBy: "Carlos Diaz"},
			{Hour: 20, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.2, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 0, Gap: 2, CycleTime: 155.0},
		},
		dtEvents: []DowntimeEvent{},
		issues: []Issue{
			{ID: 40, Resource: "WM20", IssueType: "Quality", Severity: "minor", Description: "Single scrap at hour 17 — under investigation, no pattern yet", Status: "open", RaisedBy: "Carlos Diaz", RaisedAt: today + "T17:50:00Z", UpdatedAt: today + "T17:50:00Z"},
		},
	},
	"WM21": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 151.8, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 15, Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 148.9, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 16, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 152.7, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 17, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.1, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 18, Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 149.3, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 19, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 151.9, Confirmed: true, ConfirmedBy: "Nina Vogel"},
			{Hour: 20, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.2, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 154.3},
		},
		dtEvents: []DowntimeEvent{},
		issues:   []Issue{},
	},
	"WM22": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.4, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 15, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.7, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 16, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 1, Gap: 2, CycleTime: 159.2, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 17, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 157.0, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 18, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 154.3, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 19, Plan: 23, Actual: 21, GoodCount: 21, ScrapCount: 1, Gap: 2, CycleTime: 158.8, Confirmed: true, ConfirmedBy: "Tom Adeyemi"},
			{Hour: 20, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 155.9, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 18, GoodCount: 18, ScrapCount: 0, Gap: 5, CycleTime: 155.2},
		},
		dtEvents: []DowntimeEvent{
			{ID: 60, Resource: "WM22", ReasonCode: "PM", Minutes: 10, Comment: "Lubrication cycle — scheduled preventive maintenance", StartTS: today + "T16:05:00+00:00", LoggedBy: "Tom Adeyemi"},
		},
		issues: []Issue{
			{ID: 60, Resource: "WM22", IssueType: "Quality", Severity: "minor", Description: "Two scrap parts (hours 16 & 19) — reviewing tool wear schedule", Status: "open", RaisedBy: "Tom Adeyemi", RaisedAt: today + "T19:45:00Z", UpdatedAt: today + "T19:45:00Z"},
		},
	},
	"WM23": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.0, Confirmed: true, ConfirmedBy: "Fatima Al-Rashid"},
			{Hour: 15, Plan: 23, Actual: 20, GoodCount: 20, ScrapCount: 2, Gap: 3, CycleTime: 160.5, Notes: "Vibration anomaly detected", Confirmed: true, ConfirmedBy: "Fatima Al-Rashid"},
			{Hour: 16, Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "Spindle vibration fault — production stopped", Confirmed: false},
			{Hour: 17, Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "Spindle replacement in progress", Confirmed: false},
			{Hour: 18, Plan: 23, Actual: 0, GoodCount: 0, ScrapCount: 0, Gap: 23, CycleTime: 0, Notes: "Maintenance ongoing", Confirmed: false},
			{Hour: 19, Plan: 23, Actual: 8, GoodCount: 8, ScrapCount: 1, Gap: 15, CycleTime: 158.3, Notes: "Partial restart — spindle replaced 18:40", Confirmed: false},
			{Hour: 20, Plan: 23, Actual: 18, GoodCount: 18, ScrapCount: 1, Gap: 5, CycleTime: 155.8, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 20, GoodCount: 20, ScrapCount: 0, Gap: 3, CycleTime: 154.1},
		},
		dtEvents: []DowntimeEvent{
			{ID: 70, Resource: "WM23", ReasonCode: "EQ", Minutes: 155, Comment: "Spindle vibration fault — Level 3 alarm, spindle bearing replacement", StartTS: today + "T16:05:00+00:00", LoggedBy: "Fatima Al-Rashid"},
		},
		issues: []Issue{
			{ID: 70, Resource: "WM23", IssueType: "Maintenance", Severity: "critical", Description: "Spindle bearing failure — 155 min downtime, replacement complete, vibration monitoring active", Status: "in_progress", RaisedBy: "Fatima Al-Rashid", AcknowledgedBy: "Maintenance", RaisedAt: today + "T16:10:00Z", UpdatedAt: today + "T19:00:00Z"},
		},
	},
	"WM24": {
		prodRows: []ProductionRow{
			{Hour: 14, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 155.8, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 15, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.4, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 16, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 153.9, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 17, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 156.7, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 18, Plan: 23, Actual: 24, GoodCount: 24, ScrapCount: 0, Gap: -1, CycleTime: 149.2, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 19, Plan: 23, Actual: 23, GoodCount: 23, ScrapCount: 0, Gap: 0, CycleTime: 152.6, Confirmed: true, ConfirmedBy: "Liang Wei"},
			{Hour: 20, Plan: 23, Actual: 22, GoodCount: 22, ScrapCount: 0, Gap: 1, CycleTime: 155.3, Confirmed: false},
			{Hour: 21, Plan: 23, Actual: 20, GoodCount: 20, ScrapCount: 0, Gap: 3, CycleTime: 154.8},
		},
		dtEvents: []DowntimeEvent{},
		issues:   []Issue{},
	},
}

// enrichRows stamps part_number and operator on rows for non-WM15 stations
func enrichRows(rows []ProductionRow, meta StationSummary) []ProductionRow {
	out := make([]ProductionRow, len(rows))
	for i, r := range rows {
		r.PartNumber = meta.PartNumber
		r.Operator = meta.Operator
		if r.ConfirmedAt == "" && r.ConfirmedBy != "" {
			r.ConfirmedAt = today + "T00:00:00Z"
		}
		out[i] = r
	}
	return out
}

func productivityFromProduction(rows []ProductionRow, target int) []ProductivityHour {
	out := make([]ProductivityHour, len(rows))
	for i, r := range rows {
		eff := 0.0
		if target > 0 {
			eff = float64(r.GoodCount) / float64(target) * 100
		}
		scrapRate := 0.0
		total := r.GoodCount + r.ScrapCount
		if total > 0 {
			scrapRate = float64(r.ScrapCount) / float64(total) * 100
		}
		out[i] = ProductivityHour{
			Hour: r.Hour, Target: target, Actual: r.GoodCount,
			Gap: target - r.GoodCount, EffPct: round1(eff), ScrapRate: round1(scrapRate),
		}
	}
	return out
}

func kpisFromProduction(rows []ProductionRow, issues []Issue, meta StationSummary) KPIResponse {
	var good, scrap int
	var cycleSum float64
	var cycleCount int
	for _, r := range rows {
		good += r.GoodCount
		scrap += r.ScrapCount
		if r.CycleTime > 0 {
			cycleSum += r.CycleTime
			cycleCount++
		}
	}
	plan := meta.Target
	eff := 0.0
	if plan > 0 {
		eff = float64(good) / float64(plan) * 100
	}
	total := good + scrap
	fpy := 0.0
	if total > 0 {
		fpy = float64(good) / float64(total) * 100
	}
	avgCycle := 0.0
	if cycleCount > 0 {
		avgCycle = cycleSum / float64(cycleCount)
	}
	openCount := 0
	for _, iss := range issues {
		if iss.Status != "closed" {
			openCount++
		}
	}
	return KPIResponse{
		Resource:    meta.ResourceID,
		Shift:       meta.Shift,
		Date:        today,
		Plan:        plan,
		Actual:      good,
		GoodCount:   good,
		ScrapCount:  scrap,
		Efficiency:  round1(eff),
		FPY:         round1(fpy),
		AvgCycle:    round2(avgCycle),
		HoursWorked: float64(len(rows)),
		OpenIssues:  openCount,
		JphTarget:   jphTarget,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
}

const jphTarget = 23

func round1(f float64) float64 { return float64(int(f*10+0.5)) / 10 }
func round2(f float64) float64 { return float64(int(f*100+0.5)) / 100 }

func clampFloat(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func clampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func randomDelta(rng *rand.Rand, amplitude float64) float64 {
	return (rng.Float64()*2 - 1) * amplitude
}

func baseKPIResponse(resource string) KPIResponse {
	if resource == "WM15" {
		return KPIResponse{
			Resource: "WM15", Shift: 2, Date: today, Plan: 184,
			Actual: 150, GoodCount: 150, ScrapCount: 5,
			Efficiency: 81.5, FPY: 96.8, AvgCycle: 154.8, HoursWorked: 8,
			OpenIssues: 4, JphTarget: jphTarget,
		}
	}

	meta := stationMeta(resource)
	scenario, ok := stationScenarios[resource]
	if !ok {
		return KPIResponse{Resource: resource, Shift: 2, Date: today, JphTarget: jphTarget}
	}
	return kpisFromProduction(enrichRows(scenario.prodRows, meta), scenario.issues, meta)
}

func nextKPIResponse(resource string) KPIResponse {
	liveState.mu.Lock()
	defer liveState.mu.Unlock()

	state, ok := liveState.kpis[resource]
	if !ok {
		base := baseKPIResponse(resource)
		state = kpiDriftState{value: base, baseCycle: base.AvgCycle}
	}

	state.value.Actual += 1 + liveState.rng.Intn(3)
	state.value.GoodCount = state.value.Actual
	state.value.Efficiency = round1(clampFloat(state.value.Efficiency+randomDelta(liveState.rng, 2), 72, 96))
	cycleMin := state.baseCycle - 2
	if cycleMin < 0 {
		cycleMin = 0
	}
	state.value.AvgCycle = round1(clampFloat(state.value.AvgCycle+randomDelta(liveState.rng, 0.3), cycleMin, state.baseCycle+2))
	state.value.FPY = round1(clampFloat(state.value.FPY+randomDelta(liveState.rng, 0.5), 94, 99.5))
	if liveState.rng.Intn(20) == 0 {
		if liveState.rng.Intn(2) == 0 {
			state.value.OpenIssues--
		} else {
			state.value.OpenIssues++
		}
		state.value.OpenIssues = clampInt(state.value.OpenIssues, 0, 9)
	}
	state.value.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	liveState.kpis[resource] = state
	return state.value
}

func nextProductionStatus() []ProductionStatus {
	liveState.mu.Lock()
	defer liveState.mu.Unlock()

	if liveState.productionStatus == nil {
		liveState.productionStatus = append([]ProductionStatus(nil), productionStatusList...)
	}
	for i := range liveState.productionStatus {
		station := &liveState.productionStatus[i]
		if station.Status != "running" {
			continue
		}
		increment := liveState.rng.Intn(3)
		station.Actual += increment
		station.CyclesToday += increment
		station.Efficiency = round1(clampFloat(station.Efficiency+randomDelta(liveState.rng, 1.5), 68, 97))
		station.CycleTime = round1(station.CycleTime + randomDelta(liveState.rng, 0.2))
	}
	return append([]ProductionStatus(nil), liveState.productionStatus...)
}

// ── handlers ──────────────────────────────────────────────────────────────────

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"status": "ok", "mode": "mock", "version": deployment.Version})
}

func handleMockOEEEntries(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, []any{})
		return
	}
	if r.Method == http.MethodPost {
		writeJSON(w, map[string]any{"ok": true, "id": 0})
		return
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

// Production deployments use this schema; mock mode keeps note bodies in browser localStorage:
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
func handleMockNotes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, []any{})
	case http.MethodPost:
		var payload map[string]any
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&payload); err != nil {
			http.Error(w, `{"error":"invalid note"}`, http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]any{"ok": true, "id": time.Now().UnixMilli()})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func handleStations(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, historicalPayload(r, "stations", stationList))
}

func handleKPIs(w http.ResponseWriter, r *http.Request) {
	res := qp(r, "resource", "WM15")
	if _, historical := historyForRequest(r, "kpis|"+res); historical {
		writeJSON(w, historicalPayload(r, "kpis|"+res, baseKPIResponse(res)))
		return
	}
	writeJSON(w, nextKPIResponse(res))
}

func handleProduction(w http.ResponseWriter, r *http.Request) {
	res := qp(r, "resource", "WM15")
	var rows []ProductionRow
	if res == "WM15" {
		rows = wm15Production
	} else {
		meta := stationMeta(res)
		sc, ok := stationScenarios[res]
		if ok {
			rows = enrichRows(sc.prodRows, meta)
		} else {
			rows = []ProductionRow{}
		}
	}
	writeJSON(w, historicalPayload(r, "production|"+res, rows))
}

func handleProductivity(w http.ResponseWriter, r *http.Request) {
	res := qp(r, "resource", "WM15")
	var rows []ProductivityHour
	if res == "WM15" {
		rows = wm15Productivity
	} else {
		meta := stationMeta(res)
		sc, ok := stationScenarios[res]
		if ok {
			rows = productivityFromProduction(enrichRows(sc.prodRows, meta), meta.Target/8)
		} else {
			rows = []ProductivityHour{}
		}
	}
	writeJSON(w, historicalPayload(r, "productivity|"+res, rows))
}

func handleIssues(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		writeJSON(w, map[string]any{"status": "created", "id": 99, "raised_at": time.Now().UTC().Format(time.RFC3339)})
		return
	}
	res := qp(r, "resource", "WM15")
	var issues []Issue
	if res == "WM15" {
		issues = wm15Issues
	} else if sc, ok := stationScenarios[res]; ok {
		issues = sc.issues
	} else {
		issues = []Issue{}
	}
	writeJSON(w, historicalPayload(r, "issues|"+res, issues))
}

func handleDowntime(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		writeJSON(w, map[string]any{"status": "logged", "id": 99, "minutes": 0, "ts": time.Now().UTC().Format(time.RFC3339)})
		return
	}
	res := qp(r, "resource", "WM15")
	var events []DowntimeEvent
	if res == "WM15" {
		events = wm15Downtime
	} else if sc, ok := stationScenarios[res]; ok {
		events = sc.dtEvents
	} else {
		events = []DowntimeEvent{}
	}
	total := 0
	for _, d := range events {
		total += d.Minutes
	}
	writeJSON(w, historicalPayload(r, "downtime|"+res, map[string]any{
		"events":     events,
		"total_mins": total,
		"resource":   res,
		"date":       today,
	}))
}

func handleConfirm(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "confirmed"})
}

// ── Robot Press data ───────────────────────────────────────────────────────────

var robotPressData = map[string]any{
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
}

func handleRobotPress(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "robotpress", robotPressData))
}

// ── MARS ERP data ──────────────────────────────────────────────────────────────

var marsKpis = map[string]any{
	"planned_qty": 184,
	"actual_qty":  150,
	"scrap_qty":   5,
	"fpy_pct":     96.8,
	"oee_pct":     81.4,
	"work_order":  "WO-20240610-02",
	"part_number": "BMW1000D-360",
	"revision":    "C",
}

var marsProduction = []map[string]any{
	{"WorkOrder": "WO-20240610-02", "PartNumber": "BMW1000D-360", "Revision": "C",
		"PlannedQty": 184, "ActualQty": 150, "PlannedStart": "14:00", "ActualStart": "14:02",
		"PlannedEnd": "22:00", "ActualEnd": "", "Status": "IN_PROGRESS"},
	{"WorkOrder": "WO-20240610-01", "PartNumber": "BMW1000D-360", "Revision": "C",
		"PlannedQty": 184, "ActualQty": 184, "PlannedStart": "06:00", "ActualStart": "06:01",
		"PlannedEnd": "14:00", "ActualEnd": "13:58", "Status": "COMPLETED"},
}

var marsQuality = []map[string]any{
	{"DefectCode": "BORE-OOT", "count": 3, "total_qty": 150, "last_inspector": "QA Lead", "last_ts": today + "T16:45:00Z"},
	{"DefectCode": "SURF-DING", "count": 2, "total_qty": 150, "last_inspector": "QA Lead", "last_ts": today + "T19:22:00Z"},
}

var marsSchedule = []map[string]any{
	{"WorkOrder": "WO-20240610-03", "PartNumber": "BMW1000D-360", "Revision": "C",
		"PlannedQty": 184, "scheduled_date": "2026-06-11", "ShiftNum": 2},
	{"WorkOrder": "WO-20240611-01", "PartNumber": "BMW2000E-180", "Revision": "A",
		"PlannedQty": 160, "scheduled_date": "2026-06-11", "ShiftNum": 1},
	{"WorkOrder": "WO-20240611-02", "PartNumber": "BMW3000F-240", "Revision": "B",
		"PlannedQty": 140, "scheduled_date": "2026-06-12", "ShiftNum": 2},
}

func handleMarsKpis(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "mars-kpis", marsKpis))
}

func handleMarsProduction(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "mars-production", marsProduction))
}

func handleMarsQuality(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "mars-quality", marsQuality))
}

func handleMarsSchedule(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "mars-schedule", marsSchedule))
}

// ── Production Status ──────────────────────────────────────────────────────────

type ProductionStatus struct {
	ResourceID  string  `json:"resource_id"`
	Status      string  `json:"status"`
	CurrentPart string  `json:"current_part"`
	Planned     int     `json:"planned"`
	Actual      int     `json:"actual"`
	Efficiency  float64 `json:"efficiency_pct"`
	CycleTime   float64 `json:"cycle_time_sec"`
	NextPart    string  `json:"next_part"`
	CyclesToday int     `json:"cycles_today"`
}

var productionStatusList = []ProductionStatus{
	{ResourceID: "WM15", Status: "running", CurrentPart: "BMW1000D-360", Planned: 184, Actual: 150, Efficiency: 81.5, CycleTime: 154.8, NextPart: "BMW2000E-180", CyclesToday: 847},
	{ResourceID: "WM16", Status: "running", CurrentPart: "BMW2000E-180", Planned: 184, Actual: 173, Efficiency: 94.2, CycleTime: 151.3, NextPart: "BMW1000D-360", CyclesToday: 912},
	{ResourceID: "WM17", Status: "downtime", CurrentPart: "BMW1000D-360", Planned: 184, Actual: 97, Efficiency: 52.7, CycleTime: 162.1, NextPart: "BMW1000D-360", CyclesToday: 412},
	{ResourceID: "WM18", Status: "running", CurrentPart: "BMW3000F-240", Planned: 184, Actual: 161, Efficiency: 87.6, CycleTime: 156.2, NextPart: "BMW3000F-240", CyclesToday: 765},
	{ResourceID: "WM19", Status: "idle", CurrentPart: "—", Planned: 184, Actual: 0, Efficiency: 0, CycleTime: 0, NextPart: "BMW1000D-360", CyclesToday: 0},
	{ResourceID: "WM20", Status: "running", CurrentPart: "BMW3000F-240", Planned: 184, Actual: 168, Efficiency: 91.3, CycleTime: 153.7, NextPart: "BMW2000E-180", CyclesToday: 834},
	{ResourceID: "WM21", Status: "running", CurrentPart: "BMW1500C-120", Planned: 184, Actual: 178, Efficiency: 96.8, CycleTime: 149.5, NextPart: "BMW1500C-120", CyclesToday: 943},
	{ResourceID: "WM22", Status: "running", CurrentPart: "BMW1500C-120", Planned: 184, Actual: 162, Efficiency: 88.0, CycleTime: 155.8, NextPart: "BMW2500D-300", CyclesToday: 798},
	{ResourceID: "WM23", Status: "downtime", CurrentPart: "BMW2500D-300", Planned: 184, Actual: 80, Efficiency: 43.5, CycleTime: 0, NextPart: "BMW2500D-300", CyclesToday: 320},
	{ResourceID: "WM24", Status: "running", CurrentPart: "BMW1000D-360", Planned: 184, Actual: 169, Efficiency: 92.1, CycleTime: 153.1, NextPart: "BMW1000D-360", CyclesToday: 856},
}

func handleProductionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if _, historical := historyForRequest(r, "production-status"); historical {
		writeJSON(w, historicalPayload(r, "production-status", productionStatusList))
		return
	}
	writeJSON(w, nextProductionStatus())
}

// ── Shipping Status ────────────────────────────────────────────────────────────

type CustomerDelivery struct {
	WorkOrder    string `json:"work_order"`
	Customer     string `json:"customer"`
	PartNumber   string `json:"part_number"`
	Qty          int    `json:"qty"`
	ShipBy       string `json:"ship_by"`
	Status       string `json:"status"`
	DeliveryDate string `json:"delivery_date"`
}

type ShippingStatus struct {
	PartsShippedToday  int                `json:"parts_shipped_today"`
	ShipmentCount      int                `json:"shipment_count"`
	PendingTrucks      int                `json:"pending_trucks"`
	LoadedTrucks       int                `json:"loaded_trucks"`
	ShippingDockStatus string             `json:"shipping_dock_status"`
	OnTimeRate         float64            `json:"on_time_rate_pct"`
	NextShipment       string             `json:"next_shipment"`
	DeliveryETA        string             `json:"delivery_eta"`
	CustomerDeliveries []CustomerDelivery `json:"customer_deliveries"`
}

var shippingStatus = ShippingStatus{
	PartsShippedToday:  1280,
	ShipmentCount:      3,
	PendingTrucks:      2,
	LoadedTrucks:       1,
	ShippingDockStatus: "ACTIVE",
	OnTimeRate:         94.7,
	NextShipment:       "WO-20240610-01 · 16:00",
	DeliveryETA:        "2026-06-11 08:00",
	CustomerDeliveries: []CustomerDelivery{
		{WorkOrder: "WO-20240610-01", Customer: "BMW AG Leipzig", PartNumber: "BMW1000D-360", Qty: 184, ShipBy: "16:00", Status: "IN_TRANSIT", DeliveryDate: "2026-06-11"},
		{WorkOrder: "WO-20240609-03", Customer: "BMW Group", PartNumber: "BMW2000E-180", Qty: 160, ShipBy: "14:00", Status: "ONTIME", DeliveryDate: "2026-06-10"},
		{WorkOrder: "WO-20240610-02", Customer: "BMW Dingolfing", PartNumber: "BMW1000D-360", Qty: 92, ShipBy: "20:00", Status: "PENDING", DeliveryDate: "2026-06-11"},
		{WorkOrder: "WO-20240608-02", Customer: "MINI Oxford", PartNumber: "BMW3000F-240", Qty: 140, ShipBy: "12:00", Status: "LATE", DeliveryDate: "2026-06-10"},
	},
}

func handleShippingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, historicalPayload(r, "shipping-status", shippingStatus))
}

func handleWeekly(w http.ResponseWriter, r *http.Request) {
	resource := qp(r, "resource", "WM15")
	anchorDate := qp(r, "date", time.Now().Format("2006-01-02"))
	writeJSON(w, map[string]any{"resource": resource, "days": weeklyData(resource, anchorDate)})
}

func handleUnavailable(w http.ResponseWriter, r *http.Request) {
	http.Error(w, `{"error":"not available in mock mode"}`, http.StatusServiceUnavailable)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", cors(handleHealth))
	mux.HandleFunc("/api/health", cors(handleHealth))
	mux.HandleFunc("/api/setup/demo", cors(deployment.HandleDemo))
	mux.HandleFunc("/api/setup/test-connection", cors(deployment.HandleTestConnection))
	mux.HandleFunc("/api/setup/import-excel", cors(deployment.HandleImportExcel))
	mux.HandleFunc("/api/oee/entries", cors(handleMockOEEEntries))
	mux.HandleFunc("/api/notes", cors(handleMockNotes))
	mux.HandleFunc("/api/stations", cors(handleStations))
	mux.HandleFunc("/api/kpis", cors(handleKPIs))
	mux.HandleFunc("/api/production", cors(handleProduction))
	mux.HandleFunc("/api/productivity", cors(handleProductivity))
	mux.HandleFunc("/api/issues", cors(handleIssues))
	mux.HandleFunc("/api/downtime", cors(handleDowntime))
	mux.HandleFunc("/api/confirm", cors(handleConfirm))
	mux.HandleFunc("/api/robotpress", cors(handleRobotPress))
	mux.HandleFunc("/api/robotpress/history", cors(handleRobotPress))
	mux.HandleFunc("/api/mars/kpis", cors(handleMarsKpis))
	mux.HandleFunc("/api/mars/production", cors(handleMarsProduction))
	mux.HandleFunc("/api/mars/quality", cors(handleMarsQuality))
	mux.HandleFunc("/api/mars/schedule", cors(handleMarsSchedule))
	mux.HandleFunc("/api/production/status", cors(handleProductionStatus))
	mux.HandleFunc("/api/shipping/status", cors(handleShippingStatus))
	mux.HandleFunc("/api/weekly", cors(handleWeekly))

	addr := ":3001"
	fmt.Println("🟢  Mock LSB API  →  http://localhost:3001")
	fmt.Println("    10 stations: WM15–WM24 | Shift 2 | JPH target:", jphTarget)
	fmt.Println("    Endpoints: /api/stations  /api/kpis  /api/production  /api/productivity  /api/issues  /api/downtime")
	fmt.Println()
	if err := http.ListenAndServe(addr, mux); err != nil {
		panic(err)
	}
}
