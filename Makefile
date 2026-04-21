# ── MES Line Side Board v2 — Makefile ────────────────────────────────────────
# Targets for local dev and plant deployment.
# Prerequisites: Go 1.21+, Node 20+, Java 17+, Maven 3.9+, Docker (optional)

.PHONY: help dev dev-go dev-java dev-frontend build-frontend \
        docker-up docker-down clean lint

help:
	@echo ""
	@echo "  MES Line Side Board v2 — Available commands:"
	@echo ""
	@echo "  make dev             Start all three services locally (tmux or 3 terminals)"
	@echo "  make dev-go          Start Go API gateway only  (port 3001)"
	@echo "  make dev-java        Start Java microservice only (port 8080)"
	@echo "  make dev-frontend    Start Vite dev server (port 5173, proxies /api → Go)"
	@echo ""
	@echo "  make build-frontend  Build React → backend-go/static/ (production)"
	@echo ""
	@echo "  make docker-up       docker compose up --build -d"
	@echo "  make docker-down     docker compose down"
	@echo ""
	@echo "  make clean           Remove build artefacts"
	@echo ""

# ── Local development ─────────────────────────────────────────────────────────

dev-go:
	@echo "[go] Starting API gateway on :3001 ..."
	cd backend-go && go run .

dev-java:
	@echo "[java] Starting MARS service on :8080 ..."
	cd backend-java && mvn spring-boot:run

dev-frontend:
	@echo "[frontend] Starting Vite dev server on :5173 ..."
	cd frontend && npm run dev

# Run all three in background (requires tmux or just open 3 terminals)
dev:
	@echo "Open 3 terminals and run:"
	@echo "  make dev-go"
	@echo "  make dev-java"
	@echo "  make dev-frontend"

# ── Production build ──────────────────────────────────────────────────────────

build-frontend:
	@echo "[frontend] Building React → backend-go/static/ ..."
	cd frontend && npm install && npm run build
	@echo "[frontend] Build complete. Go will serve static/ at /*"

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up --build -d
	@echo "Services starting:"
	@echo "  Frontend → http://localhost:5173"
	@echo "  Go API   → http://localhost:3001"
	@echo "  Java SVC → http://localhost:8080"

docker-down:
	docker compose down

# ── Clean ─────────────────────────────────────────────────────────────────────

clean:
	rm -rf backend-go/static backend-go/lsb-api
	rm -rf backend-java/target
	rm -rf frontend/node_modules frontend/dist
