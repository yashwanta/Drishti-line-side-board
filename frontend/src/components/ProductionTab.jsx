import React, { useState } from 'react'
import { api } from '../api/client'

const S = {
  wrap: { padding: 24 },
  title: { fontSize: 14, color: '#8b949e', marginBottom: 16, letterSpacing: 1 },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    background: '#161b22',
    color: '#8b949e',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: '1px solid #21262d',
    whiteSpace: 'nowrap',
  },
  td: { padding: '11px 14px', borderBottom: '1px solid #21262d16', color: '#e6edf3', whiteSpace: 'nowrap' },
  trEven: { background: '#0d1117' },
  trOdd:  { background: '#161b2280' },
  gap: (v) => ({
    fontWeight: 700,
    color: v < 0 ? '#ff4444' : v === 0 ? '#00ff88' : '#00d4ff',
  }),
  confirmBtn: (confirmed) => ({
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: confirmed ? 'default' : 'pointer',
    fontSize: 11,
    fontWeight: 700,
    background: confirmed ? '#21262d' : '#00d4ff22',
    color: confirmed ? '#8b949e' : '#00d4ff',
    border: `1px solid ${confirmed ? '#30363d' : '#00d4ff44'}`,
  }),
  empty: { padding: 48, textAlign: 'center', color: '#8b949e' },
}

export default function ProductionTab({ rows = [], resource, shift, onRefresh }) {
  const [confirming, setConfirming] = useState(null)

  async function handleConfirm(hour, confirmed) {
    if (confirmed) return
    setConfirming(hour)
    try {
      await api.confirm(resource, shift, hour)
      onRefresh && onRefresh()
    } catch (e) {
      alert('Confirm failed: ' + e.message)
    } finally {
      setConfirming(null)
    }
  }

  if (!rows.length) {
    return (
      <div style={S.wrap}>
        <div style={S.empty}>No production records for today's shift yet.</div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.title}>HOURLY PRODUCTION LOG — Today's Shift {shift}</div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Hour', 'Part #', 'Operator', 'Plan', 'Actual', 'Good/Hr', 'Scrap', 'Gap', 'Cycle (s)', 'Notes', 'Status'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.hour} style={i % 2 === 0 ? S.trEven : S.trOdd}>
                <td style={S.td}><b>{String(row.hour).padStart(2,'0')}:00</b></td>
                <td style={S.td}>{row.part_number || '—'}</td>
                <td style={S.td}>{row.operator || '—'}</td>
                <td style={S.td}>{row.plan}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#00d4ff' }}>{row.actual}</td>
                <td style={S.td}>{row.good_count}</td>
                <td style={{ ...S.td, color: row.scrap_count > 0 ? '#ff4444' : '#8b949e' }}>{row.scrap_count}</td>
                <td style={{ ...S.td, ...S.gap(row.gap) }}>{row.gap > 0 ? '+' : ''}{row.gap}</td>
                <td style={{ ...S.td, color: '#a78bfa' }}>{row.cycle_time_sec > 0 ? row.cycle_time_sec.toFixed(1) : '—'}</td>
                <td style={{ ...S.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.notes || '—'}</td>
                <td style={S.td}>
                  <button
                    style={S.confirmBtn(row.confirmed)}
                    disabled={row.confirmed || confirming === row.hour}
                    onClick={() => handleConfirm(row.hour, row.confirmed)}
                  >
                    {row.confirmed
                      ? `✓ ${row.confirmed_by || 'Confirmed'}`
                      : confirming === row.hour
                      ? '...'
                      : 'Confirm'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
