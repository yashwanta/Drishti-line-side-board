package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"lsb-api/db"
)

type ProductionRow struct {
	Hour        int     `json:"hour"`
	PartNumber  string  `json:"part_number"`
	Operator    string  `json:"operator"`
	Plan        int     `json:"plan"`
	Actual      int     `json:"actual"`
	Good        int     `json:"good_count"`
	Scrap       int     `json:"scrap_count"`
	Gap         int     `json:"gap"`
	CycleTime   float64 `json:"cycle_time_sec"`
	Notes       string  `json:"notes"`
	Confirmed   bool    `json:"confirmed"`
	ConfirmedBy string  `json:"confirmed_by"`
	ConfirmedAt string  `json:"confirmed_at"`
}

// HandleProduction → GET /api/production?resource=WM15&shift=2
func HandleProduction(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	shift, _ := strconv.Atoi(queryParam(r, "shift", os.Getenv("SHIFT_NUM")))
	jphTarget, _ := strconv.Atoi(os.Getenv("JPH_TARGET"))
	today := time.Now().Format("2006-01-02")
	prodTable := os.Getenv("PROD_TABLE")

	rows, err := db.Pool.Query(`
		SELECT
			EXTRACT(HOUR FROM event_ts)::INT       AS hour,
			COALESCE(part_number, '')              AS part_number,
			COALESCE(operator_name, '')            AS operator,
			COALESCE(SUM(good_count),0)            AS good,
			COALESCE(SUM(scrap_count),0)           AS scrap,
			COALESCE(AVG(cycle_time_sec),0)        AS cycle,
			COALESCE(MAX(notes),'')                AS notes,
			BOOL_OR(confirmed)                     AS confirmed,
			COALESCE(MAX(confirmed_by),'')         AS confirmed_by,
			COALESCE(MAX(confirmed_at::TEXT),'')   AS confirmed_at
		FROM `+prodTable+`
		WHERE resource_id = $1
		  AND shift_num   = $2
		  AND DATE(event_ts) = $3
		GROUP BY hour, part_number, operator_name
		ORDER BY hour`,
		resource, shift, today,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []ProductionRow
	for rows.Next() {
		var pr ProductionRow
		_ = rows.Scan(
			&pr.Hour, &pr.PartNumber, &pr.Operator,
			&pr.Good, &pr.Scrap, &pr.CycleTime,
			&pr.Notes, &pr.Confirmed, &pr.ConfirmedBy, &pr.ConfirmedAt,
		)
		pr.Actual = pr.Good
		pr.Plan = jphTarget
		pr.Gap = pr.Plan - pr.Actual
		result = append(result, pr)
	}
	if result == nil {
		result = []ProductionRow{}
	}
	writeJSON(w, result)
}

// HandleConfirm → POST /api/confirm  body: {"resource":"WM15","shift":2,"hour":14}
func HandleConfirm(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Resource string `json:"resource"`
		Shift    int    `json:"shift"`
		Hour     int    `json:"hour"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Resource == "" {
		body.Resource = os.Getenv("RESOURCE_ID")
	}
	operator := os.Getenv("OPERATOR_NAME")
	prodTable := os.Getenv("PROD_TABLE")
	today := time.Now().Format("2006-01-02")

	_, err := db.Pool.Exec(`
		UPDATE `+prodTable+`
		SET confirmed = TRUE,
		    confirmed_by = $1,
		    confirmed_at = NOW()
		WHERE resource_id = $2
		  AND shift_num   = $3
		  AND DATE(event_ts) = $4
		  AND EXTRACT(HOUR FROM event_ts)::INT = $5`,
		operator, body.Resource, body.Shift, today, body.Hour,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "confirmed", "hour": strconv.Itoa(body.Hour)})
}
