import React, { useState } from 'react'
import { api } from '../api/client'

const REASON_CODES = [
  'Equipment Failure',
  'Tooling Change',
  'Material Shortage',
  'Quality Hold',
  'Scheduled Break',
  'Shift Changeover',
  'Robot / Press Fault',
  'Network / IT',
  'Safety Stop',
  'Other',
]

const S = {
  wrap: { padding: 24, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 },
  formBox: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
    padding: 20, height: 'fit-content',
  },
  formTitle: { fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 18, letterSpacing: 1 },
  label: { fontSize: 10, color: '#8b949e', letterSpacing: 1, marginBottom: 4, display: 'block', textTransform: 'uppercase' },
  select: {
    width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    color: '#e6edf3', padding: '9px 12px', fontSize: 13, marginBottom: 14,
  },
  input: {
    width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    color: '#e6edf3', padding: '9px 12px', fontSize: 13, marginBottom: 14,
  },
  submitBtn: {
    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(90deg,#ff4444,#ff6b35)', color: '#fff',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: 1,
  },
  listBox: { },
  listTitle: { fontSize: 13, color: '#8b949e', marginBottom: 16, letterSpacing: 1 },
  summaryRow: {
    display: 'flex', gap: 12, marginBottom: 16,
  },
  summaryCard: (color) => ({
    flex: 1, background: '#161b22', border: `1px solid ${color}33`, borderRadius: 8,
    padding: '10px 14px', textAlign: 'center',
  }),
  summaryLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1 },
  summaryVal: (color) => ({ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }),
  event: {
    background: '#161b22', border: '1px solid #21262d',
    borderLeft: '3px solid #ff4444', borderRadius: 8,
    padding: '12px 16px', marginBottom: 10,
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
  },
  eventReason: { fontSize: 13, fontWeight: 700, color: '#ff6b35' },
  eventComment: { fontSize: 12, color: '#8b949e', marginTop: 3 },
  eventMeta: { fontSize: 10, color: '#6e7681', marginTop: 6, display: 'flex', gap: 10 },
  eventMins: { fontSize: 20, fontWeight: 800, color: '#ff4444', fontFamily: 'monospace', textAlign: 'right' },
  eventMinsLabel: { fontSize: 9, color: '#8b949e', textAlign: 'right' },
  empty: { padding: 32, textAlign: 'center', color: '#8b949e' },
}

export default function DowntimeTab({ data = {}, resource, onRefresh }) {
  const events = data.events || []
  const totalMins = data.total_mins || 0
  const [form, setForm] = useState({ reason_code: REASON_CODES[0], minutes: '', comment: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const mins = parseInt(form.minutes, 10)
    if (!mins || mins <= 0) { alert('Enter valid minutes'); return }
    setSaving(true)
    try {
      await api.logDowntime(resource, form.reason_code, mins, form.comment)
      setForm({ reason_code: REASON_CODES[0], minutes: '', comment: '' })
      onRefresh && onRefresh()
    } catch (err) {
      alert('Log failed: ' + err.message)
    } finally { setSaving(false) }
  }

  const totalHrs = (totalMins / 60).toFixed(1)
  const uptimePct = totalMins > 0 ? Math.max(0, ((480 - totalMins) / 480 * 100)).toFixed(1) : 100

  return (
    <div style={S.wrap}>
      {/* Form */}
      <div style={S.formBox}>
        <div style={S.formTitle}>LOG DOWNTIME EVENT</div>
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Reason Code</label>
          <select style={S.select} value={form.reason_code}
            onChange={e => setForm(f => ({ ...f, reason_code: e.target.value }))}>
            {REASON_CODES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <label style={S.label}>Duration (minutes)</label>
          <input style={S.input} type="number" min="1" max="480" placeholder="e.g. 15"
            value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} required />

          <label style={S.label}>Comment (optional)</label>
          <input style={S.input} placeholder="Additional details…"
            value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />

          <button type="submit" style={S.submitBtn} disabled={saving}>
            {saving ? 'Logging…' : '⚡ Log Downtime Event'}
          </button>
        </form>
      </div>

      {/* Events list */}
      <div style={S.listBox}>
        <div style={S.summaryRow}>
          <div style={S.summaryCard('#ff4444')}>
            <div style={S.summaryLabel}>TOTAL LOST TODAY</div>
            <div style={S.summaryVal('#ff4444')}>{totalMins}<span style={{fontSize:12,fontWeight:400}}> min</span></div>
          </div>
          <div style={S.summaryCard('#ffaa00')}>
            <div style={S.summaryLabel}>HOURS LOST</div>
            <div style={S.summaryVal('#ffaa00')}>{totalHrs}h</div>
          </div>
          <div style={S.summaryCard('#00ff88')}>
            <div style={S.summaryLabel}>UPTIME %</div>
            <div style={S.summaryVal('#00ff88')}>{uptimePct}%</div>
          </div>
          <div style={S.summaryCard('#8b949e')}>
            <div style={S.summaryLabel}>EVENTS</div>
            <div style={S.summaryVal('#8b949e')}>{events.length}</div>
          </div>
        </div>

        <div style={S.listTitle}>TODAY'S DOWNTIME LOG</div>
        {events.length === 0 ? (
          <div style={S.empty}>No downtime events recorded today</div>
        ) : (
          events.map(ev => (
            <div key={ev.id} style={S.event}>
              <div>
                <div style={S.eventReason}>{ev.reason_code}</div>
                {ev.comment && <div style={S.eventComment}>{ev.comment}</div>}
                <div style={S.eventMeta}>
                  <span>By: {ev.logged_by || 'Unknown'}</span>
                  {ev.start_ts && <span>{new Date(ev.start_ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
              <div>
                <div style={S.eventMins}>{ev.minutes}</div>
                <div style={S.eventMinsLabel}>MINS LOST</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
