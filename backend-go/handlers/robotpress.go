package handlers

import (
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// HandleRobotPress → GET /api/robotpress
// Proxies to Java microservice → GET {JAVA_SERVICE_URL}/robotpress/status
// Response forwarded verbatim; Java owns the polling logic.
func HandleRobotPress(w http.ResponseWriter, r *http.Request) {
	javaSvc := os.Getenv("JAVA_SERVICE_URL")
	target := javaSvc + "/robotpress/status"

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		log.Printf("[robotpress] Java svc unreachable: %v", err)
		writeError(w, http.StatusServiceUnavailable, "robot press service unavailable")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// HandleRobotPressHistory → GET /api/robotpress/history
// Proxies to Java microservice → GET {JAVA_SERVICE_URL}/robotpress/history
func HandleRobotPressHistory(w http.ResponseWriter, r *http.Request) {
	javaSvc := os.Getenv("JAVA_SERVICE_URL")
	target := javaSvc + "/robotpress/history"

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		log.Printf("[robotpress/history] Java svc unreachable: %v", err)
		writeError(w, http.StatusServiceUnavailable, "robot press history unavailable")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
