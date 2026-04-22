# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

MES Line Side Board — a manufacturing execution system dashboard for a Proxmox LXC host (`192.168.1.126`). It displays real-time production KPIs, downtime, quality issues, MARS ERP data, and robot press status for a single work cell (WM15).

## Development Commands

```bash
# Run all 3 services (requires 3 terminals)
make dev-go          # Go API gateway on :3001
make dev-java        # Spring Boot microservice on :8080
make dev-frontend    # Vite dev server on :5173

# Or run everything via Docker
make docker-up       # docker compose up --build -d
make docker-down

# Build frontend for production (outputs to backend-go/static/)
make build-frontend

# Individual service commands
cd backend-go && go run .
cd backend-java && mvn spring-boot:run
cd frontend && npm install && npm run dev
```

No test or lint targets exist in the Makefile yet.

## Architecture

Three independent services in a monorepo:

```
Browser (React SPA)
   │  /api/* every 15s
   ▼
Go API Gateway (:3001)          ← serves React build from ./static/
   ├── direct SQL → PostgreSQL 17 (mesdb @ :5432)
   └── HTTP proxy → Spring Boot (:8080)
                        ├── MARS SQL Server (@ 192.168.1.100:1433)
                        └── Robot Press REST API (@ 192.168.1.200)
```

**Go gateway** (`backend-go/`) handles all frontend-facing routes. It owns the PostgreSQL tables (`production_log`, `downtime_log`, `open_issues`) and proxies `/api/mars/*` and `/api/robotpress*` to the Java service.

**Java microservice** (`backend-java/`) is the only service that talks to external plant systems (MARS SQL Server via JDBC, Robot Air Press via polling loop). It exposes `/mars/*` and `/robotpress/*` internally on port 8080.

**Frontend** (`frontend/`) is a React 18 + Vite SPA. `npm run build` outputs to `backend-go/static/`, which the Go server serves as the root. The Vite dev proxy rewrites `/api` → `http://localhost:3001`.

## Important Notes

- **`main.go` and `index.html` at the repo root are legacy** — the entire stack has been rebuilt in `backend-go/`, `backend-java/`, and `frontend/`. Do not edit the root `main.go`.
- **CORS** is enforced in `backend-go/middleware/cors.go` to restrict to the plant subnet (`192.168.1.0/24`). Adjust `CORS_SUBNET` in `.env` for local dev if needed.
- **Environment config** lives in `.env` (git-ignored). See `.env.example` for all required variables. The Go gateway reads it at startup; the Java service uses `application.properties` with `${ENV_VAR}` substitution.
- **Production deployment** uses PM2 to run the compiled Go binary (`lsb-api`) and nginx on port 80, all inside a Proxmox LXC Ubuntu container.
- The frontend polls every 15 seconds via `src/hooks/useAutoRefresh.js`.
- KPI calculations: **Efficiency %** = `(good_count / (JPH_TARGET × elapsed_hours)) × 100`; **FPY %** = `good_count / (good_count + scrap_count) × 100`.
