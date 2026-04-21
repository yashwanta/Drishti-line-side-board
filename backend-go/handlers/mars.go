package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// HandleMARSKPIs → GET /api/mars/kpis?resource=WM15
// Proxies to Java microservice → GET {JAVA_SERVICE_URL}/mars/kpis?resource=WM15
func HandleMARSKPIs(w http.ResponseWriter, r *http.Request) {
	proxyToJava(w, r, "/mars/kpis")
}

// HandleMARSProduction → GET /api/mars/production?resource=WM15
// Proxies to Java microservice → GET {JAVA_SERVICE_URL}/mars/production?resource=WM15
func HandleMARSProduction(w http.ResponseWriter, r *http.Request) {
	proxyToJava(w, r, "/mars/production")
}

// HandleMARSQuality → GET /api/mars/quality?resource=WM15
func HandleMARSQuality(w http.ResponseWriter, r *http.Request) {
	proxyToJava(w, r, "/mars/quality")
}

// HandleMARSSchedule → GET /api/mars/schedule?resource=WM15
func HandleMARSSchedule(w http.ResponseWriter, r *http.Request) {
	proxyToJava(w, r, "/mars/schedule")
}

// proxyToJava forwards a GET request to the Java service, preserving query params.
func proxyToJava(w http.ResponseWriter, r *http.Request, path string) {
	javaSvc := os.Getenv("JAVA_SERVICE_URL")
	qs := r.URL.RawQuery
	target := fmt.Sprintf("%s%s", javaSvc, path)
	if qs != "" {
		target += "?" + qs
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		log.Printf("[mars proxy] %s unreachable: %v", target, err)
		writeError(w, http.StatusServiceUnavailable, "MARS service unavailable — check Java microservice")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
