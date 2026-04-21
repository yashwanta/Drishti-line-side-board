package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"lsb-api/db"
)

type ProductivityHour struct {
	Hour      int     `json:"hour"`
	Target    int     `json:"target"`
	Actual    int     `json:"actual"`
	Gap       int     `json:"gap"`
	EffPct    float64 `json:"efficiency_pct"`
	ScrapRate float64 `json:"scrap_rate_pct"`
}

// HandleProductivity → GET /api/productivity?resource=WM15&shift=2
func HandleProductivity(w http.ResponseWriter, r *http.Request) {
	resource := queryParam(r, "resource", os.Getenv("RESOURCE_ID"))
	shift, _ := strconv.Atoi(queryParam(r, "shift", os.Getenv("SHIFT_NUM")))
	jphTarget, _ := strconv.Atoi(os.Getenv("JPH_TARGET"))
	today := time.Now().Format("2006-01-02")
	prodTable := os.Getenv("PROD_TABLE")

	rows, err := db.Pool.Query(`
		SELECT
			EXTRACT(HOUR FROM event_ts)::INT  AS hour,
			COALESCE(SUM(good_count),0)       AS good,
			COALESCE(SUM(scrap_count),0)      AS scrap
		FROM `+prodTable+`
		WHERE resource_id = $1
		  AND shift_num   = $2
		  AND DATE(event_ts) = $3
		GROUP BY hour
		ORDER BY hour`,
		resource, shift, today,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var result []ProductivityHour
	for rows.Next() {
		var ph ProductivityHour
		var scrap int
		_ = rows.Scan(&ph.Hour, &ph.Actual, &scrap)
		ph.Target = jphTarget
		ph.Gap = ph.Target - ph.Actual
		if ph.Target > 0 {
			ph.EffPct = roundF(float64(ph.Actual)/float64(ph.Target)*100, 1)
		}
		total := ph.Actual + scrap
		if total > 0 {
			ph.ScrapRate = roundF(float64(scrap)/float64(total)*100, 1)
		}
		result = append(result, ph)
	}
	if result == nil {
		result = []ProductivityHour{}
	}
	writeJSON(w, result)
}
