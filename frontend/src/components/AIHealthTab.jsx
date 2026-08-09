import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

const COLORS = {
  background: '#0a0e14',
  card: '#0d1117',
  border: '#21262d',
  text: '#e6edf3',
  muted: '#8b949e',
  cyan: '#00d4ff',
  green: '#00ff88',
  yellow: '#ffaa00',
  red: '#ff4444',
}

const S = {
  container: { padding: 24, maxWidth: 1200, margin: '0 auto', background: COLORS.background, color: COLORS.text, fontSize: 13 },
  panel: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 20, marginBottom: 16 },
  header: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
    color: COLORS.muted, marginBottom: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  smallButton: {
    background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 6,
    color: COLORS.muted, cursor: 'pointer', fontSize: 11, padding: '5px 10px',
  },
  primaryButton: {
    background: '#00d4ff18', border: '1px solid #00d4ff66', borderRadius: 6,
    color: COLORS.cyan, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '8px 14px',
  },
  empty: { color: COLORS.green, padding: '12px 0' },
  muted: { color: COLORS.muted },
  code: {
    background: '#010409', border: `1px solid ${COLORS.border}`, borderRadius: 6,
    color: COLORS.text, fontFamily: 'Consolas, monospace', fontSize: 12,
    padding: '9px 12px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1,
  },
}

const healthColors = { ok: COLORS.green, degraded: COLORS.yellow, critical: COLORS.red, unknown: COLORS.muted }
const severityColors = { info: COLORS.cyan, warning: COLORS.yellow, critical: COLORS.red }
const riskColors = { low: COLORS.green, medium: COLORS.yellow, high: COLORS.red }

function Badge({ value, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 12,
      background: `${color}15`, border: `1px solid ${color}44`, color,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
    }}>
      {value}
    </span>
  )
}

function Panel({ title, actions, collapsed, onToggle, children }) {
  return (
    <section style={S.panel}>
      <div style={{ ...S.header, marginBottom: collapsed ? 0 : 14 }}>
        <span>{title}</span>
        <div style={S.headerActions}>
          {actions}
          <button type="button" onClick={onToggle} style={{ ...S.smallButton, padding: '3px 8px' }} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}>
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>
      {!collapsed && children}
    </section>
  )
}

function formatMetric(value, digits = 1) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : '—'
}

function formatDetectedTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AIHealthTab() {
  const [collapsed, setCollapsed] = useState({ system: false, anomalies: false, digest: false, remediation: false })

  const [health, setHealth] = useState({ overall_health: 'unknown', one_liner: '', issues: [] })
  const [healthLoading, setHealthLoading] = useState(true)

  const [selectedHours, setSelectedHours] = useState(24)
  const [anomalies, setAnomalies] = useState([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(true)
  const [expandedAnomaly, setExpandedAnomaly] = useState(null)

  const [digestDates, setDigestDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [digest, setDigest] = useState('')
  const [digestListLoading, setDigestListLoading] = useState(true)
  const [digestLoading, setDigestLoading] = useState(false)

  const [issue, setIssue] = useState('')
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [remediation, setRemediation] = useState(null)

  const togglePanel = useCallback((name) => {
    setCollapsed(current => ({ ...current, [name]: !current[name] }))
  }, [])

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const result = await api.llmLogAnalysis()
      setHealth({
        overall_health: result?.overall_health || 'unknown',
        one_liner: result?.one_liner || '',
        issues: Array.isArray(result?.issues) ? result.issues : [],
      })
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
    const timer = window.setInterval(loadHealth, 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [loadHealth])

  useEffect(() => {
    let active = true
    setAnomaliesLoading(true)
    setExpandedAnomaly(null)
    api.llmAnomalies(selectedHours).then(result => {
      if (active) setAnomalies(Array.isArray(result) ? result : [])
    }).finally(() => {
      if (active) setAnomaliesLoading(false)
    })
    return () => { active = false }
  }, [selectedHours])

  useEffect(() => {
    let active = true
    setDigestListLoading(true)
    api.llmDigestList().then(result => {
      if (!active) return
      const dates = Array.isArray(result) ? result : []
      setDigestDates(dates)
      setSelectedDate(dates[0] || '')
    }).finally(() => {
      if (active) setDigestListLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedDate) {
      setDigest('')
      setDigestLoading(false)
      return undefined
    }

    let active = true
    setDigestLoading(true)
    api.llmDigest(selectedDate).then(result => {
      if (active) setDigest(typeof result === 'string' ? result : '')
    }).finally(() => {
      if (active) setDigestLoading(false)
    })
    return () => { active = false }
  }, [selectedDate])

  const requestRemediation = useCallback(async () => {
    const trimmedIssue = issue.trim()
    if (!trimmedIssue) return
    setRemediationLoading(true)
    try {
      setRemediation(await api.llmRemediate(trimmedIssue))
    } finally {
      setRemediationLoading(false)
    }
  }, [issue])

  const clearRemediation = useCallback(() => {
    setIssue('')
    setRemediation(null)
  }, [])

  const copyCommand = useCallback((command) => {
    if (!command || !navigator.clipboard) return
    navigator.clipboard.writeText(command).catch(() => {})
  }, [])

  const healthState = String(health.overall_health || 'unknown').toLowerCase()
  const healthColor = healthColors[healthState] || COLORS.muted

  return (
    <div style={S.container}>
      <style>{`@keyframes ai-health-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }`}</style>

      <Panel
        title="System Health"
        collapsed={collapsed.system}
        onToggle={() => togglePanel('system')}
        actions={<button type="button" onClick={loadHealth} disabled={healthLoading} style={{ ...S.smallButton, color: COLORS.cyan }}>Refresh</button>}
      >
        {healthLoading ? (
          <div style={{ color: COLORS.cyan, animation: 'ai-health-pulse 1.2s ease-in-out infinite' }}>● Analysing logs...</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: health.issues.length ? 14 : 0 }}>
              <Badge value={healthState} color={healthColor} />
              <span style={S.muted}>{health.one_liner}</span>
            </div>
            {health.issues.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {health.issues.map((item, index) => {
                  const severity = String(item.severity || 'info').toLowerCase()
                  const color = severityColors[severity] || COLORS.muted
                  return (
                    <div key={`${item.service || 'service'}-${index}`} style={{ background: '#161b22', border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${color}`, borderRadius: 6, padding: '12px 14px' }}>
                      <Badge value={item.service || 'unknown service'} color={color} />
                      <div style={{ color: COLORS.text, fontWeight: 700, marginTop: 8 }}>{item.summary || 'No summary provided'}</div>
                      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{item.likely_cause || 'Cause not identified'}</div>
                      <div style={{ color: COLORS.green, fontSize: 12, fontStyle: 'italic', marginTop: 5 }}>{item.recommended_fix || 'No recommended fix provided'}</div>
                    </div>
                  )
                })}
              </div>
            ) : healthState === 'ok' ? (
              <div style={S.empty}>✓ No issues detected</div>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="OEE Anomalies"
        collapsed={collapsed.anomalies}
        onToggle={() => togglePanel('anomalies')}
        actions={(
          <div style={{ display: 'flex', gap: 4 }}>
            {[8, 24, 48].map(hours => (
              <button key={hours} type="button" onClick={() => setSelectedHours(hours)} style={{
                ...S.smallButton,
                color: selectedHours === hours ? COLORS.cyan : COLORS.muted,
                borderColor: selectedHours === hours ? '#00d4ff66' : COLORS.border,
                background: selectedHours === hours ? '#00d4ff15' : 'transparent',
              }}>{hours}h</button>
            ))}
          </div>
        )}
      >
        {anomaliesLoading ? (
          <div style={{ color: COLORS.cyan, animation: 'ai-health-pulse 1.2s ease-in-out infinite' }}>Scanning OEE data...</div>
        ) : anomalies.length === 0 ? (
          <div style={S.empty}>✓ No anomalies detected in the last {selectedHours} hours</div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
              <thead>
                <tr>
                  {['Station', 'OEE %', 'Mean %', 'Deviation', 'Detected', 'LLM Explanation'].map(label => (
                    <th key={label} style={{ background: '#161b22', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 10, letterSpacing: 1, padding: '9px 10px', textAlign: 'left', textTransform: 'uppercase' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalies.map((row, index) => {
                  const deviation = Number(row.deviation)
                  const magnitude = Number.isFinite(deviation) ? Math.abs(deviation) : 0
                  const color = magnitude > 2.5 ? COLORS.red : magnitude > 2 ? COLORS.yellow : COLORS.text
                  const expanded = expandedAnomaly === index
                  const explanation = row.llm_explanation || 'No explanation available'
                  return (
                    <tr key={`${row.station || 'station'}-${row.detected_at || index}`} onClick={() => setExpandedAnomaly(expanded ? null : index)} style={{ background: index % 2 ? '#161b2266' : COLORS.card, cursor: 'pointer' }}>
                      <td style={tableCellStyle}>{row.station || '—'}</td>
                      <td style={{ ...tableCellStyle, color, fontWeight: 800 }}>{formatMetric(row.oee_value)}%</td>
                      <td style={tableCellStyle}>{formatMetric(row.mean_value)}%</td>
                      <td style={{ ...tableCellStyle, color, fontFamily: 'Consolas, monospace' }}>{Number.isFinite(deviation) ? `${deviation < 0 ? '−' : '+'}${Math.abs(deviation).toFixed(1)}σ` : '—'}</td>
                      <td style={tableCellStyle}>{formatDetectedTime(row.detected_at)}</td>
                      <td style={{ ...tableCellStyle, color: '#c9d1d9', lineHeight: 1.55, maxWidth: 420 }}>
                        <div style={expanded ? { whiteSpace: 'normal' } : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{explanation}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Daily Digest"
        collapsed={collapsed.digest}
        onToggle={() => togglePanel('digest')}
        actions={digestDates.length > 0 ? (
          <select value={selectedDate} onChange={event => setSelectedDate(event.target.value)} style={{ background: '#161b22', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, fontSize: 12, padding: '5px 9px' }}>
            {digestDates.map(date => <option key={date} value={date}>{date}</option>)}
          </select>
        ) : null}
      >
        {digestListLoading ? (
          <div style={S.muted}>Loading digest dates...</div>
        ) : digestDates.length === 0 ? (
          <div style={S.muted}>No digests available yet. The first digest runs at 06:00.</div>
        ) : digestLoading ? (
          <div style={{ color: COLORS.cyan, animation: 'ai-health-pulse 1.2s ease-in-out infinite' }}>Loading digest...</div>
        ) : digest === '' ? (
          <div style={S.muted}>Digest not yet generated for this date.</div>
        ) : (
          <pre style={{ background: '#010409', color: COLORS.text, fontFamily: 'Consolas, monospace', fontSize: 12, padding: 16, borderRadius: 6, whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto', margin: 0 }}>{digest}</pre>
        )}
      </Panel>

      <Panel title="🔧 IT Remediation Assistant" collapsed={collapsed.remediation} onToggle={() => togglePanel('remediation')}>
        <div style={{ ...S.muted, fontSize: 12, marginBottom: 12 }}>Describe a problem and get suggested fix actions. For IT staff only.</div>
        <textarea
          rows={3}
          value={issue}
          onChange={event => setIssue(event.target.value)}
          placeholder="e.g. LSB-Go service stopped and won't restart after reboot..."
          style={{ width: '100%', boxSizing: 'border-box', background: '#010409', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, fontSize: 13, lineHeight: 1.5, padding: 12, resize: 'vertical', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: remediation ? 14 : 0 }}>
          <button type="button" onClick={requestRemediation} disabled={remediationLoading || !issue.trim()} style={{ ...S.primaryButton, opacity: remediationLoading || !issue.trim() ? 0.45 : 1, cursor: remediationLoading || !issue.trim() ? 'not-allowed' : 'pointer' }}>
            Get Fix Suggestions
          </button>
          <button type="button" onClick={clearRemediation} style={S.smallButton}>Clear</button>
          {remediationLoading && <span style={{ color: COLORS.cyan, animation: 'ai-health-pulse 1.2s ease-in-out infinite' }}>Asking LLM...</span>}
        </div>

        {remediation && !remediationLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#ffaa0015', border: '1px solid #ffaa0055', borderRadius: 6, color: COLORS.yellow, padding: '11px 13px' }}>{remediation.summary || 'No summary provided'}</div>

            {(Array.isArray(remediation.safe_actions) ? remediation.safe_actions : []).map((action, index) => {
              const risk = String(action.risk_level || 'medium').toLowerCase()
              const riskColor = riskColors[risk] || COLORS.muted
              return (
                <div key={`${action.action || 'action'}-${index}`} style={{ background: '#161b22', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <strong style={{ color: COLORS.text }}>{action.action || 'Suggested action'}</strong>
                    <Badge value={risk} color={riskColor} />
                  </div>
                  <CommandRow label="Windows" command={action.windows_command} onCopy={copyCommand} />
                  <CommandRow label="Linux" command={action.linux_command} onCopy={copyCommand} />
                </div>
              )
            })}

            {Array.isArray(remediation.do_not_do) && remediation.do_not_do.length > 0 && (
              <div style={{ background: '#ff44440d', border: '1px solid #ff444466', borderRadius: 6, color: COLORS.red, padding: '12px 14px' }}>
                <strong>⚠ Do NOT:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {remediation.do_not_do.map((item, index) => <li key={index} style={{ marginBottom: 4 }}>{item}</li>)}
                </ul>
              </div>
            )}

            {remediation.escalate_if && (
              <div style={{ background: '#ffaa0010', border: '1px solid #ffaa0055', borderRadius: 6, color: COLORS.yellow, padding: '11px 13px' }}>📞 Escalate if: {remediation.escalate_if}</div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

const tableCellStyle = { borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12, padding: '10px', verticalAlign: 'top' }

function CommandRow({ label, command, onCopy }) {
  const value = command || '—'
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' }}>{label} command</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <code style={S.code}>{value}</code>
        <button type="button" onClick={() => onCopy(command)} disabled={!command} style={{ ...S.smallButton, color: command ? COLORS.cyan : COLORS.muted, cursor: command ? 'pointer' : 'not-allowed' }}>Copy</button>
      </div>
    </div>
  )
}
