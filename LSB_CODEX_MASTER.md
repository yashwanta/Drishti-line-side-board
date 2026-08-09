# LSB — Master Codex Task Reference (All 14 Tasks)
# ✅ = Already done   🔲 = Still to do
# Copy the prompt block for each task and paste it to Codex.
# Always wait for Codex to finish and confirm before giving the next task.

---

## ✅ TASK 1 — Wire routes and conditional database connect

**What it did:** Wired all handler routes in main.go that existed but were never
registered. Added conditional db.Connect() — only connects to PostgreSQL when
DB_HOST environment variable is set (so dev machines without a DB still work).

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 1 only. Do not start Task 2.
After finishing, run: go build ./...
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 2 — Two-step database setup wizard

**What it did:** Created a two-step interactive setup wizard in the dashboard.
Step 1 asks for MARS MSSQL credentials and tests the ODBC connection.
Step 2 asks for PostgreSQL credentials and creates the OEE schema.
App starts in "unconfigured" mode and transitions to "production" after both steps.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 2 only. Do not start Task 3.
After finishing, run: go build ./...
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 3 — CORS middleware and internal auth token

**What it did:** Added subnet-aware CORS middleware (reads CORS_SUBNET env var)
applied as a top-level mux wrapper. Added X-Internal-Token header on all
Go → Java internal calls so Java rejects requests not coming from Go.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 3 only. Do not start Task 4.
After finishing, run: go build ./...
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 4 — Java MARS endpoints

**What it did:** Added five new endpoints to the Java Spring Boot service:
/stations, /production/status, /shipping/status, /weekly, /downtime.
Downtime events are read from MARS MSSQL (read-only), not PostgreSQL.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 4 only. Do not start Task 5.
After finishing, run: mvn clean package -DskipTests
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 5 — Structured JSON logging

**What it did:** Replaced all fmt.Println and log.Printf calls with structured
slog JSON logging. Added a request-logging middleware that logs method, path,
status, and latency for every HTTP request. Added LOG_FILE env var support
to write logs to a file in addition to stdout.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 5 only. Do not start Task 6.
After finishing, run: go build ./...
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 6 — Go unit tests

**What it did:** Created backend-go/main_test.go and backend-go/setup_test.go.
Tests: TestHealthMock (mock mode returns correct JSON), TestHealthUnconfigured
(unconfigured mode), TestJavaPath (proxy URL builder), TestOdbcConnection
(ODBC helper), TestTextHelper, TestIntegerHelper, TestDecimalHelper.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 6 only. Do not start Task 7.
After finishing, run: go test ./...
Tell me when done and paste the test output.
```

---

## ✅ TASK 7 — DEPLOYMENT.md and install-service.bat

**What it did:** Created DEPLOYMENT.md with full Windows deployment procedure
(prerequisites, install steps, service status commands, log locations, update
and removal procedure). Verified install-service.bat paths are correct:
backend-java\target\mars-service-2.0.0.jar and backend-go\lsb-api.exe.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 7 only. Do not start Task 8.
After finishing, open DEPLOYMENT.md and confirm it lists:
  backend-java\target\mars-service-2.0.0.jar
  backend-go\lsb-api.exe
Tell me when done.
```

---

## ✅ TASK 8 — Rate limiting middleware

**What it did:** Added a token-bucket rate limiter middleware to the Go service.
Limits requests per IP address. Reads RATE_LIMIT and RATE_BURST from env vars.
Applied to all /api/* routes. Returns HTTP 429 with a JSON error on breach.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 8 only. Do not start Task 9.
After finishing, run: go build ./...
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 9 — Java InternalTokenFilter

**What it did:** Created InternalTokenFilter.java in the Spring Boot service.
Reads INTERNAL_TOKEN env var. Rejects any request missing the matching
X-Internal-Token header with HTTP 403. Protects the Java service from
being called directly, bypassing the Go gateway.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 9 only. Do not start Task 10.
After finishing, run: mvn clean package -DskipTests
Tell me when done and paste the git diff summary.
```

---

## ✅ TASK 10 — uninstall-service.bat and final polish

**What it did:** Created uninstall-service.bat to stop and remove both NSSM
services cleanly. Added final config/.env template with all required variables
documented. Verified .gitignore excludes config/.env. Final review pass
on all files.

**Prompt to give Codex if you ever need to redo it:**
```
Read CODEX_TASKS.md and complete Task 10 only.
After finishing, run: go build ./... and mvn clean package -DskipTests
Tell me when done and paste the git diff summary.
```

---
---

## 🔲 TASK 11 — LLM Client Package   ← START HERE

**What it will do:** Creates the shared LLM client package (backend-go/llm/client.go)
that all AI features depend on. Connects to https://llm.eidonix.com/ using model
qwen3.6-35b. Reads the API key from API.txt and stores it in config/.env.
Adds LLM health status to the /health endpoint.

**MUST DO FIRST — before giving this to Codex:**
- Confirm API.txt is in the project root (it already is)
- Confirm .gitignore includes API.txt and config/.env

**Prompt to give Codex:**
```
Read CODEX_LLM_TASKS.md and complete Task 11 only. Do not start Task 12.

Before writing any code, read API.txt in the project root.
Line 1 = base URL, Line 2 = model name, Line 3 = API key.
Store the API key in config/.env as LLM_API_KEY — never in source code.

After finishing:
  1. Run: go build ./...
  2. Start the service and run: curl http://localhost:3001/health
     Confirm the response includes an "llm" field.
Tell me the health response and paste the git diff summary.
```

---

## 🔲 TASK 12 — Log Analysis & Diagnosis

**What it will do:** Adds GET /api/llm/log-analysis endpoint. The LLM reads
the last 200 lines of both error logs and returns a JSON diagnosis with
severity, likely cause, and recommended fix for each issue. Also runs
automatically every 60 minutes in the background and writes an alert file
if health is critical.

**Prompt to give Codex:**
```
Read CODEX_LLM_TASKS.md and complete Task 12 only. Do not start Task 13.
Task 11 (LLM client package) must already be complete before starting this.

After finishing:
  1. Run: go build ./...
  2. Start the service and run:
     curl http://localhost:3001/api/llm/log-analysis
     Paste the JSON response.
Tell me when done and paste the git diff summary.
```

---

## 🔲 TASK 13 — OEE Anomaly Explanation + Auto-Remediation Suggestions

**What it will do:** Adds background anomaly detection on OEE data every
15 minutes. When an unusual reading is found, the LLM explains the likely
cause. Results stored in new oee_anomalies PostgreSQL table, queryable via
GET /api/llm/anomalies. Also adds POST /api/llm/remediate — give it a
problem description, get back a list of safe fix actions (suggestions only,
never executes anything automatically).

**Prompt to give Codex:**
```
Read CODEX_LLM_TASKS.md and complete Task 13 only. Do not start Task 14.
Tasks 11 and 12 must already be complete before starting this.

After finishing:
  1. Run: go build ./...
  2. Confirm oee_anomalies table is added to backend-go/db/schema.sql
  3. Test: curl -X POST http://localhost:3001/api/llm/remediate \
       -H "Content-Type: application/json" \
       -d "{\"issue\": \"LSB-Java service is not starting\"}"
     Paste the JSON response.
Tell me when done and paste the git diff summary.
```

---

## 🔲 TASK 14 — Daily Health Digest

**What it will do:** Every day at 06:00 (configurable via DIGEST_TIME env var),
the LLM automatically writes a plain-English health report covering system
status, OEE summary, anomalies detected, top errors, and recommended actions.
Report saved to logs/digest-YYYY-MM-DD.txt and accessible via
GET /api/llm/digest and GET /api/llm/digest/list.

**Prompt to give Codex:**
```
Read CODEX_LLM_TASKS.md and complete Task 14 only.
Tasks 11, 12, and 13 must already be complete before starting this.

After finishing:
  1. Run: go build ./...
  2. Temporarily change DIGEST_TIME to 2 minutes from now to trigger
     a test digest, then check logs/ for a digest-*.txt file.
  3. Test: curl http://localhost:3001/api/llm/digest/list
     Paste the response.
  4. Restore DIGEST_TIME=06:00 in config/.env
Tell me when done and paste the git diff summary.
```

---

## VERIFICATION AFTER ALL 14 TASKS ARE COMPLETE

Run this full check after Task 14 is confirmed:

```
# Build both services
go build ./...
mvn clean package -DskipTests

# Run all Go tests
go test ./...

# Check all endpoints are live
curl http://localhost:3001/health
curl http://localhost:3001/api/llm/log-analysis
curl http://localhost:3001/api/llm/anomalies?hours=24
curl http://localhost:3001/api/llm/digest/list

# Confirm .gitignore protects secrets
git status --short | grep -E "\.env|API\.txt"
# Above command should return nothing (both files ignored)
```

---

## QUICK REFERENCE — All 14 tasks at a glance

| # | Task | File(s) changed | Status |
|---|------|-----------------|--------|
| 1  | Wire routes + conditional DB connect | main.go, db/postgres.go | ✅ Done |
| 2  | Two-step setup wizard | setup.go, frontend | ✅ Done |
| 3  | CORS + internal auth token | middleware/cors.go, handlers/mars.go | ✅ Done |
| 4  | Java MARS endpoints | MarsController.java | ✅ Done |
| 5  | Structured slog logging | main.go, all handlers | ✅ Done |
| 6  | Go unit tests | main_test.go, setup_test.go | ✅ Done |
| 7  | DEPLOYMENT.md + install-service.bat | DEPLOYMENT.md | ✅ Done |
| 8  | Rate limiting middleware | middleware/ratelimit.go | ✅ Done |
| 9  | Java InternalTokenFilter | InternalTokenFilter.java | ✅ Done |
| 10 | uninstall-service.bat + polish | uninstall-service.bat, .env | ✅ Done |
| 11 | LLM client package | llm/client.go, api/llm-config.json | 🔲 To do |
| 12 | Log analysis & diagnosis | handlers/loganalyze.go | 🔲 To do |
| 13 | OEE anomaly + remediation | handlers/oee_anomaly.go, remediate.go | 🔲 To do |
| 14 | Daily health digest | handlers/digest.go | 🔲 To do |
