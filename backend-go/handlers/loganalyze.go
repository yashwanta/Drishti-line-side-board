package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"lsb-api/llm"
)

const logAnalysisSystemPrompt = `You are an expert in Go microservices.
You are diagnosing a production manufacturing dashboard called
Line Side Board (LSB). It has one Windows service:
- LSB-Go: serves the React frontend and API on port 3001,
  connects to PostgreSQL for OEE data and directly to MARS SQL
  Server (read-only) for production KPIs.
Analyse the error logs below and return ONLY a valid JSON object
with this exact structure — no markdown, no explanation outside JSON:
{
  "issues": [
    {
      "service": "LSB-Go",
      "severity": "info|warning|critical",
      "summary": "one sentence",
      "likely_cause": "one sentence",
      "recommended_fix": "one sentence"
    }
  ],
  "overall_health": "ok|degraded|critical",
  "one_liner": "one sentence summary for the IT manager"
}`

const (
	logAnalysisCacheTTL = 5 * time.Minute
	logAnalysisInterval = 60 * time.Minute
	maxLogLines         = 200
)

type LogIssue struct {
	Service        string `json:"service"`
	Severity       string `json:"severity"`
	Summary        string `json:"summary"`
	LikelyCause    string `json:"likely_cause"`
	RecommendedFix string `json:"recommended_fix"`
}

type LogDiagnosis struct {
	Issues        []LogIssue `json:"issues"`
	OverallHealth string     `json:"overall_health"`
	OneLiner      string     `json:"one_liner"`
}

var logAnalysisCache struct {
	sync.Mutex
	diagnosis LogDiagnosis
	expiresAt time.Time
	valid     bool
}

// HandleLogAnalysis handles GET /api/llm/log-analysis.
func HandleLogAnalysis(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	diagnosis, err := AnalyzeLogs(r.Context())
	if err != nil {
		slog.Error("LLM log analysis failed", "error", err)
		writeError(w, http.StatusBadGateway, "log analysis unavailable")
		return
	}
	writeJSON(w, diagnosis)
}

// AnalyzeLogs returns a cached diagnosis or asks the LLM to analyze the logs.
func AnalyzeLogs(ctx context.Context) (LogDiagnosis, error) {
	logAnalysisCache.Lock()
	defer logAnalysisCache.Unlock()

	if logAnalysisCache.valid && time.Now().Before(logAnalysisCache.expiresAt) {
		return logAnalysisCache.diagnosis, nil
	}

	prompt, err := buildLogPrompt()
	if err != nil {
		return LogDiagnosis{}, err
	}
	response, err := llm.Ask(ctx, logAnalysisSystemPrompt, prompt)
	if err != nil {
		return LogDiagnosis{}, fmt.Errorf("analyze logs with LLM: %w", err)
	}

	var diagnosis LogDiagnosis
	if err := json.Unmarshal([]byte(response), &diagnosis); err != nil {
		return LogDiagnosis{}, fmt.Errorf("parse LLM log diagnosis: %w", err)
	}
	if diagnosis.Issues == nil {
		diagnosis.Issues = []LogIssue{}
	}
	if diagnosis.OverallHealth == "" || diagnosis.OneLiner == "" {
		return LogDiagnosis{}, errors.New("LLM log diagnosis is missing required fields")
	}

	logAnalysisCache.diagnosis = diagnosis
	logAnalysisCache.expiresAt = time.Now().Add(logAnalysisCacheTTL)
	logAnalysisCache.valid = true
	return diagnosis, nil
}

func buildLogPrompt() (string, error) {
	root := projectRoot()
	logFiles := []string{"lsb-go-error.log"}
	sections := make([]string, 0, len(logFiles))
	for _, name := range logFiles {
		path := filepath.Join(root, "logs", name)
		lines, err := readLastLines(path, maxLogLines)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", fmt.Errorf("read %s: %w", path, err)
		}
		sections = append(sections, "===== logs/"+name+" =====\n"+strings.Join(lines, "\n"))
	}
	if len(sections) == 0 {
		return "No error log files were found.", nil
	}
	return strings.Join(sections, "\n\n"), nil
}

func readLastLines(path string, limit int) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	lines := make([]string, 0, limit)
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		if len(lines) == limit {
			copy(lines, lines[1:])
			lines[limit-1] = scanner.Text()
			continue
		}
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

// StartLogAnalyzer starts the hourly background diagnosis loop.
func StartLogAnalyzer(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(logAnalysisInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				diagnosis, err := AnalyzeLogs(ctx)
				if err != nil {
					slog.Warn("scheduled LLM log analysis failed", "error", err)
					continue
				}
				slog.Warn("scheduled LLM log analysis", "one_liner", diagnosis.OneLiner)
				if diagnosis.OverallHealth == "critical" {
					if err := writeCriticalAlert(diagnosis); err != nil {
						slog.Warn("write LLM critical alert failed", "error", err)
					}
				}
			}
		}
	}()
}

func writeCriticalAlert(diagnosis LogDiagnosis) error {
	content, err := json.MarshalIndent(diagnosis, "", "  ")
	if err != nil {
		return fmt.Errorf("format critical diagnosis: %w", err)
	}
	logDir := filepath.Join(projectRoot(), "logs")
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return fmt.Errorf("create logs directory: %w", err)
	}
	// Colons are replaced because they are invalid in Windows filenames.
	timestamp := strings.ReplaceAll(time.Now().UTC().Format(time.RFC3339), ":", "-")
	path := filepath.Join(logDir, "llm-alert-"+timestamp+".txt")
	if err := os.WriteFile(path, append(content, '\n'), 0o600); err != nil {
		return fmt.Errorf("write critical alert: %w", err)
	}
	return nil
}

func projectRoot() string {
	candidates := []string{".", ".."}
	if executable, err := os.Executable(); err == nil {
		dir := filepath.Dir(executable)
		candidates = append(candidates, dir, filepath.Dir(dir))
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(filepath.Join(candidate, "api", "llm-config.json")); err == nil {
			return candidate
		}
	}
	return "."
}
