/**
 * IssueAnalyticsTab — Option 3 full Issue Analytics view
 *
 * Sections:
 *  1. KPI summary strip  (total, open, critical, avg MTTR)
 *  2. Pareto Chart       (top repeating issue types, stacked by severity — click to drill)
 *  3. Day-by-Day Trend   (SVG line/area chart of issues raised per day)
 *  4. MTTR Table         (mean time to resolve per issue type)
 *  5. OEE Downtime Causes (top_tool_issue / top_maint_issue / top_prod_issue from oee_entries)
 *  6. Drill-down view    (click any type → list of all matching issues)
 */
import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'

// ── Design tokens (matches app dark theme) ─────────────────────────────────
const BG      = '#0a0e14'
const CARD    = '#161b22'
const BORDER  = '#21262d'
const TEXT    = '#e6edf3'
const MUTED   = '#8b949e'
const DIM     = '#6e7681'
const ACCENT  = '#00d4ff'
const GREEN   = '#00ff88'
const YELLOW  = '#ffaa00'
const RED     = '#ff4444'

const SEV = {
  critical: { color: RED,    label: '🔴 CRITICAL' },
  major:    { color: YELLOW, label: '🟡 MAJOR' },
  minor:    { color: ACCENT, label: '🔵 MINOR' },
}

const STATUS_COLOR = { open: RED, in_progress: YELLOW, resolved: GREEN, closed: DIM }

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso :
    d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function msToHrs(ms) { return (ms / 3_600_000).toFixed(1) }

// Build Pareto aggregation from raw issues array
function buildPareto(issues) {
  const map = {}
  for (const iss of issues) {
    const t = iss.issue_type || 'General'
    if (!map[t]) map[t] = { type: t, count: 0, critical: 0, major: 0, minor: 0, resMs: [] }
    map[t].count++
    const sev = (iss.severity || 'minor').toLowerCase()
    if (sev === 'critical') map[t].critical++
    else if (sev === 'major') map[t].major++
    else map[t].minor++
    if ((iss.status === 'resolved' || iss.status === 'closed') && iss.raised_at && iss.updated_at) {
      const ms = new Date(iss.updated_at) - new Date(iss.raised_at)
      if (ms > 0) map[t].resMs.push(ms)
    }
  }
  return Object.values(map)
    .map(r => ({
      ...r,
      mttr: r.resMs.length ? r.resMs.reduce((a, b) => a + b, 0) / r.resMs.length : null,
      resolvedCount: r.resMs.length,
    }))
    .sort((a, b) => b.count - a.count)
}

// Build day-by-day trend for the given window
function buildTrend(issues, days) {
  const now = new Date()
  const buckets = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    buckets[key] = { date: key, count: 0, critical: 0 }
  }
  for (const iss of issues) {
    const key = iss.raised_at ? iss.raised_at.slice(0, 10) : null
    if (key && buckets[key]) {
      buckets[key].count++
      if ((iss.severity || '').toLowerCase() === 'critical') buckets[key].critical++
    }
  }
  return Object.values(buckets)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiChip({ label, value, color = TEXT, sub }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 20px', minWidth: 120, flex: 1 }}>
      <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// Horizontal stacked bar Pareto chart (pure SVG)
function ParetoChart({ data, onSelect, selected, maxRows = 8 }) {
  const rows = data.slice(0, maxRows)
  const maxCount = Math.max(...rows.map(r => r.count), 1)
  const ROW_H = 38, GAP = 6, LABEL_W = 150, BAR_W = 300, COUNT_W = 36
  const SVG_W = LABEL_W + BAR_W + COUNT_W + 12
  const SVG_H = rows.length * (ROW_H + GAP)

  // cumulative % for Pareto line
  const total = rows.reduce((s, r) => s + r.count, 0)
  let cumCount = 0
  const paretoPoints = rows.map((r, i) => {
    cumCount += r.count
    const x = LABEL_W + BAR_W + 6
    const y = i * (ROW_H + GAP) + ROW_H / 2
    return { x, y, pct: total ? (cumCount / total) * 100 : 0 }
  })

  return (
    <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block', overflow: 'visible' }}>
      {rows.map((r, i) => {
        const y = i * (ROW_H + GAP)
        const bw = Math.max((r.count / maxCount) * BAR_W, 2)
        const critW = r.count ? (r.critical / r.count) * bw : 0
        const majW  = r.count ? (r.major  / r.count) * bw : 0
        const minW  = r.count ? (r.minor  / r.count) * bw : 0
        const isSelected = selected === r.type

        return (
          <g key={r.type} onClick={() => onSelect(r.type)} style={{ cursor: 'pointer' }}>
            {/* Row highlight */}
            <rect x={0} y={y} width={SVG_W} height={ROW_H} fill={isSelected ? '#00d4ff14' : 'transparent'} rx={4} />
            {/* Label */}
            <text
              x={LABEL_W - 8} y={y + ROW_H / 2 + 4}
              textAnchor="end"
              fill={isSelected ? TEXT : MUTED}
              fontSize={11}
              fontFamily="ui-monospace,monospace"
            >
              {r.type.length > 18 ? r.type.slice(0, 17) + '…' : r.type}
            </text>
            {/* Bar track */}
            <rect x={LABEL_W} y={y + 9} width={BAR_W} height={ROW_H - 18} fill="#21262d" rx={4} />
            {/* Stacked severity fills */}
            {critW > 0 && <rect x={LABEL_W}                 y={y + 9} width={critW} height={ROW_H - 18} fill={RED}    rx={4} />}
            {majW  > 0 && <rect x={LABEL_W + critW}         y={y + 9} width={majW}  height={ROW_H - 18} fill={YELLOW} />}
            {minW  > 0 && <rect x={LABEL_W + critW + majW}  y={y + 9} width={minW}  height={ROW_H - 18} fill={ACCENT} rx={4} />}
            {/* Hover outline */}
            {isSelected && <rect x={LABEL_W} y={y + 9} width={BAR_W} height={ROW_H - 18} fill="none" stroke={ACCENT} strokeWidth={1.5} rx={4} />}
            {/* Count */}
            <text
              x={LABEL_W + BAR_W + 8} y={y + ROW_H / 2 + 4}
              fill={TEXT} fontSize={13} fontWeight="700" fontFamily="monospace"
            >
              {r.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Day-by-day area + line chart (pure SVG)
function TrendChart({ data, height = 140 }) {
  if (!data || data.length < 2) return <div style={{ color: MUTED, fontSize: 12, padding: 24 }}>Not enough data for trend.</div>

  const maxVal = Math.max(...data.map(d => d.count), 1)
  const PAD_L = 30, PAD_R = 12, PAD_T = 10, PAD_B = 22
  const N = data.length

  // We use a viewBox so it scales to container width
  const VW = 600
  const VH = height
  const cW = VW - PAD_L - PAD_R
  const cH = VH - PAD_T - PAD_B

  const px = (i) => PAD_L + (i / (N - 1)) * cW
  const py = (v) => PAD_T + cH - (v / maxVal) * cH

  const linePts  = data.map((d, i) => `${px(i)},${py(d.count)}`).join(' ')
  const areaPath = `M ${px(0)},${py(0)} ` + data.map((d, i) => `L ${px(i)},${py(d.count)}`).join(' ') + ` L ${px(N - 1)},${PAD_T + cH} L ${PAD_L},${PAD_T + cH} Z`

  const critLinePts = data.map((d, i) => `${px(i)},${py(d.critical)}`).join(' ')

  // X-axis: label every Nth date
  const step = Math.max(1, Math.ceil(N / 8))
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal]

  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <line key={v} x1={PAD_L} x2={VW - PAD_R} y1={py(v)} y2={py(v)} stroke={BORDER} strokeWidth={1} />
      ))}
      {/* Area fill */}
      <path d={areaPath} fill={`${ACCENT}18`} />
      {/* Total line */}
      <polyline points={linePts} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
      {/* Critical line */}
      <polyline points={critLinePts} fill="none" stroke={RED} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
      {/* Data points */}
      {data.map((d, i) => d.count > 0 && (
        <circle key={i} cx={px(i)} cy={py(d.count)} r={3} fill={ACCENT} />
      ))}
      {/* Y labels */}
      {yTicks.map(v => (
        <text key={v} x={PAD_L - 4} y={py(v) + 4} textAnchor="end" fill={DIM} fontSize={9}>{v}</text>
      ))}
      {/* X labels */}
      {data.filter((_, i) => i % step === 0 || i === N - 1).map((d, _, arr) => {
        const origIdx = data.indexOf(d)
        return (
          <text key={d.date} x={px(origIdx)} y={VH - 4} textAnchor="middle" fill={DIM} fontSize={9}>
            {d.date.slice(5)}
          </text>
        )
      })}
      {/* Legend */}
      <circle cx={VW - 90} cy={PAD_T + 8} r={4} fill={ACCENT} />
      <text x={VW - 82} y={PAD_T + 12} fill={MUTED} fontSize={9}>All issues</text>
      <line x1={VW - 90} y1={PAD_T + 20} x2={VW - 80} y2={PAD_T + 20} stroke={RED} strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={VW - 76} y={PAD_T + 24} fill={MUTED} fontSize={9}>Critical</text>
    </svg>
  )
}

// MTTR table — sorted by avg resolution time desc
function MTTRTable({ pareto, onSelect }) {
  const rows = pareto
    .filter(r => r.mttr !== null)
    .sort((a, b) => b.mttr - a.mttr)

  if (!rows.length) return (
    <div style={{ color: MUTED, fontSize: 12, padding: '16px 0' }}>No resolved issues in this period — MTTR will appear once issues are resolved.</div>
  )

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
          {['Issue Type', 'Total', 'Resolved', 'Avg MTTR', 'Resolution Rate'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: MUTED, fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const resPct = r.count ? Math.round((r.resolvedCount / r.count) * 100) : 0
          const mttrHrs = msToHrs(r.mttr)
          const mttrColor = r.mttr < 3_600_000 ? GREEN : r.mttr < 7_200_000 ? YELLOW : RED
          return (
            <tr
              key={r.type}
              onClick={() => onSelect(r.type)}
              style={{
                borderBottom: `1px solid ${BORDER}`,
                cursor: 'pointer',
                background: i % 2 === 0 ? 'transparent' : '#0d111780',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${ACCENT}11`}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#0d111780'}
            >
              <td style={{ padding: '8px 10px', color: TEXT, fontWeight: 600 }}>{r.type}</td>
              <td style={{ padding: '8px 10px', color: MUTED, fontFamily: 'monospace' }}>{r.count}</td>
              <td style={{ padding: '8px 10px', color: GREEN, fontFamily: 'monospace' }}>{r.resolvedCount}</td>
              <td style={{ padding: '8px 10px', color: mttrColor, fontWeight: 700, fontFamily: 'monospace' }}>{mttrHrs}h</td>
              <td style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${resPct}%`, height: '100%', background: resPct > 75 ? GREEN : resPct > 40 ? YELLOW : RED, borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ color: MUTED, fontSize: 10, minWidth: 32 }}>{resPct}%</span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// OEE downtime cause impact matrix
const OEE_CATEGORY = {
  Tool:        { color: '#ff6b35', icon: '◆', label: 'Tool' },
  Maintenance: { color: YELLOW,   icon: '●', label: 'Maintenance' },
  Production:  { color: ACCENT,   icon: '▲', label: 'Production' },
}

function OEECausesPanel({ causes }) {
  if (!causes || causes.length === 0) {
    return (
      <div style={{ color: MUTED, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
        No OEE downtime cause data in this period. Data populates when OEE entries are logged with issue descriptions.
      </div>
    )
  }

  const points = [...causes]
    .filter(c => Number(c.occurrences) > 0 && Number(c.total_dt_min) >= 0)
    .sort((a, b) => b.total_dt_min - a.total_dt_min)
    .slice(0, 10)
  const maxOccurrences = Math.max(...points.map(c => Number(c.occurrences)), 1)
  const maxDowntime = Math.max(...points.map(c => Number(c.total_dt_min)), 1)
  const occurrenceThreshold = Math.max(1, Math.ceil(maxOccurrences * 0.55))
  const downtimeThreshold = Math.max(1, Math.ceil(maxDowntime * 0.55))
  const W = 720, H = 330
  const left = 62, right = 24, top = 24, bottom = 54
  const plotW = W - left - right
  const plotH = H - top - bottom
  const x = value => left + (Number(value) / (maxOccurrences + 1)) * plotW
  const y = value => top + plotH - (Number(value) / (maxDowntime * 1.12)) * plotH
  const thresholdX = x(occurrenceThreshold)
  const thresholdY = y(downtimeThreshold)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(maxDowntime * ratio))
  const xTicks = Array.from({ length: maxOccurrences + 1 }, (_, i) => i)

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries(OEE_CATEGORY).map(([type, meta]) => (
          <span key={type} style={{ color: MUTED, fontSize: 10 }}>
            <span style={{ color: meta.color, marginRight: 5 }}>{meta.icon}</span>{meta.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Downtime impact matrix plotting recurring causes by occurrences and total downtime minutes"
        style={{ display: 'block', minHeight: 260 }}
      >
        <rect x={left} y={top} width={plotW} height={plotH} fill="#0d1117" stroke={BORDER} />
        <rect x={thresholdX} y={top} width={left + plotW - thresholdX} height={thresholdY - top} fill={`${RED}0b`} />

        {yTicks.map(value => (
          <g key={`y-${value}`}>
            <line x1={left} x2={left + plotW} y1={y(value)} y2={y(value)} stroke={BORDER} strokeWidth={1} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end" fill={DIM} fontSize={9}>{value}</text>
          </g>
        ))}
        {xTicks.map(value => (
          <g key={`x-${value}`}>
            <line x1={x(value)} x2={x(value)} y1={top} y2={top + plotH} stroke={BORDER} strokeWidth={1} opacity={0.5} />
            <text x={x(value)} y={top + plotH + 17} textAnchor="middle" fill={DIM} fontSize={9}>{value}</text>
          </g>
        ))}

        <line x1={thresholdX} x2={thresholdX} y1={top} y2={top + plotH} stroke={YELLOW} strokeDasharray="5 5" opacity={0.7} />
        <line x1={left} x2={left + plotW} y1={thresholdY} y2={thresholdY} stroke={YELLOW} strokeDasharray="5 5" opacity={0.7} />
        <text x={left + 8} y={top + 14} fill={DIM} fontSize={9}>MAJOR LOSS</text>
        <text x={left + plotW - 8} y={top + 14} textAnchor="end" fill={RED} fontSize={9} fontWeight={700}>PRIORITY</text>
        <text x={left + 8} y={top + plotH - 8} fill={DIM} fontSize={9}>MONITOR</text>
        <text x={left + plotW - 8} y={top + plotH - 8} textAnchor="end" fill={DIM} fontSize={9}>CHRONIC</text>

        {points.map((cause, index) => {
          const meta = OEE_CATEGORY[cause.cause_type] || { color: MUTED, icon: '●' }
          const averageMinutes = Number(cause.total_dt_min) / Math.max(Number(cause.occurrences), 1)
          const radius = Math.min(18, 7 + averageMinutes * 0.55)
          const px = x(cause.occurrences)
          const py = y(cause.total_dt_min)
          const labelAbove = index % 2 === 0
          const label = cause.cause_text.length > 24 ? `${cause.cause_text.slice(0, 23)}…` : cause.cause_text
          return (
            <g key={`${cause.cause_type}-${cause.cause_text}`}>
              <title>{`${cause.cause_text}: ${cause.occurrences} occurrences, ${cause.total_dt_min} minutes total, ${averageMinutes.toFixed(1)} minutes average`}</title>
              <circle cx={px} cy={py} r={radius} fill={`${meta.color}55`} stroke={meta.color} strokeWidth={2} />
              <text x={px} y={py + 3} textAnchor="middle" fill={TEXT} fontSize={8} fontWeight={700}>{cause.occurrences}×</text>
              <text x={px} y={labelAbove ? py - radius - 7 : py + radius + 13} textAnchor="middle" fill={TEXT} fontSize={9}>{label}</text>
              <text x={px} y={labelAbove ? py - radius + 3 : py + radius + 23} textAnchor="middle" fill={meta.color} fontSize={8}>{cause.total_dt_min} min</text>
            </g>
          )
        })}

        <text x={left + plotW / 2} y={H - 5} textAnchor="middle" fill={MUTED} fontSize={10}>Occurrences in selected period →</text>
        <text transform={`translate(14 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" fill={MUTED} fontSize={10}>Total downtime (minutes) →</text>
      </svg>

      <div style={{ color: DIM, fontSize: 10, textAlign: 'center', marginTop: 6 }}>
        Bubble size = average minutes lost per occurrence · Focus improvement work on the upper-right priority zone
      </div>
    </div>
  )
}

// Drill-down: all issues for a specific issue_type
function DrillDownView({ issues, issueType, onBack }) {
  const filtered = issues.filter(iss => (iss.issue_type || 'General') === issueType)
  const open     = filtered.filter(i => i.status === 'open').length
  const critical = filtered.filter(i => (i.severity || '').toLowerCase() === 'critical').length
  const resolved = filtered.filter(i => i.status === 'resolved' || i.status === 'closed')
  const mttr = resolved.length
    ? resolved.reduce((sum, iss) => {
        const ms = new Date(iss.updated_at) - new Date(iss.raised_at)
        return sum + (ms > 0 ? ms : 0)
      }, 0) / resolved.length
    : null

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 20, fontSize: 12 }}
      >
        ← Back to Analytics
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>{issueType}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{filtered.length} issues in selected period</div>
      </div>

      {/* Mini KPI chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiChip label="Total"    value={filtered.length} />
        <KpiChip label="Open"     value={open}     color={open > 0 ? RED : GREEN} />
        <KpiChip label="Critical" value={critical}  color={critical > 0 ? RED : TEXT} />
        <KpiChip label="Resolved" value={resolved.length} color={GREEN} />
        {mttr !== null && <KpiChip label="Avg MTTR" value={`${msToHrs(mttr)}h`} color={mttr < 3_600_000 ? GREEN : mttr < 7_200_000 ? YELLOW : RED} />}
      </div>

      {/* Issue list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(iss => {
          const sev = (iss.severity || 'minor').toLowerCase()
          const sevColor = SEV[sev]?.color || MUTED
          const stColor  = STATUS_COLOR[iss.status] || MUTED
          const mttrMs   = (iss.status === 'resolved' || iss.status === 'closed') && iss.raised_at && iss.updated_at
            ? new Date(iss.updated_at) - new Date(iss.raised_at) : null

          return (
            <div
              key={iss.id}
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderLeft: `4px solid ${sevColor}`,
                borderRadius: 8,
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: sevColor, fontWeight: 700, letterSpacing: 1 }}>{SEV[sev]?.label || sev.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: stColor, background: `${stColor}18`, border: `1px solid ${stColor}44`, borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>
                    {(iss.status || 'open').replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 6 }}>{iss.description || 'No description'}</div>
                <div style={{ fontSize: 10, color: DIM, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>Raised: {fmtDate(iss.raised_at)}</span>
                  {iss.raised_by && <span>By: {iss.raised_by}</span>}
                  {iss.acknowledged_by && <span>Ack: {iss.acknowledged_by}</span>}
                  {mttrMs !== null && mttrMs > 0 && <span style={{ color: mttrMs < 3_600_000 ? GREEN : mttrMs < 7_200_000 ? YELLOW : RED }}>MTTR: {msToHrs(mttrMs)}h</span>}
                </div>
              </div>
              <div style={{ fontSize: 10, color: DIM, textAlign: 'right', minWidth: 60 }}>
                #{iss.id}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ color: MUTED, padding: 24, textAlign: 'center' }}>No issues found for this type in the selected period.</div>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function IssueAnalyticsTab({ resource = 'WM15' }) {
  const [days, setDays]             = useState(30)
  const [issues, setIssues]         = useState([])
  const [oeeCauses, setOeeCauses]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [drillType, setDrillType]   = useState(null)
  const [paretoSel, setParetoSel]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      api.issuesAnalytics(resource, days),
      api.oeeCauses(days),
    ]).then(([issRes, oeeRes]) => {
      setIssues(issRes.status === 'fulfilled' && Array.isArray(issRes.value) ? issRes.value : [])
      setOeeCauses(oeeRes.status === 'fulfilled' && Array.isArray(oeeRes.value) ? oeeRes.value : [])
      setLoading(false)
      if (issRes.status === 'rejected') setError(issRes.reason?.message || 'Failed to load issues')
    })
  }, [resource, days])

  const pareto = useMemo(() => buildPareto(issues), [issues])
  const trend  = useMemo(() => buildTrend(issues, days), [issues, days])

  // KPI summary numbers
  const totalCount    = issues.length
  const openCount     = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const criticalCount = issues.filter(i => (i.severity || '').toLowerCase() === 'critical').length
  const resolved      = issues.filter(i => i.status === 'resolved' || i.status === 'closed')
  const avgMttr = resolved.length
    ? resolved.reduce((sum, iss) => {
        const ms = new Date(iss.updated_at) - new Date(iss.raised_at)
        return sum + (ms > 0 ? ms : 0)
      }, 0) / resolved.length
    : null
  const topType = pareto[0]?.type || '—'

  function handleParetoClick(type) {
    setParetoSel(prev => prev === type ? null : type)
    setDrillType(type)
  }

  // ── Drill-down view ──────────────────────────────────────────────────────
  if (drillType) {
    return (
      <div style={{ padding: 24, background: BG, minHeight: '100%' }}>
        <DrillDownView
          issues={issues}
          issueType={drillType}
          onBack={() => { setDrillType(null); setParetoSel(null) }}
        />
      </div>
    )
  }

  // ── Main analytics view ──────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: BG, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 2 }}>Issue Analytics</div>
          <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>RESOURCE: {resource} · TOP REPEATING ISSUES &amp; TRENDS</div>
        </div>
        {/* Days selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: days === d ? 700 : 500,
                background: days === d ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${days === d ? ACCENT : BORDER}`,
                color: days === d ? ACCENT : MUTED,
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
          <div>Loading issue analytics…</div>
        </div>
      )}
      {!loading && error && (
        <div style={{ background: `${RED}11`, border: `1px solid ${RED}44`, borderRadius: 10, padding: 20, color: RED, fontSize: 13 }}>
          <strong>⚠ Could not load analytics:</strong> {error}
          <div style={{ marginTop: 8, color: MUTED, fontSize: 11 }}>Make sure the backend is running and /api/issues/analytics is registered.</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI Strip ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <KpiChip label={`Issues (${days}d)`} value={totalCount} />
            <KpiChip label="Open / Active"        value={openCount}     color={openCount > 0 ? RED : GREEN} sub={totalCount ? `${Math.round((openCount / totalCount) * 100)}% of total` : undefined} />
            <KpiChip label="Critical"             value={criticalCount} color={criticalCount > 0 ? RED : TEXT} />
            <KpiChip label="Avg MTTR"             value={avgMttr !== null ? `${msToHrs(avgMttr)}h` : '—'} color={avgMttr === null ? MUTED : avgMttr < 3_600_000 ? GREEN : avgMttr < 7_200_000 ? YELLOW : RED} sub="mean time to resolve" />
            <KpiChip label="Top Issue Type"       value={topType.length > 14 ? topType.slice(0, 13) + '…' : topType} color={ACCENT} sub={pareto[0] ? `${pareto[0].count} occurrences` : undefined} />
          </div>

          {/* ── Two-column: Pareto + Trend ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Pareto Chart */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Top Repeating Issues</div>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 16 }}>Click a row to drill into all instances</div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {[['Critical', RED], ['Major', YELLOW], ['Minor', ACCENT]].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 10, color: MUTED }}>{label}</span>
                  </div>
                ))}
              </div>
              {pareto.length === 0
                ? <div style={{ color: MUTED, fontSize: 12, padding: 24, textAlign: 'center' }}>No issues in this period.</div>
                : <ParetoChart data={pareto} onSelect={handleParetoClick} selected={paretoSel} />
              }
            </div>

            {/* Trend Chart */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Issue Trend — Last {days} Days</div>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 16 }}>Daily issue count · dashed red = critical</div>
              <TrendChart data={trend} height={160} />
              {/* Weekday heatmap - simple row of colored circles per day */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>Daily volume (darker = more issues)</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {trend.slice(-28).map(d => {
                    const maxD = Math.max(...trend.map(x => x.count), 1)
                    const intensity = d.count / maxD
                    const bg = d.count === 0 ? BORDER
                      : d.critical > 0 ? `rgba(255,68,68,${0.2 + intensity * 0.8})`
                      : `rgba(0,212,255,${0.15 + intensity * 0.75})`
                    return (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.count} issue${d.count !== 1 ? 's' : ''}${d.critical ? ` (${d.critical} critical)` : ''}`}
                        style={{ width: 14, height: 14, borderRadius: 3, background: bg, cursor: 'default' }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── MTTR Table ── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Mean Time to Resolve — By Issue Type</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 16 }}>
              Click any row to see all issues of that type · Green &lt; 1h · Yellow 1–2h · Red &gt; 2h
            </div>
            <MTTRTable pareto={pareto} onSelect={t => setDrillType(t)} />
          </div>

          {/* ── Downtime Impact Matrix ── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>
                Downtime Cause Impact Matrix
              </div>
              <span style={{ fontSize: 9, color: DIM, background: '#21262d', borderRadius: 4, padding: '2px 7px' }}>
                oee_entries · last {days}d
              </span>
            </div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 16 }}>
              Compare how often each shift-log cause occurs with the total production minutes it removes
            </div>
            <OEECausesPanel causes={oeeCauses} />
          </div>
        </>
      )}
    </div>
  )
}
