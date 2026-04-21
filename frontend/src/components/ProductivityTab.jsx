import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 20, letterSpacing: 1 },
  chartBox: {
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: 10,
    padding: '24px 12px 12px',
    marginBottom: 24,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: 8,
    padding: '12px 16px',
    textAlign: 'center',
  },
  statLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1, marginBottom: 4 },
  statVal: (color) => ({ fontSize: 22, fontWeight: 800, color: color || '#00d4ff', fontFamily: 'monospace' }),
  empty: { padding: 48, textAlign: 'center', color: '#8b949e' },
}

const TooltipContent = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#8b949e', marginBottom: 6 }}>{`${label}:00`}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></div>
      ))}
      {payload.length >= 2 && (
        <div style={{ color: payload[0].value >= payload[1].value ? '#00ff88' : '#ff4444', marginTop: 4 }}>
          Gap: {payload[0].value - (payload[1]?.value ?? 0)}
        </div>
      )}
    </div>
  )
}

export default function ProductivityTab({ rows = [] }) {
  if (!rows.length) {
    return <div style={S.wrap}><div style={S.empty}>No productivity data yet for today.</div></div>
  }

  const avgEff = rows.length
    ? (rows.reduce((s, r) => s + r.efficiency_pct, 0) / rows.length).toFixed(1)
    : 0

  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const totalTarget = rows.reduce((s, r) => s + r.target, 0)
  const bestHour = rows.reduce((b, r) => r.actual > (b?.actual ?? -1) ? r : b, null)
  const worstHour = rows.reduce((b, r) => r.actual < (b?.actual ?? Infinity) ? r : b, null)

  return (
    <div style={S.wrap}>
      <div style={S.title}>HOURLY PRODUCTIVITY — Target vs Actual</div>

      <div style={S.chartBox}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="hour"
              tickFormatter={h => `${String(h).padStart(2,'0')}:00`}
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend
              wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
              formatter={v => <span style={{ color: '#8b949e' }}>{v}</span>}
            />
            <ReferenceLine y={rows[0]?.target} stroke="#ffaa00" strokeDasharray="4 4" label={{ value: 'JPH Target', fill: '#ffaa00', fontSize: 10 }} />
            <Bar dataKey="target" name="Target" fill="#21262d" radius={[3, 3, 0, 0]}>
              {rows.map((_, i) => <Cell key={i} fill="#21262d" />)}
            </Bar>
            <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
              {rows.map((r, i) => (
                <Cell
                  key={i}
                  fill={r.actual >= r.target ? '#00ff88' : r.actual >= r.target * 0.85 ? '#ffaa00' : '#ff4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={S.statsRow}>
        <div style={S.statCard}>
          <div style={S.statLabel}>AVG EFFICIENCY</div>
          <div style={S.statVal(avgEff >= 90 ? '#00ff88' : avgEff >= 75 ? '#ffaa00' : '#ff4444')}>{avgEff}%</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>TOTAL ACTUAL</div>
          <div style={S.statVal('#00d4ff')}>{totalActual}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>TOTAL TARGET</div>
          <div style={S.statVal('#8b949e')}>{totalTarget}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>BEST HOUR</div>
          <div style={S.statVal('#00ff88')}>{bestHour ? `${String(bestHour.hour).padStart(2,'0')}:00` : '—'}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>WORST HOUR</div>
          <div style={S.statVal('#ff4444')}>{worstHour ? `${String(worstHour.hour).padStart(2,'0')}:00` : '—'}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>HOURS LOGGED</div>
          <div style={S.statVal('#a78bfa')}>{rows.length}</div>
        </div>
      </div>
    </div>
  )
}
