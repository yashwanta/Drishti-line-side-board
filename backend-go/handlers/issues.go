package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"lsb-api/db"
)

type Issue struct {
	ID             int    `json:"id"`
	Resource       string `json:"resource"`
	IssueType      string `json:"issue_type"`
	Severity       string `json:"severity"`  // critical | major | minor
	Description    string `json:"description"`
	Status         string `json:"status"`    // open | in_progress | resolved | closed
	RaisedBy       string `json:"raised_by"`
	AcknowledgedBy string `json:"acknowledged_by"`
	RaisedAt       string `json:"raised_at"`
	UpdatedAt      string `json:"updated_at"`
}

// HandleIssues → GET /api/issues?resource=WM15
func HandleIssues(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	issuesTable := os.Getenv("ISSUES_TABLE")

	rows, err := db.Pool.Query(`
		SELECT
			id,
			resource_id,
			COALESCE(issue_type,''),
			COALESCE(severity,'minor'),
			COALESCE(description,''),
			COALESCE(status,'open'),
			COALESCE(raised_by,''),
			COALESCE(acknowledged_by,''),
			COALESCE(raised_at::TEXT,''),
			COALESCE(updated_at::TEXT,'')
		FROM `+issuesTable+`
		WHERE resource_id = $1
		  AND status <> 'closed'
		ORDER BY
			CASE severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 ELSE 3 END,
			raised_at DESC`,
		resource,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []Issue
	for rows.Next() {
		var iss Issue
		_ = rows.Scan(
			&iss.ID, &iss.Resource, &iss.IssueType, &iss.Severity,
			&iss.Description, &iss.Status, &iss.RaisedBy,
			&iss.AcknowledgedBy, &iss.RaisedAt, &iss.UpdatedAt,
		)
		result = append(result, iss)
	}
	if result == nil {
		result = []Issue{}
	}
	writeJSON(w, result)
}

// HandleRaiseIssue → POST /api/issues
func HandleRaiseIssue(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Resource    string `json:"resource"`
		IssueType   string `json:"issue_type"`
		Severity    string `json:"severity"`
		Description string `json:"description"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Resource == "" {
		body.Resource = os.Getenv("RESOURCE_ID")
	}
	if body.Severity == "" {
		body.Severity = "minor"
	}
	issuesTable := os.Getenv("ISSUES_TABLE")
	operator := os.Getenv("OPERATOR_NAME")

	var newID int
	err := db.Pool.QueryRow(`
		INSERT INTO `+issuesTable+`
		  (resource_id, issue_type, severity, description, status, raised_by, raised_at, updated_at)
		VALUES ($1, $2, $3, $4, 'open', $5, NOW(), NOW())
		RETURNING id`,
		body.Resource, body.IssueType, body.Severity, body.Description, operator,
	).Scan(&newID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]interface{}{"status": "created", "id": newID, "raised_at": time.Now().UTC().Format(time.RFC3339)})
}

// OEECause is a ranked downtime cause from oee_entries
type OEECause struct {
	CauseText   string `json:"cause_text"`
	CauseType   string `json:"cause_type"` // Tool | Maintenance | Production
	Occurrences int    `json:"occurrences"`
	TotalDTMin  int    `json:"total_dt_min"`
}

// HandleOEECauses → GET /api/issues/oee-causes?days=30
// Aggregates top_tool_issue, top_maint_issue, top_prod_issue from oee_entries
// to show plant-wide repeating downtime causes alongside raised issues.
func HandleOEECauses(w http.ResponseWriter, r *http.Request) {
	oeeTable := os.Getenv("OEE_TABLE")
	if oeeTable == "" {
		oeeTable = "oee_entries"
	}

	days := 30
	if d, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && d > 0 && d <= 365 {
		days = d
	}

	rows, err := db.Pool.Query(`
		SELECT cause_text, cause_type, COUNT(*)::INT AS occurrences, COALESCE(SUM(dt_min),0)::INT AS total_dt_min
		FROM (
			SELECT top_tool_issue   AS cause_text, 'Tool'        AS cause_type, tool_dt_min  AS dt_min
			FROM `+oeeTable+` WHERE entry_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
			  AND top_tool_issue  IS NOT NULL AND top_tool_issue  <> ''
			UNION ALL
			SELECT top_maint_issue  AS cause_text, 'Maintenance' AS cause_type, maint_dt_min AS dt_min
			FROM `+oeeTable+` WHERE entry_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
			  AND top_maint_issue IS NOT NULL AND top_maint_issue <> ''
			UNION ALL
			SELECT top_prod_issue   AS cause_text, 'Production'  AS cause_type, prod_dt_min  AS dt_min
			FROM `+oeeTable+` WHERE entry_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
			  AND top_prod_issue  IS NOT NULL AND top_prod_issue  <> ''
		) t
		GROUP BY cause_text, cause_type
		ORDER BY occurrences DESC, total_dt_min DESC
		LIMIT 30`,
		strconv.Itoa(days),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []OEECause
	for rows.Next() {
		var c OEECause
		_ = rows.Scan(&c.CauseText, &c.CauseType, &c.Occurrences, &c.TotalDTMin)
		result = append(result, c)
	}
	if result == nil {
		result = []OEECause{}
	}
	writeJSON(w, result)
}

// HandleIssuesAnalytics → GET /api/issues/analytics?resource=WM15&days=30
// Returns ALL issues (all statuses) in the given date range for aggregation on the frontend.
func HandleIssuesAnalytics(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	issuesTable := os.Getenv("ISSUES_TABLE")

	days := 30
	if d, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && d > 0 && d <= 365 {
		days = d
	}

	rows, err := db.Pool.Query(`
		SELECT
			id,
			resource_id,
			COALESCE(issue_type,'General'),
			COALESCE(severity,'minor'),
			COALESCE(description,''),
			COALESCE(status,'open'),
			COALESCE(raised_by,''),
			COALESCE(acknowledged_by,''),
			COALESCE(raised_at::TEXT,''),
			COALESCE(updated_at::TEXT,'')
		FROM `+issuesTable+`
		WHERE resource_id = $1
		  AND raised_at >= NOW() - ($2 || ' days')::INTERVAL
		ORDER BY raised_at DESC`,
		resource, strconv.Itoa(days),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []Issue
	for rows.Next() {
		var iss Issue
		_ = rows.Scan(
			&iss.ID, &iss.Resource, &iss.IssueType, &iss.Severity,
			&iss.Description, &iss.Status, &iss.RaisedBy,
			&iss.AcknowledgedBy, &iss.RaisedAt, &iss.UpdatedAt,
		)
		result = append(result, iss)
	}
	if result == nil {
		result = []Issue{}
	}
	writeJSON(w, result)
}
