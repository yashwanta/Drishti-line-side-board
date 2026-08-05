/**
 * API client — all calls go to the Go gateway at /api/*
 * In dev: Vite proxies /api → http://localhost:3001
 * In prod: same origin (Go serves the built React app)
 */

const BASE = '/api'

export function dateStr(d = new Date()) {
  const date = d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  health:       () => get('/health'),

  setupDemo:   () => post('/setup/demo', {}),

  testConnection: (settings) => post('/setup/test-connection', settings),

  importExcel: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/setup/import-excel`, { method: 'POST', body: form })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error || payload.errors?.join(', ') || `Import failed → ${res.status}`)
    return payload
  },

  oeeEntries:  () => get('/oee/entries'),

  saveOeeEntry: (entry) => post('/oee/entries', entry),

  notes:        (resource, shift, date) =>
                  get(`/notes?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  postNote:     (note) => post('/notes', note),

  kpis:         (resource = 'WM15', shift = 2, date = new Date()) =>
                  get(`/kpis?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  production:   (resource = 'WM15', shift = 2, date = new Date()) =>
                  get(`/production?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  productivity: (resource = 'WM15', shift = 2, date = new Date()) =>
                  get(`/productivity?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  issues:       (resource = 'WM15', date = new Date()) =>
                  get(`/issues?resource=${resource}&date=${dateStr(date)}`),

  downtime:     (resource = 'WM15', date = new Date()) =>
                  get(`/downtime?resource=${resource}&date=${dateStr(date)}`),

  confirm:      (resource, shift, hour) =>
                  post('/confirm', { resource, shift, hour }),

  logDowntime:  (resource, reason_code, minutes, comment) =>
                  post('/downtime', { resource, reason_code, minutes, comment }),

  raiseIssue:   (resource, issue_type, severity, description) =>
                  post('/issues', { resource, issue_type, severity, description }),

  // ── Java proxy endpoints ──────────────────────────────────────────────────
  marsKpis:       (resource = 'WM15', shift = 2, date = new Date()) =>
                    get(`/mars/kpis?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  marsProduction: (resource = 'WM15', shift = 2, date = new Date()) =>
                    get(`/mars/production?resource=${resource}&shift=${shift}&date=${dateStr(date)}`),

  marsQuality:    (resource = 'WM15', date = new Date()) =>
                    get(`/mars/quality?resource=${resource}&date=${dateStr(date)}`),

  marsSchedule:   (resource = 'WM15', date = new Date()) =>
                    get(`/mars/schedule?resource=${resource}&date=${dateStr(date)}`),

  stations:       (date = new Date()) => get(`/stations?date=${dateStr(date)}`),

  productionStatus:  (date = new Date()) => get(`/production/status?date=${dateStr(date)}`),
  shippingStatus:    (date = new Date()) => get(`/shipping/status?date=${dateStr(date)}`),
  weekly:            (resource = 'WM15', date = new Date()) => get(`/weekly?resource=${resource}&date=${dateStr(date)}`),

  robotPress:     (date = new Date()) => get(`/robotpress?date=${dateStr(date)}`),

  robotPressHistory: (limit = 50) => get(`/robotpress/history?limit=${limit}`),
}
