import React, { useState } from 'react'
import { api } from '../api/client'
import { Bar } from './OEEAnalyticsTab'

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

const BACK_STYLE = {
  background: 'transparent', border: '1px solid #21262d', color: '#8b949e',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 16,
}
const CATEGORY_COLORS = { Tooling: '#a78bfa', Maintenance: '#ff4444', Production: '#ffaa00', Material: '#00d4ff', Quality: '#fb923c' }

function downtimeCategory(reason = '') {
  const value = reason.toLowerCase()
  if (/tool|mandrel|electrode|gun/.test(value)) return 'Tooling'
  if (/material|forklift|shortage/.test(value)) return 'Material'
  if (/quality|scrap|hold/.test(value)) return 'Quality'
  if (/equipment|robot|press|network|failure|fault|maintenance/.test(value)) return 'Maintenance'
  return 'Production'
}

function CategoryDetail({ category, events, totalMins, resource, date, onBack }) {
  const selectedEvents = events.filter(event => downtimeCategory(event.reason_code) === category)
  const reasons = Object.values(selectedEvents.reduce((result, event) => {
    const reason = event.reason_code || 'Unspecified'
    if (!result[reason]) result[reason] = { reason, minutes: 0, count: 0 }
    result[reason].minutes += Number(event.minutes) || 0
    result[reason].count += 1
    return result
  }, {})).sort((a, b) => b.minutes - a.minutes).slice(0, 5)
  const categoryMins = selectedEvents.reduce((sum, event) => sum + (Number(event.minutes) || 0), 0)
  const maxMinutes = Math.max(...reasons.map(reason => reason.minutes), 1)
  const key = `lsb_dt_action_${resource}*${category}*${date}`
  const [action, setAction] = useState(() => {
    try { return localStorage.getItem(key) || '' } catch { return '' }
  })
  const color = CATEGORY_COLORS[category] || '#8b949e'

  function saveAction(value) {
    setAction(value)
    try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
  }

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={BACK_STYLE}>← Back</button>
      <div style={{ fontSize: 24, color, fontWeight: 800, marginBottom: 18 }}>{category.toUpperCase()} DOWNTIME</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 220px))', gap: 12, marginBottom: 22 }}>
        <div style={S.summaryCard(color)}><div style={S.summaryLabel}>TOTAL MINUTES</div><div style={S.summaryVal(color)}>{categoryMins}</div></div>
        <div style={S.summaryCard('#8b949e')}><div style={S.summaryLabel}>EVENT COUNT</div><div style={S.summaryVal('#8b949e')}>{selectedEvents.length}</div></div>
      </div>
      <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 8, padding: 12, color: '#c9d1d9', fontSize: 13, marginBottom: 22 }}>
        This category accounts for <strong style={{ color }}>{totalMins ? (categoryMins / totalMins * 100).toFixed(1) : '0.0'}%</strong> of total downtime this shift.
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Top downtime reasons</div>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18, marginBottom: 24 }}>
        {reasons.length ? reasons.map(reason => (
          <div key={reason.reason} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 85px', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div><div style={{ color: '#e6edf3', fontSize: 12 }}>{reason.reason}</div><div style={{ color: '#6e7681', fontSize: 10 }}>{reason.count} event{reason.count === 1 ? '' : 's'}</div></div>
            <Bar pct={reason.minutes / maxMinutes * 100} color={color} height={9} />
            <div style={{ color, fontFamily: 'monospace', textAlign: 'right' }}>{reason.minutes} min</div>
          </div>
        )) : <div style={S.empty}>No reasons recorded in this category</div>}
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Log Action Taken</div>
      <textarea value={action} onChange={e => saveAction(e.target.value)} rows={5} placeholder="Record containment, repair, or follow-up action..." style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, color: '#e6edf3', padding: 12, resize: 'vertical', lineHeight: 1.5 }} />
    </div>
  )
}

export default function DowntimeTab({ data = {}, resource, selectedDate, onRefresh }) {
  const events = data.events || []
  const totalMins = data.total_mins || 0
  const [form, setForm] = useState({ reason_code: REASON_CODES[0], minutes: '', comment: '' })
  const [saving, setSaving] = useState(false)
  const [drillTarget, setDrillTarget] = useState(null)

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
  const dateValue = selectedDate || new Date()
  const date = data.date || `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
  const categories = Object.values(events.reduce((result, event) => {
    const category = downtimeCategory(event.reason_code)
    if (!result[category]) result[category] = { name: category, minutes: 0, count: 0 }
    result[category].minutes += Number(event.minutes) || 0
    result[category].count += 1
    return result
  }, {})).sort((a, b) => b.minutes - a.minutes)

  if (drillTarget) {
    return <CategoryDetail category={drillTarget} events={events} totalMins={totalMins} resource={resource} date={date} onBack={() => setDrillTarget(null)} />
  }

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

        {categories.length > 0 && <>
          <div style={S.listTitle}>DOWNTIME BY CATEGORY</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
            {categories.map(category => {
              const color = CATEGORY_COLORS[category.name] || '#8b949e'
              return <button key={category.name} onClick={() => setDrillTarget(category.name)} style={{ background: '#161b22', border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '11px 13px', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{category.name.toUpperCase()}</div>
                <div style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 18, fontWeight: 800, marginTop: 4 }}>{category.minutes} min</div>
                <div style={{ color: '#6e7681', fontSize: 10 }}>{category.count} event{category.count === 1 ? '' : 's'} · View details →</div>
              </button>
            })}
          </div>
        </>}

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
