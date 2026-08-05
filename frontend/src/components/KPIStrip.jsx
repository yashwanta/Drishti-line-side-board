import React, { useRef, useEffect } from 'react'

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
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    userSelect: 'none',
    position: 'relative',
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
  trend: (dir) => ({
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 12,
    fontWeight: 700,
    color: dir === 'up' ? '#00ff88' : dir === 'down' ? '#ff4444' : '#6e7681',
  }),
}

// dir: 'up' | 'down' | 'flat' | null
function TrendArrow({ dir }) {
  if (!dir) return null
  const symbol = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '─'
  return <span style={S.trend(dir)} title={`Trend: ${dir}`}>{symbol}</span>
}

function Tile({ label, value, sub, accent = '#00d4ff', badge, badgeOk, onClick, trend }) {
  return (
    <div style={S.tile(accent)} onClick={onClick} title={onClick ? `Go to ${label}` : undefined}>
      <TrendArrow dir={trend} />
      <div style={S.label}>{label}</div>
      <div style={S.value(accent)}>{value ?? '—'}</div>
      {badge != null
        ? <span style={S.badge(badgeOk)}>{badge}</span>
        : <div style={S.subtext}>{sub}</div>
      }
    </div>
  )
}

function calcTrend(curr, prev, higherIsBetter = true) {
  if (prev == null || curr == null || curr === prev) return 'flat'
  const up = curr > prev
  return (up === higherIsBetter) ? 'up' : 'down'
}

export default function KPIStrip({ kpis = {}, marsKpis = {}, onTileClick }) {
  const {
    actual = 0, plan = 0,
    efficiency_pct = 0,
    fpy_pct = 0,
    avg_cycle_sec = 0,
    hours_worked = 0,
    open_issues = 0,
    jph_target = 23,
  } = kpis

  // Track previous KPI snapshot for trend arrows
  const prevRef = useRef(null)
  const prev = prevRef.current
  useEffect(() => {
    if (actual !== 0 || efficiency_pct !== 0) {
      prevRef.current = { actual, efficiency_pct, fpy_pct, avg_cycle_sec, open_issues }
    }
  }, [actual, efficiency_pct, fpy_pct, avg_cycle_sec, open_issues])

  const gap = actual - plan

  return (
    <div style={S.strip}>
      <Tile
        label="Actual / Plan"
        value={`${actual} / ${plan}`}
        accent="#00d4ff"
        badge={gap >= 0 ? `+${gap} ahead` : `${gap} behind`}
        badgeOk={gap >= 0}
        trend={calcTrend(actual, prev?.actual)}
        onClick={() => onTileClick && onTileClick('production')}
      />
      <Tile
        label="Efficiency %"
        value={`${efficiency_pct}%`}
        accent={efficiency_pct >= 90 ? '#00ff88' : efficiency_pct >= 75 ? '#ffaa00' : '#ff4444'}
        sub={`JPH Target: ${jph_target}`}
        trend={calcTrend(efficiency_pct, prev?.efficiency_pct)}
        onClick={() => onTileClick && onTileClick('productivity')}
      />
      <Tile
        label="First Pass Yield %"
        value={`${fpy_pct}%`}
        accent={fpy_pct >= 99 ? '#00ff88' : fpy_pct >= 95 ? '#ffaa00' : '#ff4444'}
        sub="Good / (Good + Scrap)"
        trend={calcTrend(fpy_pct, prev?.fpy_pct)}
        onClick={() => onTileClick && onTileClick('productivity')}
      />
      <Tile
        label="Avg Cycle Time"
        value={avg_cycle_sec > 0 ? `${avg_cycle_sec}s` : '—'}
        accent="#a78bfa"
        sub={jph_target > 0 ? `Target: ${Math.round(3600 / jph_target)}s` : ''}
        trend={calcTrend(avg_cycle_sec, prev?.avg_cycle_sec, false /* lower is better */)}
        onClick={() => onTileClick && onTileClick('production')}
      />
      <Tile
        label="Hours Worked"
        value={hours_worked > 0 ? `${hours_worked}h` : '—'}
        accent="#fb923c"
        sub="Current shift"
        onClick={() => onTileClick && onTileClick('downtime')}
      />
      <Tile
        label="Open Issues"
        value={open_issues}
        accent={open_issues === 0 ? '#00ff88' : open_issues <= 2 ? '#ffaa00' : '#ff4444'}
        badge={open_issues === 0 ? 'All Clear' : `${open_issues} Active`}
        badgeOk={open_issues === 0}
        trend={calcTrend(open_issues, prev?.open_issues, false /* lower is better */)}
        onClick={() => onTileClick && onTileClick('issues')}
      />
      {marsKpis.oee_pct != null && (
        <Tile
          label="OEE % (MARS)"
          value={`${marsKpis.oee_pct}%`}
          accent={marsKpis.oee_pct >= 85 ? '#00ff88' : marsKpis.oee_pct >= 65 ? '#ffaa00' : '#ff4444'}
          sub={`WO: ${marsKpis.work_order || 'N/A'}`}
          onClick={() => onTileClick && onTileClick('mars')}
        />
      )}
    </div>
  )
}
