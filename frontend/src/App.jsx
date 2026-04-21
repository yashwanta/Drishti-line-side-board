import React, { useState, useCallback } from 'react'
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

const RESOURCE = 'WM15'
const SHIFT    = 2
const REFRESH_MS = 15_000

const TABS = [
  { id: 'production',  label: '⚙ Production' },
  { id: 'productivity',label: '📊 Productivity' },
  { id: 'issues',      label: '⚠ Issues' },
  { id: 'downtime',    label: '⏱ Downtime' },
  { id: 'robotpress',  label: '🤖 Robot Press' },
  { id: 'mars',        label: '🗄 MARS Data' },
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
  const [activeTab, setActiveTab] = useState('production')

  // Data state
  const [kpis, setKpis] = useState({})
  const [production, setProduction] = useState([])
  const [productivity, setProductivity] = useState([])
  const [issues, setIssues] = useState([])
  const [downtime, setDowntime] = useState({})
  const [robotPress, setRobotPress] = useState({})
  const [marsKpis, setMarsKpis] = useState({})
  const [marsProduction, setMarsProduction] = useState([])
  const [marsQuality, setMarsQuality] = useState([])
  const [marsSchedule, setMarsSchedule] = useState([])
  const [marsError, setMarsError] = useState(null)

  // Connection status
  const [status, setStatus] = useState('connecting')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [operator, setOperator] = useState('')

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    let anyOk = false

    // ── PostgreSQL endpoints (core) ─────────────────────────────────────────
    await Promise.allSettled([
      api.kpis(RESOURCE, SHIFT).then(d => { setKpis(d); anyOk = true; if (d.operator_name) setOperator(d.operator_name) }),
      api.production(RESOURCE, SHIFT).then(setProduction),
      api.productivity(RESOURCE, SHIFT).then(setProductivity),
      api.issues(RESOURCE).then(setIssues),
      api.downtime(RESOURCE).then(setDowntime),
    ])

    // ── Robot press (Java → pendant, non-blocking) ─────────────────────────
    api.robotPress().then(setRobotPress).catch(() => {})

    // ── MARS SQL Server (Java → SQL Server, non-blocking) ──────────────────
    Promise.allSettled([
      api.marsKpis(RESOURCE, SHIFT).then(setMarsKpis),
      api.marsProduction(RESOURCE, SHIFT).then(setMarsProduction),
      api.marsQuality(RESOURCE).then(setMarsQuality),
      api.marsSchedule(RESOURCE).then(setMarsSchedule),
    ]).then(results => {
      const allFailed = results.every(r => r.status === 'rejected')
      setMarsError(allFailed ? 'MARS service unavailable' : null)
    })

    setStatus(anyOk ? 'live' : 'error')
    setLastUpdate(new Date())
    setRefreshing(false)
  }, [])

  useAutoRefresh(fetchAll, REFRESH_MS)

  return (
    <div style={S.app}>
      <Header status={status} shift={SHIFT} resource={RESOURCE} operator={operator} />

      <KPIStrip kpis={kpis} marsKpis={marsKpis} />

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
        {activeTab === 'production'  && <ProductionTab  rows={production} resource={RESOURCE} shift={SHIFT} onRefresh={fetchAll} />}
        {activeTab === 'productivity'&& <ProductivityTab rows={productivity} />}
        {activeTab === 'issues'      && <IssuesTab      issues={issues} resource={RESOURCE} onRefresh={fetchAll} />}
        {activeTab === 'downtime'    && <DowntimeTab    data={downtime} resource={RESOURCE} onRefresh={fetchAll} />}
        {activeTab === 'robotpress'  && <RobotPressPanel data={robotPress} />}
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
        <div>MES LINE SIDE BOARD v2.0  ·  {RESOURCE}  ·  SHIFT {SHIFT}  ·  Go + React + Java</div>
        <div style={S.footerRight}>
          <span><span style={S.refreshDot(refreshing)} />Auto-refresh {REFRESH_MS / 1000}s</span>
          {lastUpdate && <span>Updated: {lastUpdate.toLocaleTimeString('en-GB')}</span>}
          <span style={{ color: status === 'live' ? '#00ff88' : '#ff4444' }}>
            {status === 'live' ? '● LIVE' : status === 'error' ? '⚠ API ERROR' : '◌ CONNECTING'}
          </span>
        </div>
      </div>
    </div>
  )
}
