# Codex Feature Prompts — Run One at a Time

Run these in order. Verify the app works after each one before running the next.

---

## FEATURE 1 — Historical Date Navigation

Paste this into Codex:

```
Read CODEX_PROMPT.md and USER_GUIDE.md for full project context.

Add a date navigation system so users can look back at any past date's data.

### 1. Date picker in the header

Open `frontend/src/components/Header.jsx`. Add a date control to the right side of the header bar (before the status pill):

- A "◀" previous-day button
- A date display showing the selected date (e.g. "Tue 05 Aug 2026")
- A "▶" next-day button (disabled when viewing today)
- A "● LIVE" chip that resets to today and re-enables live auto-refresh when clicked
- When viewing a past date, the chip changes to "🕐 HISTORY" in amber (#ffaa00)

Props: add `selectedDate`, `onDateChange`, `isLive` to Header. selectedDate is a JS Date object.

### 2. Wire date into App.jsx

In `frontend/src/App.jsx`:

- Add state: `const [selectedDate, setSelectedDate] = useState(new Date())`
- Add computed: `const isLive = isToday(selectedDate)` (write a helper: same year/month/day as new Date())
- When `isLive` is true: keep the existing 15-second auto-refresh running
- When `isLive` is false (history mode): stop auto-refresh, do a single fetch for that date, show no auto-refresh dot
- Pass `selectedDate` as a `date` parameter to every `api.*` call
- Pass `selectedDate`, `onDateChange`, `isLive` to `<Header />`

### 3. Update api/client.js

Add a `dateStr(d)` helper that formats a Date as `YYYY-MM-DD`. Append `&date=YYYY-MM-DD` to every existing API call that accepts a resource/shift. Example:
```js
kpis: (resource, shift, date) =>
  fetch(`/api/kpis?resource=${resource}&shift=${shift}&date=${dateStr(date)}`).then(r => r.json()),
```
Update all calls: kpis, production, productivity, issues, downtime, weekly, marsKpis, marsProduction, marsQuality, marsSchedule.

### 4. Date filter bar above tab content

In `App.jsx`, between the alert banner and the tab bar, when `!isLive` show a full-width amber info bar:
```
🕐 Viewing historical data for Tuesday, 05 August 2026  [Return to Live ●]
```
Style: background #ffaa0015, border-top 3px solid #ffaa00, same dismiss-button style as the alert banner.

### 5. Mock server — date parameter support

In `seed/mock_server.go` and `exe/main.go`, read the `?date=` query param in all handlers. When a past date is provided, return slightly different mock data (reduce efficiency by 5–10%, use a different seed value for the random drift based on the date string hash). When no date param or today's date, return current live drift data as before.

### 6. Weekly tab — date navigation

In `frontend/src/components/WeeklyPanel.jsx`, change the panel title from "Weekly" to show the week range: "Week of Mon 01 Aug – Sun 07 Aug 2026". The week displayed should be the week containing `selectedDate`. Pass `selectedDate` as a prop to `WeeklyPanel`.

### Constraints
- Do not change any existing tab IDs or remove any existing features
- Inline styles only, no new npm packages
- `go vet` must pass after changes to Go files
- Rebuild exe after: `cd exe && go build -o ../lsb-dashboard.exe .`
```

---

## FEATURE 2 — Production Notes

Paste this into Codex:

```
Read CODEX_PROMPT.md for full project context.

Add a shift notes system so operators and supervisors can write timestamped notes during production.

### 1. Notes panel in Production tab

Open `frontend/src/components/ProductionTab.jsx`. Below the existing production rows table, add a "Shift Notes" section:

- Section header: "📝 Shift Notes" with a note count badge
- A text area (3 rows, full width) with placeholder "Add a note... (e.g. 'Tool changed at 14:30', 'Material delay resolved', 'Supervisor notified of scrap spike')"
- A "Post Note" button (cyan #00d4ff accent)
- On submit: prepend the note to a list below with timestamp (HH:MM format), auto-clear the textarea
- Notes list: each note shows time chip (monospace, small), the note text, and a ✕ delete button on hover
- Notes are stored in localStorage under key `lsb_notes_{resource}_{date}_{shift}` so they persist per station per shift
- Cap at 50 notes per key (drop oldest when over limit)

### 2. Note categories

Add 4 quick-tag buttons before the textarea:
- [🔧 Tooling] [⚠ Quality] [🚛 Material] [📋 General]
Clicking a tag pre-fills the textarea with that category prefix, e.g. "🔧 Tooling: "

### 3. Notes indicator in Stations grid

In `frontend/src/components/StationsPanel.jsx`, for each station card, show a small 📝 count badge (same style as the issues badge in the tab bar) when that station has notes saved in localStorage for today. Load note counts on mount.

### 4. Notes in Executive Summary

In `frontend/src/components/ExecutiveSummary.jsx`, add a "Recent Notes" section at the bottom — show the last 5 notes across all stations for today, formatted as:
```
[14:32] WM15  ⚠ Quality: Scrap spike observed on part BMW1000D-360
[13:15] WM22  🔧 Tooling: Tool #4 changed, 18 min downtime
```
Read from all `lsb_notes_*` localStorage keys matching today's date.

### 5. Notes API endpoint (for production DB mode)

In `seed/mock_server.go` and `exe/main.go`, add:

POST /api/notes
Body: `{"resource_id":"WM15","shift":2,"date":"2026-08-05","text":"Tool changed","category":"Tooling"}`
In mock mode: return `{"ok":true,"id":1234567890}`
In production mode: INSERT into a `shift_notes` table (create the SQL schema in comments at top of the handler):
```sql
CREATE TABLE shift_notes (
    id          INT IDENTITY PRIMARY KEY,
    resource_id VARCHAR(20),
    shift       INT,
    note_date   DATE,
    category    VARCHAR(50),
    note_text   VARCHAR(1000),
    created_at  DATETIME DEFAULT GETDATE()
);
```

GET /api/notes?resource=WM15&shift=2&date=2026-08-05
Returns array of notes for that resource/shift/date, ordered newest first.

In `frontend/src/api/client.js` add:
```js
notes: (resource, shift, date) => fetch(`/api/notes?resource=${resource}&shift=${shift}&date=${dateStr(date)}`).then(r => r.json()),
postNote: (note) => fetch('/api/notes', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(note)}).then(r => r.json()),
```

Update `ProductionTab.jsx` to also call `api.postNote()` alongside localStorage save (catch errors silently).

### Constraints
- Inline styles only, no new npm packages
- Match dark theme: note cards background #161b22, border #21262d, timestamp color #6e7681
- Notes textarea: background #0d1117, border #21262d, color #e6edf3, resize: vertical
- `go vet` must pass, rebuild exe after changes
```

---

## FEATURE 3 — Drill-Down Everywhere

Paste this into Codex:

```
Read CODEX_PROMPT.md for full project context.

Add drill-down detail views throughout the dashboard. Each drill-down opens a full-panel detail view that replaces the list/grid, with a ← Back button to return.

### Pattern to implement (use this same pattern in all 4 places below)

In each component, add state:
```jsx
const [drillTarget, setDrillTarget] = useState(null)
```
When `drillTarget` is null, show the normal list/grid. When set, show the detail view with a back button:
```jsx
<button onClick={() => setDrillTarget(null)} style={{...}}>← Back</button>
```

### 1. OEE Analytics — Station drill-down

In `OEEAnalyticsTab.jsx`, on the "Station OEE" sub-tab, make each station row clickable. When clicked, show a station detail view with:
- Large OEE gauge (same OEEGauge component, size=140) with station name as title
- 4 metric tiles: OEE%, JPH, Parts, Total Downtime min
- Downtime breakdown: 5 labelled bars (tooling/maint/prod/material/quality DT) using the Bar component
- Monthly trend: pull from MONTHLY_DATA if this station appears there, else show a flat sparkline
- Issues: a static list of the top 3 downtime issues for this station's program (look up from TOP_ISSUES filtered by matching category)
- "Suggested action": if mDTpct > 10 show "→ Schedule PM", if tDTpct > 8 show "→ Review tooling life", if oee < 75 show "→ Raise 1×1 sheet"

### 2. Shipping — Customer delivery drill-down

In `ShippingPanel.jsx`, make each row in the customer deliveries table clickable. When clicked, show a customer detail card with:
- Customer name as title (large, accent coloured)
- All deliveries for that customer (filter `customer_deliveries` by customer name)
- A timeline: each delivery as a horizontal bar on a timeline, coloured by status
- Summary: total parts to that customer today, on-time count vs late count
- Contact placeholder: "Customer contact: [not configured]" in muted text

### 3. Issues — Issue detail drill-down

In `IssuesTab.jsx`, make each issue row/card clickable. When clicked, show issue detail:
- Issue title and severity badge (large)
- Full description text (not truncated)
- Timeline: Raised at → [In Progress at] → [Closed at] as a horizontal step indicator
- Resource and shift info
- A "Resolution Notes" text area (same style as production notes) stored in localStorage under `lsb_issue_notes_{id}`
- A status change button: if OPEN show "→ Mark In Progress", if IN_PROGRESS show "→ Mark Resolved" (updates localStorage state for that issue id, visual only in mock mode)

### 4. Downtime — Event drill-down

In `DowntimeTab.jsx`, make each downtime category clickable. When clicked, show a category detail view with:
- Category name as title (e.g. "TOOLING DOWNTIME")
- A bar chart of the top 5 individual downtime reasons within that category using the Bar component
- Total minutes and event count
- A trend note: "This category accounts for X% of total downtime this shift"
- A "Log Action Taken" text area stored in localStorage under `lsb_dt_action_{resource}_{category}_{date}`

### 5. Floor Status — Station drill-down

In `ProductionStatusCard.jsx`, each station card is already clickable (goes to Production tab). Change the click behaviour:
- Single click: open the in-panel drill-down detail view (do NOT navigate to Production tab anymore)
- The detail view shows: large status badge, actual/plan with progress bar, efficiency gauge (reuse OEEGauge at size=100), cycle time history as a sparkline (generate 8 plausible mock data points around current cycle_time_sec ±10%), current part and next part, current operator if available
- Add a "→ Go to Production Tab" link button inside the detail view that does navigate (pass an `onNavigate` prop)

### General constraints
- ← Back button style: background transparent, border 1px solid #21262d, color #8b949e, borderRadius 8, padding 7px 16px, cursor pointer, marginBottom 16
- All detail views use the same padding 24px wrap as other panels
- Section headers: fontSize 11, color #8b949e, letterSpacing 1, textTransform uppercase
- Inline styles only, no new packages
- Do not change API calls — all detail views use data already loaded in the parent component (no new fetches needed)
- go vet must pass, rebuild exe after all changes
```

---

## FEATURE 4 — Custom TV Dashboard Builder

Paste this into Codex:

```
Read CODEX_PROMPT.md for full project context.

Add a full-screen customisable TV dashboard that lets users pick which widgets to display, arrange them in a grid, and cycle through multiple layouts automatically. This is for mounting on factory floor TVs.

### 1. New tab — 📺 TV Dashboard

Add to the TABS array in `App.jsx`:
```js
{ id: 'tv', label: '📺 TV Mode' }
```
Import and render `<TVDashboard />` when this tab is active. Pass all existing data as props: kpis, productionStatus, shippingStatus, issues, stations, downtime, marsKpis, resource, isLive (add this prop once Feature 1 is done; for now hardcode true).

### 2. Create frontend/src/components/TVDashboard.jsx

This component has two modes toggled by a state variable `fullscreen`:

**Config mode** (fullscreen=false): The layout builder.
**TV mode** (fullscreen=true): The actual full-screen display.

### 3. Available widgets

Define a WIDGETS array — each widget has an id, label, and a render function that accepts the data props:

```js
const WIDGETS = [
  { id: 'kpi_strip',     label: '📊 KPI Strip',          minW: 2 },
  { id: 'plant_health',  label: '🎯 Plant Health Score',  minW: 1 },
  { id: 'efficiency',    label: '⚡ Efficiency Gauge',    minW: 1 },
  { id: 'actual_plan',   label: '🔢 Actual vs Plan',      minW: 1 },
  { id: 'oee_fleet',     label: '📈 Fleet OEE',           minW: 1 },
  { id: 'floor_status',  label: '🏭 Floor Status Grid',   minW: 2 },
  { id: 'shipping',      label: '🚛 Shipping Status',     minW: 2 },
  { id: 'issues',        label: '⚠ Open Issues',          minW: 1 },
  { id: 'alerts',        label: '🚨 Alert Banner',        minW: 2 },
  { id: 'top_stations',  label: '🏆 Top 5 Stations',      minW: 1 },
  { id: 'bottom_stations',label: '⬇ Bottom 5 Stations',  minW: 1 },
  { id: 'clock',         label: '🕐 Live Clock',          minW: 1 },
  { id: 'on_time_rate',  label: '📦 On-Time Delivery',    minW: 1 },
]
```

### 4. Config mode — layout builder

Show a grid of all available widget tiles (3 columns). Each tile is a card with the widget label and a toggle checkbox. Selected widgets are highlighted with cyan border.

Below the widget grid, show layout options:
- **Columns**: 1 / 2 / 3 / 4 (button group, default 3)
- **Auto-cycle layouts**: toggle switch — when ON, show a "Cycle every N seconds" number input (default 30). Cycle through saved layouts automatically.

Two preset buttons:
- "Supervisor View" — pre-selects: plant_health, efficiency, actual_plan, floor_status, alerts, issues
- "Executive View" — pre-selects: plant_health, kpi_strip, on_time_rate, shipping, top_stations, bottom_stations

Below that:
- "💾 Save Layout" — saves current widget selection + columns to localStorage as `lsb_tv_layout_1` (or 2, 3... allow up to 4 saved layouts)
- "📺 Launch TV Mode" — enters fullscreen mode
- Saved layouts listed as chips: "Layout 1 [Edit] [Delete]" etc.

### 5. TV mode — full screen display

When fullscreen=true:
- Call `document.documentElement.requestFullscreen()` to enter true browser fullscreen
- Render a dark (#0a0e14) full-screen grid using CSS grid with the configured number of columns
- Each selected widget fills its cell, styled as a card (background #161b22, border 1px solid #21262d, borderRadius 12, padding 16)
- Show a thin header bar at the top (height 36px): plant name "DRISHTI MANUFACTURING", current time (update every second), and a small "⚙ Exit" button (top-right, semi-transparent)
- "⚙ Exit" calls `document.exitFullscreen()` and sets fullscreen=false
- Auto-cycle: if enabled, cycle through saved layouts every N seconds using setInterval

### 6. Widget render functions

Implement each widget as a self-contained render function that receives the data props. Keep them compact — they must fit in a grid cell. Examples:

**clock**: Large digital time display, monospace, white, with date below in muted text. Update every second with setInterval inside a useEffect.

**plant_health**: The OEEGauge component reused with the plant health score (calculate same formula as ExecutiveSummary.jsx). Show HEALTHY/CAUTION/AT RISK label.

**efficiency**: Large number (same style as KPIStrip tile value), efficiency_pct from kpis, colour-coded, with a thin progress bar below.

**actual_plan**: Two-line display "ACTUAL: 847" / "PLAN: 900" with gap badge (same as KPIStrip).

**floor_status**: Compact version of ProductionStatusCard — show station ID, status badge, and efficiency% in a tight 4-column sub-grid. No click interaction in TV mode.

**issues**: Count of open issues, large number, colour coded. List first 3 issue descriptions in small text below.

**clock**: Current time HH:MM:SS, updates every second.

**top_stations**: Top 5 stations by efficiency (from productionStatus), each as a one-line row with station ID and efficiency bar.

**bottom_stations**: Bottom 5 stations by efficiency, same style as top_stations but red accents.

**alerts**: If no alerts: green "✓ All Systems Normal". If alerts: red card listing each alert message.

**shipping**: Parts shipped today, on-time rate, next shipment in compact 2×2 grid.

**on_time_rate**: Large OEE-gauge-style ring showing on_time_rate_pct from shippingStatus.

**kpi_strip**: All 6 KPI tiles in a 3×2 compact grid (reuse Tile component logic inline).

**oee_fleet**: Average OEE across all productionStatus rows with OEEGauge at size=100.

### 7. Persistence

Save the full TV dashboard config to localStorage under `lsb_tv_config`:
```json
{
  "layouts": [
    {"id":1,"name":"Layout 1","widgets":["plant_health","efficiency","floor_status"],"columns":3},
    {"id":2,"name":"Layout 2","widgets":["kpi_strip","shipping","alerts"],"columns":2}
  ],
  "autoCycle": true,
  "cycleSeconds": 30,
  "activeLayout": 1
}
```
Load this config on mount. If no config exists, default to the Supervisor View preset.

### Constraints
- Inline styles only, no new npm packages
- The fullscreen grid must have no scrollbars — each widget must fit within its cell (use overflow: hidden on cells)
- Widget render functions must be pure — they receive data as arguments, no API calls inside
- The ⚙ Exit button must always be visible in TV mode even when other content is large
- All widget content must remain readable from 3–4 metres away on a 55" TV: minimum font size 14px for data values, KPI numbers minimum 28px
- Brace/paren balance check after writing the file: run node -e "..." verification as in previous sessions
- Rebuild exe after: cd exe && go build -o ../lsb-dashboard.exe .
```

---

## Recommended run order

1. **Feature 1** (Date navigation) first — it changes how API calls work, everything else builds on top
2. **Feature 2** (Notes) — standalone, no dependencies
3. **Feature 3** (Drill-down) — depends on existing components being stable
4. **Feature 4** (TV Dashboard) — last, as it references data from all other components

Each prompt is self-contained. Codex reads CODEX_PROMPT.md at the start of each, so it has full project context every time.
