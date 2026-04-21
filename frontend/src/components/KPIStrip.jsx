import React from 'react'

const S = {
  strip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    padding: '16px 24px',
    background: '#0d1117',
    borderBottom: '1px solid #21262d',
  },
  tile: (accent) => ({
    background: '#161b22',
    border: `1px solid ${accent}33`,
    borderTop: `3px solid ${accent}`,
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.3s',
  }),
  label: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 },
  value: (accent) => ({ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1, fontFamily: "'Courier New', monospace" }),
  subtext: { fontSize: 11, color: '#8b949e' },
  badge: (ok) => ({
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
    background: ok ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,68,0.12)',
    color: ok ? '#00ff88' : '#ff4444',
    border: `1px solid ${ok ? '#00ff88' : '#ff4444'}44`,
  }),
}

function Tile({ label, value, sub, accent = '#00d4ff', badge, badgeOk }) {
  return (
    <div style={S.tile(accent)}>
      <div style={S.label}>{label}</div>
      <div style={S.value(accent)}>{value ?? '—'}</div>
      {badge != null
        ? <span style={S.badge(badgeOk)}>{badge}</span>
        : <div style={S.subtext}>{sub}</div>
      }
    </div>
  )
}

export default function KPIStrip({ kpis = {}, marsKpis = {} }) {
  const {
    actual = 0, plan = 0,
    efficiency_pct = 0,
    fpy_pct = 0,
    avg_cycle_sec = 0,
    hours_worked = 0,
    open_issues = 0,
    jph_target = 23,
  } = kpis

  const gap = actual - plan

  return (
    <div style={S.strip}>
      <Tile
        label="Actual / Plan"
        value={`${actual} / ${plan}`}
        accent="#00d4ff"
        badge={gap >= 0 ? `+${gap} ahead` : `${gap} behind`}
        badgeOk={gap >= 0}
      />
      <Tile
        label="Efficiency %"
        value={`${efficiency_pct}%`}
        accent={efficiency_pct >= 90 ? '#00ff88' : efficiency_pct >= 75 ? '#ffaa00' : '#ff4444'}
        sub={`JPH Target: ${jph_target}`}
      />
      <Tile
        label="First Pass Yield %"
        value={`${fpy_pct}%`}
        accent={fpy_pct >= 99 ? '#00ff88' : fpy_pct >= 95 ? '#ffaa00' : '#ff4444'}
        sub="Good / (Good + Scrap)"
      />
      <Tile
        label="Avg Cycle Time"
        value={avg_cycle_sec > 0 ? `${avg_cycle_sec}s` : '—'}
        accent="#a78bfa"
        sub={jph_target > 0 ? `Target: ${Math.round(3600 / jph_target)}s` : ''}
      />
      <Tile
        label="Hours Worked"
        value={hours_worked > 0 ? `${hours_worked}h` : '—'}
        accent="#fb923c"
        sub="Current shift"
      />
      <Tile
        label="Open Issues"
        value={open_issues}
        accent={open_issues === 0 ? '#00ff88' : open_issues <= 2 ? '#ffaa00' : '#ff4444'}
        badge={open_issues === 0 ? 'All Clear' : `${open_issues} Active`}
        badgeOk={open_issues === 0}
      />
      {marsKpis.oee_pct != null && (
        <Tile
          label="OEE % (MARS)"
          value={`${marsKpis.oee_pct}%`}
          accent={marsKpis.oee_pct >= 85 ? '#00ff88' : marsKpis.oee_pct >= 65 ? '#ffaa00' : '#ff4444'}
          sub={`WO: ${marsKpis.work_order || 'N/A'}`}
        />
      )}
    </div>
  )
}
