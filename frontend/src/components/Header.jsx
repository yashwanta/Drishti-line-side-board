import React, { useState, useEffect } from 'react'
import nocLogo from '../../../image/NOC-LOGO4.png'
import { api } from '../api/client'

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
  brand: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  logoFrame: {
    width: 112,
    height: 62,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 9,
    background: 'linear-gradient(135deg, #101419, #0d1117)',
    border: '1px solid rgba(111, 210, 238, 0.22)',
    boxShadow: '0 0 18px rgba(0, 212, 255, 0.10), inset 0 0 12px rgba(0, 0, 0, 0.45)',
  },
  logo: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    filter: 'brightness(1.12) contrast(1.08) saturate(1.06)',
  },
  left: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  title: {
    fontFamily: "'Courier New', monospace",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: 4,
    color: '#00d4ff',
    textShadow: '0 0 20px rgba(0,212,255,0.4)',
  },
  subtitle: { fontSize: 11, color: '#8b949e', letterSpacing: 2, textTransform: 'uppercase' },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
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
  demoPill: {
    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    letterSpacing: 1, color: '#8b949e', background: '#8b949e12',
    border: '1px solid #8b949e55', whiteSpace: 'nowrap',
  },
  dateNav: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
    borderRadius: 8, background: '#0a0e14', border: '1px solid #30363d',
  },
  dateButton: (disabled = false) => ({
    width: 28, height: 28, borderRadius: 6, border: '1px solid #30363d',
    background: disabled ? '#161b22' : '#21262d',
    color: disabled ? '#484f58' : '#e6edf3', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14, lineHeight: 1,
  }),
  selectedDate: {
    minWidth: 126, textAlign: 'center', color: '#e6edf3', fontSize: 11,
    fontFamily: "'Courier New', monospace", fontWeight: 700, whiteSpace: 'nowrap',
  },
  historyChip: (isLive) => ({
    padding: '6px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    letterSpacing: 1, whiteSpace: 'nowrap', cursor: 'pointer',
    color: isLive ? '#00ff88' : '#ffaa00',
    background: isLive ? '#00ff8812' : '#ffaa0012',
    border: `1px solid ${isLive ? '#00ff8855' : '#ffaa0055'}`,
  }),
}

export default function Header({
  status = 'connecting', shift = 2, resource = 'WM15', operator = '',
  selectedDate = new Date(), onDateChange = () => {}, isLive = true,
}) {
  const [now, setNow] = useState(new Date())
  const [mode, setMode] = useState('production')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    api.health().then(data => setMode(data.mode || 'production')).catch(() => {})
  }, [])

  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const selectedDateStr = selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  const moveDay = (offset) => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + offset)
    next.setHours(0, 0, 0, 0)
    onDateChange(next)
  }

  const returnToLive = () => onDateChange(new Date())

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
        <div style={S.brand}>
          <div style={S.logoFrame}>
            <img src={nocLogo} alt="DRISHTI NOC" style={S.logo} />
          </div>
          <div style={S.left}>
          <div style={S.title}>LINE SIDE BOARD</div>
          <div style={S.subtitle}>Manufacturing Execution System  ·  Real-Time Production Dashboard</div>
          </div>
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

          <div style={S.dateNav} aria-label="Dashboard date navigation">
            <button type="button" aria-label="Previous day" title="Previous day" style={S.dateButton()} onClick={() => moveDay(-1)}>◀</button>
            <div style={S.selectedDate}>{selectedDateStr}</div>
            <button type="button" aria-label="Next day" title={isLive ? 'Already viewing today' : 'Next day'} style={S.dateButton(isLive)} disabled={isLive} onClick={() => moveDay(1)}>▶</button>
            <button type="button" style={S.historyChip(isLive)} onClick={returnToLive} title={isLive ? 'Live auto-refresh is active' : 'Return to today and resume live updates'}>
              {isLive ? '● LIVE' : '🕐 HISTORY'}
            </button>
          </div>

          <div style={S.pill(status)}>
            <span style={S.dot(status)} />
            {pillLabel}
          </div>

          {mode === 'mock' && <div style={S.demoPill}>DEMO MODE</div>}

          <div style={S.clockBox}>
            <div style={S.time}>{timeStr}</div>
            <div style={S.date}>{dateStr}</div>
          </div>
        </div>
      </header>
    </>
  )
}
