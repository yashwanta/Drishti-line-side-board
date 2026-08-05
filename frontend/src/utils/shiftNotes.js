const PREFIX = 'lsb_notes_'
const MAX_NOTES = 50

export function localDateKey(date = new Date()) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function notesStorageKey(resource, date = new Date(), shift = 2) {
  return `${PREFIX}${resource}*${localDateKey(date)}*${shift}`
}

export function readShiftNotes(resource, date = new Date(), shift = 2) {
  try {
    const parsed = JSON.parse(localStorage.getItem(notesStorageKey(resource, date, shift)) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeShiftNotes(resource, date, shift, notes) {
  const capped = notes.slice(0, MAX_NOTES)
  try {
    localStorage.setItem(notesStorageKey(resource, date, shift), JSON.stringify(capped))
  } catch {
    // Notes remain usable for this session if browser storage is unavailable.
  }
  return capped
}

function entriesForDate(date = new Date()) {
  const wantedDate = localDateKey(date)
  const entries = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(PREFIX)) continue
      const match = key.match(/^lsb_notes_(.+)\*(\d{4}-\d{2}-\d{2})\*(\d+)$/)
      if (!match || match[2] !== wantedDate) continue
      const [, resource, noteDate, shift] = match
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(parsed)) continue
      parsed.forEach(note => entries.push({ ...note, resource, date: noteDate, shift: Number(shift) }))
    }
  } catch {
    return []
  }
  return entries
}

export function noteCountsForDate(date = new Date()) {
  return entriesForDate(date).reduce((counts, note) => {
    counts[note.resource] = (counts[note.resource] || 0) + 1
    return counts
  }, {})
}

export function recentNotesForDate(date = new Date(), limit = 5) {
  return entriesForDate(date)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
}

export function noteTime(note) {
  const created = new Date(note?.createdAt)
  if (!Number.isNaN(created.getTime())) {
    return created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return note?.time || '--:--'
}
