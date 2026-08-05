import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatHour12 } from '../utils/time'
import { localDateKey, noteTime, readShiftNotes, writeShiftNotes } from '../utils/shiftNotes'

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
    cursor: confirmed ? 'default' : 'pointer',
    fontSize: 11,
    fontWeight: 700,
    background: confirmed ? '#21262d' : '#00d4ff22',
    color: confirmed ? '#8b949e' : '#00d4ff',
    border: `1px solid ${confirmed ? '#30363d' : '#00d4ff44'}`,
  }),
  empty: { padding: 48, textAlign: 'center', color: '#8b949e' },
  notesPanel: {
    marginTop: 22, padding: 18, background: '#0d1117',
    border: '1px solid #21262d', borderRadius: 10,
  },
  tag: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 20,
    color: '#c9d1d9', padding: '5px 10px', fontSize: 11, cursor: 'pointer',
  },
  textarea: {
    width: '100%', minHeight: 74, resize: 'vertical', boxSizing: 'border-box',
    background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
    color: '#e6edf3', padding: '10px 12px', fontSize: 13, fontFamily: 'Arial, sans-serif',
    outline: 'none', lineHeight: 1.5,
  },
}

const NOTE_TAGS = ['🔧 Tooling', '⚠ Quality', '🚛 Material', '📋 General']
const CATEGORY_ICONS = { Tooling: '🔧', Quality: '⚠', Material: '🚛', General: '📋' }

function noteParts(text) {
  for (const [category, icon] of Object.entries(CATEGORY_ICONS)) {
    const prefix = `${icon} ${category}: `
    if (text.startsWith(prefix)) return { category, body: text.slice(prefix.length) }
  }
  return { category: 'General', body: text }
}

export default function ProductionTab({ rows = [], resource, shift, selectedDate = new Date(), onRefresh }) {
  const [confirming, setConfirming] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState([])
  const [hoveredNote, setHoveredNote] = useState(null)

  useEffect(() => {
    setNotes(readShiftNotes(resource, selectedDate, shift))
    setNoteText('')
  }, [resource, selectedDate, shift])

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

  function postNote() {
    const text = noteText.trim()
    if (!text) return
    const createdAt = new Date().toISOString()
    const { category, body } = noteParts(text)
    const note = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, category, createdAt }
    const next = writeShiftNotes(resource, selectedDate, shift, [note, ...notes])
    setNotes(next)
    setNoteText('')
    api.postNote({
      resource_id: resource,
      shift,
      date: localDateKey(selectedDate),
      text: body,
      category,
    }).catch(() => {})
  }

  function deleteNote(id) {
    const next = writeShiftNotes(resource, selectedDate, shift, notes.filter(note => note.id !== id))
    setNotes(next)
  }

  return (
    <div style={S.wrap}>
      <div style={S.title}>HOURLY PRODUCTION LOG — Today's Shift {shift}</div>
      {rows.length === 0 ? (
        <div style={{ ...S.empty, ...S.tableWrap }}>No production records for this shift yet.</div>
      ) : (
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
                <td style={S.td}><b>{formatHour12(row.hour)}</b></td>
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
      )}

      <section style={S.notesPanel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700 }}>📝 Shift Notes</div>
          <span style={{
            background: notes.length ? '#00d4ff' : '#30363d', color: notes.length ? '#0a0e14' : '#8b949e',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            fontFamily: "'Courier New', monospace",
          }}>{notes.length}</span>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
          {NOTE_TAGS.map(tag => (
            <button key={tag} type="button" style={S.tag} onClick={() => setNoteText(`${tag}: `)}>{tag}</button>
          ))}
        </div>

        <textarea
          rows={3}
          maxLength={1000}
          value={noteText}
          onChange={event => setNoteText(event.target.value)}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') postNote()
          }}
          placeholder="Add a note... (e.g. 'Tool changed at 14:30', 'Material delay resolved', 'Supervisor notified of scrap spike')"
          style={S.textarea}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 9 }}>
          <button
            type="button"
            disabled={!noteText.trim()}
            onClick={postNote}
            style={{
              background: noteText.trim() ? '#00d4ff22' : '#161b22',
              color: noteText.trim() ? '#00d4ff' : '#484f58',
              border: `1px solid ${noteText.trim() ? '#00d4ff66' : '#30363d'}`,
              borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700,
              cursor: noteText.trim() ? 'pointer' : 'not-allowed',
            }}
          >Post Note</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: notes.length ? 14 : 0 }}>
          {notes.map(note => (
            <div
              key={note.id}
              onMouseEnter={() => setHoveredNote(note.id)}
              onMouseLeave={() => setHoveredNote(null)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px',
                background: '#161b22', border: '1px solid #21262d', borderRadius: 7,
              }}
            >
              <span style={{
                color: '#6e7681', background: '#0d1117', border: '1px solid #21262d',
                borderRadius: 5, padding: '2px 6px', fontSize: 10,
                fontFamily: "'Courier New', monospace", whiteSpace: 'nowrap',
              }}>{noteTime(note)}</span>
              <span style={{ flex: 1, color: '#c9d1d9', fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.text}</span>
              <button
                type="button"
                aria-label="Delete note"
                title="Delete note"
                onClick={() => deleteNote(note.id)}
                style={{
                  background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer',
                  fontSize: 14, lineHeight: 1, opacity: hoveredNote === note.id ? 1 : 0,
                  transition: 'opacity 0.15s', padding: 2,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
