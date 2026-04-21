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

export default function IssuesTab({ issues = [], resource, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

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
            return (
              <div key={iss.id} style={S.card(sev)}>
                <div style={S.topRow}>
                  <div style={S.sevBadge(sev)}>{SEVERITY_STYLES[sev]?.label || sev.toUpperCase()}</div>
                  <div style={S.statusBadge(iss.status)}>{iss.status?.replace('_', ' ').toUpperCase()}</div>
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
