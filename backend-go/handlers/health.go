package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"lsb-api/db"
	"lsb-api/llm"
)

type HealthSnapshot struct {
	Mode string
	LLM  string
}

var lastLLMHealth = struct {
	sync.RWMutex
	status string
}{status: "unreachable"}

// CheckLLM pings the LLM and records the result for background health reports.
func CheckLLM(ctx context.Context) error {
	err := llm.Ping(ctx)
	status := "ok"
	if err != nil {
		status = "unreachable"
	}
	lastLLMHealth.Lock()
	lastLLMHealth.status = status
	lastLLMHealth.Unlock()
	return err
}

// CurrentHealthStatus returns the current mode and the most recent LLM ping result.
func CurrentHealthStatus() HealthSnapshot {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("LSB_MODE")))
	if mode == "" {
		mode = "unconfigured"
	}
	lastLLMHealth.RLock()
	llmStatus := lastLLMHealth.status
	lastLLMHealth.RUnlock()
	return HealthSnapshot{Mode: mode, LLM: llmStatus}
}

// HandleHealth reports application, database-mode, and LLM availability.
func HandleHealth(w http.ResponseWriter, _ *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = CheckLLM(ctx)
	health := CurrentHealthStatus()

	payload := map[string]any{
		"status":  "ok",
		"mode":    health.Mode,
		"version": "2.0",
		"llm":     health.LLM,
		"mssql":   "unreachable",
	}
	if db.MSSQLHealthy() {
		payload["mssql"] = "ok"
	}
	if health.Mode == "production" {
		payload["db"] = os.Getenv("LSB_DB_NAME")
	}
	if health.Mode == "unconfigured" {
		payload["status"] = "unconfigured"
	}
	writeJSON(w, payload)
}
