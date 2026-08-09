# Drishti Line Side Board — OpenAI Codex CLI Work Prompt

## How to run Codex CLI
```bash
# Install (one-time)
npm install -g @openai/codex

# Authenticate (one-time)
codex auth login

# Run a task (use --full-auto for hands-free file edits)
codex --full-auto "Read CODEX_PROMPT.md and implement task #1 — Executive Summary tab"

# Review mode (shows a diff before applying)
codex --auto-edit "Read CODEX_PROMPT.md and implement task #2 — Export/Print"

# Suggest only (no file changes, just shows what it would do)
codex --suggest "Read CODEX_PROMPT.md and implement task #3 — Alert banner"
```

## Project in one sentence
A real-time manufacturing execution dashboard (React + Go + Java) displayed on TVs beside assembly lines. Workers and supervisors use it to track OEE, production, downtime, shipping, and quality.

## Tech stack
- **Frontend**: React 18 + Vite (port 5173 in dev)  ·  `frontend/src/`
- **Go API gateway**: port 3001  ·  `backend-go/`  (also serves static build in prod)
- **Java microservice**: port 8080  ·  `backend-java/`  (MARS ERP / SQL Server proxy)
- **Mock server**: `seed/mock_server.go`  (standalone, runs when real DB is unavailable)
- **Standalone EXE**: `exe/main.go`  (embeds React build + all mock API handlers)

## How to run for dev
```bash
# Terminal 1 — mock API (no database needed)
go run seed/mock_server.go

# Terminal 2 — frontend hot-reload
cd frontend && npm run dev
# Opens http://localhost:5173
```

## What has already been built (do NOT redo)
- All tabs: Stations · Production · Productivity · Issues · Downtime · Robot Press · MARS Data · Shipping · Floor Status · 1×1 Sheet · Legend · Weekly · **📈 OEE Analytics**
- KPI strip with trend arrows (▲▼) comparing current vs previous refresh
- Shipping panel (`ShippingPanel.jsx`) — parts shipped, trucks, on-time rate, customer deliveries table
- Floor Status (`ProductionStatusCard.jsx`) — per-station status grid (RUNNING/DOWNTIME/IDLE/SETUP)
- OEE Analytics tab (`OEEAnalyticsTab.jsx`) — data from Assembly OEE 2026.xlsx:
  - Fleet OEE gauge, 47 stations sortable by OEE/JPH/DT, filterable by Program & Customer
  - Downtime split stacked bar chart per station
  - Top 12 downtime issues with minutes + occurrence count
  - Month-over-month heat-map table with sparklines
- 1×1 Problem Solving Sheet (`OneByOneTab.jsx`) — digital form + **scanned file upload** (JPG/PNG/PDF → base64, thumbnail card, full viewer, "Convert to Digital" button)
- Tab labels fixed: "🔢 Floor Status", "🗺 Legend" (removed duplicate 🏭 emojis)
- **🎯 Executive Summary tab** — plant health score ring, top KPIs, shift-over-shift comparison, bottom-5 stations, shipping snapshot, quick nav
- **Alert banner** in App.jsx — dismissible, auto-re-shows on new alert conditions (efficiency <75%, LATE delivery, 3+ issues)
- **🖨 Print** buttons on ShippingPanel and ProductionStatusCard — white-bg printable HTML in new tab
- **➕ Log Entry + 📋 Entries** sub-tabs in OEEAnalyticsTab — OEE form with live A×P×Q preview, saves to localStorage
- **lsb-dashboard.exe** (10.36 MB) — single self-contained Windows executable, all mock API + React build embedded
- **Audio + desktop notification alerts** in `App.jsx` — two-tone Web Audio beep (880Hz→660Hz), browser Notification when tab is hidden, useRef transition guard, no new state or files
- **Weekly trend chart** in `WeeklyPanel.jsx` — SVG OEE polyline, 85% target line, Best/Worst/Average cards, 7-row breakdown table, deterministic Mon–Sun fallback data
- **Live data drift** in `seed/mock_server.go` and `exe/main.go` — mutex-protected state, smooth bounded drift on efficiency/cycle-time/FPY/actual parts per resource, occasional issue count changes. Validated with `go test` + `go vet`.

## Files to know
```
frontend/src/App.jsx                          — tab list, data fetch loop, layout
frontend/src/components/KPIStrip.jsx          — top KPI tiles with trend arrows
frontend/src/components/OEEAnalyticsTab.jsx   — OEE analytics (Excel data embedded)
frontend/src/components/ShippingPanel.jsx     — shipping status
frontend/src/components/ProductionStatusCard.jsx — floor status grid
frontend/src/components/OneByOneTab.jsx       — 1×1 PS sheet + scan upload
frontend/src/components/Header.jsx            — sticky header with clock, status pill
frontend/src/api/client.js                    — all API calls
seed/mock_server.go                           — mock API (add new endpoints here)
exe/main.go                                   — standalone EXE (mirrors mock endpoints)
Makefile                                      — make dev-go / dev-frontend / build-exe
```

## Style conventions (match exactly)
- Dark theme: `#0a0e14` app bg · `#0d1117` panels · `#161b22` cards · `#21262d` borders
- Accent cyan `#00d4ff` · green `#00ff88` · amber `#ffaa00` · red `#ff4444` · purple `#a78bfa`
- All fonts: `Arial, sans-serif` for body · `'Courier New', monospace` for numbers/IDs
- KPI values: monospace, bold, accent-coloured, `fontSize 28–30`
- Status badges: pill shape, `background: color+'15'`, `border: 1px solid color+'33'`
- No external CSS files — inline styles only (`const S = { ... }`)
- API calls always go through `frontend/src/api/client.js`, never raw fetch in components

## Remaining work — priority order

### 1. Executive Summary tab (HIGH — business leader ask)
Add a new tab `{ id: 'exec', label: '🎯 Executive Summary' }` **as the first tab** (before Stations).
Create `frontend/src/components/ExecutiveSummary.jsx`.

Show in a single scroll:
- **Plant health score** (0–100): weighted average of OEE%, on-time delivery, open issues inverse, efficiency. Show as a large colour-coded number with RAG status.
- **Top 3 KPIs** (giant tiles): OEE%, On-Time Delivery %, Open Issues count
- **Shift comparison**: current shift vs previous shift for actual/plan, efficiency, OEE. Show delta with ▲▼.
- **Bottom 5 stations by OEE** — table showing station, OEE, primary DT cause, suggested action.
- **Alert list**: any station below 75% OEE, any open issues with severity HIGH, shipping LATE deliveries — each as a dismissible red card.

Wire up: pass `kpis`, `productionStatus`, `shippingStatus`, `issues` props from `App.jsx`.

### 2. Export / Print report (MEDIUM)
In `ShippingPanel.jsx` and `ProductionStatusCard.jsx`, add a `🖨 Print` button (top-right of the panel).
On click, open a new browser tab with `window.open()` containing a clean white-background HTML summary of the panel data (no dark theme). Use `document.write()` and `window.print()`.

### 3. Alert banner (MEDIUM)
In `App.jsx`, add a dismissible alert banner between the KPI strip and the tab bar.
Show the banner when any of these conditions are true:
- Any station in `productionStatus` has `efficiency < 75` and `status === 'running'`
- `shippingStatus.customer_deliveries` has any entry with `status === 'LATE'`
- `issues.length >= 3`

Banner style: full-width, red background `#ff444420`, red border top `3px solid #ff4444`, text lists the alerts. Has an ✕ dismiss button (sets a `dismissed` state, re-shows if a new alert condition appears after next refresh).

### 4. OEE data entry form (MEDIUM)
Add a sub-tab "➕ Log Entry" inside `OEEAnalyticsTab.jsx`.
Form fields matching the Excel INPUT columns:
- Date (date picker), Shift (1/2/3 select), Cell (dropdown from STATION_OEE list)
- Part Number (text), Tooling DT (number), Top Tooling Issue (text)
- Maint DT (number), Top Maint Issue (text), Prod DT (number), Top Prod Issue (text)
- Parts Reported (number), Target Cycle Time (number), Actual Cycle Time (number)
- Scrap (number), Rework (number)
- Auto-calculate: Efficiency%, Uptime%, Quality%, OEE% and show live preview below the form.

Save to `localStorage` under key `lsb_oee_entries`. Add a "📋 Entries" sub-tab that lists saved entries as cards.

### 5. ~~Standalone EXE~~ ✅ COMPLETE
`lsb-dashboard.exe` (10.36 MB) ships at the repo root. Built with CGO_ENABLED=0, GOOS=windows, GOARCH=amd64.
Run: double-click or `.\lsb-dashboard.exe` → dashboard at http://localhost:3001.
All mock API endpoints verified HTTP 200. `build-exe` target in Makefile (requires GNU Make; run the two commands directly if Make is not installed).

---

## Important constraints
- Do NOT install new npm packages unless absolutely necessary (only use what is already in `package.json`)
- Do NOT change the existing tab IDs — only add new ones
- Do NOT modify `CLAUDE.md` — it is the original architecture plan
- Inline styles only — no new CSS files, no Tailwind
- Keep mock data realistic — use real station names from STATION_OEE in OEEAnalyticsTab.jsx
- After any component change, verify brace balance and that the component has a `default export`
