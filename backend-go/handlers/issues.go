package handlers

import (
	"net/http"
	"os"
	"time"

	"lsb-api/db"
)

type Issue struct {
	ID           int    `json:"id"`
	Resource     string `json:"resource"`
	IssueType    string `json:"issue_type"`
	Severity     string `json:"severity"`  // critical | major | minor
	Description  string `json:"description"`
	Status       string `json:"status"`    // open | in_progress | resolved | closed
	RaisedBy     string `json:"raised_by"`
	AcknowledgedBy string `json:"acknowledged_by"`
	RaisedAt     string `json:"raised_at"`
	UpdatedAt    string `json:"updated_at"`
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
