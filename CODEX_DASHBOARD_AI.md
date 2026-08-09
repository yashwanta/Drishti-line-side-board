# CODEX TASK — AI Health Dashboard Tab
#
# Goal: add a new "🤖 AI Health" tab to the existing React dashboard
#       with four panels powered by the LLM endpoints built in Tasks 11-14.
#
# Stack: React 18, Vite, Recharts, inline styles, dark theme (#0a0e14)
# No new dependencies — use only what is already in package.json.
#
# PHASES:
#   Phase A — Add API methods + create AIHealthTab component
#   Phase B — Wire tab into App.jsx + fix footer text
#
# Give Codex ONE phase at a time.

---

## PHASE A — Add API methods and create the AIHealthTab component

Paste this to Codex:

```
Read CODEX_DASHBOARD_AI.md for full context on what we are building.

Before writing any code, read ALL of these files carefully:
  - frontend/src/App.jsx               (understand tab structure and inline style patterns)
  - frontend/src/api/client.js         (understand how API calls are made — copy the pattern exactly)
  - frontend/src/components/OEEAnalyticsTab.jsx   (read for dark-theme style reference)
  - frontend/src/components/IssuesTab.jsx         (read for panel/card style reference)

DO ONLY PHASE A. Do not modify App.jsx yet.

### PHASE A Task 1 — Add four API methods to frontend/src/api/client.js

Add these four methods to the existing api object, following the exact
same pattern (fetch, error handling, return shape) used by the other methods:

  llmLogAnalysis()
    GET /api/llm/log-analysis
    Returns: { overall_health, one_liner, issues: [{service, severity, summary, likely_cause, recommended_fix}] }
    On error: return { overall_health: 'unknown', one_liner: 'Unable to reach service', issues: [] }

  llmAnomalies(hours = 24)
    GET /api/llm/anomalies?hours=<hours>
    Returns: array of { station, oee_value, mean_value, std_dev, deviation, detected_at, llm_explanation }
    On error: return []

  llmDigest(date = '')
    GET /api/llm/digest?date=<date>   (omit ?date= if date is empty string)
    Returns: plain text string (Content-Type: text/plain from server)
    On error: return ''

  llmDigestList()
    GET /api/llm/digest/list
    Returns: array of date strings e.g. ["2026-08-09", "2026-08-08"]
    On error: return []

  llmRemediate(issue)
    POST /api/llm/remediate
    Body: { issue: issue }
    Returns: { summary, safe_actions: [{action, windows_command, linux_command, risk_level}], do_not_do, escalate_if }
    On error: return { summary: 'Request failed', safe_actions: [], do_not_do: [], escalate_if: '' }

### PHASE A Task 2 — Create frontend/src/components/AIHealthTab.jsx

This is a single self-contained React component with four collapsible/stacked panels.
Match the dark theme from App.jsx exactly:
  background:       #0a0e14
  card background:  #0d1117
  card border:      #21262d
  primary text:     #e6edf3
  muted text:       #8b949e
  accent/cyan:      #00d4ff
  green:            #00ff88
  yellow:           #ffaa00
  red:              #ff4444
  font-size base:   13px
  border-radius:    8px on cards

Use only React hooks (useState, useEffect, useCallback) and fetch via api.llm* methods.
No new npm packages. No CSS files — inline styles only, same as all other components.

#### PANEL 1 — System Health  (top of the tab)

State: call api.llmLogAnalysis() on mount and every 60 minutes.
Show a loading spinner (simple animated dot or "Analysing logs...") while fetching.

Display:
- A header bar showing overall_health as a coloured pill badge:
    ok       → green  (#00ff88 background at 15% opacity, green text)
    degraded → yellow (#ffaa00 background at 15% opacity, yellow text)
    critical → red    (#ff4444 background at 15% opacity, red text)
    unknown  → grey   (#8b949e)
- The one_liner text beside the badge in muted colour
- A "Refresh" button (small, top-right of the panel) that re-calls the API
- If issues array is non-empty, a list of issue cards below.
  Each issue card shows:
    Left border colour by severity: info=#00d4ff, warning=#ffaa00, critical=#ff4444
    Service name (small badge, uppercase)
    Summary (bold)
    Likely cause (muted, smaller)
    Recommended fix (green text, smaller, italic)
- If issues is empty and overall_health is "ok": show "✓ No issues detected"

#### PANEL 2 — OEE Anomalies

State: call api.llmAnomalies(selectedHours) on mount and when selectedHours changes.
selectedHours controlled by a toggle: 8h | 24h | 48h (default 24h)

Display:
- Toggle buttons for 8h / 24h / 48h at the top of the panel
- If loading: "Scanning OEE data..."
- If empty: "✓ No anomalies detected in the last {selectedHours} hours"
- If results: a table with columns:
    Station | OEE % | Mean % | Deviation | Detected | LLM Explanation
  - OEE % coloured red if deviation > 2.5, yellow if > 2.0, white otherwise
  - Deviation shown as e.g. "−2.3σ" with colour matching OEE %
  - LLM Explanation shown in a lighter muted colour, max 3 lines with overflow ellipsis
  - Clicking a row expands to show the full explanation
  - detected_at formatted as local time only (e.g. "14:32")

#### PANEL 3 — Daily Digest

State: call api.llmDigestList() on mount to populate date dropdown.
      Call api.llmDigest(selectedDate) when selectedDate changes.
      Default selectedDate = first item in the list (most recent).

Display:
- A date picker: a <select> dropdown showing available dates from llmDigestList
- If list is empty: "No digests available yet. The first digest runs at 06:00."
- If digest is "": "Digest not yet generated for this date."
- If digest has content: render it in a <pre> block styled like a terminal:
    background: #010409
    color: #e6edf3
    font-family: Consolas, monospace
    font-size: 12px
    padding: 16px
    border-radius: 6px
    white-space: pre-wrap
    max-height: 500px
    overflow-y: auto

#### PANEL 4 — IT Remediation  (bottom of the tab)

State: local — a text input for the issue, a loading flag, and the last response.

Display:
- A label: "🔧 IT Remediation Assistant"
- A sub-label in muted text: "Describe a problem and get suggested fix actions. For IT staff only."
- A <textarea> (3 rows, full width, dark styled) with placeholder:
    "e.g. LSB-Go service stopped and won't restart after reboot..."
- A "Get Fix Suggestions" button — disabled while loading or textarea is empty
- While loading: show "Asking LLM..." with a pulse animation
- On response:
    Show summary in a yellow callout box
    For each safe_action: a card showing:
      Action (bold)
      Windows command in a dark code block (copy button beside it)
      Linux command in a dark code block (copy button beside it)
      Risk level badge: low=green, medium=yellow, high=red
    If do_not_do is non-empty: a red-bordered box "⚠ Do NOT:" with each item
    If escalate_if is set: an orange callout "📞 Escalate if: {escalate_if}"
- A "Clear" button to reset the form

#### Component structure:

export default function AIHealthTab()

The four panels are stacked vertically with 16px gap.
Each panel is a card:
  { background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 20, marginBottom: 16 }

Each panel has a section header:
  { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
    color: '#8b949e', marginBottom: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between' }

Wrap everything in a container:
  { padding: 24, maxWidth: 1200, margin: '0 auto' }

After completing Phase A:
  Paste: the list of files created or modified
  Do NOT run npm build yet — that happens in Phase B after App.jsx is wired.
```

---

## PHASE B — Wire the tab into App.jsx and fix the footer

Paste this to Codex AFTER Phase A is complete:

```
Read CODEX_DASHBOARD_AI.md for full context.
Read frontend/src/App.jsx before making any changes.
Read frontend/src/components/AIHealthTab.jsx to confirm it was created in Phase A.

Phase A is complete — AIHealthTab.jsx exists and api methods are added.
Now wire everything into App.jsx.

### PHASE B tasks:

1. Import AIHealthTab at the top of App.jsx:
   import AIHealthTab from './components/AIHealthTab'

2. Add the new tab to the TABS array in App.jsx.
   Insert it BEFORE the 'tv' entry (TV Mode should stay last):
   { id: 'aihealth', label: '🤖 AI Health' }

3. Add the tab content render in the <main> section.
   Add it alongside the other activeTab conditionals:
   {activeTab === 'aihealth' && <AIHealthTab />}

4. Update the footer text at the bottom of App.jsx.
   Change:
     LINE SIDE BOARD v2.0  ·  {resource}  ·  SHIFT {SHIFT}  ·  Go + React + Java
   To:
     LINE SIDE BOARD v2.0  ·  {resource}  ·  SHIFT {SHIFT}  ·  Go + React

5. Build the frontend to confirm no errors:
   cd frontend
   npm run build

   If the build fails, fix all errors before reporting done.
   The most common issue is an unused import — remove it.

After all changes:
  Paste: the npm run build output (last 20 lines)
  Paste: the updated TABS array from App.jsx showing the new tab in position
  Confirm: footer no longer says "Java"
  Confirm: AIHealthTab is imported and rendered in App.jsx
```

---

## WHAT TO SAY TO CODEX

Phase A:
  "Read CODEX_DASHBOARD_AI.md and complete Phase A only. Do not modify App.jsx yet.
   Before writing anything, read frontend/src/App.jsx, frontend/src/api/client.js,
   frontend/src/components/OEEAnalyticsTab.jsx, and frontend/src/components/IssuesTab.jsx."

Phase B (after Phase A):
  "Read CODEX_DASHBOARD_AI.md and complete Phase B only.
   Before making any changes, read frontend/src/App.jsx and confirm
   frontend/src/components/AIHealthTab.jsx exists from Phase A."

---

## AFTER BOTH PHASES — HOW TO TEST

1. Build and serve the frontend:
   cd C:\DRISHTI\Drishti-LineSideBoard\frontend
   npm run build

2. The Go service serves the built frontend automatically from the frontend/dist folder.
   Restart LSB-Go to pick up the new build:
   net stop LSB-Go
   net start LSB-Go

3. Open http://localhost:3001 in a browser.
   You should see a new "🤖 AI Health" tab between Weekly and TV Mode.

4. Click the tab and confirm all four panels load:
   - System Health shows a health badge (may show "unknown" if LLM unreachable in mock mode)
   - OEE Anomalies shows the toggle buttons and an empty state message
   - Daily Digest shows "No digests available yet" (correct — none generated yet)
   - IT Remediation shows the textarea and button

5. Test remediation: type "test issue" and click Get Fix Suggestions.
   It should call the LLM and show a response within 30 seconds.
