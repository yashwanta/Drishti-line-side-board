import React from 'react'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 20, letterSpacing: 1 },
  offline: {
    background: '#161b22', border: '1px solid #ffaa0033', borderRadius: 10,
    padding: 32, textAlign: 'center', color: '#ffaa00', fontSize: 14,
  },
  topGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 20 },
  kpiCard: (color) => ({
    background: '#161b22', border: `1px solid ${color}22`,
    borderTop: `3px solid ${color}`, borderRadius: 10, padding: '14px 18px',
  }),
  kpiLabel: { fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  kpiVal: (color) => ({ fontFamily: 'monospace', fontSize: 28, fontWeight: 800, color }),
  kpiSub: { fontSize: 11, color: '#6e7681', marginTop: 4 },

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
  infoBadge: (color) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
    background: `${color}15`, color, border: `1px solid ${color}33`,
  }),
  scheduleRow: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 8,
    padding: '12px 16px', marginBottom: 8, display: 'grid',
    gridTemplateColumns: '1fr auto', gap: 8,
  },
  woNum: { fontSize: 12, fontWeight: 700, color: '#00d4ff' },
  woSub: { fontSize: 11, color: '#8b949e', marginTop: 3 },
  woPlan: { fontSize: 18, fontWeight: 800, color: '#e6edf3', fontFamily: 'monospace', textAlign: 'right' },
  woPlanLabel: { fontSize: 9, color: '#8b949e', textAlign: 'right' },
  sourceChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: '#21262d', border: '1px solid #30363d', borderRadius: 6,
    padding: '3px 10px', fontSize: 10, color: '#8b949e',
  },
  empty: { padding: 32, textAlign: 'center', color: '#8b949e', fontSize: 12 },
}

function KPICards({ kpis }) {
  const { planned_qty = 0, actual_qty = 0, scrap_qty = 0, fpy_pct = 0, oee_pct = 0, work_order, part_number, revision } = kpis

  return (
    <div style={S.topGrid}>
      <div style={S.kpiCard('#00d4ff')}>
        <div style={S.kpiLabel}>MARS Plan Qty</div>
        <div style={S.kpiVal('#00d4ff')}>{planned_qty}</div>
        <div style={S.kpiSub}>WO: {work_order || 'N/A'}</div>
      </div>
      <div style={S.kpiCard('#00ff88')}>
        <div style={S.kpiLabel}>MARS Actual Qty</div>
        <div style={S.kpiVal('#00ff88')}>{actual_qty}</div>
        <div style={S.kpiSub}>confirmed in MARS</div>
      </div>
      <div style={S.kpiCard('#ff4444')}>
        <div style={S.kpiLabel}>MARS Scrap</div>
        <div style={S.kpiVal('#ff4444')}>{scrap_qty}</div>
        <div style={S.kpiSub}>quality rejects</div>
      </div>
      <div style={S.kpiCard(fpy_pct >= 99 ? '#00ff88' : fpy_pct >= 95 ? '#ffaa00' : '#ff4444')}>
        <div style={S.kpiLabel}>MARS FPY %</div>
        <div style={S.kpiVal(fpy_pct >= 99 ? '#00ff88' : fpy_pct >= 95 ? '#ffaa00' : '#ff4444')}>{fpy_pct}%</div>
        <div style={S.kpiSub}>first pass yield</div>
      </div>
      <div style={S.kpiCard(oee_pct >= 85 ? '#00ff88' : oee_pct >= 65 ? '#ffaa00' : '#ff4444')}>
        <div style={S.kpiLabel}>OEE %</div>
        <div style={S.kpiVal(oee_pct >= 85 ? '#00ff88' : oee_pct >= 65 ? '#ffaa00' : '#ff4444')}>{oee_pct}%</div>
        <div style={S.kpiSub}>from MARS ERP</div>
      </div>
      <div style={S.kpiCard('#a78bfa')}>
        <div style={S.kpiLabel}>Part / Rev</div>
        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#a78bfa', marginTop: 4 }}>
          {part_number || 'N/A'}
        </div>
        <div style={S.kpiSub}>Rev: {revision || 'N/A'}</div>
      </div>
    </div>
  )
}

function QualityTable({ rows }) {
  if (!rows.length) return <div style={S.empty}>No quality defects recorded today in MARS</div>
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>
            {['Defect Code', 'Count', 'Total Qty', 'Last Inspector', 'Last Logged'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={i % 2 === 0 ? S.trEven : S.trOdd}>
              <td style={S.td}><span style={S.infoBadge('#ff4444')}>{r.DefectCode || r.defect_code}</span></td>
              <td style={{ ...S.td, color: '#ffaa00', fontWeight: 700 }}>{r.count}</td>
              <td style={S.td}>{r.total_qty}</td>
              <td style={S.td}>{r.last_inspector || '—'}</td>
              <td style={{ ...S.td, color: '#6e7681', fontSize: 11 }}>{r.last_ts || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScheduleList({ rows }) {
  if (!rows.length) return <div style={S.empty}>No scheduled work orders found in MARS</div>
  return rows.map((r, i) => (
    <div key={i} style={S.scheduleRow}>
      <div>
        <div style={S.woNum}>{r.WorkOrder || r.work_order}</div>
        <div style={S.woSub}>
          {r.PartNumber || r.part_number}  ·  Rev {r.Revision || r.revision || '—'}
          <span style={{ marginLeft: 10 }}>{r.scheduled_date}</span>
          {r.ShiftNum && <span style={{ marginLeft: 8, ...S.infoBadge('#00d4ff') }}>Shift {r.ShiftNum}</span>}
        </div>
      </div>
      <div>
        <div style={S.woPlan}>{r.PlannedQty || r.planned_qty}</div>
        <div style={S.woPlanLabel}>PLANNED QTY</div>
      </div>
    </div>
  ))
}

export default function MARSPanel({ kpis = {}, production = [], quality = [], schedule = [], error = null }) {
  if (error) {
    return (
      <div style={S.wrap}>
        <div style={S.offline}>
          ⚠ MARS SQL Server is not reachable.<br/>
          <small style={{ color: '#8b949e', marginTop: 8, display: 'block' }}>
            Set MARS_DB_HOST, MARS_DB_NAME, MARS_DB_USER, MARS_DB_PASS in backend-java/.env
          </small>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.title}>MARS DATABASE — ERP / MES Live Data</div>
        <div style={S.sourceChip}>📊 SQL Server · MARS DB</div>
      </div>

      <KPICards kpis={kpis} />

      <div style={S.sectionTitle}>Quality Defects Today (MARS)</div>
      <QualityTable rows={quality} />

      <div style={S.sectionTitle}>Work Order Schedule (Next 10)</div>
      <ScheduleList rows={schedule} />
    </div>
  )
}
