# Codex Prompt — Production Deployment Version

Paste the entire block below into Codex CLI:

---

```
Read CODEX_PROMPT.md and USER_GUIDE.md for full project context before making any changes.

This prompt builds a production-ready deployment version of the Drishti Line Side Board. The current app runs entirely on mock/seed data. This task strips the mock data out and replaces it with:
1. Real SQL Server connectivity via the Java backend
2. A "first run" setup screen when no database is configured
3. An Excel upload feature to seed historical OEE data from Assembly OEE 2026.xlsx format
4. A production config system using environment variables and a .env file

Do all of this without breaking the existing mock/dev mode — it must still work via `go run seed/mock_server.go` for development.

---

## TASK 1 — Environment configuration system

Create `config/.env.example` with these variables:
```
# Set to "production" to use real SQL Server, "mock" to use seed data
LSB_MODE=mock

# SQL Server connection (only needed when LSB_MODE=production)
LSB_DB_SERVER=localhost
LSB_DB_PORT=1433
LSB_DB_NAME=MARS_PROD
LSB_DB_USER=lsb_reader
LSB_DB_PASSWORD=

# Go API gateway port
LSB_PORT=3001

# Java microservice URL (Go proxies to this)
LSB_JAVA_URL=http://localhost:8080
```

Copy `config/.env.example` to `config/.env` if `.env` does not already exist (do not overwrite existing).

In `backend-go/main.go`, load `config/.env` using the existing Go stdlib only (no new packages — read the file manually with `os.ReadFile`, split on newlines, parse KEY=VALUE). Apply each variable with `os.Setenv`. Then branch on `LSB_MODE`: if "production", proxy API calls to `LSB_JAVA_URL`; if "mock", serve the mock handlers from `seed/mock_server.go` inline.

Also apply the same env loading to `exe/main.go`.

---

## TASK 2 — First-run setup screen

In `frontend/src/components/SetupScreen.jsx` (new file), create a full-page setup wizard shown when the API returns a special status `{"status":"unconfigured"}`.

The setup screen has two steps:

**Step 1 — Connection choice:**
- Option A: "🗄 Connect to SQL Server" — shows a form with fields: Server, Port (default 1433), Database Name, Username, Password. Submit calls `POST /api/setup/test-connection` and shows ✓ Connected or ✗ error message.
- Option B: "📊 Run with Demo Data" — sets `LSB_MODE=mock` and redirects to the main dashboard immediately.

**Step 2 — Data seeding (only after successful connection):**
- Shows: "Your database is connected and empty. Would you like to import historical data?"
- Button: "📎 Upload Excel File" — file picker accepting `.xlsx` only
- On file select, sends the file to `POST /api/setup/import-excel` and shows a progress indicator
- Button: "⏭ Skip — start fresh" — goes straight to the main dashboard
- After import completes, shows a summary: "Imported X stations, Y OEE entries, Z issues" then redirects to the main dashboard

Style the setup screen using the same dark theme as the rest of the app (#0a0e14 bg, inline styles only, no new packages).

In `frontend/src/App.jsx`, add a check at startup: if `kpis` fetch returns `{"status":"unconfigured"}`, render `<SetupScreen onComplete={() => window.location.reload()} />` instead of the normal dashboard.

---

## TASK 3 — Excel import API endpoint

In `seed/mock_server.go` AND `exe/main.go`, add these two new API handlers:

### POST /api/setup/test-connection
Accepts JSON body:
```json
{"server":"","port":1433,"database":"","username":"","password":""}
```
Tries to open a SQL Server connection using `database/sql` with the `github.com/denisenkom/go-mssqldb` driver (add to go.mod). Returns:
```json
{"ok":true,"message":"Connected to MARS_PROD on MARSDB01"}
```
or:
```json
{"ok":false,"error":"Login failed for user 'lsb_reader'"}
```
On success, writes the connection string to `config/.env` (update LSB_DB_* variables and set LSB_MODE=production). Returns immediately — do not keep the connection open.

### POST /api/setup/import-excel
Accepts multipart/form-data with field name `file` containing the .xlsx file.

Parse the Excel file without any external Go library — save it to a temp file, then shell out to a Python script `scripts/import_excel.py` (create this script). The Python script:
- Accepts the temp xlsx path as argv[1] and a SQL connection string as argv[2]  
- Uses `openpyxl` to read the file (install: `pip install openpyxl`)
- Reads these sheets if they exist: "OEE Data", "Station OEE", "Operator Data", any sheet with "OEE" in the name
- Inserts into SQL Server tables: `oee_entries`, `kpi_summary` using `pyodbc` (install: `pip install pyodbc`)
- Prints a JSON summary to stdout: `{"stations":47,"oee_entries":120,"errors":[]}`

The Go handler reads stdout, returns the JSON summary to the frontend.

Also accept the existing `Assembly OEE 2026.xlsx` format — the script should handle the column mapping from the Excel file that is already in the project (look at the constants in `frontend/src/components/OEEAnalyticsTab.jsx` to understand the column names and data structure — STATION_OEE, OPERATOR_DATA, MONTHLY_DATA are already extracted from the real Excel file).

---

## TASK 4 — Production API endpoint in Go (no Java required for OEE data)

Add a new route in `exe/main.go` and `backend-go/main.go`:

### GET /api/oee/entries
When `LSB_MODE=production`, query the `oee_entries` SQL table and return all rows as JSON array.
When `LSB_MODE=mock`, return an empty array (entries come from localStorage in the frontend).

### POST /api/oee/entries  
When `LSB_MODE=production`, INSERT a new row into `oee_entries` table from the JSON body.
When `LSB_MODE=mock`, return `{"ok":true,"id":0}` (frontend saves to localStorage instead).

Update `frontend/src/api/client.js` to add:
```js
oeeEntries: () => fetch('/api/oee/entries').then(r => r.json()),
saveOeeEntry: (entry) => fetch('/api/oee/entries', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(entry)}).then(r => r.json()),
```

Update `frontend/src/components/OEEAnalyticsTab.jsx` — in `OEELogEntry`, after saving to localStorage also call `api.saveOeeEntry(entry).catch(()=>{})` so entries are persisted to SQL when connected.

In `OEEEntries`, on mount call `api.oeeEntries()` and merge with localStorage entries (deduplicate by date+shift+cell). Show a "(synced)" badge on entries that came from the server.

---

## TASK 5 — Production status indicator

In `frontend/src/components/Header.jsx`, add a small indicator next to the existing status pill:
- When running in mock mode: grey pill "DEMO MODE"  
- When running in production mode (real DB): no extra pill (the existing LIVE/ERROR indicator is enough)

Call `GET /api/health` to determine the mode. Add that endpoint to both servers, returning:
```json
{"status":"ok","mode":"mock","version":"2.0"}
```
or
```json
{"status":"ok","mode":"production","db":"MARS_PROD","version":"2.0"}
```

---

## CONSTRAINTS (do not violate)
- Do NOT remove or break the existing mock data mode — `go run seed/mock_server.go` must still work as before
- Do NOT install new npm packages in the frontend
- Do NOT change existing tab IDs, component names, or API routes that already work
- Inline styles only in all React components
- All new Go code must compile with `go vet ./...` passing
- The `config/.env` file must be added to `.gitignore` (it contains passwords)
- After all changes, rebuild `lsb-dashboard.exe` with: `cd exe && go build -o ../lsb-dashboard.exe .`
- Run `go vet` on both `seed/mock_server.go` and `exe/main.go` after changes
- Verify the frontend builds without errors: `cd frontend && npm run build`
```
