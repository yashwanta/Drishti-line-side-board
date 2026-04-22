import React, { useState, useEffect } from 'react'

const S = {
  header: {
    background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
    borderBottom: '2px solid #21262d',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: { display: 'flex', flexDirection: 'column', gap: 2 },
  title: {
    fontFamily: "'Courier New', monospace",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: 4,
    color: '#00d4ff',
    textShadow: '0 0 20px rgba(0,212,255,0.4)',
  },
  subtitle: { fontSize: 11, color: '#8b949e', letterSpacing: 2, textTransform: 'uppercase' },
  right: { display: 'flex', alignItems: 'center', gap: 20 },
  clockBox: { textAlign: 'right' },
  time: {
    fontFamily: "'Courier New', monospace",
    fontSize: 28,
    fontWeight: 700,
    color: '#00ff88',
    textShadow: '0 0 15px rgba(0,255,136,0.4)',
    lineHeight: 1,
  },
  date: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  pill: (status) => ({
    padding: '4px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid',
    ...(status === 'live'
      ? { background: 'rgba(0,255,136,0.1)', color: '#00ff88', borderColor: '#00ff88' }
      : status === 'error'
      ? { background: 'rgba(255,68,68,0.1)', color: '#ff4444', borderColor: '#ff4444' }
      : { background: 'rgba(255,170,0,0.1)', color: '#ffaa00', borderColor: '#ffaa00' }),
  }),
  dot: (status) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: status === 'live' ? '#00ff88' : status === 'error' ? '#ff4444' : '#ffaa00',
    boxShadow: status === 'live' ? '0 0 8px #00ff88' : 'none',
    animation: status === 'live' ? 'pulse 2s infinite' : 'none',
  }),
  shiftBadge: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '6px 14px',
    textAlign: 'center',
  },
  shiftLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1 },
  shiftVal: { fontSize: 16, fontWeight: 700, color: '#e6edf3' },
}

export default function Header({ status = 'connecting', shift = 2, resource = 'WM15', operator = '' }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  const pillLabel = status === 'live' ? '● LIVE' : status === 'error' ? '⚠ API ERROR' : '◌ CONNECTING'

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; box-shadow:0 0 8px #00ff88; }
          50%      { opacity:0.5; box-shadow:0 0 16px #00ff88; }
        }
      `}</style>
      <header style={S.header}>
        <div style={S.left}>
<<<<<<< HEAD
          <div style={S.title}>MES — LINE SIDE BOARD — {resource}</div>
=======
          <div style={S.title}>MES — LINE SIDE BOARD</div>
>>>>>>> afadfd2 (fix: remove WM15 from header title)
          <div style={S.subtitle}>Manufacturing Execution System  ·  Real-Time Production Dashboard</div>
        </div>

        <div style={S.right}>
          <div style={S.shiftBadge}>
            <div style={S.shiftLabel}>SHIFT</div>
            <div style={S.shiftVal}>{shift}</div>
          </div>

          {operator && (
            <div style={S.shiftBadge}>
              <div style={S.shiftLabel}>OPERATOR</div>
              <div style={{ ...S.shiftVal, fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{operator}</div>
            </div>
          )}

          <div style={S.pill(status)}>
            <span style={S.dot(status)} />
            {pillLabel}
          </div>

          <div style={S.clockBox}>
            <div style={S.time}>{timeStr}</div>
            <div style={S.date}>{dateStr}</div>
          </div>
        </div>
      </header>
    </>
  )
}
