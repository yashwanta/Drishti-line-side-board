import React, { useEffect, useState } from 'react'
import { noteCountsForDate } from '../utils/shiftNotes'

const STATUS_COLOR = {
  running:  { bg: '#0d2818', border: '#00ff88', dot: '#00ff88', label: 'RUNNING' },
  downtime: { bg: '#2a0a0a', border: '#ff4444', dot: '#ff4444', label: 'DOWNTIME' },
  idle:     { bg: '#161b22', border: '#8b949e', dot: '#8b949e', label: 'IDLE' },
}

function effColor(eff) {
  if (eff >= 90) return '#00ff88'
  if (eff >= 75) return '#ffcc00'
  return '#ff4444'
}

function StationCard({ station, active, onSelect, noteCount = 0 }) {
  const sc = STATUS_COLOR[station.status] || STATUS_COLOR.idle
  const eff = station.efficiency_pct || 0
  const color = effColor(eff)

  return (
    <div
      onClick={() => onSelect(station.resource_id)}
      style={{
        background: active ? '#0d1f35' : sc.bg,
        border: `1.5px solid ${active ? '#00d4ff' : sc.border}`,
        borderRadius: 10,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.18s',
        boxShadow: active ? '0 0 18px #00d4ff44' : 'none',
        position: 'relative',
        minWidth: 0,
      }}
    >
      {/* Active indicator */}
      {active && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 9, color: '#00d4ff', fontWeight: 700, letterSpacing: 1,
        }}>
          ● ACTIVE
        </div>
      )}

      {/* Station ID + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 20, fontWeight: 800, color: active ? '#00d4ff' : '#e6edf3',
          letterSpacing: 1,
        }}>
          {station.resource_id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: sc.dot,
          background: sc.bg, border: `1px solid ${sc.dot}`,
          borderRadius: 20, padding: '2px 7px', letterSpacing: 0.8,
        }}>
          {sc.label}
        </span>
        {noteCount > 0 && (
          <span style={{
            background: '#ff4444', color: '#fff', borderRadius: 10,
            padding: '1px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
          }}>📝 {noteCount}</span>
        )}
      </div>

      {/* Part number */}
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, fontFamily: 'monospace' }}>
        {station.part_number}
      </div>

      {/* Efficiency bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#6e7681' }}>EFFICIENCY</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{eff.toFixed(1)}%</span>
        </div>
        <div style={{ height: 4, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(eff, 100)}%`,
            background: color, borderRadius: 2,
            transition: 'width 0.4s',
          }} />
        </div>
      </div>

      {/* Actual vs Target */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <div>
          <div style={{ color: '#6e7681', marginBottom: 1 }}>ACTUAL</div>
          <div style={{ color: '#e6edf3', fontWeight: 700 }}>{station.actual}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6e7681', marginBottom: 1 }}>TARGET</div>
          <div style={{ color: '#8b949e' }}>{station.target}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#6e7681', marginBottom: 1 }}>SHIFT</div>
          <div style={{ color: '#8b949e' }}>{station.shift}</div>
        </div>
      </div>

      {/* Operator */}
      {station.operator && (
        <div style={{
          marginTop: 10, paddingTop: 8, borderTop: '1px solid #21262d',
          fontSize: 10, color: '#6e7681',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          👤 {station.operator}
        </div>
      )}
    </div>
  )
}

export default function StationsPanel({ stations, activeResource, onSelect }) {
  const [noteCounts, setNoteCounts] = useState({})

  useEffect(() => {
    setNoteCounts(noteCountsForDate(new Date()))
  }, [])

  if (!stations || stations.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6e7681', fontSize: 14 }}>
        Loading stations…
      </div>
    )
  }

  const running  = stations.filter(s => s.status === 'running').length
  const downtime = stations.filter(s => s.status === 'downtime').length
  const idle     = stations.filter(s => s.status === 'idle').length
  const avgEff   = stations.filter(s => s.status === 'running')
                           .reduce((a, s) => a + s.efficiency_pct, 0) / (running || 1)

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 24,
        padding: '14px 20px',
        background: '#0d1117', borderRadius: 10, border: '1px solid #21262d',
        flexWrap: 'wrap',
      }}>
        <Stat label="TOTAL STATIONS" value={stations.length} color="#e6edf3" />
        <Stat label="RUNNING"  value={running}  color="#00ff88" />
        <Stat label="DOWNTIME" value={downtime} color="#ff4444" />
        <Stat label="IDLE"     value={idle}     color="#8b949e" />
        <Stat label="AVG EFF (RUNNING)" value={`${avgEff.toFixed(1)}%`} color={effColor(avgEff)} />
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6e7681', alignSelf: 'center' }}>
          Click a station to load its dashboard
        </div>
      </div>

      {/* Station grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
      }}>
        {stations.map(s => (
          <StationCard
            key={s.resource_id}
            station={s}
            active={s.resource_id === activeResource}
            onSelect={onSelect}
            noteCount={noteCounts[s.resource_id] || 0}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
