import React, { useState } from 'react'
import { api } from '../api/client'

const SEVERITY_STYLES = {
  critical: { border: '#ff4444', bg: 'rgba(255,68,68,0.07)', badge: '#ff4444', label: '🔴 CRITICAL' },
  major:    { border: '#ffaa00', bg: 'rgba(255,170,0,0.07)', badge: '#ffaa00', label: '🟡 MAJOR' },
  minor:    { border: '#00d4ff', bg: 'rgba(0,212,255,0.07)', badge: '#00d4ff', label: '🔵 MINOR' },
}

const STATUS_COLOR = {
  open: '#ff4444', in_progress: '#ffaa00', resolved: '#00ff88',
}

const BACK_STYLE = {
  background: 'transparent', border: '1px solid #21262d', color: '#8b949e',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 16,
}
const SECTION_HEADER = { fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase' }

const S = {
  wrap: { padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 14, color: '#8b949e', letterSpacing: 1 },
  raiseBtn: {
    padding: '7px 18px', borderRadius: 8, border: '1px solid #00d4ff44',
    background: '#00d4ff11', color: '#00d4ff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  card: (sev) => ({
    background: SEVERITY_STYLES[sev]?.bg || '#161b22',
    border: `1px solid ${SEVERITY_STYLES[sev]?.border || '#30363d'}55`,
    borderLeft: `4px solid ${SEVERITY_STYLES[sev]?.border || '#30363d'}`,
    borderRadius: 10,
    padding: 18,
  }),
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sevBadge: (sev) => ({
    fontSize: 10, fontWeight: 700, color: SEVERITY_STYLES[sev]?.badge || '#8b949e',
    letterSpacing: 1,
  }),
  statusBadge: (st) => ({
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
    background: `${STATUS_COLOR[st] || '#8b949e'}15`,
    color: STATUS_COLOR[st] || '#8b949e',
    border: `1px solid ${STATUS_COLOR[st] || '#8b949e'}44`,
  }),
  issueType: { fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 6 },
  desc: { fontSize: 12, color: '#8b949e', lineHeight: 1.5, marginBottom: 10 },
  meta: { fontSize: 10, color: '#6e7681', display: 'flex', gap: 12, flexWrap: 'wrap' },
  empty: { padding: 48, textAlign: 'center', color: '#00ff88', fontSize: 16 },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
    padding: 28, width: 420, maxWidth: '90vw',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#00d4ff', marginBottom: 20 },
  label: { fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 4, display: 'block' },
  input: {
    width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    color: '#e6edf3', padding: '8px 12px', fontSize: 13, marginBottom: 14,
  },
  select: {
    width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    color: '#e6edf3', padding: '8px 12px', fontSize: 13, marginBottom: 14,
  },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: { padding: '7px 18px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' },
  submitBtn: { padding: '7px 18px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#0d1117', fontWeight: 700, cursor: 'pointer' },
}

function RaiseModal({ resource, onClose, onDone }) {
  const [form, setForm] = useState({ issue_type: '', severity: 'minor', description: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    try {
      await api.raiseIssue(resource, form.issue_type, form.severity, form.description)
      onDone()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Raise New Issue</div>
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Issue Type</label>
          <input style={S.input} placeholder="e.g. Equipment, Quality, Safety…"
            value={form.issue_type} onChange={e => setForm(f => ({ ...f, issue_type: e.target.value }))} />
          <label style={S.label}>Severity</label>
          <select style={S.select} value={form.severity}
            onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
          <label style={S.label}>Description *</label>
          <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} required
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe the issue…" />
          <div style={S.btnRow}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={S.submitBtn} disabled={saving}>{saving ? 'Saving…' : 'Raise Issue'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatTime(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}

function IssueDetail({ issue, resource, shift, onBack, onStatusChange }) {
  const initialStatus = (() => {
    try { return localStorage.getItem(`lsb_issue_status_${issue.id}`) || issue.status || 'open' } catch { return issue.status || 'open' }
  })()
  const [status, setStatus] = useState(initialStatus.toLowerCase())
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`lsb_issue_notes_${issue.id}`) || '' } catch { return '' }
  })
  const severity = (issue.severity || 'minor').toLowerCase()
  const steps = [
    { label: 'Raised', time: issue.raised_at, active: true },
    { label: 'In Progress', time: status !== 'open' ? issue.in_progress_at || issue.updated_at : null, active: status !== 'open' },
    { label: 'Closed', time: status === 'resolved' ? issue.closed_at || issue.updated_at : null, active: status === 'resolved' },
  ]

  function saveNotes(value) {
    setNotes(value)
    try { localStorage.setItem(`lsb_issue_notes_${issue.id}`, value) } catch { /* storage unavailable */ }
  }

  function advanceStatus() {
    const next = status === 'open' ? 'in_progress' : status === 'in_progress' ? 'resolved' : status
    setStatus(next)
    try { localStorage.setItem(`lsb_issue_status_${issue.id}`, next) } catch { /* storage unavailable */ }
    onStatusChange(issue.id, next)
  }

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={BACK_STYLE}>← Back</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#e6edf3' }}>{issue.issue_type || 'General Issue'}</div>
        <span style={{ ...S.sevBadge(severity), fontSize: 12, padding: '6px 12px', background: `${SEVERITY_STYLES[severity]?.badge || '#8b949e'}15`, borderRadius: 12 }}>
          {SEVERITY_STYLES[severity]?.label || severity.toUpperCase()}
        </span>
      </div>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18, color: '#c9d1d9', fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
        {issue.description || 'No description provided.'}
      </div>
      <div style={{ ...SECTION_HEADER, marginBottom: 12 }}>Timeline</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24, background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '18px 20px' }}>
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            <div style={{ flex: '0 0 120px', textAlign: 'center' }}>
              <div style={{ width: 18, height: 18, margin: '0 auto 7px', borderRadius: '50%', background: step.active ? STATUS_COLOR[status] : '#21262d', border: `2px solid ${step.active ? STATUS_COLOR[status] : '#30363d'}` }} />
              <div style={{ color: step.active ? '#e6edf3' : '#6e7681', fontSize: 11, fontWeight: 700 }}>{step.label}</div>
              <div style={{ color: '#6e7681', fontSize: 10, marginTop: 3 }}>{formatTime(step.time)}</div>
            </div>
            {index < steps.length - 1 && <div style={{ flex: 1, height: 2, background: steps[index + 1].active ? STATUS_COLOR[status] : '#21262d', marginTop: 8 }} />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          ['Resource', issue.resource_id || resource || 'Unknown'],
          ['Shift', issue.shift || shift || 'Unknown'],
          ['Status', status.replace('_', ' ').toUpperCase()],
        ].map(([label, value]) => <div key={label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 14 }}>
          <div style={SECTION_HEADER}>{label}</div><div style={{ color: label === 'Status' ? STATUS_COLOR[status] : '#e6edf3', fontFamily: 'monospace', marginTop: 6, fontWeight: 700 }}>{value}</div>
        </div>)}
      </div>
      <div style={{ ...SECTION_HEADER, marginBottom: 8 }}>Resolution Notes</div>
      <textarea value={notes} onChange={e => saveNotes(e.target.value)} rows={5} placeholder="Add investigation details, containment, and resolution notes..." style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, color: '#e6edf3', padding: 12, resize: 'vertical', lineHeight: 1.5, marginBottom: 14 }} />
      {status !== 'resolved' && <button onClick={advanceStatus} style={{ background: '#00d4ff15', border: '1px solid #00d4ff55', color: '#00d4ff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>
        {status === 'open' ? '→ Mark In Progress' : '→ Mark Resolved'}
      </button>}
    </div>
  )
}

export default function IssuesTab({ issues = [], resource, shift, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [drillTarget, setDrillTarget] = useState(null)
  const [statusOverrides, setStatusOverrides] = useState({})

  if (drillTarget) {
    return <IssueDetail
      issue={drillTarget}
      resource={resource}
      shift={shift}
      onBack={() => setDrillTarget(null)}
      onStatusChange={(id, status) => setStatusOverrides(current => ({ ...current, [id]: status }))}
    />
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.title}>OPEN ISSUES — {resource}  ({issues.length} active)</div>
        <button style={S.raiseBtn} onClick={() => setShowModal(true)}>+ Raise Issue</button>
      </div>

      {issues.length === 0 ? (
        <div style={S.empty}>✓ No open issues — all clear!</div>
      ) : (
        <div style={S.grid}>
          {issues.map(iss => {
            const sev = iss.severity || 'minor'
            const visualStatus = statusOverrides[iss.id] || (() => {
              try { return localStorage.getItem(`lsb_issue_status_${iss.id}`) || iss.status } catch { return iss.status }
            })()
            return (
              <div key={iss.id} onClick={() => setDrillTarget({ ...iss, status: visualStatus })} title="View issue details" style={{ ...S.card(sev), cursor: 'pointer' }}>
                <div style={S.topRow}>
                  <div style={S.sevBadge(sev)}>{SEVERITY_STYLES[sev]?.label || sev.toUpperCase()}</div>
                  <div style={S.statusBadge(visualStatus)}>{visualStatus?.replace('_', ' ').toUpperCase()}</div>
                </div>
                <div style={S.issueType}>{iss.issue_type || 'General Issue'}</div>
                <div style={S.desc}>{iss.description}</div>
                <div style={S.meta}>
                  <span>Raised by: {iss.raised_by || 'Unknown'}</span>
                  {iss.acknowledged_by && <span>Ack: {iss.acknowledged_by}</span>}
                  {iss.raised_at && <span>{new Date(iss.raised_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <RaiseModal
          resource={resource}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); onRefresh && onRefresh() }}
        />
      )}
    </div>
  )
}
