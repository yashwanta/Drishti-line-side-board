package handlers

import "net/http"

// HandleRobotPress reports that no direct robot-press data source is configured.
func HandleRobotPress(w http.ResponseWriter, _ *http.Request) {
	writeMARSResponse(w, http.StatusServiceUnavailable, map[string]string{
		"error": "robot press integration not configured",
	})
}

// HandleRobotPressHistory reports that no direct history data source is configured.
func HandleRobotPressHistory(w http.ResponseWriter, _ *http.Request) {
	writeMARSResponse(w, http.StatusServiceUnavailable, map[string]string{
		"error": "robot press history integration not configured",
	})
}
