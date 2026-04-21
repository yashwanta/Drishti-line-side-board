package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"lsb-api/db"
)

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

// HandleKPIs → GET /api/kpis?resource=WM15&shift=2
func HandleKPIs(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	shift, _ := strconv.Atoi(queryParam(r, "shift", os.Getenv("SHIFT_NUM")))
	jphTarget, _ := strconv.Atoi(os.Getenv("JPH_TARGET"))
	today := time.Now().Format("2006-01-02")

	prodTable := os.Getenv("PROD_TABLE")
	issuesTable := os.Getenv("ISSUES_TABLE")

	// Aggregate from production_log
	row := db.Pool.QueryRow(`
		SELECT
			COALESCE(SUM(good_count),0)   AS actual,
			COALESCE(SUM(scrap_count),0)  AS scrap,
			COALESCE(AVG(cycle_time_sec),0) AS avg_cycle,
			COALESCE(
				EXTRACT(EPOCH FROM (MAX(event_ts) - MIN(event_ts)))/3600.0,
				0
			) AS hrs
		FROM `+prodTable+`
		WHERE resource_id = $1
		  AND shift_num   = $2
		  AND DATE(event_ts) = $3`,
		resource, shift, today,
	)

	var actual, scrap int
	var avgCycle, hrs float64
	_ = row.Scan(&actual, &scrap, &avgCycle, &hrs)

	// Hours worked: clamp to realistic shift length
	if hrs > 12 {
		hrs = 12
	}

	plan := jphTarget * int(hrs+0.5) // round to nearest hour
	if plan == 0 {
		plan = jphTarget * 8
	}

	var eff, fpy float64
	if plan > 0 {
		eff = float64(actual) / float64(plan) * 100
	}
	total := actual + scrap
	if total > 0 {
		fpy = float64(actual) / float64(total) * 100
	}

	// Open issues count
	issueRow := db.Pool.QueryRow(`
		SELECT COUNT(*) FROM `+issuesTable+`
		WHERE resource_id = $1 AND status <> 'closed'`, resource)
	var openIssues int
	_ = issueRow.Scan(&openIssues)

	resp := KPIResponse{
		Resource:    resource,
		Shift:       shift,
		Date:        today,
		Plan:        plan,
		Actual:      actual,
		GoodCount:   actual,
		ScrapCount:  scrap,
		Efficiency:  roundF(eff, 1),
		FPY:         roundF(fpy, 1),
		AvgCycle:    roundF(avgCycle, 2),
		HoursWorked: roundF(hrs, 2),
		OpenIssues:  openIssues,
		JphTarget:   jphTarget,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	writeJSON(w, resp)
}
