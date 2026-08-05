import React from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const OEE_TARGET = 85
const box = { background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18 }
const mono = "'Courier New', monospace"

const FALLBACK_ROWS = [
  { day: 'Mon', plan: 1700, actual: 1540, good_count: 1524, scrap_count: 16, efficiency_pct: 88.6, downtime_mins: 34, oee_pct: 82.4, top_issue: 'Tool changeovers' },
  { day: 'Tue', plan: 1750, actual: 1685, good_count: 1673, scrap_count: 12, efficiency_pct: 92.1, downtime_mins: 18, oee_pct: 87.8, top_issue: 'No major issue' },
  { day: 'Wed', plan: 1700, actual: 1268, good_count: 1241, scrap_count: 27, efficiency_pct: 79.4, downtime_mins: 83, oee_pct: 74.6, top_issue: 'Equipment downtime' },
  { day: 'Thu', plan: 1800, actual: 1762, good_count: 1753, scrap_count: 9, efficiency_pct: 94.8, downtime_mins: 12, oee_pct: 90.9, top_issue: 'No major issue' },
  { day: 'Fri', plan: 1750, actual: 1598, good_count: 1574, scrap_count: 24, efficiency_pct: 89.2, downtime_mins: 39, oee_pct: 84.3, top_issue: 'Quality / scrap' },
  { day: 'Sat', plan: 1650, actual: 1384, good_count: 1371, scrap_count: 13, efficiency_pct: 83.5, downtime_mins: 61, oee_pct: 78.7, top_issue: 'Material delay' },
  { day: 'Sun', plan: 1700, actual: 1651, good_count: 1640, scrap_count: 11, efficiency_pct: 91.0, downtime_mins: 25, oee_pct: 86.1, top_issue: 'Minor stops' },
]

function numberOr(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function oeeColor(value) {
  if (value >= OEE_TARGET) return '#00ff88'
  if (value >= 75) return '#ffaa00'
  return '#ff4444'
}

function deriveOEE(row) {
  const supplied = Number(row.oee_pct ?? row.oee)
  if (Number.isFinite(supplied)) return supplied

  const actual = numberOr(row.actual ?? row.parts)
  const plan = numberOr(row.plan)
  const efficiency = numberOr(row.efficiency_pct, plan > 0 ? (actual / plan) * 100 : 0)
  const downtime = numberOr(row.downtime_mins)
  const availability = Math.max(0, Math.min(1, 1 - downtime / (8 * 60)))
  const good = numberOr(row.good_count, actual - numberOr(row.scrap_count))
  const total = good + numberOr(row.scrap_count)
  const quality = total > 0 ? good / total : 1
  return efficiency * availability * quality
}

function topIssue(row) {
  if (row.top_issue) return row.top_issue
  const downtime = numberOr(row.downtime_mins)
  const scrap = numberOr(row.scrap_count)
  const actual = numberOr(row.actual)
  const plan = numberOr(row.plan)
  if (downtime >= 60) return 'Equipment downtime'
  if (scrap >= 20) return 'Quality / scrap'
  if (plan > 0 && actual < plan * 0.9) return 'Production shortfall'
  if (downtime >= 30) return 'Minor stops'
  return 'No major issue'
}

function normaliseRow(row, index) {
  const actual = numberOr(row.actual ?? row.parts)
  const plan = numberOr(row.plan, actual)
  const scrap = numberOr(row.scrap_count)
  const good = numberOr(row.good_count, Math.max(0, actual - scrap))
  const efficiency = numberOr(row.efficiency_pct, plan > 0 ? (actual / plan) * 100 : 0)
  return {
    ...row,
    day: row.day || row.date || `Day ${index + 1}`,
    plan,
    actual,
    good_count: good,
    scrap_count: scrap,
    efficiency_pct: efficiency,
    downtime_mins: numberOr(row.downtime_mins),
    oee_pct: Math.max(0, Math.min(100, deriveOEE(row))),
    top_issue: topIssue(row),
  }
}

function OEETrendChart({ rows }) {
  const width = 700
  const height = 120
  const left = 30
  const right = 18
  const top = 18
  const bottom = 25
  const minY = 65
  const maxY = 100
  const xFor = index => left + (index / Math.max(rows.length - 1, 1)) * (width - left - right)
  const yFor = value => top + ((maxY - value) / (maxY - minY)) * (height - top - bottom)
  const points = rows.map((row, index) => `${xFor(index)},${yFor(row.oee_pct)}`).join(' ')
  const targetY = yFor(OEE_TARGET)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="120"
      role="img"
      aria-label="Seven-day OEE percentage trend"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <line x1={left} y1={targetY} x2={width - right} y2={targetY} stroke="#ffaa00" strokeWidth="1" strokeDasharray="6 5" opacity="0.8" />
      <text x={width - right} y={targetY - 5} fill="#ffaa00" fontSize="9" textAnchor="end" fontFamily={mono}>85% TARGET</text>
      <polyline points={points} fill="none" stroke="#00d4ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((row, index) => {
        const x = xFor(index)
        const y = yFor(row.oee_pct)
        const color = oeeColor(row.oee_pct)
        return (
          <g key={`${row.day}-${index}`}>
            <circle cx={x} cy={y} r="5" fill="#0a0e14" stroke={color} strokeWidth="3" />
            <text x={x} y={Math.max(10, y - 9)} fill={color} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily={mono}>
              {row.oee_pct.toFixed(1)}%
            </text>
            <text x={x} y={height - 5} fill="#8b949e" fontSize="10" textAnchor="middle">{row.day}</text>
          </g>
        )
      })}
    </svg>
  )
}

function SummaryTile({ label, day, value, color }) {
  return (
    <div style={{
      background: '#161b22', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`,
      borderRadius: 10, padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 7 }}>
        <span style={{ color: '#e6edf3', fontSize: 12 }}>{day}</span>
        <span style={{ color, fontSize: 28, fontWeight: 800, fontFamily: mono, lineHeight: 1 }}>{value.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const th = {
  background: '#161b22', color: '#8b949e', fontSize: 10, fontWeight: 700,
  letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'left', padding: '10px 12px',
  borderBottom: '1px solid #21262d', whiteSpace: 'nowrap',
}
const td = { padding: '11px 12px', borderBottom: '1px solid #21262d55', color: '#e6edf3', fontSize: 12 }

export default function WeeklyPanel({ data = {}, resource, selectedDate = new Date() }) {
  const weekStart = new Date(selectedDate)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const startLabel = weekStart.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).replace(',', '')
  const endLabel = weekEnd.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '')
  const weekLabel = `Week of ${startLabel} – ${endLabel}`
  const suppliedRows = Array.isArray(data) ? data : Array.isArray(data?.days) ? data.days : []
  const usingFallback = suppliedRows.length === 0
  const rows = (usingFallback ? FALLBACK_ROWS : suppliedRows).slice(0, 7).map(normaliseRow)
  const total = key => rows.reduce((sum, row) => sum + numberOr(row[key]), 0)
  const plan = total('plan')
  const actual = total('actual')
  const efficiency = plan > 0 ? (actual / plan) * 100 : 0
  const best = rows.reduce((current, row) => row.oee_pct > current.oee_pct ? row : current, rows[0])
  const worst = rows.reduce((current, row) => row.oee_pct < current.oee_pct ? row : current, rows[0])
  const averageOEE = total('oee_pct') / rows.length
  const stats = [
    ['WEEKLY PLAN', plan, '#8b949e'], ['ACTUAL', actual, '#00d4ff'],
    ['GOOD PARTS', total('good_count'), '#00ff88'], ['EFFICIENCY', `${efficiency.toFixed(1)}%`, efficiency >= 90 ? '#00ff88' : '#ffaa00'],
    ['SCRAP', total('scrap_count'), '#ff6b6b'], ['DOWNTIME', `${total('downtime_mins')} min`, '#a78bfa'],
  ]
  const tooltip = { background: '#161b22', border: '1px solid #30363d' }

  return (
    <div style={{ padding: 24, background: '#0a0e14' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ color: '#e6edf3', letterSpacing: 1, fontWeight: 700 }}>{weekLabel} <span style={{ color: '#8b949e' }}>— {resource}</span></div>
        {usingFallback && <div style={{ color: '#ffaa00', fontSize: 10, letterSpacing: 1 }}>DEMO DATA — WAITING FOR WEEKLY HISTORY</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12, marginBottom: 18 }}>
        {stats.map(([label, value, color]) => (
          <div key={label} style={{ ...box, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 5, fontFamily: mono }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
        <SummaryTile label="Best Day" day={best.day} value={best.oee_pct} color="#00ff88" />
        <SummaryTile label="Worst Day" day={worst.day} value={worst.oee_pct} color="#ff4444" />
        <SummaryTile label="Week Average" day="7-day mean" value={averageOEE} color={oeeColor(averageOEE)} />
      </div>

      <div style={{ ...box, padding: '14px 18px 8px', marginBottom: 18 }}>
        <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>OEE Trend</div>
        <OEETrendChart rows={rows} />
      </div>

      <div style={{ ...box, padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', color: '#e6edf3', fontSize: 13, fontWeight: 700, borderBottom: '1px solid #21262d' }}>Day-by-Day Breakdown</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr><th style={th}>Day</th><th style={th}>OEE %</th><th style={th}>Parts</th><th style={th}>Efficiency</th><th style={th}>Top Issue</th></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.day}-${index}`} style={{ background: index % 2 === 0 ? '#0d1117' : '#161b2280' }}>
                  <td style={{ ...td, color: '#00d4ff', fontWeight: 700 }}>{row.day}</td>
                  <td style={{ ...td, color: oeeColor(row.oee_pct), fontFamily: mono, fontWeight: 800 }}>{row.oee_pct.toFixed(1)}%</td>
                  <td style={{ ...td, fontFamily: mono }}>{row.actual.toLocaleString()}</td>
                  <td style={{ ...td, fontFamily: mono, color: row.efficiency_pct >= 90 ? '#00ff88' : row.efficiency_pct >= 75 ? '#ffaa00' : '#ff4444' }}>{row.efficiency_pct.toFixed(1)}%</td>
                  <td style={{ ...td, color: row.top_issue === 'No major issue' ? '#6e7681' : '#e6edf3' }}>{row.top_issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18 }}>
        <div style={box}>
          <div style={{ color: '#e6edf3', marginBottom: 12 }}>Plan vs Actual</div>
          <ResponsiveContainer width="100%" height={300}><BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" /><XAxis dataKey="day" tick={{ fill: '#8b949e' }} /><YAxis tick={{ fill: '#8b949e' }} />
            <Tooltip contentStyle={tooltip} /><Legend /><Bar dataKey="plan" name="Plan" fill="#30363d" /><Bar dataKey="actual" name="Actual" fill="#00d4ff" />
          </BarChart></ResponsiveContainer>
        </div>
        <div style={box}>
          <div style={{ color: '#e6edf3', marginBottom: 12 }}>Efficiency & Downtime</div>
          <ResponsiveContainer width="100%" height={300}><LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" /><XAxis dataKey="day" tick={{ fill: '#8b949e' }} /><YAxis tick={{ fill: '#8b949e' }} />
            <Tooltip contentStyle={tooltip} /><Legend /><Line type="monotone" dataKey="efficiency_pct" name="Efficiency %" stroke="#00ff88" strokeWidth={3} />
            <Line type="monotone" dataKey="downtime_mins" name="Downtime min" stroke="#ff6b6b" strokeWidth={2} />
          </LineChart></ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
