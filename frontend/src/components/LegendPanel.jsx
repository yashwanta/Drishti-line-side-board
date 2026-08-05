import React from 'react'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 24, letterSpacing: 1 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 12, color: '#8b949e', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 12,
    borderBottom: '1px solid #21262d', paddingBottom: 8,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12 },
  card: (color) => ({
    background: '#161b22', border: `1px solid ${color}44`,
    borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '12px 16px',
  }),
  chip: (color) => ({
    display: 'inline-block', width: 16, height: 16, borderRadius: 4,
    background: color, marginRight: 8, verticalAlign: 'middle',
  }),
  colorName: { fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 4 },
  colorDesc: { fontSize: 12, color: '#8b949e', lineHeight: 1.5 },
  usage: { fontSize: 11, color: '#6e7681', marginTop: 4 },
  badgeRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  badge: (color) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
    background: `${color}15`, color, border: `1px solid ${color}44`,
    letterSpacing: 0.5,
  }),
}

const STATUS_COLORS = [
  {
    color: '#00ff88', name: 'Green — Running / Good',
    desc: 'Station is actively running or metric is healthy and on target.',
    usage: 'Efficiency ≥ 90% · FPY ≥ 99% · OEE ≥ 85% · All issues resolved',
    badges: [
      { label: 'RUNNING', color: '#00ff88' },
      { label: 'PASS', color: '#00ff88' },
      { label: 'ONTIME', color: '#00ff88' },
    ],
  },
  {
    color: '#00d4ff', name: 'Cyan — Primary KPI',
    desc: 'Primary production metric. Represents count, quantity, or primary output.',
    usage: 'Actual/Plan count · Stations count · KPI values',
    badges: [],
  },
  {
    color: '#ffaa00', name: 'Amber — Warning',
    desc: 'Metric is below target but not critical. Needs attention soon.',
    usage: 'Efficiency 75–90% · FPY 95–99% · OEE 65–85% · 1–2 open issues',
    badges: [
      { label: 'SETUP', color: '#ffaa00' },
      { label: 'PENDING', color: '#ffaa00' },
      { label: 'IN_PROGRESS', color: '#ffaa00' },
    ],
  },
  {
    color: '#ff4444', name: 'Red — Critical / Downtime',
    desc: 'Station is stopped or metric is critically below target. Immediate action required.',
    usage: 'Efficiency < 75% · FPY < 95% · OEE < 65% · 3+ open issues · Machine down',
    badges: [
      { label: 'DOWNTIME', color: '#ff4444' },
      { label: 'FAIL', color: '#ff4444' },
      { label: 'LATE', color: '#ff4444' },
    ],
  },
  {
    color: '#8b949e', name: 'Gray — Idle / Unknown',
    desc: 'Station is idle, unconfirmed, or no data available yet.',
    usage: 'Station idle · Shift not started · No cycles recorded',
    badges: [
      { label: 'IDLE', color: '#8b949e' },
      { label: 'UNKNOWN', color: '#8b949e' },
      { label: 'SHIPPED', color: '#8b949e' },
    ],
  },
  {
    color: '#a78bfa', name: 'Purple — Cycle Time / Technical',
    desc: 'Secondary process parameter. Informational — not a pass/fail indicator.',
    usage: 'Avg cycle time · Robot press avg force · Technical measurements',
    badges: [],
  },
  {
    color: '#fb923c', name: 'Orange — Time / Duration',
    desc: 'Time-based metric. Represents elapsed or scheduled time.',
    usage: 'Hours worked · Cycle time · Downtime minutes',
    badges: [],
  },
]

export default function LegendPanel() {
  return (
    <div style={S.wrap}>
      <div style={S.title}>COLOR LEGEND — What Each Color Means</div>

      {/* Status color grid */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Status Colors</div>
        <div style={S.grid}>
          {STATUS_COLORS.map(item => (
            <div key={item.color} style={S.card(item.color)}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <div style={S.chip(item.color)} />
                <div style={{ fontSize: 12, color: '#6e7681', fontFamily: 'monospace' }}>{item.color}</div>
              </div>
              <div style={S.colorName}>{item.name}</div>
              <div style={S.colorDesc}>{item.desc}</div>
              <div style={S.usage}>{item.usage}</div>
              {item.badges.length > 0 && (
                <div style={S.badgeRow}>
                  {item.badges.map(b => (
                    <span key={b.label} style={S.badge(b.color)}>{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Station status legend */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Station Status Indicators</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { status: 'running', dot: '#00ff88', desc: 'Machine is actively producing parts' },
            { status: 'downtime', dot: '#ff4444', desc: 'Machine is stopped — breakdown, maintenance, or changeover' },
            { status: 'idle', dot: '#8b949e', desc: 'Machine is idle — shift not started or no plan loaded' },
            { status: 'setup', dot: '#ffaa00', desc: 'Machine is in setup or adjustment phase' },
          ].map(s => (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot }} />
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#00d4ff', fontWeight: 700 }}>{s.status.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Efficiency thresholds */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Efficiency / FPY / OEE Thresholds</div>
        <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0d1117' }}>
                {['Metric', 'Green (Good)', 'Amber (Warning)', 'Red (Critical)'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#8b949e', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', borderBottom: '1px solid #21262d' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Efficiency %', '≥ 90%', '75 – 90%', '< 75%'],
                ['First Pass Yield %', '≥ 99%', '95 – 99%', '< 95%'],
                ['OEE %', '≥ 85%', '65 – 85%', '< 65%'],
                ['Open Issues', '0', '1 – 2', '3+'],
                ['Cycle Time', 'At or below target', 'Up to 10% over', '> 10% over'],
              ].map(([metric, good, warn, crit], i) => (
                <tr key={metric} style={{ background: i % 2 === 0 ? '#0d1117' : '#161b2280' }}>
                  <td style={{ padding: '10px 14px', color: '#e6edf3', fontWeight: 600 }}>{metric}</td>
                  <td style={{ padding: '10px 14px', color: '#00ff88' }}>{good}</td>
                  <td style={{ padding: '10px 14px', color: '#ffaa00' }}>{warn}</td>
                  <td style={{ padding: '10px 14px', color: '#ff4444' }}>{crit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
