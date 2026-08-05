import React, { useState } from 'react'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 20, letterSpacing: 1 },
  topGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 24 },
  kpiCard: (color) => ({
    background: '#161b22', border: `1px solid ${color}22`,
    borderTop: `3px solid ${color}`, borderRadius: 10, padding: '14px 18px',
  }),
  kpiLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  kpiVal: (color) => ({ fontFamily: 'monospace', fontSize: 28, fontWeight: 800, color }),
  kpiSub: { fontSize: 11, color: '#6e7681', marginTop: 4 },

  dockBanner: (status) => ({
    background: status === 'ACTIVE' ? '#00ff8811' : status === 'IDLE' ? '#ffaa0011' : '#ff444411',
    border: `1px solid ${status === 'ACTIVE' ? '#00ff8844' : status === 'IDLE' ? '#ffaa0044' : '#ff444444'}`,
    borderRadius: 10, padding: '16px 20px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
  }),
  dockLabel: { fontSize: 11, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase' },
  dockVal: (status) => ({
    fontFamily: 'monospace', fontSize: 18, fontWeight: 800,
    color: status === 'ACTIVE' ? '#00ff88' : status === 'IDLE' ? '#ffaa00' : '#ff4444',
  }),

  sectionTitle: { fontSize: 12, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 20 },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    background: '#161b22', color: '#8b949e', fontWeight: 600, fontSize: 10, letterSpacing: 1.5,
    textTransform: 'uppercase', padding: '9px 14px', textAlign: 'left', borderBottom: '1px solid #21262d',
  },
  td: { padding: '10px 14px', borderBottom: '1px solid #21262d16', color: '#e6edf3' },
  trOdd: { background: '#161b2280' },
  trEven: { background: '#0d1117' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
    background: `${color}15`, color, border: `1px solid ${color}33`,
  }),
  nextShipment: {
    background: '#161b22', border: '1px solid #00d4ff33', borderRadius: 10,
    padding: '14px 18px', marginBottom: 20, display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  nextLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  nextVal: { fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#00d4ff' },
  empty: { padding: 32, textAlign: 'center', color: '#8b949e', fontSize: 12 },
}

const STATUS_COLORS = {
  SHIPPED:    '#8b949e',
  IN_TRANSIT: '#00d4ff',
  PENDING:    '#ffaa00',
  ONTIME:     '#00ff88',
  LATE:       '#ff4444',
}

const BACK_STYLE = {
  background: 'transparent', border: '1px solid #21262d', color: '#8b949e',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 16,
}

function CustomerDetail({ customer, deliveries, onBack }) {
  const customerDeliveries = deliveries.filter(d => d.customer === customer)
  const totalParts = customerDeliveries.reduce((sum, d) => sum + (Number(d.qty) || 0), 0)
  const onTimeCount = customerDeliveries.filter(d => ['ONTIME', 'SHIPPED', 'IN_TRANSIT'].includes(d.status)).length
  const lateCount = customerDeliveries.filter(d => d.status === 'LATE').length
  const maxQty = Math.max(...customerDeliveries.map(d => Number(d.qty) || 0), 1)

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={BACK_STYLE}>← Back</button>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#00d4ff', marginBottom: 6 }}>{customer}</div>
      <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 22 }}>Customer contact: [not configured]</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          ['Total Parts Today', totalParts.toLocaleString(), '#00d4ff'],
          ['On Time', onTimeCount, '#00ff88'],
          ['Late', lateCount, '#ff4444'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ ...S.kpiCard(color), minWidth: 0 }}>
            <div style={S.kpiLabel}>{label}</div>
            <div style={S.kpiVal(color)}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Delivery timeline</div>
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18, marginBottom: 24 }}>
        {customerDeliveries.map((delivery, index) => {
          const color = STATUS_COLORS[delivery.status] || '#8b949e'
          return (
            <div key={`${delivery.work_order}-${index}`} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: 12, alignItems: 'center', marginBottom: 13 }}>
              <div>
                <div style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 11 }}>{delivery.work_order}</div>
                <div style={{ color: '#6e7681', fontSize: 10 }}>{delivery.ship_by} · {delivery.delivery_date}</div>
              </div>
              <div style={{ height: 16, background: '#0d1117', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(18, (Number(delivery.qty) || 0) / maxQty * 100)}%`, background: color, borderRadius: 8, opacity: 0.8 }} />
              </div>
              <span style={{ ...S.badge(color), textAlign: 'center' }}>{delivery.status}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>All deliveries</div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>{['Work Order', 'Part', 'Qty', 'Ship By', 'Status', 'Delivery'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{customerDeliveries.map((d, i) => {
            const color = STATUS_COLORS[d.status] || '#8b949e'
            return <tr key={`${d.work_order}-${i}`} style={i % 2 ? S.trOdd : S.trEven}>
              <td style={{ ...S.td, color: '#00d4ff', fontFamily: 'monospace' }}>{d.work_order}</td>
              <td style={{ ...S.td, fontFamily: 'monospace' }}>{d.part_number}</td>
              <td style={{ ...S.td, fontFamily: 'monospace' }}>{d.qty}</td>
              <td style={S.td}>{d.ship_by}</td>
              <td style={S.td}><span style={S.badge(color)}>{d.status}</span></td>
              <td style={S.td}>{d.delivery_date}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function printShipping(data) {
  const {
    parts_shipped_today = 0, shipment_count = 0, pending_trucks = 0,
    loaded_trucks = 0, shipping_dock_status = 'UNKNOWN', on_time_rate_pct = 0,
    next_shipment = '', delivery_eta = '', customer_deliveries = [],
  } = data
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><title>Shipping Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 32px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
    .card { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
    .card-label { font-size: 10px; color: #888; letter-spacing: 1px; text-transform: uppercase; }
    .card-val { font-size: 24px; font-weight: 800; font-family: monospace; margin-top: 4px; }
    .banner { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px;
      display: flex; justify-content: space-between; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      padding: 8px 10px; text-align: left; border: 1px solid #ddd; }
    td { padding: 8px 10px; border: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) { background: #fafafa; }
    .late { color: #cc0000; font-weight: 700; }
    .ontime { color: #006600; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; }
    @media print { button { display: none; } }
  </style></head><body>
  <h1>🚛 Shipping Status Report</h1>
  <div class="sub">Printed: ${new Date().toLocaleString('en-GB')} &nbsp;|&nbsp; Dock: ${shipping_dock_status}</div>
  <div class="grid">
    <div class="card"><div class="card-label">Parts Shipped</div><div class="card-val">${parts_shipped_today.toLocaleString()}</div></div>
    <div class="card"><div class="card-label">Shipments</div><div class="card-val">${shipment_count}</div></div>
    <div class="card"><div class="card-label">Trucks Loaded</div><div class="card-val">${loaded_trucks} <span style="font-size:14px;color:#888">/ ${loaded_trucks + pending_trucks}</span></div></div>
    <div class="card"><div class="card-label">On-Time Rate</div><div class="card-val" style="color:${on_time_rate_pct >= 95 ? '#006600' : on_time_rate_pct >= 85 ? '#cc6600' : '#cc0000'}">${on_time_rate_pct}%</div></div>
  </div>
  <div class="banner">
    <div><div class="card-label">Next Shipment</div><div style="font-family:monospace;font-size:15px;font-weight:700">${next_shipment || '—'}</div></div>
    <div style="text-align:right"><div class="card-label">Delivery ETA</div><div style="font-family:monospace;font-size:15px">${delivery_eta || '—'}</div></div>
  </div>
  <table>
    <thead><tr><th>Work Order</th><th>Customer</th><th>Part Number</th><th>Qty</th><th>Ship By</th><th>Status</th><th>Delivery Date</th></tr></thead>
    <tbody>${customer_deliveries.map(d => `
      <tr>
        <td style="font-family:monospace">${d.work_order}</td>
        <td>${d.customer}</td>
        <td style="font-family:monospace">${d.part_number}</td>
        <td style="font-weight:700">${d.qty}</td>
        <td>${d.ship_by}</td>
        <td class="${d.status === 'LATE' ? 'late' : d.status === 'ONTIME' || d.status === 'SHIPPED' ? 'ontime' : ''}">${d.status}</td>
        <td>${d.delivery_date}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">Drishti Line Side Board — Shipping Report — Generated ${new Date().toISOString()}</div>
  <script>window.onload = () => window.print()</script>
  </body></html>`)
  win.document.close()
}

export default function ShippingPanel({ data = {} }) {
  const [drillTarget, setDrillTarget] = useState(null)
  const {
    parts_shipped_today = 0,
    shipment_count = 0,
    pending_trucks = 0,
    loaded_trucks = 0,
    shipping_dock_status = 'UNKNOWN',
    on_time_rate_pct = 0,
    next_shipment = '',
    delivery_eta = '',
    customer_deliveries = [],
  } = data

  if (drillTarget) {
    return <CustomerDetail customer={drillTarget} deliveries={customer_deliveries} onBack={() => setDrillTarget(null)} />
  }

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={S.title}>SHIPPING STATUS — Logistics & Deliveries</div>
        <button
          onClick={() => printShipping(data)}
          style={{
            background: '#161b22', border: '1px solid #21262d', borderRadius: 8,
            color: '#8b949e', fontSize: 12, padding: '7px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >🖨 Print</button>
      </div>

      {/* KPI cards */}
      <div style={S.topGrid}>
        <div style={S.kpiCard('#00d4ff')}>
          <div style={S.kpiLabel}>Parts Shipped Today</div>
          <div style={S.kpiVal('#00d4ff')}>{parts_shipped_today.toLocaleString()}</div>
          <div style={S.kpiSub}>units dispatched</div>
        </div>
        <div style={S.kpiCard('#a78bfa')}>
          <div style={S.kpiLabel}>Shipments Today</div>
          <div style={S.kpiVal('#a78bfa')}>{shipment_count}</div>
          <div style={S.kpiSub}>work orders shipped</div>
        </div>
        <div style={S.kpiCard('#00ff88')}>
          <div style={S.kpiLabel}>Trucks Loaded</div>
          <div style={S.kpiVal('#00ff88')}>{loaded_trucks}</div>
          <div style={S.kpiSub}>{pending_trucks} pending</div>
        </div>
        <div style={S.kpiCard(on_time_rate_pct >= 95 ? '#00ff88' : on_time_rate_pct >= 85 ? '#ffaa00' : '#ff4444')}>
          <div style={S.kpiLabel}>On-Time Rate</div>
          <div style={S.kpiVal(on_time_rate_pct >= 95 ? '#00ff88' : on_time_rate_pct >= 85 ? '#ffaa00' : '#ff4444')}>{on_time_rate_pct}%</div>
          <div style={S.kpiSub}>delivery performance</div>
        </div>
      </div>

      {/* Shipping dock banner */}
      <div style={S.dockBanner(shipping_dock_status)}>
        <div>
          <div style={S.dockLabel}>Shipping Dock Status</div>
          <div style={S.dockVal(shipping_dock_status)}>{shipping_dock_status}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>Next Shipment ETA</div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#e6edf3' }}>{delivery_eta}</div>
        </div>
      </div>

      {/* Next shipment */}
      {next_shipment && (
        <div style={S.nextShipment}>
          <div>
            <div style={S.nextLabel}>Next Shipment</div>
            <div style={S.nextVal}>{next_shipment}</div>
          </div>
        </div>
      )}

      {/* Customer deliveries table */}
      <div style={S.sectionTitle}>Customer Deliveries</div>
      {customer_deliveries.length === 0 ? (
        <div style={S.empty}>No deliveries scheduled</div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Work Order', 'Customer', 'Part', 'Qty', 'Ship By', 'Status', 'Delivery'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customer_deliveries.map((d, i) => {
                const sc = STATUS_COLORS[d.status] || '#8b949e'
                return (
                  <tr key={i} onClick={() => setDrillTarget(d.customer)} title={`View ${d.customer} details`} style={{ ...(i % 2 === 0 ? S.trEven : S.trOdd), cursor: 'pointer' }}>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#00d4ff' }}>{d.work_order}</span></td>
                    <td style={S.td}>{d.customer}</td>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.part_number}</span></td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>{d.qty}</td>
                    <td style={{ ...S.td, color: '#8b949e' }}>{d.ship_by}</td>
                    <td style={S.td}><span style={S.badge(sc)}>{d.status}</span></td>
                    <td style={{ ...S.td, color: '#6e7681', fontSize: 11 }}>{d.delivery_date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
