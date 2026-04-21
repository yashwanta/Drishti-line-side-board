package main

import (
	"log"
	"net/http"
	"os"

	"lsb-api/db"
	"lsb-api/handlers"
	"lsb-api/middleware"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env if present (ignored in prod where vars come from environment/docker)
	if err := godotenv.Load(); err != nil {
		log.Println("[main] no .env file found — using environment variables")
	}

	// Open PostgreSQL pool
	db.Connect()

	// ── Routes ──────────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"lsb-api","version":"2.0.0"}`))
	})

	// ── PostgreSQL-backed endpoints ──────────────────────────────────────────────
	mux.HandleFunc("/api/kpis", handlers.HandleKPIs)
	mux.HandleFunc("/api/production", handlers.HandleProduction)
	mux.HandleFunc("/api/productivity", handlers.HandleProductivity)
	mux.HandleFunc("/api/issues", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.HandleIssues(w, r)
		case http.MethodPost:
			handlers.HandleRaiseIssue(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/downtime", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.HandleDowntimeGET(w, r)
		case http.MethodPost:
			handlers.HandleDowntimePOST(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/confirm", handlers.HandleConfirm)

	// ── Java microservice proxies ─────────────────────────────────────────────
	// Robot air press (pendant → Java → here)
	mux.HandleFunc("/api/robotpress", handlers.HandleRobotPress)
	mux.HandleFunc("/api/robotpress/history", handlers.HandleRobotPressHistory)

	// MARS SQL Server data (MARS DB → Java → here)
	mux.HandleFunc("/api/mars/kpis", handlers.HandleMARSKPIs)
	mux.HandleFunc("/api/mars/production", handlers.HandleMARSProduction)
	mux.HandleFunc("/api/mars/quality", handlers.HandleMARSQuality)
	mux.HandleFunc("/api/mars/schedule", handlers.HandleMARSSchedule)

	// ── Start server ─────────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	handler := middleware.CORS(mux)

	log.Printf("[main] MES Line Side Board API v2.0 listening on :%s", port)
	log.Printf("[main] CORS subnet: %s", os.Getenv("CORS_SUBNET"))
	log.Printf("[main] Resource: %s | Shift: %s | JPH Target: %s",
		os.Getenv("RESOURCE_ID"), os.Getenv("SHIFT_NUM"), os.Getenv("JPH_TARGET"))

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("[main] server error: %v", err)
	}
}
