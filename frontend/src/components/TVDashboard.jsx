import React, { useEffect, useMemo, useState } from 'react'
import { OEEGauge } from './OEEAnalyticsTab'

const COLORS = { cyan: '#00d4ff', green: '#00ff88', amber: '#ffaa00', red: '#ff4444', purple: '#a78bfa', muted: '#8b949e' }
const SUPERVISOR_WIDGETS = ['plant_health', 'efficiency', 'actual_plan', 'floor_status', 'alerts', 'issues']
const EXECUTIVE_WIDGETS = ['plant_health', 'kpi_strip', 'on_time_rate', 'shipping', 'top_stations', 'bottom_stations']

const DEFAULT_CONFIG = {
  layouts: [{ id: 1, name: 'Layout 1', widgets: SUPERVISOR_WIDGETS, columns: 3 }],
  autoCycle: false,
  cycleSeconds: 30,
  activeLayout: 1,
}

function metricColor(value, greenAt = 90, amberAt = 75) {
  if (value >= greenAt) return COLORS.green
  if (value >= amberAt) return COLORS.amber
  return COLORS.red
}

function healthScore({ kpis = {}, productionStatus = [], shippingStatus = {}, issues = [] }) {
  const scores = []
  if (kpis.efficiency_pct != null) scores.push({ score: Math.min(kpis.efficiency_pct, 100), weight: 35 })
  const running = productionStatus.filter(row => String(row.status).toLowerCase() === 'running')
  if (running.length) {
    const average = running.reduce((sum, row) => sum + (row.efficiency_pct || 0), 0) / running.length
    scores.push({ score: Math.min(average, 100), weight: 25 })
  }
  if (shippingStatus.on_time_rate_pct != null) scores.push({ score: shippingStatus.on_time_rate_pct, weight: 25 })
  scores.push({ score: Math.max(0, 100 - issues.length * 20), weight: 15 })
  const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0)
  return Math.round(scores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
}

function alertMessages(data) {
  const messages = []
  if (data.kpis?.efficiency_pct != null && data.kpis.efficiency_pct < 75) messages.push(`Efficiency at ${data.kpis.efficiency_pct}% — below target`)
  data.productionStatus.filter(row => String(row.status).toLowerCase() === 'running' && (row.efficiency_pct ?? 100) < 75)
    .forEach(row => messages.push(`${row.resource_id} running at ${row.efficiency_pct}% efficiency`))
  const late = (data.shippingStatus?.customer_deliveries || []).filter(delivery => delivery.status === 'LATE')
  if (late.length) messages.push(`${late.length} late delivery${late.length === 1 ? '' : 'ies'}: ${late.map(item => item.customer).join(', ')}`)
  if (data.issues.length >= 3) messages.push(`${data.issues.length} open issues require attention`)
  return messages
}

const labelStyle = { fontSize: 11, color: COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }
const valueStyle = color => ({ fontFamily: "'Courier New', monospace", fontSize: 32, lineHeight: 1, fontWeight: 800, color })
const barStyle = { height: 7, background: '#21262d', borderRadius: 4, overflow: 'hidden' }

function ValueWidget({ label, value, color, sub, progress }) {
  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <div style={labelStyle}>{label}</div>
    <div style={{ ...valueStyle(color), fontSize: 44, margin: '10px 0 8px' }}>{value}</div>
    {progress != null && <div style={barStyle}><div style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, height: '100%', background: color }} /></div>}
    {sub && <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 8 }}>{sub}</div>}
  </div>
}

function StationRows({ rows, bottom = false }) {
  const sorted = [...rows].sort((a, b) => bottom ? (a.efficiency_pct || 0) - (b.efficiency_pct || 0) : (b.efficiency_pct || 0) - (a.efficiency_pct || 0)).slice(0, 5)
  const accent = bottom ? COLORS.red : COLORS.green
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    {sorted.map(row => <div key={row.resource_id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 58px', alignItems: 'center', gap: 9 }}>
      <span style={{ color: '#e6edf3', fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 700 }}>{row.resource_id}</span>
      <div style={barStyle}><div style={{ height: '100%', width: `${Math.min(row.efficiency_pct || 0, 100)}%`, background: accent }} /></div>
      <span style={{ color: accent, fontFamily: "'Courier New', monospace", fontSize: 14, textAlign: 'right', fontWeight: 700 }}>{(row.efficiency_pct || 0).toFixed(1)}%</span>
    </div>)}
    {!sorted.length && <div style={{ color: COLORS.muted, fontSize: 14 }}>No station data</div>}
  </div>
}

function CompactKpis({ kpis = {} }) {
  const items = [
    ['Actual', kpis.actual ?? 0, COLORS.cyan], ['Plan', kpis.plan ?? 0, '#e6edf3'],
    ['Efficiency', `${kpis.efficiency_pct ?? 0}%`, metricColor(kpis.efficiency_pct || 0)],
    ['FPY', `${kpis.fpy_pct ?? 0}%`, metricColor(kpis.fpy_pct || 0, 99, 95)],
    ['Cycle', kpis.avg_cycle_sec ? `${kpis.avg_cycle_sec}s` : '—', COLORS.purple],
    ['Issues', kpis.open_issues ?? 0, (kpis.open_issues || 0) ? COLORS.red : COLORS.green],
  ]
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, height: '100%' }}>
    {items.map(([label, value, color]) => <div key={label} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 9, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ ...labelStyle, fontSize: 9 }}>{label}</div><div style={{ ...valueStyle(color), fontSize: 28, marginTop: 5 }}>{value}</div>
    </div>)}
  </div>
}

function ClockWidget({ now }) {
  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 48, color: '#fff', fontWeight: 800 }}>{now.toLocaleTimeString('en-GB')}</div>
    <div style={{ color: COLORS.muted, fontSize: 16, marginTop: 8 }}>{now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>
}

export const WIDGETS = [
  { id: 'kpi_strip', label: '📊 KPI Strip', minW: 2, render: data => <CompactKpis kpis={data.kpis} /> },
  { id: 'plant_health', label: '🎯 Plant Health Score', minW: 1, render: data => {
    const score = healthScore(data), color = metricColor(score, 85, 70)
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '100%', gap: 10 }}><OEEGauge value={score} size={110} /><div><div style={labelStyle}>Plant Health</div><div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 8 }}>{score >= 85 ? 'HEALTHY' : score >= 70 ? 'CAUTION' : 'AT RISK'}</div></div></div>
  } },
  { id: 'efficiency', label: '⚡ Efficiency Gauge', minW: 1, render: data => {
    const value = data.kpis?.efficiency_pct || 0
    return <ValueWidget label="Efficiency" value={`${value}%`} color={metricColor(value)} progress={value} sub="Current shift" />
  } },
  { id: 'actual_plan', label: '🔢 Actual vs Plan', minW: 1, render: data => {
    const actual = data.kpis?.actual || 0, plan = data.kpis?.plan || 0, gap = actual - plan
    return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}><div style={labelStyle}>Output</div><div style={valueStyle(COLORS.cyan)}>ACTUAL: {actual}</div><div style={{ ...valueStyle('#e6edf3'), fontSize: 28 }}>PLAN: {plan}</div><span style={{ color: gap >= 0 ? COLORS.green : COLORS.red, fontSize: 14, fontWeight: 700 }}>{gap >= 0 ? `+${gap} ahead` : `${gap} behind`}</span></div>
  } },
  { id: 'oee_fleet', label: '📈 Fleet OEE', minW: 1, render: data => {
    const rows = data.productionStatus || [], average = rows.length ? rows.reduce((sum, row) => sum + (row.oee_pct ?? row.oee ?? row.efficiency_pct ?? 0), 0) / rows.length : 0
    return <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><OEEGauge value={average} size={100} label="Fleet OEE" /></div>
  } },
  { id: 'floor_status', label: '🏭 Floor Status Grid', minW: 2, render: data => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7, height: '100%' }}>{(data.productionStatus || []).slice(0, 12).map(row => {
    const status = String(row.status || 'idle').toLowerCase(), color = status === 'running' ? COLORS.green : status === 'downtime' ? COLORS.red : status === 'setup' ? COLORS.amber : COLORS.muted
    return <div key={row.resource_id} style={{ background: '#0d1117', border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 7, padding: 7, overflow: 'hidden' }}><div style={{ color: COLORS.cyan, fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 800 }}>{row.resource_id}</div><div style={{ color, fontSize: 10, fontWeight: 700, margin: '3px 0' }}>{status.toUpperCase()}</div><div style={{ color: '#e6edf3', fontSize: 16, fontWeight: 800 }}>{(row.efficiency_pct || 0).toFixed(1)}%</div></div>
  })}</div> },
  { id: 'shipping', label: '🚛 Shipping Status', minW: 2, render: data => {
    const shipping = data.shippingStatus || {}
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9, height: '100%' }}>{[
      ['Parts Shipped', shipping.parts_shipped_today || 0, COLORS.cyan], ['On-Time Rate', `${shipping.on_time_rate_pct || 0}%`, metricColor(shipping.on_time_rate_pct || 0, 95, 85)],
      ['Shipments', shipping.shipment_count || 0, COLORS.purple], ['Next Shipment', shipping.next_shipment || '—', COLORS.amber],
    ].map(([label, value, color]) => <div key={label} style={{ background: '#0d1117', borderRadius: 8, padding: 10, overflow: 'hidden' }}><div style={labelStyle}>{label}</div><div style={{ ...valueStyle(color), fontSize: label === 'Next Shipment' ? 17 : 28, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div></div>)}</div>
  } },
  { id: 'issues', label: '⚠ Open Issues', minW: 1, render: data => <div><div style={labelStyle}>Open Issues</div><div style={{ ...valueStyle(data.issues.length ? COLORS.red : COLORS.green), fontSize: 48, margin: '7px 0' }}>{data.issues.length}</div>{data.issues.slice(0, 3).map(issue => <div key={issue.id} style={{ color: '#c9d1d9', fontSize: 14, borderTop: '1px solid #21262d', padding: '5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {issue.description || issue.issue_type}</div>)}</div> },
  { id: 'alerts', label: '🚨 Alert Banner', minW: 2, render: data => {
    const messages = alertMessages(data)
    return messages.length ? <div style={{ color: '#ffd1d1' }}><div style={{ color: COLORS.red, fontSize: 18, fontWeight: 800, marginBottom: 9 }}>🚨 PLANT ALERTS</div>{messages.map(message => <div key={message} style={{ background: '#ff444415', borderLeft: `3px solid ${COLORS.red}`, padding: '7px 10px', marginBottom: 6, fontSize: 14 }}>{message}</div>)}</div> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.green, fontSize: 25, fontWeight: 800 }}>✓ All Systems Normal</div>
  } },
  { id: 'top_stations', label: '🏆 Top 5 Stations', minW: 1, render: data => <StationRows rows={data.productionStatus || []} /> },
  { id: 'bottom_stations', label: '⬇ Bottom 5 Stations', minW: 1, render: data => <StationRows rows={data.productionStatus || []} bottom /> },
  { id: 'clock', label: '🕐 Live Clock', minW: 1, render: data => <ClockWidget now={data.now} /> },
  { id: 'on_time_rate', label: '📦 On-Time Delivery', minW: 1, render: data => <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><OEEGauge value={data.shippingStatus?.on_time_rate_pct || 0} size={110} label="On-Time Delivery" /></div> },
]

function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem('lsb_tv_config'))
    if (stored?.layouts?.length) return { ...DEFAULT_CONFIG, ...stored }
  } catch { /* use safe default */ }
  return DEFAULT_CONFIG
}

export default function TVDashboard(props) {
  const [config, setConfig] = useState(loadConfig)
  const initialLayout = config.layouts.find(layout => layout.id === config.activeLayout) || config.layouts[0]
  const [selected, setSelected] = useState(initialLayout?.widgets || SUPERVISOR_WIDGETS)
  const [columns, setColumns] = useState(initialLayout?.columns || 3)
  const [editingId, setEditingId] = useState(initialLayout?.id || null)
  const [fullscreen, setFullscreen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('lsb_tv_config', JSON.stringify(config))
      for (let id = 1; id <= 4; id += 1) {
        const layout = config.layouts.find(item => item.id === id)
        if (layout) localStorage.setItem(`lsb_tv_layout_${id}`, JSON.stringify(layout))
        else localStorage.removeItem(`lsb_tv_layout_${id}`)
      }
    } catch { /* localStorage can be disabled in locked-down TV browsers */ }
  }, [config])

  useEffect(() => {
    const handleChange = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  useEffect(() => {
    if (!fullscreen || !config.autoCycle || config.layouts.length < 2) return undefined
    const timer = window.setInterval(() => {
      setConfig(current => {
        const currentIndex = current.layouts.findIndex(layout => layout.id === current.activeLayout)
        const next = current.layouts[(currentIndex + 1) % current.layouts.length]
        setSelected(next.widgets); setColumns(next.columns); setEditingId(next.id)
        return { ...current, activeLayout: next.id }
      })
    }, Math.max(5, Number(config.cycleSeconds) || 30) * 1000)
    return () => window.clearInterval(timer)
  }, [fullscreen, config.autoCycle, config.cycleSeconds, config.layouts.length])

  const widgetData = useMemo(() => ({ ...props, now }), [props, now])
  const activeWidgets = WIDGETS.filter(widget => selected.includes(widget.id))
  const rowCount = Math.max(1, Math.ceil(activeWidgets.reduce((sum, widget) => sum + Math.min(widget.minW, columns), 0) / columns))

  function choosePreset(widgets, presetColumns = 3) { setSelected(widgets); setColumns(presetColumns); setEditingId(null) }
  function editLayout(layout) { setSelected(layout.widgets); setColumns(layout.columns); setEditingId(layout.id); setConfig(current => ({ ...current, activeLayout: layout.id })) }
  function deleteLayout(id) {
    setConfig(current => {
      const layouts = current.layouts.filter(layout => layout.id !== id)
      const fallback = layouts[0]
      if (fallback) { setSelected(fallback.widgets); setColumns(fallback.columns); setEditingId(fallback.id) }
      else { setSelected(SUPERVISOR_WIDGETS); setColumns(3); setEditingId(null) }
      return { ...current, layouts, activeLayout: fallback?.id || null }
    })
  }
  function saveLayout() {
    setConfig(current => {
      if (editingId && current.layouts.some(layout => layout.id === editingId)) {
        return { ...current, layouts: current.layouts.map(layout => layout.id === editingId ? { ...layout, widgets: selected, columns } : layout), activeLayout: editingId }
      }
      if (current.layouts.length >= 4) return current
      const used = new Set(current.layouts.map(layout => layout.id))
      const id = [1, 2, 3, 4].find(value => !used.has(value))
      const layout = { id, name: `Layout ${id}`, widgets: selected, columns }
      setEditingId(id)
      return { ...current, layouts: [...current.layouts, layout], activeLayout: id }
    })
  }
  async function launchTV() {
    if (!selected.length) return
    setFullscreen(true)
    try { await document.documentElement.requestFullscreen?.() } catch { /* browser may block fullscreen; fixed overlay still works */ }
  }
  async function exitTV() {
    try { if (document.fullscreenElement) await document.exitFullscreen?.() } catch { /* still exit overlay */ }
    setFullscreen(false)
  }

  if (fullscreen) return <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0a0e14', color: '#e6edf3', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ height: 36, boxSizing: 'border-box', padding: '0 12px 0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #21262d', background: '#0d1117' }}>
      <div style={{ color: COLORS.cyan, fontSize: 14, fontWeight: 800, letterSpacing: 1.5 }}>DRISHTI MANUFACTURING</div>
      <div style={{ fontFamily: "'Courier New', monospace", color: '#fff', fontSize: 16, fontWeight: 700 }}>{now.toLocaleTimeString('en-GB')} {props.isLive ? <span style={{ color: COLORS.green }}>● LIVE</span> : <span style={{ color: COLORS.amber }}>HISTORY</span>}</div>
      <button onClick={exitTV} style={{ position: 'relative', zIndex: 10001, background: '#ffffff10', border: '1px solid #ffffff35', color: '#c9d1d9', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>⚙ Exit</button>
    </div>
    <div style={{ height: 'calc(100vh - 36px)', boxSizing: 'border-box', padding: 10, display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`, gridAutoFlow: 'dense', gap: 10, overflow: 'hidden' }}>
      {activeWidgets.map(widget => <section key={widget.id} style={{ gridColumn: `span ${Math.min(widget.minW, columns)}`, minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 16, boxSizing: 'border-box' }}>
        <div style={{ ...labelStyle, color: COLORS.cyan, marginBottom: 9 }}>{widget.label}</div>
        <div style={{ height: 'calc(100% - 24px)', overflow: 'hidden' }}>{widget.render(widgetData)}</div>
      </section>)}
    </div>
  </div>

  return <div style={{ padding: 24, color: '#e6edf3', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ marginBottom: 22 }}><div style={{ fontSize: 22, fontWeight: 800 }}>📺 TV Dashboard Builder</div><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Choose the information your factory-floor displays should show.</div></div>
    <div style={{ ...labelStyle, marginBottom: 10 }}>Available widgets</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 24 }}>
      {WIDGETS.map(widget => {
        const checked = selected.includes(widget.id)
        return <label key={widget.id} style={{ background: checked ? '#00d4ff0d' : '#161b22', border: `1px solid ${checked ? COLORS.cyan : '#21262d'}`, borderRadius: 9, padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: checked ? '#e6edf3' : COLORS.muted }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{widget.label}</span><input type="checkbox" checked={checked} onChange={() => setSelected(current => checked ? current.filter(id => id !== widget.id) : [...current, widget.id])} style={{ accentColor: COLORS.cyan, width: 18, height: 18 }} />
        </label>
      })}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}><div style={{ ...labelStyle, marginBottom: 12 }}>Columns</div><div style={{ display: 'flex', gap: 8 }}>{[1, 2, 3, 4].map(count => <button key={count} onClick={() => setColumns(count)} style={{ width: 44, height: 34, background: columns === count ? COLORS.cyan : '#0d1117', color: columns === count ? '#0a0e14' : '#e6edf3', border: '1px solid #30363d', borderRadius: 7, cursor: 'pointer', fontWeight: 800 }}>{count}</button>)}</div></div>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}><label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><input type="checkbox" checked={config.autoCycle} onChange={event => setConfig(current => ({ ...current, autoCycle: event.target.checked }))} style={{ accentColor: COLORS.cyan, width: 18, height: 18 }} /><span style={{ fontSize: 14, fontWeight: 700 }}>Auto-cycle layouts</span></label>{config.autoCycle && <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.muted, marginTop: 12, fontSize: 13 }}>Cycle every <input type="number" min="5" max="3600" value={config.cycleSeconds} onChange={event => setConfig(current => ({ ...current, cycleSeconds: Math.max(5, Number(event.target.value) || 30) }))} style={{ width: 70, background: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: 6, padding: 6 }} /> seconds</label>}</div>
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}><button onClick={() => choosePreset(SUPERVISOR_WIDGETS)} style={{ background: '#00d4ff12', border: '1px solid #00d4ff44', color: COLORS.cyan, borderRadius: 8, padding: '8px 15px', cursor: 'pointer', fontWeight: 700 }}>Supervisor View</button><button onClick={() => choosePreset(EXECUTIVE_WIDGETS, 3)} style={{ background: '#a78bfa12', border: '1px solid #a78bfa44', color: COLORS.purple, borderRadius: 8, padding: '8px 15px', cursor: 'pointer', fontWeight: 700 }}>Executive View</button></div>
    <div style={{ ...labelStyle, marginBottom: 10 }}>Saved layouts</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>{config.layouts.map(layout => <div key={layout.id} style={{ background: layout.id === editingId ? '#00d4ff15' : '#161b22', border: `1px solid ${layout.id === editingId ? '#00d4ff55' : '#30363d'}`, borderRadius: 18, padding: '5px 7px 5px 12px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}><span>{layout.name}</span><button onClick={() => editLayout(layout)} style={{ background: 'transparent', border: 0, color: COLORS.cyan, cursor: 'pointer' }}>Edit</button><button onClick={() => deleteLayout(layout.id)} style={{ background: 'transparent', border: 0, color: COLORS.red, cursor: 'pointer' }}>Delete</button></div>)}{config.layouts.length < 4 && <button onClick={() => { setEditingId(null); setSelected(SUPERVISOR_WIDGETS); setColumns(3) }} style={{ background: 'transparent', border: '1px dashed #30363d', color: COLORS.muted, borderRadius: 18, padding: '5px 12px', cursor: 'pointer' }}>+ New Layout</button>}</div>
    <div style={{ display: 'flex', gap: 12 }}><button onClick={saveLayout} disabled={!selected.length} style={{ background: '#161b22', border: '1px solid #00d4ff55', color: COLORS.cyan, borderRadius: 8, padding: '10px 18px', cursor: selected.length ? 'pointer' : 'not-allowed', fontWeight: 800 }}>💾 Save Layout</button><button onClick={launchTV} disabled={!selected.length} style={{ background: COLORS.cyan, border: 0, color: '#0a0e14', borderRadius: 8, padding: '10px 20px', cursor: selected.length ? 'pointer' : 'not-allowed', fontWeight: 900 }}>📺 Launch TV Mode</button></div>
  </div>
}
