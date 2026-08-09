# Drishti LineSideBoard — Codex Production Tasks
> Work through these tasks **one at a time, in order**. Do not start the next task until the current one compiles and you have verified the output. Each task references exact file paths.

---

## TASK 1 — Wire Go routes and initialize PostgreSQL
**Status: COMPLETE** ✅

Completed work:
- Initialized PostgreSQL with `db.Connect()`
- Registered six operational routes (kpis, production, confirm, productivity, issues, issues/raise)
- Did not add `/api/downtime` — downtime is read-only from MARS via the Java proxy
- Added PostgreSQL variables to `config/.env.example`
- `go build ./...` passed

**PATCH REQUIRED before Task 2:**

`db.Connect()` currently crashes on startup when `DB_HOST` is empty (development machine has no PostgreSQL). Apply this fix to `backend-go/main.go`:

Replace the unconditional `db.Connect()` call with a conditional check:
```go
if os.Getenv("DB_HOST") != "" {
    db.Connect()
}
```

This allows the app to run in mock mode on a dev machine with no PostgreSQL configured. When installed at a plant and PostgreSQL is configured through the setup wizard, `db.Connect()` will be called live at that point (see Task 2).

Run `go build ./...` and confirm it passes before starting Task 2.

---

## TASK 2 — Two-step database setup wizard (MSSQL + PostgreSQL)
**Files:** `backend-go/setup.go`, `backend-go/main.go`

### Context
The app must work in three modes:
- **mock** — no databases needed (development)
- **unconfigured** — waiting for setup (fresh plant install)
- **production** — both MSSQL and PostgreSQL configured

When installed at a plant, the operator opens the dashboard and is guided through a setup wizard that configures both databases interactively. No manual `.env` editing required. The wizard has two steps: connect MSSQL (read-only to MARS), then connect PostgreSQL (read/write for OEE data).

### Step 1 — Rename and fix the existing MSSQL setup endpoint

In `backend-go/setup.go`:

1. Rename `handleSetupTestConnection` → `handleSetupConfigureMSSQL`. Its job stays the same: accept MSSQL credentials, test the connection, save `LSB_DB_*` variables to `config/.env`. **Remove** the `ensureSetupOEESchema(ctx, database)` call from it entirely — OEE schema is PostgreSQL's responsibility now, not MSSQL's. Do NOT set `LSB_MODE=production` here — that only happens after PostgreSQL is also configured (Step 2).

2. In `backend-go/main.go`, update the route registration:
   ```go
   // Replace:
   mux.HandleFunc("/api/setup/test-connection", cors(handleSetupTestConnection))
   // With:
   mux.HandleFunc("/api/setup/configure-mssql", cors(handleSetupConfigureMSSQL))
   ```

### Step 2 — Add new PostgreSQL setup endpoint

Add a new handler `handleSetupConfigurePostgres` in `backend-go/setup.go`.

Register it in `backend-go/main.go`:
```go
mux.HandleFunc("/api/setup/configure-postgres", cors(handleSetupConfigurePostgres))
```

The handler accepts a JSON body:
```json
{ "host": "", "port": 5432, "database": "lsb_oee", "username": "", "password": "" }
```

It must do the following in order:

1. **Validate MSSQL is already configured.** Check that `LSB_DB_SERVER` env var is set and non-empty. If not, return HTTP 409:
   ```json
   {"ok": false, "error": "configure MSSQL connection first (Step 1)"}
   ```

2. **Open a PostgreSQL connection** using `github.com/lib/pq` (already in `go.mod`). Build the DSN:
   ```go
   dsn := fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=disable",
       body.Host, body.Port, body.Database, body.Username, body.Password)
   pgDB, err := sql.Open("postgres", dsn)
   ```

3. **Ping with an 8-second timeout.** If the ping fails, return HTTP 200:
   ```json
   {"ok": false, "error": "<error message>"}
   ```

4. **Create the schema** by calling `ensurePostgresSchema(ctx, pgDB)` — write this as a new function in `setup.go`. It must create these four tables using `CREATE TABLE IF NOT EXISTS` with PostgreSQL syntax (`BIGSERIAL`, `TIMESTAMPTZ`, `NUMERIC`, `DEFAULT NOW()`):

   **Table 1 — production_log**
   ```
   id BIGSERIAL PRIMARY KEY, resource_id VARCHAR(50) NOT NULL, shift_num INT NOT NULL,
   event_ts TIMESTAMPTZ NOT NULL, part_number VARCHAR(100), operator_name VARCHAR(100),
   good_count INT NOT NULL DEFAULT 0, scrap_count INT NOT NULL DEFAULT 0,
   cycle_time_sec NUMERIC(10,2), notes TEXT, confirmed BOOLEAN NOT NULL DEFAULT FALSE,
   confirmed_by VARCHAR(100), confirmed_at TIMESTAMPTZ
   ```
   + index on `(resource_id, shift_num, event_ts)`

   **Table 2 — issues**
   ```
   id BIGSERIAL PRIMARY KEY, resource_id VARCHAR(50) NOT NULL, issue_type VARCHAR(100),
   severity VARCHAR(20) NOT NULL DEFAULT 'minor', description TEXT,
   status VARCHAR(30) NOT NULL DEFAULT 'open', raised_by VARCHAR(100),
   acknowledged_by VARCHAR(100), raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   ```
   + index on `(resource_id, status, raised_at)`

   **Table 3 — oee_entries**
   ```
   id BIGSERIAL PRIMARY KEY, entry_date DATE NOT NULL, shift INT NOT NULL,
   cell VARCHAR(100) NOT NULL, part_number VARCHAR(100),
   tool_dt_min INT NOT NULL DEFAULT 0, top_tool_issue VARCHAR(500),
   maint_dt_min INT NOT NULL DEFAULT 0, top_maint_issue VARCHAR(500),
   prod_dt_min INT NOT NULL DEFAULT 0, top_prod_issue VARCHAR(500),
   parts_reported INT NOT NULL DEFAULT 0, target_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0,
   actual_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0, scrap INT NOT NULL DEFAULT 0,
   rework INT NOT NULL DEFAULT 0, availability_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
   performance_pct NUMERIC(8,3) NOT NULL DEFAULT 0, quality_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
   oee_pct NUMERIC(8,3) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   ```
   + index on `(entry_date, shift, cell)`

   > Do NOT create a `downtime_events` table — downtime is read-only from MARS MSSQL.

   If schema creation fails, return HTTP 200:
   ```json
   {"ok": false, "error": "connected but schema creation failed: <error>"}
   ```

5. **Save PostgreSQL config** using `updateConfigEnv()`:
   ```go
   updateConfigEnv(map[string]string{
       "DB_HOST": body.Host,
       "DB_PORT": strconv.Itoa(body.Port),
       "DB_NAME": body.Database,
       "DB_USER": body.Username,
       "DB_PASS": body.Password,
   })
   ```

6. **Set production mode** now that both databases are configured:
   ```go
   updateConfigEnv(map[string]string{"LSB_MODE": "production"})
   ```

7. **Open the live connection pool** without a server restart:
   ```go
   db.Connect()
   ```

8. Return HTTP 200:
   ```json
   {"ok": true, "message": "Connected to lsb_oee on <host>. Schema ready. Production mode enabled."}
   ```

### Step 3 — Fix oee_entries handler to use PostgreSQL pool

In `setup.go`, `handleOEEEntries` currently calls `openSQLServer()` (MSSQL) for reading and writing OEE entries. Change it to use `db.Pool` (PostgreSQL) instead.

1. Import `"lsb-api/db"` at the top of `setup.go`.
2. Replace both `openSQLServer(currentDBConfig())` calls in `handleOEEEntries` with `db.Pool`. Remove the associated `defer database.Close()` lines.
3. Rewrite the SQL from T-SQL to PostgreSQL syntax:
   - `@p1, @p2 ...` → `$1, $2 ...`
   - `CONVERT(varchar(10), entry_date, 23)` → `entry_date::TEXT`
   - `SELECT CONVERT(bigint, SCOPE_IDENTITY())` → remove; add `RETURNING id` to the INSERT statement
4. Keep all JSON field names and response shapes identical.

Run `go build ./...` and fix any errors. Stop and wait for confirmation.

---

## TASK 3 — Create the PostgreSQL schema file
**New file:** `backend-go/db/schema.sql`

> **Note:** The schema is now also created automatically by the setup wizard (Task 2 — `ensurePostgresSchema`). This file exists as a standalone reference and for DBAs who prefer to run migrations manually before the app starts.

Add this header comment:
```sql
-- LSB Operational Database Schema
-- Applied automatically by the setup wizard at /api/setup/configure-postgres
-- Can also be run manually: psql -U lsb_admin -d lsb_oee -f schema.sql
```

Create three tables using `CREATE TABLE IF NOT EXISTS` with the exact same DDL used in `ensurePostgresSchema` in `setup.go` (copy it — they must stay in sync):

**Table 1 — production_log** (queried by `handlers/production.go`, `kpis.go`, `productivity.go`)

**Table 2 — issues** (queried by `handlers/issues.go`)

**Table 3 — oee_entries** (queried by `setup.go` `handleOEEEntries`)

Refer to the `ensurePostgresSchema` function written in Task 2 for the exact column definitions and index statements.

> **Do NOT add a `downtime_events` table** — downtime is read-only from MARS MSSQL via the Java service.

---

## TASK 4 — Fix CORS: replace wildcard with subnet-aware middleware
**Files:** `backend-go/main.go`, `exe/main.go`

`backend-go/middleware/cors.go` already has a correct subnet-aware `CORS()` function. Use it.

**Changes to `backend-go/main.go`:**

1. Import `"lsb-api/middleware"`.

2. Delete the inline `cors()` helper function entirely.

3. Wrap the mux with `middleware.CORS` when starting the server:
   ```go
   // Before:
   http.ListenAndServe(":"+port, mux)
   // After:
   http.ListenAndServe(":"+port, middleware.CORS(mux))
   ```

4. Remove all individual `cors()` wrapper calls from `mux.HandleFunc` lines — the middleware now covers the whole mux.

5. Add to `config/.env.example`:
   ```
   # CORS — restrict to plant LAN subnet e.g. 192.168.10.0/24. Leave empty during development only.
   CORS_SUBNET=
   ```

**Changes to `exe/main.go`:**

6. The exe is a standalone Go module so it cannot import `middleware/`. Copy the subnet-aware CORS logic directly into `exe/main.go` as a local function, replacing the existing wildcard `cors()` function and the `writeJSON` wildcard header. Apply it as a top-level `http.Handler` wrapper.

Run `go build ./...` on both modules and fix any errors.

---

## TASK 5 — Add missing Java endpoints
**File:** `backend-java/src/main/java/com/mes/mars/controller/MarsController.java`

Add five new GET endpoints to the **existing** `@RestController` class. Do not create a new controller file.

All five accept:
- `?resource=` query parameter (default to `RESOURCE_ID` env var if missing)
- `?date=` query parameter (default to today's date `yyyy-MM-dd` if missing)

Base queries on the MARS SQL Server database via the existing `JdbcTemplate`. If the exact MARS table or column names are unknown, use a comment `-- TODO: replace with actual MARS table name` and return a hardcoded fallback row so the code still compiles.

**Endpoint 1 — GET /stations**
Returns: `List<Map>` where each map has:
`resource_id, part_number, status, efficiency_pct, actual, target, shift, operator`

**Endpoint 2 — GET /production/status**
Returns: `List<Map>` where each map has:
`resource_id, status, current_part, planned, actual, efficiency_pct, cycle_time_sec`

**Endpoint 3 — GET /shipping/status**
Returns single object:
`parts_shipped_today, shipment_count, pending_trucks, loaded_trucks, shipping_dock_status, on_time_rate_pct, next_shipment, delivery_eta`
Plus nested array `customer_deliveries`: `[ { work_order, customer, part_number, qty, ship_by, status, delivery_date } ]`

**Endpoint 4 — GET /weekly**
Returns: `{ resource, days: [ { date, day, plan, actual, good_count, scrap_count, efficiency_pct, downtime_mins, shipments, parts_shipped } ] }`
Seven rows — Monday through Sunday of the week containing the `?date=` value.

**Endpoint 5 — GET /downtime**
Returns: `{ events: [ { id, resource, reason_code, minutes, comment, start_ts, logged_by } ], total_mins, resource, date }`
All downtime/stoppage records from MARS for the given resource and date.

After adding the endpoints, run:
```
mvn compile -q
```
Fix any compilation errors before finishing.

---

## TASK 6 — Windows service install scripts
**New files:** `install-service.bat`, `uninstall-service.bat`, `DEPLOYMENT.md` (all in project root)

**`install-service.bat`** must:
1. Check that NSSM is on the PATH — if not, print error and exit.
2. Print a warning: `"Make sure config\.env is filled with real values before continuing."` and pause.
3. Install Windows service `LSB-Java` via NSSM:
   - Application: `java.exe`
   - Arguments: `-jar "%~dp0backend-java\target\mars-service-2.0.0.jar"`
   - Working directory: `%~dp0`
   - Start type: Automatic
   - On failure: restart after 15000 ms
4. Install Windows service `LSB-Go` via NSSM:
   - Application: `"%~dp0backend-go\lsb-api.exe"`
   - Working directory: `%~dp0`
   - Start type: Automatic
   - On failure: restart after 10000 ms
5. Start both services: `net start LSB-Java` then `net start LSB-Go`
6. Print: `"Done. Open http://localhost:3001 to verify."`

**`uninstall-service.bat`** must:
1. Stop both services (ignore errors if already stopped)
2. Remove both: `nssm remove LSB-Go confirm` and `nssm remove LSB-Java confirm`
3. Print: `"Services removed."`

**`DEPLOYMENT.md`** must cover:
- Prerequisites: Java 17 JRE, PostgreSQL 15+, Python 3 + pyodbc, ODBC Driver 18 for SQL Server, NSSM, Go 1.21 (build only)
- Step-by-step: fill `config\.env` → run `schema.sql` → run `install-service.bat`
- Status check: `sc query LSB-Go` / `sc query LSB-Java`
- Log file locations
- How to update: stop services → replace binaries → start services

---

## TASK 7 — Internal auth token between Go and Java
**Files:** `backend-go/main.go`, `backend-go/handlers/mars.go`, new Java filter file

**Go side:**

In both `proxyToJava` functions (one in `main.go`, one in `handlers/mars.go`), before making the outbound HTTP request, check if env var `LSB_INTERNAL_TOKEN` is set and non-empty. If it is, add the header to the outgoing request:
```
X-Internal-Token: <value of LSB_INTERNAL_TOKEN>
```

**Java side:**

Create new file:
`backend-java/src/main/java/com/mes/mars/config/InternalTokenFilter.java`

Implement as a Spring `OncePerRequestFilter` that:
- Reads expected token from `@Value("${internal.token:}")`
- If token is empty: allows all requests (dev mode)
- If token is set: reads `X-Internal-Token` request header
- If header is missing or does not match: returns `403 Forbidden` with body `{"error":"forbidden"}`
- If it matches: calls `filterChain.doFilter()`

Register the filter for all paths.

**Config:**

Add to `config/.env.example`:
```
# Shared secret between Go and Java. Generate with: openssl rand -hex 32
# Leave empty to disable (development only).
LSB_INTERNAL_TOKEN=
```

Add to `backend-java/src/main/resources/application.properties`:
```
internal.token=${LSB_INTERNAL_TOKEN:${INTERNAL_TOKEN:}}
```

Run `go build ./...` and `mvn compile -q` and fix any errors.

---

## TASK 8 — Structured logging
**Files:** `backend-go/main.go`, `backend-go/setup.go`, `backend-java/src/main/resources/application.properties`

**Go changes:**

1. Import `"log/slog"` in `main.go` (standard library, Go 1.21+ — already in go.mod).

2. At startup after `loadConfigEnv()`, check env var `LOG_FILE`. If set and non-empty, open or create that file with append flag and set as the slog default:
   ```go
   slog.SetDefault(slog.New(slog.NewJSONHandler(logFile, nil)))
   ```
   Otherwise use `slog.NewJSONHandler(os.Stdout, nil)`.

3. Replace all `log.Printf` / `log.Fatal` calls in `main.go` with `slog` equivalents (Info for startup messages, Error for failures).

4. Add a request-logging middleware function that wraps `http.Handler` and logs each request with fields: `method`, `path`, `status_code`, `duration_ms`, `remote_addr`. Apply it as the outermost wrapper (outside `middleware.CORS`).

5. In `setup.go`, add `slog.Info` when an OEE entry is written successfully. Fields: `cell`, `shift`, `date`, `id`.

6. Add to `config/.env.example`:
   ```
   # Log output file. Leave empty to log to stdout.
   LOG_FILE=
   ```

**Java changes:**

Add to `backend-java/src/main/resources/application.properties`:
```
logging.file.name=logs/mars-service.log
logging.logback.rollingpolicy.max-file-size=10MB
logging.logback.rollingpolicy.max-history=30
```

Run `go build ./...` and fix any errors.

---

## TASK 9 — Go tests
**New files:** `backend-go/setup_test.go`, `backend-go/main_test.go`

Use only the standard library (`testing`, `net/http/httptest`).

**`setup_test.go`:**
- `TestOdbcConnection`: call `odbcConnection()` with `{Server:"dbhost", Port:1433, Database:"MARS", Username:"sa", Password:"secret"}`. Assert the result contains `SERVER=dbhost,1433`, `DATABASE={MARS}`, `UID={sa}`, `PWD={secret}`.
- `TestTextHelper`: call `text()` with `nil` (expect `""`), `"hello"` (expect `"hello"`), `42` (expect `"42"`).
- `TestIntegerHelper`: call `integer()` with `"42"` → 42, `"  7  "` → 7, `"bad"` → 0, `nil` → 0.
- `TestDecimalHelper`: call `decimal()` with `"3.14"` → 3.14, `""` → 0, `nil` → 0.

**`main_test.go`:**
- `TestHealthMock`: use `httptest.NewServer` with `healthHandler`. Set `LSB_MODE=mock` via `os.Setenv`. GET `/health` — assert HTTP 200 and JSON body contains `"mode":"mock"`.
- `TestHealthUnconfigured`: set `LSB_MODE=""` — assert JSON body contains `"status":"unconfigured"`.
- `TestJavaPath`: call `javaPath()` with at minimum:
  - `"/api/kpis"` → `"/mars/kpis"`
  - `"/api/production"` → `"/mars/production"`
  - `"/api/mars/quality"` → `"/mars/quality"`
  - `"/api/robotpress"` → `"/robotpress"`

Run `go test ./...` and fix any failures before finishing.

---

## TASK 10 — Harden Excel import
**Files:** `backend-go/setup.go`, `scripts/import_excel.py`

**Go changes (`setup.go`):**

1. **Zero-byte guard:** after receiving the uploaded file but before running Python, check `header.Size`. If 0, return HTTP 400: `{"error": "uploaded file is empty"}`.

2. **Rate limiting:** add a package-level variable:
   ```go
   var importRateLimit = struct {
       mu     sync.Mutex
       counts map[string][]time.Time
   }{counts: make(map[string][]time.Time)}
   ```
   Before running the script, check how many calls the remote IP has made in the last 60 seconds. If more than 3, return HTTP 429: `{"error": "too many import requests — wait one minute"}`. Clean up entries older than 60 seconds while holding the lock.

3. **Success logging:** after the Python script runs successfully, log with `slog.Info`. Fields: `file_name` (from `header.Filename`), `remote_addr`.

**Python changes (`scripts/import_excel.py`):**

4. **Column validation:** after reading the first sheet, check that the header row contains all required column names:
   `date, shift, cell, part_number, tool_dt_min, maint_dt_min, prod_dt_min, parts_reported, target_cycle_sec, actual_cycle_sec, scrap, rework, availability_pct, performance_pct, quality_pct, oee_pct`
   If any are missing, print to stdout and exit code 1:
   ```json
   {"error": "missing columns", "missing": ["col1", "col2"]}
   ```

5. **Row limit guard:** count data rows (excluding header). If more than 10,000, print and exit code 1:
   ```json
   {"error": "file too large — maximum 10000 rows"}
   ```

6. **Summary output:** print as the final JSON line:
   ```json
   {"rows_imported": N, "rows_skipped": M, "errors": []}
   ```

---

## Quick Reference

| Task | What | Priority |
|------|------|----------|
| 1 | Wire Go routes + PostgreSQL init | ✅ Complete |
| 1b | Patch db.Connect() to be conditional | 🔴 P1 — Apply before Task 2 |
| 2 | Two-step setup wizard (MSSQL + PostgreSQL) | 🔴 P1 — Blocker |
| 3 | Create schema.sql reference file | 🔴 P1 — Blocker |
| 4 | Fix CORS wildcard | 🔴 P1 — Security |
| 5 | Java missing endpoints | 🟡 P2 — Before go-live |
| 6 | Windows service scripts | 🟡 P2 — Before go-live |
| 7 | Go→Java auth token | 🟡 P2 — Before go-live |
| 8 | Structured logging | 🟡 P2 — Before go-live |
| 9 | Go tests | 🟢 P3 — Hardening |
| 10 | Excel import hardening | 🟢 P3 — Hardening |

---

*Generated August 2026 — Drishti LineSideBoard production readiness review*
