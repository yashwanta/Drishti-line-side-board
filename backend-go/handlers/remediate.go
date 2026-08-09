package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"lsb-api/llm"
)

const remediationSystemPrompt = `You are an IT remediation assistant for a manufacturing plant server.
The server runs one Windows service managed by NSSM:
- LSB-Go (Go API, port 3001, connects to PostgreSQL 15 and directly
  to MARS SQL Server)
On Linux the same service runs as a systemd unit.
Given an issue description, return ONLY a valid JSON object — no
markdown, no text outside the JSON:
{
  "summary": "one sentence describing the problem",
  "safe_actions": [
    {
      "action": "what to do",
      "windows_command": "exact command for Windows",
      "linux_command": "exact command for Linux",
      "risk_level": "low|medium|high"
    }
  ],
  "do_not_do": ["list of actions to avoid"],
  "escalate_if": "condition that means this needs senior IT"
}`

type RemediationAction struct {
	Action         string `json:"action"`
	WindowsCommand string `json:"windows_command"`
	LinuxCommand   string `json:"linux_command"`
	RiskLevel      string `json:"risk_level"`
}

type RemediationResponse struct {
	Summary     string              `json:"summary"`
	SafeActions []RemediationAction `json:"safe_actions"`
	DoNotDo     []string            `json:"do_not_do"`
	EscalateIf  string              `json:"escalate_if"`
}

// Auto-execution is intentionally disabled for safety.
// This endpoint returns suggestions only. No system commands
// are ever executed by this handler.
func HandleRemediate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	var request struct {
		Issue string `json:"issue"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	request.Issue = strings.TrimSpace(request.Issue)
	if request.Issue == "" {
		writeError(w, http.StatusBadRequest, "issue is required")
		return
	}
	safeActionsCount := 0
	defer func() {
		slog.Info("LLM remediation request",
			"timestamp", time.Now().UTC().Format(time.RFC3339),
			"issue_text_length", len(request.Issue),
			"safe_actions_count", safeActionsCount,
		)
	}()

	response, err := llm.Ask(r.Context(), remediationSystemPrompt, request.Issue)
	if err != nil {
		slog.Error("LLM remediation request failed", "error", err)
		writeError(w, http.StatusBadGateway, "remediation suggestions unavailable")
		return
	}

	var remediation RemediationResponse
	if err := json.Unmarshal([]byte(response), &remediation); err != nil {
		slog.Error("parse LLM remediation response failed", "error", err)
		writeError(w, http.StatusBadGateway, "invalid remediation response")
		return
	}
	if remediation.Summary == "" || remediation.EscalateIf == "" {
		slog.Error("LLM remediation response missing required fields")
		writeError(w, http.StatusBadGateway, "invalid remediation response")
		return
	}
	if remediation.SafeActions == nil {
		remediation.SafeActions = []RemediationAction{}
	}
	if remediation.DoNotDo == nil {
		remediation.DoNotDo = []string{}
	}
	safeActionsCount = len(remediation.SafeActions)
	writeJSON(w, remediation)
}
