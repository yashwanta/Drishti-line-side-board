# CODEX TASK — Remove Java JAR, migrate MARS queries to Go
#
# Goal: eliminate the Java/Spring Boot service entirely.
#       All MARS SQL Server queries move into the Go service
#       using Microsoft's official Go driver (go-mssqldb).
#       Result: one binary, one service, no JVM vulnerabilities.
#
# HOW TO USE THIS FILE:
#   Give Codex the prompt under each PHASE one at a time.
#   Wait for Codex to finish and confirm go build ./... passes
#   before giving the next phase.
#
# PHASES:
#   Phase A — Add MSSQL driver and connection package
#   Phase B — Migrate MARS query handlers into Go
#   Phase C — Remove Java proxy and internal token
#   Phase D — Update services, scripts, and documentation
#   Phase E — Final cleanup and verification

---

## PHASE A — Add MSSQL driver and database connection package

Paste this to Codex:

```
Read CODEX_REMOVE_JAVA.md for full context on what we are doing.

Before writing any code, read these files to understand the current structure:
  - backend-go/main.go
  - backend-go/exe/main.go  
  - backend-go/setup.go
  - backend-go/db/postgres.go
  - config/.env (or .env.example if .env is not readable)

We are removing the Java Spring Boot service and moving all MARS SQL Server
queries directly into Go using Microsoft's official driver.

DO ONLY PHASE A in this session. Do not touch any handler or route files yet.

### PHASE A tasks:

1. Add the MSSQL driver to go.mod:
   Run: go get github.com/microsoft/go-mssqldb@latest
   This adds the dependency. Do not import it manually — go get handles that.

2. Create backend-go/db/mssql.go

   This file must:
   a) Read MSSQL connection details from environment variables.
      Read setup.go first to find the EXACT variable names the setup wizard
      already writes to config/.env for the MSSQL connection (host, port,
      database, user, password). Use those exact same variable names.

   b) Expose these exported items:
      - var MSSQLPool *sql.DB
      - func ConnectMSSQL() error
        Opens a connection pool to SQL Server using go-mssqldb.
        Connection string format:
          sqlserver://<user>:<pass>@<host>:<port>?database=<db>&connection+timeout=30
        Set pool limits: SetMaxOpenConns(10), SetMaxIdleConns(3),
        SetConnMaxLifetime(5 * time.Minute)
        Ping the connection after opening to verify it works.
        Log success or failure using slog.
      - func CloseMSSQL()
        Closes MSSQLPool if not nil.
      - func MSSQLHealthy() bool
        Returns true if MSSQLPool is not nil and Ping succeeds within 2 seconds.

   c) Import only: database/sql, fmt, log/slog, time,
      _ "github.com/microsoft/go-mssqldb"  (blank import for driver registration)

3. In backend-go/main.go (or exe/main.go — check which one has the startup logic):
   After the existing conditional db.Connect() block, add:
     if os.Getenv("<MSSQL_HOST_VAR>") != "" {
         if err := db.ConnectMSSQL(); err != nil {
             slog.Warn("MSSQL connection failed at startup", "error", err)
         }
     }
   Use the exact env var name from setup.go — do not hardcode "MSSQL_HOST".

4. Update the /health endpoint to include MSSQL status:
   Add "mssql": "ok" or "mssql": "unreachable" alongside the existing
   "llm" and PostgreSQL status fields.
   Call db.MSSQLHealthy() for this check.

After all changes:
  Run: go build ./...
  Fix any errors before reporting done.
  Paste: the full go build output and a list of every file created or changed.
```

---

## PHASE B — Migrate MARS query handlers into Go

Paste this to Codex AFTER Phase A passes:

```
Read CODEX_REMOVE_JAVA.md for full context.

Before writing any code, read ALL of these files:
  - backend-go/handlers/mars.go        (current Java proxy — we are replacing this)
  - backend-go/db/mssql.go             (just created in Phase A)
  - backend-go/main.go                 (to see how routes are registered)
  - backend-java/src/main/java/com/mes/mars/controller/MarsController.java
    (the Java controller — read every endpoint so we know what SQL to write)

DO ONLY PHASE B in this session.

### PHASE B tasks:

Rewrite backend-go/handlers/mars.go from scratch.
Remove all proxy/forwarding code. Replace with direct MSSQL queries.

The new file must implement these five handlers, each querying db.MSSQLPool
directly using database/sql Scan patterns (same style as db/postgres.go):

#### 1. GetStations — GET /api/stations
Query MARS for a list of active production stations/lines.
Read MarsController.java to find the exact table and column names.
If the Java code has a TODO placeholder, use a reasonable query like:
  SELECT StationID, StationName, LineID, IsActive
  FROM Stations
  WHERE IsActive = 1
  ORDER BY StationName
Return JSON array: [{"id":"...","name":"...","line":"..."}]

#### 2. GetProductionStatus — GET /api/production/status
Query MARS for current shift production counts per station.
Read MarsController.java for table/column names.
Return JSON array: [{"station":"...","target":0,"actual":0,"variance":0}]

#### 3. GetShippingStatus — GET /api/shipping/status
Query MARS for today's shipping schedule vs actual.
Read MarsController.java for table/column names.
Return JSON: {"scheduled":0,"shipped":0,"pending":0}

#### 4. GetWeekly — GET /api/weekly
Query MARS for the current week's production summary by day.
Read MarsController.java for table/column names.
Return JSON array: one entry per day with date and production count.

#### 5. GetDowntime — GET /api/downtime
Query MARS for downtime events from the last 24 hours.
Read MarsController.java for table/column names.
Return JSON array: [{"station":"...","reason":"...","duration_minutes":0,"started_at":"..."}]

#### Error handling rules for ALL handlers:
- If db.MSSQLPool is nil (MSSQL not configured yet), return HTTP 503:
    {"error":"MSSQL not configured","hint":"complete setup wizard step 1"}
- If a query fails, log the error with slog.Error and return HTTP 502:
    {"error":"MSSQL query failed","detail":"<error message>"}
- All queries must use a context with 10-second timeout:
    ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
    defer cancel()

#### Important note on table/column names:
The Java MarsController.java may have TODO comments where real table names
were not yet known. Where you find TODOs, write the query with a comment:
  // TODO: confirm table name with DBA — placeholder used
and use a sensible placeholder table name based on the endpoint purpose.
Do NOT invent data or use hardcoded mock responses.

After all changes:
  Run: go build ./...
  Fix any errors before reporting done.
  Paste: the full go build output and the list of MSSQL table names you used
  (so we can verify them with the DBA).
```

---

## PHASE C — Remove Java proxy and internal token

Paste this to Codex AFTER Phase B passes:

```
Read CODEX_REMOVE_JAVA.md for full context.

Before writing any code, read:
  - backend-go/main.go
  - backend-go/middleware/ (list all files)
  - config/.env or .env.example

DO ONLY PHASE C in this session.

### PHASE C tasks:

1. In main.go (or wherever routes are registered):
   Remove any route that proxied to Java (previously /api/java/* or similar).
   The five MARS routes from Phase B (/api/stations, /api/production/status,
   /api/shipping/status, /api/weekly, /api/downtime) are now served directly
   by Go — confirm they are registered and pointing to the new handlers.

2. Remove internal token middleware:
   - Delete or empty backend-go/middleware/internaltoken.go if it exists.
   - Remove any middleware.InternalToken (or similar) references from main.go.
   - Remove INTERNAL_TOKEN from config/.env template — it is no longer needed.

3. Remove the JAVA_URL / JAVA_HOST environment variable references:
   - Search all .go files for any reference to JAVA_URL, JAVA_HOST,
     JAVA_PORT, or JAVA_BASE_URL.
   - Remove those variable reads and any code that uses them.
   - Remove those variables from config/.env template.

4. Remove the Java HTTP client/transport code:
   If there is a shared HTTP client configured for Java calls (timeout,
   headers, base URL), remove it entirely from main.go or any helper file.

5. Clean up imports:
   Run: go build ./...
   Fix any "imported and not used" errors by removing the unused imports.

After all changes:
  Run: go build ./...
  Run: go test ./...
  Paste: build output, test output, and list of every file modified.
  Confirm: grep -r "JAVA" . --include="*.go" returns nothing.
  Confirm: grep -r "INTERNAL_TOKEN" . --include="*.go" returns nothing.
```

---

## PHASE D — Update services, scripts, and documentation

Paste this to Codex AFTER Phase C passes:

```
Read CODEX_REMOVE_JAVA.md for full context.

Read these files before making any changes:
  - install-service.bat
  - uninstall-service.bat
  - DEPLOYMENT.md
  - config/.env (or .env.example)

DO ONLY PHASE D in this session. No Go source changes in this phase.

### PHASE D tasks:

1. Rewrite install-service.bat
   Remove all LSB-Java NSSM commands entirely.
   Keep only the LSB-Go service installation.
   Updated file must:
   - Check NSSM is on PATH (keep existing check)
   - Show a pause reminder about config\.env (keep)
   - Create logs\ folder if missing (keep)
   - Install and start LSB-Go only:
       nssm install LSB-Go "%~dp0backend-go\lsb-api.exe"
       nssm set LSB-Go AppDirectory "%~dp0"
       nssm set LSB-Go Start SERVICE_AUTO_START
       nssm set LSB-Go AppExit Default Restart
       nssm set LSB-Go AppRestartDelay 10000
       nssm set LSB-Go AppStdout "%~dp0logs\lsb-go.log"
       nssm set LSB-Go AppStderr "%~dp0logs\lsb-go-error.log"
       net start LSB-Go
   - End with: echo Done. Open http://localhost:3001 to verify.

2. Rewrite uninstall-service.bat
   Remove LSB-Java stop and remove commands.
   Keep only LSB-Go:
       net stop LSB-Go
       nssm remove LSB-Go confirm

3. Update config/.env template (or .env.example):
   Remove these lines if they exist:
     JAVA_URL, JAVA_HOST, JAVA_PORT, INTERNAL_TOKEN
   Keep all MSSQL, PostgreSQL, LLM, and app config variables.
   Add a comment above the MSSQL block:
     # MARS SQL Server — filled by setup wizard step 1

4. Rewrite DEPLOYMENT.md
   Remove all Java/JRE prerequisites and references.
   Updated prerequisites section must list:
     - Go 1.21 or newer (build only, not needed on plant server)
     - PostgreSQL 15 or newer
     - Microsoft ODBC Driver 18 for SQL Server
     - NSSM on PATH
   Remove all mentions of:
     - Java JRE
     - maven / mvn
     - mars-service-2.0.0.jar
     - LSB-Java service
     - lsb-java.log / lsb-java-error.log
   Update the Logs section to show only:
     - logs\lsb-go.log
     - logs\lsb-go-error.log
   Update the service status section to show only:
     sc query LSB-Go
   Update the update procedure — remove the Java JAR copy step.
   Update the build step to:
     go build -o backend-go\lsb-api.exe .\backend-go\exe\

After all changes:
  Paste: the full content of the updated install-service.bat
  Confirm: the word "Java" does not appear in install-service.bat
  Confirm: the word "Java" does not appear in DEPLOYMENT.md prerequisites
```

---

## PHASE E — Final cleanup and verification

Paste this to Codex AFTER Phase D passes:

```
Read CODEX_REMOVE_JAVA.md for full context.

This is the final cleanup phase. Do a full project review and fix anything missed.

### PHASE E tasks:

1. Search for any remaining Java references in Go source files:
   grep -r "java" backend-go/ --include="*.go" -i
   grep -r "8080" backend-go/ --include="*.go"
   Fix anything found — remove or replace with the Go equivalent.

2. Search for stray INTERNAL_TOKEN or X-Internal-Token references:
   grep -r "Internal-Token" backend-go/ --include="*.go" -i
   grep -r "InternalToken" backend-go/ --include="*.go"
   Remove any found.

3. Update go.mod and go.sum:
   Run: go mod tidy
   This removes any unused dependencies and ensures go-mssqldb is properly listed.

4. Final build and test:
   Run: go build ./...
   Run: go test ./...
   Both must pass with zero errors.

5. Build the production binary:
   Run: go build -o backend-go\lsb-api.exe .\backend-go\exe\
   Confirm the .exe is created and is larger than before
   (it now includes the MSSQL driver, so expect ~25-35 MB).

6. Write a short migration summary:
   Create MIGRATION_NOTES.md in the project root with:
   - Date of migration
   - What was removed: LSB-Java service, mars-service-2.0.0.jar, JRE dependency
   - What was added: github.com/microsoft/go-mssqldb driver in LSB-Go
   - New single binary: backend-go\lsb-api.exe
   - MSSQL table names used (list them) — mark any TODO items needing DBA confirmation
   - Deployment change: only one service now (LSB-Go), no Java required on servers

After all changes:
  Run: go build ./... and paste result
  Run: go test ./... and paste result
  Run: go mod tidy and paste result
  Paste: the content of MIGRATION_NOTES.md
  Confirm: backend-go\lsb-api.exe exists and its file size
```

---

## SUMMARY — What to say to Codex

Give each phase separately. Wait for a clean go build ./... before the next.

  Phase A: "Read CODEX_REMOVE_JAVA.md and complete Phase A only. Do not start Phase B."
  Phase B: "Read CODEX_REMOVE_JAVA.md and complete Phase B only. Do not start Phase C."
  Phase C: "Read CODEX_REMOVE_JAVA.md and complete Phase C only. Do not start Phase D."
  Phase D: "Read CODEX_REMOVE_JAVA.md and complete Phase D only. Do not start Phase E."
  Phase E: "Read CODEX_REMOVE_JAVA.md and complete Phase E. This is the final phase."

## AFTER ALL PHASES COMPLETE

Run this final check:
  go build ./...                          — must pass
  go test ./...                           — must pass
  go mod tidy                             — must produce no errors
  dir backend-go\lsb-api.exe             — must exist

Then update LSB_CODEX_MASTER.md:
  Mark Tasks 1-14 complete.
  Add a note: "Java removed — single Go binary as of <date>"

## WHAT YOU NO LONGER NEED ON PLANT SERVERS
  - Java 17 JRE        (remove from prerequisites)
  - Maven              (remove from build tools)
  - backend-java\      (folder can be archived or deleted after pilot)
  - LSB-Java service   (only LSB-Go runs)
  - Port 8080          (Java used this — no longer needed, close in firewall)
