import React, { useState, useCallback, useRef, useEffect } from 'react'
import { api } from './api/client'
import { useAutoRefresh } from './hooks/useAutoRefresh'

import Header from './components/Header'
import KPIStrip from './components/KPIStrip'
import ProductionTab from './components/ProductionTab'
import ProductivityTab from './components/ProductivityTab'
import IssuesTab from './components/IssuesTab'
import DowntimeTab from './components/DowntimeTab'
import RobotPressPanel from './components/RobotPressPanel'
import MARSPanel from './components/MARSPanel'
import StationsPanel from './components/StationsPanel'
import ProductionStatusCard from './components/ProductionStatusCard'
import ShippingPanel from './components/ShippingPanel'
import OneByOneTab from './components/OneByOneTab'
import LegendPanel from './components/LegendPanel'
import WeeklyPanel from './components/WeeklyPanel'
import OEEAnalyticsTab from './components/OEEAnalyticsTab'
import AIHealthTab from './components/AIHealthTab'
import ExecutiveSummary from './components/ExecutiveSummary'
import SetupScreen from './components/SetupScreen'
import TVDashboard from './components/TVDashboard'

const DEFAULT_RESOURCE = 'WM15'
const SHIFT    = 2
const REFRESH_MS = 15_000

function isToday(date) {
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

const TABS = [
  { id: 'exec',        label: '🎯 Executive Summary' },
  { id: 'stations',    label: '🏭 Stations' },
  { id: 'production',  label: '⚙ Production' },
  { id: 'productivity',label: '📊 Productivity' },
  { id: 'issues',      label: '⚠ Issues' },
  { id: 'downtime',    label: '⏱ Downtime' },
  { id: 'robotpress',  label: '🤖 Robot Press' },
  { id: 'mars',        label: '🗄 MARS Data' },
  { id: 'shipping',    label: '🚛 Shipping' },
  { id: 'prodstatus',  label: '🔢 Floor Status' },
  { id: 'oee',        label: '📈 OEE Analytics' },
  { id: 'onebyone',   label: '📋 1×1 Sheet' },
  { id: 'legend',     label: '🗺 Legend' },
  { id: 'weekly',     label: '📅 Weekly' },
  { id: 'aihealth',   label: '🤖 AI Health' },
  { id: 'tv',         label: '📺 TV Mode' },
]

const S = {
  app: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0a0e14' },
  tabBar: {
    display: 'flex',
    gap: 0,
    background: '#0d1117',
    borderBottom: '1px solid #21262d',
    padding: '0 24px',
    overflowX: 'auto',
  },
  tab: (active) => ({
    padding: '12px 20px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? '#00d4ff' : '#8b949e',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
    marginBottom: -1,
    whiteSpace: 'nowrap',
    transition: 'color 0.2s',
    letterSpacing: 0.5,
  }),
  main: { flex: 1, overflowY: 'auto' },
  footer: {
    background: '#0d1117',
    borderTop: '1px solid #21262d',
    padding: '8px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 10,
    color: '#6e7681',
    letterSpacing: 1,
  },
  footerRight: { display: 'flex', gap: 20, alignItems: 'center' },
  refreshDot: (refreshing) => ({
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: refreshing ? '#00ff88' : '#30363d',
    marginRight: 4,
    transition: 'background 0.3s',
  }),
}

export default function App() {
  const [activeTab, setActiveTab]   = useState('stations')
  const [resource, setResource]     = useState(DEFAULT_RESOURCE)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const isLive = isToday(selectedDate)

  // Data state
  const [stations, setStations]         = useState([])
  const [kpis, setKpis]                 = useState({})
  const [production, setProduction]     = useState([])
  const [productivity, setProductivity] = useState([])
  const [issues, setIssues]             = useState([])
  const [downtime, setDowntime]         = useState({})
  const [robotPress, setRobotPress]     = useState({})
  const [marsKpis, setMarsKpis]         = useState({})
  const [productionStatus, setProductionStatus] = useState([])
  const [shippingStatus, setShippingStatus]     = useState({})
  const [weekly, setWeekly]                     = useState({})
  const [marsProduction, setMarsProduction] = useState([])
  const [marsQuality, setMarsQuality]   = useState([])
  const [marsSchedule, setMarsSchedule] = useState([])
  const [marsError, setMarsError]       = useState(null)

  // Alert banner
  const [alertDismissed, setAlertDismissed] = useState(false)
  const alertKeyRef = useRef('')          // changes when new alert set appears → re-show banner
  const previousAlertLengthRef = useRef(0)

  const alertMessages = (() => {
    const msgs = []
    if ((kpis.efficiency_pct ?? 100) < 75 && kpis.efficiency_pct != null)
      msgs.push(`Efficiency at ${kpis.efficiency_pct}% — below 75% threshold`)
    const lateDeliveries = (shippingStatus?.customer_deliveries ?? []).filter(d => d.status === 'LATE')
    if (lateDeliveries.length > 0)
      msgs.push(`${lateDeliveries.length} LATE delivery${lateDeliveries.length > 1 ? 'ies' : ''}: ${lateDeliveries.map(d => d.customer).join(', ')}`)
    if (issues.length >= 3)
      msgs.push(`${issues.length} open issues require attention`)
    return msgs
  })()

  // Ask once on startup; unsupported or blocked notification APIs are harmless.
  useEffect(() => {
    try {
      if ('Notification' in window) {
        const permissionRequest = Notification.requestPermission()
        if (permissionRequest?.catch) permissionRequest.catch(() => {})
      }
    } catch {
      // Browser notifications are optional and must never interrupt the board.
    }
  }, [])

  // Escalate only when alerts transition from none to one or more.
  useEffect(() => {
    const currentLength = alertMessages.length
    const isNewAlertSet = previousAlertLengthRef.current === 0 && currentLength > 0
    previousAlertLengthRef.current = currentLength
    if (!isNewAlertSet) return

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) {
        const audioContext = new AudioContextClass()
        const playTones = () => {
          const start = audioContext.currentTime
          const gain = audioContext.createGain()
          gain.gain.setValueAtTime(0.3, start)
          gain.connect(audioContext.destination)

          ;[[880, 0], [660, 0.12]].forEach(([frequency, offset]) => {
            const oscillator = audioContext.createOscillator()
            oscillator.frequency.setValueAtTime(frequency, start + offset)
            oscillator.connect(gain)
            oscillator.start(start + offset)
            oscillator.stop(start + offset + 0.12)
          })

          window.setTimeout(() => {
            try {
              const closeRequest = audioContext.close()
              if (closeRequest?.catch) closeRequest.catch(() => {})
            } catch {
              // The context may already be closed by the browser.
            }
          }, 350)
        }

        if (audioContext.state === 'suspended') {
          audioContext.resume().then(playTones).catch(() => {})
        } else {
          playTones()
        }
      }
    } catch {
      // Autoplay restrictions must never interrupt the board.
    }

    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('⚠ LSB Plant Alert', { body: alertMessages[0] })
      }
    } catch {
      // Desktop notifications are best-effort only.
    }
  }, [alertMessages.length])

  // Re-show banner whenever the set of alerts changes
  useEffect(() => {
    const key = alertMessages.join('|')
    if (key !== alertKeyRef.current) {
      alertKeyRef.current = key
      if (alertMessages.length > 0) setAlertDismissed(false)
    }
  }, [alertMessages.join('|')])

  const showBanner = alertMessages.length > 0 && !alertDismissed

  // Connection status
  const [status, setStatus]       = useState('connecting')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [operator, setOperator]   = useState('')

  // fetchAll uses the resource ref so the latest value is always used
  const fetchAll = useCallback(async (res = resource, date = selectedDate) => {
    setRefreshing(true)
    let anyOk = false

    // ── Stations list ───────────────────────────────────────────────────────
    api.stations(date).then(setStations).catch(() => {})

    // ── PostgreSQL endpoints (core) ─────────────────────────────────────────
    await Promise.allSettled([
      api.kpis(res, SHIFT, date).then(d => { setKpis(d); anyOk = true; if (d.operator_name) setOperator(d.operator_name) }),
      api.production(res, SHIFT, date).then(setProduction),
      api.productivity(res, SHIFT, date).then(setProductivity),
      api.issues(res, date).then(setIssues),
      api.downtime(res, date).then(setDowntime),
    ])

    // ── Robot press (Java → pendant, non-blocking) ─────────────────────────
    api.robotPress(date).then(setRobotPress).catch(() => {})

    // ── Production & shipping status ───────────────────────────────────────
    api.productionStatus(date).then(setProductionStatus).catch(() => {})
    api.shippingStatus(date).then(setShippingStatus).catch(() => {})
    api.weekly(res, date).then(setWeekly).catch(() => {})

    // ── MARS SQL Server (Java → SQL Server, non-blocking) ──────────────────
    Promise.allSettled([
      api.marsKpis(res, SHIFT, date).then(setMarsKpis),
      api.marsProduction(res, SHIFT, date).then(setMarsProduction),
      api.marsQuality(res, date).then(setMarsQuality),
      api.marsSchedule(res, date).then(setMarsSchedule),
    ]).then(results => {
      const allFailed = results.every(r => r.status === 'rejected')
      setMarsError(allFailed ? 'MARS service unavailable' : null)
    })

    setStatus(anyOk ? 'live' : 'error')
    setLastUpdate(new Date())
    setRefreshing(false)
  }, [resource, selectedDate])

  useAutoRefresh(fetchAll, REFRESH_MS, isLive)

  useEffect(() => {
    if (!isLive) fetchAll(resource, selectedDate)
  }, [fetchAll, isLive, resource, selectedDate])

  // When user picks a station: switch resource, clear stale data, go to Production tab
  function handleSelectStation(resourceId) {
    setResource(resourceId)
    setKpis({})
    setProduction([])
    setProductivity([])
    setIssues([])
    setDowntime({})
    setActiveTab('production')
    if (isLive) fetchAll(resourceId, selectedDate)
  }

  if (kpis.status === 'unconfigured') {
    return <SetupScreen onComplete={() => window.location.reload()} />
  }

  return (
    <div style={S.app}>
      <Header
        status={status}
        shift={SHIFT}
        resource={resource}
        operator={operator}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        isLive={isLive}
      />

      <KPIStrip kpis={kpis} marsKpis={marsKpis} onTileClick={(tab) => setActiveTab(tab)} />

      {/* Alert banner */}
      {showBanner && (
        <div style={{
          background: '#ff444418',
          borderTop: '3px solid #ff4444',
          borderBottom: '1px solid #ff444444',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ff4444', letterSpacing: 1, marginBottom: 2 }}>
              ⚠ PLANT ALERT
            </div>
            {alertMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e6edf3' }}>· {msg}</div>
            ))}
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            style={{
              background: 'transparent', border: '1px solid #ff444466',
              color: '#ff4444', borderRadius: 6, padding: '4px 12px',
              cursor: 'pointer', fontSize: 12, flexShrink: 0,
            }}
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {!isLive && (
        <div style={{
          width: '100%', padding: '9px 24px', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          color: '#ffaa00', background: '#ffaa0015', borderTop: '3px solid #ffaa00',
          borderBottom: '1px solid #ffaa0044', fontSize: 12,
        }}>
          <span>
            🕐 Viewing historical data for <strong>{selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>. Auto-refresh is paused.
          </span>
          <button
            type="button"
            onClick={() => setSelectedDate(new Date())}
            style={{
              background: 'transparent', border: '1px solid #ffaa0066',
              color: '#ffaa00', borderRadius: 6, padding: '4px 12px',
              cursor: 'pointer', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            Return to Live
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
            {t.id === 'issues' && issues.length > 0 && (
              <span style={{
                marginLeft: 6, background: '#ff4444', color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>{issues.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main style={S.main}>
        {activeTab === 'exec'        && (
          <ExecutiveSummary
            kpis={kpis}
            productionStatus={productionStatus}
            shippingStatus={shippingStatus}
            issues={issues}
            onTabClick={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'stations'    && (
          <StationsPanel
            stations={stations}
            activeResource={resource}
            onSelect={handleSelectStation}
          />
        )}
        {activeTab === 'production'  && <ProductionTab rows={production} resource={resource} shift={SHIFT} selectedDate={selectedDate} onRefresh={() => fetchAll(resource)} />}
        {activeTab === 'productivity'&& <ProductivityTab rows={productivity} />}
        {activeTab === 'issues'      && <IssuesTab      issues={issues} resource={resource} shift={SHIFT} onRefresh={() => fetchAll(resource)} />}
        {activeTab === 'downtime'    && <DowntimeTab    data={downtime} resource={resource} selectedDate={selectedDate} onRefresh={() => fetchAll(resource)} />}
        {activeTab === 'robotpress'  && <RobotPressPanel data={robotPress} />}
        {activeTab === 'shipping'    && <ShippingPanel data={shippingStatus} />}
        {activeTab === 'prodstatus'  && <ProductionStatusCard rows={productionStatus} onNavigate={handleSelectStation} />}
        {activeTab === 'oee'         && <OEEAnalyticsTab />}
        {activeTab === 'onebyone'    && <OneByOneTab />}
        {activeTab === 'legend'      && <LegendPanel />}
        {activeTab === 'weekly'      && <WeeklyPanel data={weekly} resource={resource} selectedDate={selectedDate} />}
        {activeTab === 'aihealth'    && <AIHealthTab />}
        {activeTab === 'tv'          && (
          <TVDashboard
            kpis={kpis}
            productionStatus={productionStatus}
            shippingStatus={shippingStatus}
            issues={issues}
            stations={stations}
            downtime={downtime}
            marsKpis={marsKpis}
            resource={resource}
            isLive={isLive}
          />
        )}
        {activeTab === 'mars'        && (
          <MARSPanel
            kpis={marsKpis}
            production={marsProduction}
            quality={marsQuality}
            schedule={marsSchedule}
            error={marsError}
          />
        )}
      </main>

      {/* Footer */}
      <div style={S.footer}>
        <div>LINE SIDE BOARD v2.0  ·  {resource}  ·  SHIFT {SHIFT}  ·  Go + React</div>
        <div style={S.footerRight}>
          {isLive
            ? <span><span style={S.refreshDot(refreshing)} />Auto-refresh {REFRESH_MS / 1000}s</span>
            : <span style={{ color: '#ffaa00' }}>HISTORICAL SNAPSHOT</span>}
          {lastUpdate && <span>Updated: {lastUpdate.toLocaleTimeString('en-GB')}</span>}
          <span style={{ color: status === 'live' ? '#00ff88' : '#ff4444' }}>
            {status === 'live' ? '● LIVE' : status === 'error' ? '⚠ API ERROR' : '◌ CONNECTING'}
          </span>
        </div>
      </div>
    </div>
  )
}
