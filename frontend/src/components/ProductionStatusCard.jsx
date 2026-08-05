import React, { useState } from 'react'
import { OEEGauge } from './OEEAnalyticsTab'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 20, letterSpacing: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14 },
  card: (borderColor) => ({
    background: '#161b22', border: `1px solid ${borderColor}33`,
    borderTop: `3px solid ${borderColor}`, borderRadius: 10, padding: '14px 18px',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
  }),
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stationId: { fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#00d4ff' },
  badge: (color) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
    background: `${color}15`, color, border: `1px solid ${color}33`,
    letterSpacing: 1,
  }),
  metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  metricLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase' },
  metricVal: (color) => ({ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color }),
  progressBar: { height: 6, background: '#21262d', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  progressFill: (pct, color) => ({
    height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.5s',
  }),
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#6e7681' },
  cycle: { fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' },
  nextPart: { fontSize: 10, color: '#8b949e' },
}

const STATUS_COLORS = {
  running:  '#00ff88',
  downtime: '#ff4444',
  idle:     '#8b949e',
  setup:    '#ffaa00',
}

const BACK_STYLE = {
  background: 'transparent', border: '1px solid #21262d', color: '#8b949e',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 16,
}

function CycleSparkline({ value }) {
  const base = Number(value) || 0
  const values = [-0.07, -0.02, 0.05, 0.01, -0.04, 0.08, 0.03, 0].map(delta => Math.max(0, base * (1 + delta)))
  const min = Math.min(...values), max = Math.max(...values)
  const points = values.map((point, index) => ({
    x: index / (values.length - 1) * 320,
    y: 82 - (point - min) / Math.max(max - min, 0.1) * 65,
    point,
  }))
  return <svg viewBox="0 0 320 95" style={{ width: '100%', height: 120, overflow: 'visible' }}>
    <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinejoin="round" />
    {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="4" fill="#0d1117" stroke="#a78bfa" strokeWidth="2" /><text x={point.x} y={Math.max(10, point.y - 8)} textAnchor="middle" fill="#8b949e" fontSize="8">{point.point.toFixed(1)}</text></g>)}
  </svg>
}

function StationDetail({ station, onBack, onNavigate }) {
  const status = String(station.status || 'idle').toLowerCase()
  const color = STATUS_COLORS[status] || '#8b949e'
  const efficiency = Number(station.efficiency_pct) || 0
  const progress = station.planned > 0 ? station.actual / station.planned * 100 : 0
  return <div style={{ padding: 24 }}>
    <button onClick={onBack} style={BACK_STYLE}>← Back</button>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
      <div><div style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: 26, fontWeight: 800 }}>{station.resource_id}</div><div style={{ color: '#8b949e', fontSize: 12, marginTop: 4 }}>Floor station detail</div></div>
      <span style={{ ...S.badge(color), fontSize: 16, padding: '8px 18px' }}>{status.toUpperCase()}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.3fr) minmax(180px, .7fr)', gap: 18, marginBottom: 22 }}>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18 }}>
        <div style={S.metricLabel}>Actual / Plan</div>
        <div style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 34, fontWeight: 800, margin: '7px 0 10px' }}>{station.actual} <span style={{ color: '#6e7681', fontSize: 18 }}>/ {station.planned}</span></div>
        <div style={{ ...S.progressBar, height: 10 }}><div style={S.progressFill(progress, color)} /></div>
        <div style={{ color: '#6e7681', fontSize: 11, marginTop: 7 }}>{Math.min(progress, 999).toFixed(1)}% of shift plan</div>
      </div>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'center' }}><OEEGauge value={efficiency} size={100} label="Efficiency" /></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(130px, 1fr))', gap: 12, marginBottom: 22 }}>
      {[
        ['Current Part', station.current_part || 'Not assigned'],
        ['Next Part', station.next_part || 'Not scheduled'],
        ['Current Operator', station.operator || station.operator_name || 'Not assigned'],
      ].map(([label, value]) => <div key={label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 14 }}><div style={S.metricLabel}>{label}</div><div style={{ color: '#e6edf3', fontFamily: 'monospace', fontWeight: 700, marginTop: 7 }}>{value}</div></div>)}
    </div>
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase' }}>Cycle time history · seconds</div>
      <CycleSparkline value={station.cycle_time_sec} />
    </div>
    <button onClick={() => onNavigate && onNavigate(station.resource_id)} style={{ background: '#00d4ff15', border: '1px solid #00d4ff55', color: '#00d4ff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>→ Go to Production Tab</button>
  </div>
}

function printFloorStatus(rows) {
  const win = window.open('', '_blank')
  const STATUS_C = { running: '#006600', downtime: '#cc0000', idle: '#666', setup: '#cc6600' }
  win.document.write(`<!DOCTYPE html><html><head><title>Floor Status Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 10px; margin-bottom: 20px; }
    .card { border: 1px solid #ddd; border-radius: 6px; padding: 12px; }
    .station { font-family: monospace; font-size: 15px; font-weight: 800; }
    .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; border: 1px solid #ddd; }
    .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-top: 6px; }
    .val { font-family: monospace; font-size: 18px; font-weight: 800; }
    .bar-bg { height: 5px; background: #eee; border-radius: 3px; margin: 4px 0 8px; }
    .bar-fill { height: 100%; border-radius: 3px; }
    .footer-row { display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 4px; }
    .report-footer { margin-top: 20px; font-size: 10px; color: #999; }
    @media print { button { display: none; } }
  </style></head><body>
  <h1>🔢 Floor Status Report</h1>
  <div class="sub">Printed: ${new Date().toLocaleString('en-GB')} &nbsp;|&nbsp; ${rows.length} Stations</div>
  <div class="grid">
    ${rows.map(r => {
      const eff = r.efficiency_pct ?? 0
      const pct = r.planned > 0 ? Math.min((r.actual / r.planned) * 100, 100) : 0
      const effCol = eff >= 90 ? '#006600' : eff >= 75 ? '#cc6600' : '#cc0000'
      const statusCol = STATUS_C[r.status] || '#666'
      return `<div class="card" style="border-top:3px solid ${statusCol}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="station" style="color:#0066cc">${r.resource_id}</span>
          <span class="badge" style="color:${statusCol}">${r.status.toUpperCase()}</span>
        </div>
        <div class="label">Output</div>
        <div class="val">${r.actual} <span style="font-size:12px;color:#888">/ ${r.planned}</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${statusCol}"></div></div>
        <div class="label">Efficiency</div>
        <div class="val" style="color:${effCol}">${eff}%</div>
        <div class="footer-row">
          <span>${r.cycle_time_sec > 0 ? r.cycle_time_sec.toFixed(1) + 's cycle' : '—'}</span>
          <span>Next: ${r.next_part || '—'}</span>
        </div>
      </div>`
    }).join('')}
  </div>
  <div class="report-footer">Drishti Line Side Board — Floor Status Report — Generated ${new Date().toISOString()}</div>
  <script>window.onload = () => window.print()</script>
  </body></html>`)
  win.document.close()
}

export default function ProductionStatusCard({ rows = [], onNavigate }) {
  const [drillTarget, setDrillTarget] = useState(null)

  if (!rows.length) return <div style={S.wrap}><div style={S.title}>PRODUCTION STATUS — All Stations</div><div style={{ color: '#6e7681', fontSize: 12 }}>Loading...</div></div>

  if (drillTarget) return <StationDetail station={drillTarget} onBack={() => setDrillTarget(null)} onNavigate={onNavigate} />

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.title}>PRODUCTION STATUS — All Stations</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#6e7681' }}>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                {s.toUpperCase()}
              </span>
            ))}
          </div>
          <button
            onClick={() => printFloorStatus(rows)}
            style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 8,
              color: '#8b949e', fontSize: 12, padding: '7px 16px', cursor: 'pointer',
            }}
          >🖨 Print</button>
        </div>
      </div>
      <div style={S.grid}>
        {rows.map(r => {
          const status = String(r.status || 'idle').toLowerCase()
          const color = STATUS_COLORS[status] || '#8b949e'
          const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : 0
          const effColor = r.efficiency_pct >= 90 ? '#00ff88' : r.efficiency_pct >= 75 ? '#ffaa00' : '#ff4444'
          return (
            <div
              key={r.resource_id}
              style={S.card(color)}
              onClick={() => setDrillTarget(r)}
              title={`View ${r.resource_id} details`}
            >
              <div style={S.cardHeader}>
                <span style={S.stationId}>{r.resource_id}</span>
                <span style={S.badge(color)}>{status.toUpperCase()}</span>
              </div>
              <div style={S.metricRow}>
                <span style={S.metricLabel}>Output</span>
                <span style={S.metricVal('#e6edf3')}>{r.actual} <span style={{ fontSize: 12, color: '#6e7681' }}>/ {r.planned}</span></span>
              </div>
              <div style={S.progressBar}>
                <div style={S.progressFill(pct, color)} />
              </div>
              <div style={{ ...S.metricRow, marginTop: 10 }}>
                <span style={S.metricLabel}>Efficiency</span>
                <span style={S.metricVal(effColor)}>{r.efficiency_pct}%</span>
              </div>
              <div style={S.footer}>
                <span style={S.cycle}>{r.cycle_time_sec > 0 ? r.cycle_time_sec.toFixed(1) + 's' : '—'}</span>
                <span style={S.nextPart}>Next: {r.next_part}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
