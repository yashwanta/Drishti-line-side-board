package handlers

import (
	"net/http"
	"os"
	"time"

	"lsb-api/db"
)

type DowntimeEvent struct {
	ID         int    `json:"id"`
	Resource   string `json:"resource"`
	ReasonCode string `json:"reason_code"`
	Minutes    int    `json:"minutes"`
	Comment    string `json:"comment"`
	StartTS    string `json:"start_ts"`
	LoggedBy   string `json:"logged_by"`
}

// HandleDowntimeGET → GET /api/downtime?resource=WM15
func HandleDowntimeGET(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	dtTable := os.Getenv("DT_TABLE")
	today := time.Now().Format("2006-01-02")

	rows, err := db.Pool.Query(`
		SELECT
			id,
			resource_id,
			COALESCE(reason_code,''),
			COALESCE(minutes_lost,0),
			COALESCE(comment,''),
			COALESCE(start_ts::TEXT,''),
			COALESCE(logged_by,'')
		FROM `+dtTable+`
		WHERE resource_id = $1
		  AND DATE(start_ts) = $2
		ORDER BY start_ts DESC`,
		resource, today,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []DowntimeEvent
	for rows.Next() {
		var de DowntimeEvent
		_ = rows.Scan(
			&de.ID, &de.Resource, &de.ReasonCode,
			&de.Minutes, &de.Comment, &de.StartTS, &de.LoggedBy,
		)
		result = append(result, de)
	}
	if result == nil {
		result = []DowntimeEvent{}
	}

	// Compute total lost minutes for the day
	var totalMins int
	for _, d := range result {
		totalMins += d.Minutes
	}
	writeJSON(w, map[string]interface{}{
		"events":      result,
		"total_mins":  totalMins,
		"resource":    resource,
		"date":        today,
	})
}

// HandleDowntimePOST → POST /api/downtime
func HandleDowntimePOST(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Resource   string `json:"resource"`
		ReasonCode string `json:"reason_code"`
		Minutes    int    `json:"minutes"`
		Comment    string `json:"comment"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Resource == "" {
		body.Resource = os.Getenv("RESOURCE_ID")
	}
	if body.Minutes <= 0 {
		writeError(w, http.StatusBadRequest, "minutes must be > 0")
		return
	}

	operator := os.Getenv("OPERATOR_NAME")
	dtTable := os.Getenv("DT_TABLE")

	var newID int
	err := db.Pool.QueryRow(`
		INSERT INTO `+dtTable+`
		  (resource_id, reason_code, minutes_lost, comment, start_ts, logged_by)
		VALUES ($1, $2, $3, $4, NOW(), $5)
		RETURNING id`,
		body.Resource, body.ReasonCode, body.Minutes, body.Comment, operator,
	).Scan(&newID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]interface{}{
		"status":  "logged",
		"id":      newID,
		"minutes": body.Minutes,
		"ts":      time.Now().UTC().Format(time.RFC3339),
	})
}
