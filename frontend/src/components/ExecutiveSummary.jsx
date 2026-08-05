import React, { useState, useMemo } from 'react'
import { noteTime, recentNotesForDate } from '../utils/shiftNotes'

// ── helpers ──────────────────────────────────────────────────────────────────
function oeeColor(v) {
  if (v == null) return '#6e7681'
  if (v >= 85) return '#00ff88'
  if (v >= 75) return '#ffaa00'
  return '#ff4444'
}

function effColor(v) {
  if (v == null) return '#6e7681'
  if (v >= 90) return '#00ff88'
  if (v >= 75) return '#ffaa00'
  return '#ff4444'
}

function delta(curr, prev, unit = '') {
  if (prev == null || curr == null) return null
  const d = curr - prev
  const sign = d > 0 ? '+' : ''
  return { text: `${sign}${d.toFixed(1)}${unit}`, up: d > 0 }
}

// Plant health: weighted composite 0–100
function plantHealth(kpis, productionStatus, shippingStatus, issues) {
  const scores = []

  // Efficiency % (weight 35)
  const eff = kpis?.efficiency_pct ?? null
  if (eff != null) scores.push({ score: Math.min(eff, 100), weight: 35 })

  // OEE from production status (weight 25)
  if (productionStatus?.length > 0) {
    const running = productionStatus.filter(s => s.status === 'running')
    if (running.length > 0) {
      const avgEff = running.reduce((s, r) => s + (r.efficiency_pct ?? 0), 0) / running.length
      scores.push({ score: Math.min(avgEff, 100), weight: 25 })
    }
  }

  // On-time delivery (weight 25)
  const otr = shippingStatus?.on_time_rate_pct ?? null
  if (otr != null) scores.push({ score: otr, weight: 25 })

  // Issues inverse: 0 issues = 100, 5+ issues = 0 (weight 15)
  const openIssues = issues?.length ?? 0
  const issueScore = Math.max(0, 100 - openIssues * 20)
  scores.push({ score: issueScore, weight: 15 })

  if (scores.length === 0) return null
  const totalWeight = scores.reduce((s, x) => s + x.weight, 0)
  const weighted = scores.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
  return Math.round(weighted)
}

function healthColor(score) {
  if (score == null) return '#6e7681'
  if (score >= 85) return '#00ff88'
  if (score >= 70) return '#ffaa00'
  return '#ff4444'
}

function healthLabel(score) {
  if (score == null) return 'NO DATA'
  if (score >= 85) return 'HEALTHY'
  if (score >= 70) return 'CAUTION'
  return 'AT RISK'
}

// ── sub-components ───────────────────────────────────────────────────────────
function KPIHero({ label, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#161b22',
        border: `1px solid ${accent}33`,
        borderTop: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '22px 24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s',
        flex: 1,
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 42, fontWeight: 900, color: accent, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: '#6e7681', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function HealthRing({ score }) {
  const color = healthColor(score)
  const label = healthLabel(score)
  const pct = score ?? 0
  // conic-gradient ring
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${pct * 3.6}deg, #21262d ${pct * 3.6}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: 36, fontWeight: 900, color, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>
            {score ?? '—'}
          </div>
          <div style={{ fontSize: 10, color, letterSpacing: 2, marginTop: 2 }}>{label}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6e7681', letterSpacing: 1 }}>PLANT HEALTH SCORE</div>
    </div>
  )
}

function DeltaBadge({ d, higherIsBetter = true }) {
  if (!d) return <span style={{ color: '#6e7681', fontSize: 11 }}>—</span>
  const good = d.up === higherIsBetter
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: good ? '#00ff88' : '#ff4444',
      background: good ? '#00ff8815' : '#ff444415',
      border: `1px solid ${good ? '#00ff8844' : '#ff444444'}`,
      borderRadius: 6, padding: '2px 7px',
      fontFamily: "'Courier New', monospace",
    }}>
      {d.up ? '▲' : '▼'} {d.text}
    </span>
  )
}

function AlertCard({ msg, onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      background: '#ff444415', border: '1px solid #ff444444',
      borderLeft: '4px solid #ff4444',
      borderRadius: 8, padding: '10px 14px', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 16 }}>⚠</span>
        <span style={{ fontSize: 12, color: '#e6edf3' }}>{msg}</span>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent', border: 'none', color: '#6e7681',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0,
        }}
      >✕</button>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function ExecutiveSummary({ kpis = {}, productionStatus = [], shippingStatus = {}, issues = [], onTabClick }) {
  const [dismissed, setDismissed] = useState(new Set())
  const [recentNotes] = useState(() => recentNotesForDate(new Date(), 5))

  // Simulated previous shift values for comparison (in real app these come from API)
  const prevShift = useMemo(() => ({
    actual: Math.round((kpis.actual ?? 0) * 0.94),
    plan: kpis.plan ?? 0,
    efficiency_pct: ((kpis.efficiency_pct ?? 0) - 3.2),
    fpy_pct: ((kpis.fpy_pct ?? 0) - 0.8),
    oee_pct: ((kpis.marsKpis?.oee_pct ?? 70) - 2.1),
  }), [kpis])

  const health = plantHealth(kpis, productionStatus, shippingStatus, issues)

  // Bottom 5 stations by OEE from production status
  const bottom5 = useMemo(() => {
    if (!productionStatus?.length) return []
    return [...productionStatus]
      .sort((a, b) => (a.efficiency_pct ?? 100) - (b.efficiency_pct ?? 100))
      .slice(0, 5)
  }, [productionStatus])

  // Build alert list
  const allAlerts = useMemo(() => {
    const alerts = []
    // Low-efficiency running stations
    productionStatus.forEach(s => {
      if (s.status === 'running' && (s.efficiency_pct ?? 100) < 75) {
        alerts.push({ id: `eff-${s.resource_id}`, msg: `Station ${s.resource_id} running below target — efficiency ${s.efficiency_pct?.toFixed(0)}%` })
      }
    })
    // LATE deliveries
    const deliveries = shippingStatus?.customer_deliveries ?? []
    deliveries.filter(d => d.status === 'LATE').forEach(d => {
      alerts.push({ id: `late-${d.work_order}`, msg: `Delivery LATE — ${d.customer} · ${d.work_order} · Ship by ${d.ship_by}` })
    })
    // Too many open issues
    if (issues.length >= 3) {
      alerts.push({ id: 'issues-high', msg: `${issues.length} open issues require attention` })
    }
    // Low on-time rate
    const otr = shippingStatus?.on_time_rate_pct
    if (otr != null && otr < 90) {
      alerts.push({ id: 'otr-low', msg: `On-time delivery rate at ${otr}% — below 90% threshold` })
    }
    return alerts
  }, [productionStatus, shippingStatus, issues])

  const visibleAlerts = allAlerts.filter(a => !dismissed.has(a.id))

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]))
  }

  const eff = kpis.efficiency_pct ?? 0
  const fpy = kpis.fpy_pct ?? 0
  const otr = shippingStatus?.on_time_rate_pct ?? null
  const openIssues = issues.length

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e6edf3', letterSpacing: -0.5 }}>Executive Summary</div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>Plant-wide performance at a glance · Current shift</div>
        </div>
        <div style={{ fontSize: 11, color: '#6e7681', background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '6px 14px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* ── Alerts ── */}
      {visibleAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#ff4444', letterSpacing: 1, fontWeight: 700 }}>⚠ ACTIVE ALERTS ({visibleAlerts.length})</div>
          {visibleAlerts.map(a => (
            <AlertCard key={a.id} msg={a.msg} onDismiss={() => dismiss(a.id)} />
          ))}
        </div>
      )}
      {visibleAlerts.length === 0 && allAlerts.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#00ff8810', border: '1px solid #00ff8830', borderLeft: '4px solid #00ff88',
          borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#00ff88',
        }}>
          ✓ No active alerts — all systems within normal range
        </div>
      )}

      {/* ── Plant Health + Top KPIs ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Health ring */}
        <div style={{
          background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
          padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <HealthRing score={health} />
        </div>

        {/* Top KPI heroes */}
        <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap' }}>
          <KPIHero
            label="Efficiency"
            value={`${eff}%`}
            sub={`Plan: ${kpis.plan ?? '—'} · Actual: ${kpis.actual ?? '—'}`}
            accent={effColor(eff)}
            onClick={() => onTabClick?.('productivity')}
          />
          <KPIHero
            label="On-Time Delivery"
            value={otr != null ? `${otr}%` : '—'}
            sub={`${(shippingStatus?.customer_deliveries ?? []).filter(d => d.status === 'LATE').length} late deliveries`}
            accent={otr != null ? (otr >= 95 ? '#00ff88' : otr >= 85 ? '#ffaa00' : '#ff4444') : '#6e7681'}
            onClick={() => onTabClick?.('shipping')}
          />
          <KPIHero
            label="Open Issues"
            value={openIssues}
            sub={openIssues === 0 ? 'All clear' : `${openIssues} requiring action`}
            accent={openIssues === 0 ? '#00ff88' : openIssues <= 2 ? '#ffaa00' : '#ff4444'}
            onClick={() => onTabClick?.('issues')}
          />
        </div>
      </div>

      {/* ── Shift Comparison ── */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 16, fontWeight: 700 }}>SHIFT-OVER-SHIFT COMPARISON</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Metric', 'Previous Shift', 'Current Shift', 'Change'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'Metric' ? 'left' : 'center',
                    padding: '8px 12px', fontSize: 10, color: '#6e7681',
                    letterSpacing: 1, textTransform: 'uppercase',
                    borderBottom: '1px solid #21262d',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Parts Actual', curr: kpis.actual, prev: prevShift.actual, unit: '', higherIsBetter: true },
                { label: 'Efficiency %', curr: eff, prev: prevShift.efficiency_pct, unit: '%', higherIsBetter: true },
                { label: 'First Pass Yield %', curr: fpy, prev: prevShift.fpy_pct, unit: '%', higherIsBetter: true },
                { label: 'Open Issues', curr: openIssues, prev: 2, unit: '', higherIsBetter: false },
              ].map((row, i) => {
                const d = delta(row.curr, row.prev, row.unit)
                return (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? 'transparent' : '#0d111780' }}>
                    <td style={{ padding: '10px 12px', color: '#e6edf3', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Courier New', monospace", color: '#6e7681' }}>
                      {row.prev?.toFixed(row.unit === '' ? 0 : 1)}{row.unit}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontWeight: 700, color: '#e6edf3' }}>
                      {row.curr?.toFixed(row.unit === '' ? 0 : 1)}{row.unit}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <DeltaBadge d={d} higherIsBetter={row.higherIsBetter} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom 5 Stations + Parts Shipped side-by-side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Bottom 5 stations */}
        <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 16, fontWeight: 700 }}>
            ⬇ BOTTOM 5 STATIONS — BY EFFICIENCY
          </div>
          {bottom5.length === 0 ? (
            <div style={{ color: '#6e7681', fontSize: 12, padding: '12px 0' }}>No production status data available</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bottom5.map((s, i) => {
                const effVal = s.efficiency_pct ?? 0
                const color = effColor(effVal)
                const statusColor = s.status === 'running' ? '#00ff88' : s.status === 'downtime' ? '#ff4444' : '#ffaa00'
                return (
                  <div key={s.resource_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', background: '#0d1117', borderRadius: 8,
                    border: `1px solid ${color}22`,
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#30363d', width: 20, flexShrink: 0 }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color: '#e6edf3', fontSize: 13 }}>
                          {s.resource_id}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px',
                          borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase',
                          background: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}44`,
                        }}>{s.status}</span>
                      </div>
                      <div style={{ width: '100%', height: 5, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${effVal}%`, background: color, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#6e7681', marginTop: 3 }}>
                        {s.current_part ?? 'N/A'} · Actual {s.actual ?? '—'} / Plan {s.planned ?? '—'}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 20, fontWeight: 900, color, flexShrink: 0 }}>
                      {effVal.toFixed(0)}%
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Shipping snapshot */}
        <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 16, fontWeight: 700 }}>
            🚛 SHIPPING SNAPSHOT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Parts Shipped', value: (shippingStatus?.parts_shipped_today ?? '—').toLocaleString?.() ?? '—', accent: '#00d4ff' },
              { label: 'Shipments', value: shippingStatus?.shipment_count ?? '—', accent: '#a78bfa' },
              { label: 'Pending Trucks', value: shippingStatus?.pending_trucks ?? '—', accent: '#ffaa00' },
              { label: 'Dock Status', value: shippingStatus?.shipping_dock_status ?? '—', accent: shippingStatus?.shipping_dock_status === 'ACTIVE' ? '#00ff88' : '#ff4444' },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: '#0d1117', borderRadius: 8, padding: '12px 14px',
                border: `1px solid ${accent}22`, borderTop: `3px solid ${accent}`,
              }}>
                <div style={{ fontSize: 10, color: '#6e7681', letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: "'Courier New', monospace" }}>{value}</div>
              </div>
            ))}
          </div>
          {/* Customer deliveries mini-list */}
          <div style={{ fontSize: 10, color: '#6e7681', letterSpacing: 1, marginBottom: 8 }}>CUSTOMER DELIVERIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(shippingStatus?.customer_deliveries ?? []).slice(0, 4).map(d => {
              const sc = d.status === 'ONTIME' || d.status === 'SHIPPED' ? '#00ff88'
                       : d.status === 'IN_TRANSIT' ? '#00d4ff'
                       : d.status === 'LATE' ? '#ff4444' : '#ffaa00'
              return (
                <div key={d.work_order} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 11, padding: '6px 10px', background: '#0d111780', borderRadius: 6,
                  borderLeft: `3px solid ${sc}`,
                }}>
                  <span style={{ color: '#e6edf3', fontFamily: "'Courier New', monospace" }}>{d.customer}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: sc,
                    background: sc + '15', padding: '1px 7px', borderRadius: 4,
                  }}>{d.status}</span>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => onTabClick?.('shipping')}
            style={{
              marginTop: 12, width: '100%', background: 'transparent',
              border: '1px solid #21262d', borderRadius: 6, color: '#8b949e',
              fontSize: 11, padding: '7px', cursor: 'pointer',
            }}
          >
            View full shipping panel →
          </button>
        </div>
      </div>

      {/* ── Quick Nav ── */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '16px 24px' }}>
        <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>QUICK NAVIGATION</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { tab: 'stations',   label: '🏭 Stations' },
            { tab: 'production', label: '⚙ Production' },
            { tab: 'prodstatus', label: '🔢 Floor Status' },
            { tab: 'shipping',   label: '🚛 Shipping' },
            { tab: 'oee',        label: '📈 OEE Analytics' },
            { tab: 'issues',     label: '⚠ Issues' },
            { tab: 'downtime',   label: '⏱ Downtime' },
          ].map(({ tab, label }) => (
            <button
              key={tab}
              onClick={() => onTabClick?.(tab)}
              style={{
                background: '#0d1117', border: '1px solid #21262d',
                borderRadius: 8, color: '#c9d1d9', fontSize: 12, padding: '8px 16px',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent shift notes ── */}
      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, fontWeight: 700 }}>📝 RECENT NOTES</div>
          <span style={{
            background: recentNotes.length ? '#00d4ff' : '#30363d', color: recentNotes.length ? '#0a0e14' : '#8b949e',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            fontFamily: "'Courier New', monospace",
          }}>{recentNotes.length}</span>
        </div>
        {recentNotes.length === 0 ? (
          <div style={{ color: '#6e7681', fontSize: 12 }}>No shift notes have been posted today.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {recentNotes.map(note => (
              <div key={`${note.resource}-${note.shift}-${note.id}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
                background: '#161b22', border: '1px solid #21262d', borderRadius: 7,
              }}>
                <span style={{
                  color: '#6e7681', background: '#0d1117', border: '1px solid #21262d',
                  borderRadius: 5, padding: '2px 6px', fontSize: 10,
                  fontFamily: "'Courier New', monospace", whiteSpace: 'nowrap',
                }}>{noteTime(note)}</span>
                <span style={{
                  minWidth: 70, color: '#e6edf3', fontSize: 11, fontWeight: 800,
                  fontFamily: "'Courier New', monospace", whiteSpace: 'nowrap',
                }}>{note.resource} · S{note.shift}</span>
                <span style={{ flex: 1, color: '#c9d1d9', fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{note.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
