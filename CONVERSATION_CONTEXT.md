# MesLineSideBoard — Conversation Context & Project Reference

> Working file for Claude to reference in future sessions. Contains project overview, architecture, and conversation history.

**User:** Yash (k_yashwanta@hotmail.com) — IT Manager, Special Project, Cyber Security
**Workspace:** `C:\MesLineSideBoard`
**Last updated:** 2026-04-21

---

## Project Overview

**Name:** Line Side Board — WM15
**Purpose:** Real-time shop-floor production monitoring dashboard (MES / digital Andon board). Replaces paper-based boards at workstation WM15.
**Deployment:** Proxmox LXC 205 @ 192.168.1.126 (PostgreSQL 17 + Go API + nginx).
**Network:** CORS-locked to plant subnet `192.168.1.0/24`.

---

## File Inventory

| File | Lines | Purpose |
|---|---|---|
| `index.html` | 1054 | Single-page UI (HTML + vanilla JS, no build step) |
| `main.go` | 1093 | Go HTTP API server (port 3001) |
| `README.md` | 373 | Project documentation |
| `.env.example` | — | Config template (DB creds, resource ID, JPH target) |
| `go.mod` | — | Go module definition |

---

## Architecture

```
[Browser UI :80/443]  ── HTTP ─►  [Go API :3001]  ── SQL ─►  [PostgreSQL :5432 / mesdb]
  index.html                        main.go                   production_log
  (vanilla JS, 15s poll)            (Go handlers)             downtime_log
                                                              open_issues
```

**Tech:** HTML5 + vanilla JS (no framework) · Go HTTP server · PostgreSQL 17
**External systems:** None. Self-contained, DB-only.

---

## UI Layout (index.html)

Top-to-bottom:

1. **Header (sticky)** — "MES — LINE SIDE BOARD — WM15", date, live clock (1s tick), status pill (Connecting / ● LIVE / API Error)
2. **KPI strip** (6 tiles): Actual/Plan · Efficiency % · First Pass Yield % · Avg Cycle Time · Hours Worked · Open Issues
3. **Tabs** (orange underline when active):
   - **Production** — hourly table (Hour, Part#, Operator, Plan, Actual, Good/Hr, Scrap, Gap, Cycle Time, Notes, Confirm button)
   - **Productivity** — stacked bar chart, Target vs Actual per hour, color-coded by performance
   - **Issues** — severity-colored cards (type, description, status, acknowledged-by, timestamp)
   - **Downtime** — log form (reason code + minutes + comment) + today's events list
4. **Footer (sticky)** — API version, DB host, operator name, auto-refresh interval (15s), last update

**API base URL (hardcoded in UI):** `http://192.168.1.126:3001/api` (lines 713–718)
**Polling:** `fetchAll()` every 15 seconds via `setInterval` (line 1047)

---

## API Endpoints & Data Flow

All GET endpoints filter to **today's date** and **resource_id=WM15**.

| UI Element | Method | Endpoint | Handler (main.go) | Data Source |
|---|---|---|---|---|
| KPI tiles | GET | `/api/kpis?resource=WM15&shift=2` | `handleKPIs` (L529) | `production_log` — SUM good/scrap, AVG cycle, hours worked |
| Production table | GET | `/api/production?resource=WM15&shift=2` | `handleProduction` (L430) | `production_log` grouped by HOUR(event_ts) |
| Productivity chart | GET | `/api/productivity?resource=WM15&shift=2` | `handleProductivity` | `production_log` hourly good_count vs `JPH_TARGET` |
| Issues cards | GET | `/api/issues?resource=WM15` | `handleIssues` (L644) | `open_issues` WHERE status != 'closed' |
| Downtime list | GET | `/api/downtime?resource=WM15` | `handleDowntimeGET` | `downtime_log` WHERE start_ts::date = CURRENT_DATE |
| Confirm Hour btn | POST | `/api/confirm` | `handleConfirm` | Writes `confirmed_by` + `confirmed_at` to `production_log` |
| Log Event btn | POST | `/api/downtime` | `handleDowntimePOST` (L840) | INSERT into `downtime_log` |
| Health check | GET | `/api/health` | `handleHealth` | DB ping + today's event count |

---

## Database Schema (mesdb @ 192.168.1.126:5432)

**User:** `mesapp`

### `production_log`
Event-level production records. Fields used: `event_ts`, `resource_id`, `shift_number`, `good_count`, `scrap_count`, `cycle_time_seconds`, `part_number`, `operator_name`, `notes`, `confirmed_by`, `confirmed_at`. Startup migration (L273–314) adds `confirmed_by` + `confirmed_at` if missing.

### `downtime_log`
Downtime events. Fields used: `start_ts`, `end_ts`, `resource_id`, `reason_code`, `reason_detail`, `operator_name`. `is_open = (end_ts IS NULL)` in the response.

### `open_issues`
Quality/maintenance/safety issues. Fields used: `id`, `description`, `issue_type`, `severity`, `status`, `acknowledged_by`, `created_ts`. Sorted severity DESC (critical→high→medium), then created_ts DESC.

---

## Configuration (.env)

Loaded in main.go (L117–151):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `RESOURCE_ID=WM15`
- `JPH_TARGET=23` (jobs per hour target, used for plan/efficiency calcs)
- `SHIFT_NUM=2`
- `PROD_TABLE=production_log`, `DT_TABLE=downtime_log`, `ISSUES_TABLE=open_issues`

**Downtime reason codes:** PM, EQ, OP, MT, QA, CL, BK, OT

---

## Key Calculations

- **Efficiency %** = `total_good / (hours_worked × JPH_TARGET) × 100`
- **First Pass Yield %** = `total_good / (total_good + total_scrap) × 100`
- **Gap** = `actual − plan` (cumulative per hour)
- **Plan accumulator** = `hours_elapsed × JPH_TARGET` (23 parts/hr)

---

## Notable Characteristics / Gotchas

- All queries are **today-scoped** (`event_ts::date = CURRENT_DATE`) — no historical view in UI.
- Single-resource design (WM15). No cross-machine aggregation.
- No WebSockets — pure 15-second polling.
- No authentication layer visible — CORS-based network isolation only.
- Audit logging on POST endpoints (writes/confirmations) — includes IP, operator, timestamp.
- API URL is hardcoded in index.html (lines 713–718) — change required for other environments.

---

## Conversation History

### 2026-04-21

**Q:** "can you check what ui i have what am i pulling on that UI to display"

**A:** Surveyed index.html + main.go. Produced full UI-to-DB trace (see "API Endpoints & Data Flow" table above). Key finding: 5 GET endpoints polled every 15s, 2 POST endpoints for operator actions, all backed by 3 PostgreSQL tables on mesdb. No external systems.

**Q:** "create our conversation file so you can reference later when i ask question"

**A:** Created this file (`CONVERSATION_CONTEXT.md`) in the workspace root as project reference.

---

## Open Questions / Future Work Ideas

*(Populated as conversations continue)*

- [ ] Historical/trend view (multi-day)?
- [ ] Live artifact in Cowork sidebar?
- [ ] Multi-resource / multi-workstation rollup?
- [ ] Auth layer beyond CORS?
- [ ] WebSocket push instead of polling?

---

*Update this file at the end of significant conversations. Keep entries concise — details live in the code.*
