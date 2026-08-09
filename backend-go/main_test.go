package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthMock(t *testing.T) {
	t.Setenv("LSB_MODE", "mock")
	server := httptest.NewServer(http.HandlerFunc(healthHandler))
	t.Cleanup(server.Close)

	response, err := server.Client().Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health failed: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("GET /health status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read health response: %v", err)
	}
	if !strings.Contains(string(body), `"mode":"mock"`) {
		t.Errorf("GET /health body = %s, expected mock mode", body)
	}
}

func TestHealthUnconfigured(t *testing.T) {
	t.Setenv("LSB_MODE", "")
	server := httptest.NewServer(http.HandlerFunc(healthHandler))
	t.Cleanup(server.Close)

	response, err := server.Client().Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health failed: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("GET /health status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read health response: %v", err)
	}
	if !strings.Contains(string(body), `"status":"unconfigured"`) {
		t.Errorf("GET /health body = %s, expected unconfigured status", body)
	}
}
