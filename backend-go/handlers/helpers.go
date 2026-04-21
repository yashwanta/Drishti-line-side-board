package handlers

import (
	"encoding/json"
	"math"
	"net/http"
)

// writeJSON serialises v as JSON and writes to w with 200.
func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error body with the given HTTP status code.
func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// decodeBody parses the JSON request body into v.
func decodeBody(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// queryParam returns the first value of the named URL query param,
// falling back to def if not present.
func queryParam(r *http.Request, name, def string) string {
	if v := r.URL.Query().Get(name); v != "" {
		return v
	}
	return def
}

// roundF rounds f to dp decimal places.
func roundF(f float64, dp int) float64 {
	factor := math.Pow10(dp)
	return math.Round(f*factor) / factor
}
