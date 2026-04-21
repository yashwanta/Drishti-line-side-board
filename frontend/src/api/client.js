/**
 * API client — all calls go to the Go gateway at /api/*
 * In dev: Vite proxies /api → http://localhost:3001
 * In prod: same origin (Go serves the built React app)
 */

const BASE = '/api'

async function get(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

// ── PostgreSQL-backed endpoints ───────────────────────────────────────────────
export const api = {
  kpis:         (resource = 'WM15', shift = 2) =>
                  get(`/kpis?resource=${resource}&shift=${shift}`),

  production:   (resource = 'WM15', shift = 2) =>
                  get(`/production?resource=${resource}&shift=${shift}`),

  productivity: (resource = 'WM15', shift = 2) =>
                  get(`/productivity?resource=${resource}&shift=${shift}`),

  issues:       (resource = 'WM15') =>
                  get(`/issues?resource=${resource}`),

  downtime:     (resource = 'WM15') =>
                  get(`/downtime?resource=${resource}`),

  confirm:      (resource, shift, hour) =>
                  post('/confirm', { resource, shift, hour }),

  logDowntime:  (resource, reason_code, minutes, comment) =>
                  post('/downtime', { resource, reason_code, minutes, comment }),

  raiseIssue:   (resource, issue_type, severity, description) =>
                  post('/issues', { resource, issue_type, severity, description }),

  // ── Java proxy endpoints ──────────────────────────────────────────────────
  marsKpis:       (resource = 'WM15', shift = 2) =>
                    get(`/mars/kpis?resource=${resource}&shift=${shift}`),

  marsProduction: (resource = 'WM15', shift = 2) =>
                    get(`/mars/production?resource=${resource}&shift=${shift}`),

  marsQuality:    (resource = 'WM15') =>
                    get(`/mars/quality?resource=${resource}`),

  marsSchedule:   (resource = 'WM15') =>
                    get(`/mars/schedule?resource=${resource}`),

  robotPress:     () => get('/robotpress'),

  robotPressHistory: (limit = 50) => get(`/robotpress/history?limit=${limit}`),
}
