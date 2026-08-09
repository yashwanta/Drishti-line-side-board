package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type config struct {
	BaseURL        string `json:"base_url"`
	Model          string `json:"model"`
	TimeoutSeconds int    `json:"timeout_seconds"`
	MaxTokens      int    `json:"max_tokens"`
}

type clientState struct {
	sync.RWMutex
	config config
	apiKey string
	client *http.Client
	loaded bool
}

var state clientState

// LoadConfig merges the non-secret JSON configuration with LLM_API_KEY.
func LoadConfig() error {
	path, err := findConfigFile()
	if err != nil {
		return err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read LLM config: %w", err)
	}

	var cfg config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse LLM config: %w", err)
	}
	cfg.BaseURL = strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	cfg.Model = strings.TrimSpace(cfg.Model)
	if cfg.BaseURL == "" || cfg.Model == "" || cfg.TimeoutSeconds <= 0 || cfg.MaxTokens <= 0 {
		return errors.New("LLM config is incomplete")
	}

	apiKey := strings.TrimSpace(os.Getenv("LLM_API_KEY"))
	if apiKey == "" {
		return errors.New("LLM_API_KEY is not configured")
	}

	state.Lock()
	state.config = cfg
	state.apiKey = apiKey
	state.client = &http.Client{Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second}
	state.loaded = true
	state.Unlock()
	return nil
}

func findConfigFile() (string, error) {
	candidates := []string{
		filepath.Join("api", "llm-config.json"),
		filepath.Join("..", "api", "llm-config.json"),
	}
	if executable, err := os.Executable(); err == nil {
		dir := filepath.Dir(executable)
		candidates = append(candidates,
			filepath.Join(dir, "api", "llm-config.json"),
			filepath.Join(dir, "..", "api", "llm-config.json"),
		)
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", errors.New("api/llm-config.json not found")
}

// Ask submits a system and user prompt to the configured chat-completions API.
func Ask(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	state.RLock()
	cfg := state.config
	apiKey := state.apiKey
	client := state.client
	loaded := state.loaded
	state.RUnlock()
	if !loaded || client == nil {
		return "", errors.New("LLM client is not configured")
	}

	payload := struct {
		Model     string    `json:"model"`
		Messages  []message `json:"messages"`
		MaxTokens int       `json:"max_tokens"`
		Stream    bool      `json:"stream"`
	}{
		Model: cfg.Model,
		Messages: []message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens: cfg.MaxTokens,
		Stream:    false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encode LLM request: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create LLM request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+apiKey)

	started := time.Now()
	response, err := client.Do(request)
	if err != nil {
		slog.Debug("LLM request", "model", cfg.Model, "prompt_bytes", len(systemPrompt)+len(userPrompt), "response_bytes", 0, "latency_ms", time.Since(started).Milliseconds())
		return "", fmt.Errorf("send LLM request: %w", err)
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(response.Body)
	slog.Debug("LLM request", "model", cfg.Model, "prompt_bytes", len(systemPrompt)+len(userPrompt), "response_bytes", len(raw), "latency_ms", time.Since(started).Milliseconds())
	if err != nil {
		return "", fmt.Errorf("read LLM response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("LLM HTTP %d: %s", response.StatusCode, raw)
	}

	var decoded completionResponse
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return "", fmt.Errorf("parse LLM response: %w; raw body: %s", err, raw)
	}
	var content string
	if len(decoded.Choices) > 0 {
		content = decoded.Choices[0].Message.Content
	}
	if strings.TrimSpace(content) == "" {
		content = decoded.Message.Content
	}
	if strings.TrimSpace(content) == "" {
		content = decoded.Response
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", fmt.Errorf("LLM response contained no content; raw body: %s", raw)
	}
	return content, nil
}

// Ping verifies that the configured server accepts a minimal request.
func Ping(ctx context.Context) error {
	_, err := Ask(ctx, "Reply with one word.", "ping")
	return err
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type completionResponse struct {
	Choices []struct {
		Message message `json:"message"`
	} `json:"choices"`
	Message  message `json:"message"`
	Response string  `json:"response"`
}
