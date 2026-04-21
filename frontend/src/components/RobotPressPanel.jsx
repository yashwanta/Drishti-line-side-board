import React from 'react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 20, letterSpacing: 1 },
  offline: {
    background: '#161b22', border: '1px solid #ff444433', borderRadius: 10,
    padding: 32, textAlign: 'center', color: '#ff4444', fontSize: 14,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  gridSmall: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16 },

  // Big force gauge card
  gaugeCard: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
    padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  gaugeLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase' },
  forceVal: (pf) => ({
    fontFamily: "'Courier New', monospace",
    fontSize: 56,
    fontWeight: 900,
    lineHeight: 1,
    color: pf === 'PASS' ? '#00ff88' : pf === 'FAIL' ? '#ff4444' : '#ffaa00',
    textShadow: `0 0 30px ${pf === 'PASS' ? '#00ff88' : pf === 'FAIL' ? '#ff4444' : '#ffaa00'}55`,
  }),
  forceUnit: { fontSize: 16, color: '#8b949e' },
  pfBadge: (pf) => ({
    padding: '6px 24px',
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 3,
    background: pf === 'PASS' ? 'rgba(0,255,136,0.15)' : pf === 'FAIL' ? 'rgba(255,68,68,0.15)' : 'rgba(255,170,0,0.15)',
    color: pf === 'PASS' ? '#00ff88' : pf === 'FAIL' ? '#ff4444' : '#ffaa00',
    border: `1px solid ${pf === 'PASS' ? '#00ff88' : pf === 'FAIL' ? '#ff4444' : '#ffaa00'}55`,
  }),
  toleranceBar: { width: '100%' },

  // Stats cards
  statCard: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '16px 20px',
  },
  statLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  statVal: (color) => ({ fontFamily: 'monospace', fontSize: 32, fontWeight: 800, color }),
  statSub: { fontSize: 11, color: '#6e7681', marginTop: 4 },

  // Force range bar
  rangeWrap: { marginTop: 8, width: '100%' },
  rangeLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6e7681', marginBottom: 4 },
  rangeTrack: { height: 8, background: '#21262d', borderRadius: 4, position: 'relative', overflow: 'hidden' },
  rangeFill: (pct, pf) => ({
    position: 'absolute', left: 0, top: 0,
    height: '100%',
    width: `${Math.min(pct, 100)}%`,
    background: pf === 'PASS' ? '#00ff88' : '#ff4444',
    borderRadius: 4,
    transition: 'width 0.5s',
  }),

  // Alarm
  alarmBox: {
    background: 'rgba(255,68,68,0.08)', border: '1px solid #ff444444',
    borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
  },
  alarmCode: { fontSize: 13, fontWeight: 700, color: '#ff4444' },
  alarmDesc: { fontSize: 12, color: '#ffaaaa' },

  separator: { gridColumn: '1/-1', height: 1, background: '#21262d', margin: '4px 0' },
  pollMeta: { fontSize: 10, color: '#6e7681', textAlign: 'right', marginTop: 12 },
}

export default function RobotPressPanel({ data = {} }) {
  const {
    peak_force_kn = 0,
    pass_fail = 'UNKNOWN',
    force_min_kn = 12,
    force_max_kn = 18,
    program = '—',
    alarm_code = '',
    alarm_desc = '',
    cycles_today = 0,
    passes_today = 0,
    fails_today = 0,
    pass_rate_pct = 0,
    min_force_today_kn = 0,
    max_force_today_kn = 0,
    avg_force_today_kn = 0,
    last_poll_ts = null,
    pendant_online = false,
  } = data

  const forceRange = force_max_kn - force_min_kn || 1
  const forcePct = Math.max(0, Math.min(100, (peak_force_kn - force_min_kn) / forceRange * 100))

  return (
    <div style={S.wrap}>
      <div style={S.title}>ROBOT AIR PRESS — Live Status  {!pendant_online && <span style={{ color: '#ff4444', marginLeft: 8 }}>⚠ PENDANT OFFLINE</span>}</div>

      {!pendant_online && peak_force_kn === 0 ? (
        <div style={S.offline}>
          ⚠ Robot air press pendant is not reachable.<br/>
          Check ROBOT_PRESS_URL in backend-java/src/main/resources/application.properties
        </div>
      ) : (
        <>
          {/* Top row: force gauge + stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 16 }}>
            {/* Force gauge */}
            <div style={S.gaugeCard}>
              <div style={S.gaugeLabel}>Peak Force — Last Cycle</div>
              <div style={S.forceVal(pass_fail)}>
                {peak_force_kn > 0 ? peak_force_kn.toFixed(2) : '—'}
              </div>
              <div style={S.forceUnit}>kN</div>
              <div style={S.pfBadge(pass_fail)}>{pass_fail}</div>
              <div style={S.rangeWrap}>
                <div style={S.rangeLabel}>
                  <span>{force_min_kn} kN min</span>
                  <span>{force_max_kn} kN max</span>
                </div>
                <div style={S.rangeTrack}>
                  <div style={S.rangeFill(forcePct, pass_fail)} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6e7681' }}>Program: {program}</div>
            </div>

            {/* Today stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={S.statCard}>
                <div style={S.statLabel}>Cycles Today</div>
                <div style={S.statVal('#00d4ff')}>{cycles_today}</div>
                <div style={S.statSub}>total press cycles</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>Pass Rate</div>
                <div style={S.statVal(pass_rate_pct >= 99 ? '#00ff88' : pass_rate_pct >= 95 ? '#ffaa00' : '#ff4444')}>
                  {pass_rate_pct}%
                </div>
                <div style={S.statSub}>{passes_today} pass / {fails_today} fail</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>Avg Force</div>
                <div style={S.statVal('#a78bfa')}>{avg_force_today_kn > 0 ? avg_force_today_kn.toFixed(2) : '—'}</div>
                <div style={S.statSub}>kN average today</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>Min Force</div>
                <div style={S.statVal('#8b949e')}>{min_force_today_kn > 0 ? min_force_today_kn.toFixed(2) : '—'}</div>
                <div style={S.statSub}>kN lowest today</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>Max Force</div>
                <div style={S.statVal('#fb923c')}>{max_force_today_kn > 0 ? max_force_today_kn.toFixed(2) : '—'}</div>
                <div style={S.statSub}>kN highest today</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>Tolerance Band</div>
                <div style={{ ...S.statVal('#00d4ff'), fontSize: 18, paddingTop: 4 }}>
                  {force_min_kn}–{force_max_kn}
                </div>
                <div style={S.statSub}>kN acceptable range</div>
              </div>
            </div>
          </div>

          {/* Alarm */}
          {alarm_code && (
            <div style={{ marginBottom: 16 }}>
              <div style={S.alarmBox}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <div style={S.alarmCode}>ALARM: {alarm_code}</div>
                  {alarm_desc && <div style={S.alarmDesc}>{alarm_desc}</div>}
                </div>
              </div>
            </div>
          )}

          {last_poll_ts && (
            <div style={S.pollMeta}>
              Last polled: {new Date(last_poll_ts).toLocaleTimeString('en-GB')}  ·
              Pendant: {pendant_online ? <span style={{ color: '#00ff88' }}>Online</span> : <span style={{ color: '#ff4444' }}>Offline</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
