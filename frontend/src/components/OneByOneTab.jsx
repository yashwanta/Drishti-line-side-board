import React, { useState, useRef, useEffect } from 'react'

// ── Sketch pad (draw with mouse / touch) ──────────────────────────────────────
function SketchPad({ height = 110, label }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)

  const pos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const sx = canvas.width  / r.width
    const sy = canvas.height / r.height
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy }
  }

  const start = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = pos(e, canvasRef.current) }
  const move  = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const p = pos(e, canvas)
    ctx.beginPath(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(p.x, p.y); ctx.stroke()
    lastPos.current = p
  }
  const end = () => { drawing.current = false }

  const clear = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
  }

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      {label && <div style={{ fontSize: 9, color: '#888', marginBottom: 2, fontStyle: 'italic' }}>✏ {label}</div>}
      <canvas
        ref={canvasRef} width={700} height={height}
        style={{ width: '100%', height, border: '1px dashed #bbb', borderRadius: 3,
                 background: '#fefefe', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button onClick={clear} style={{
        position: 'absolute', top: label ? 18 : 2, right: 3,
        fontSize: 9, padding: '1px 6px', cursor: 'pointer',
        background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 3, color: '#555',
      }}>Clear</button>
    </div>
  )
}

// ── Shared field styles ────────────────────────────────────────────────────────
const F = {
  input: {
    border: 'none', borderBottom: '1px solid #999', background: 'transparent',
    fontSize: 12, color: '#111', width: '100%', padding: '2px 4px', outline: 'none',
    fontFamily: 'inherit',
  },
  textarea: {
    border: '1px solid #ccc', borderRadius: 3, background: '#fafafa',
    fontSize: 12, color: '#111', width: '100%', padding: '5px 7px',
    outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
  },
  label: { fontSize: 10, color: '#555', display: 'block', marginBottom: 2 },
  sectionHeader: {
    fontSize: 11, fontWeight: 700, color: '#1a3a6b', background: '#e8f0fe',
    padding: '4px 8px', marginBottom: 6, borderLeft: '3px solid #1a3a6b',
    letterSpacing: 0.3,
  },
  sectionWrap: { marginBottom: 10 },
  row: { display: 'flex', gap: 6, marginBottom: 6 },
  field: (flex = 1) => ({ flex, minWidth: 0 }),
}

// ── Empty form ─────────────────────────────────────────────────────────────────
function emptySheet() {
  return {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    plant: '', station: 'All', line: 'All', process: '',
    name: '', date: new Date().toLocaleDateString('en-GB'),
    phenomenon: '',
    quantify: '',
    placeOfOccurrence: '', exactlyWhenWhere: '',
    processConditions: [
      { condition: '', standard: '', actual: '', okng: '' },
      { condition: '', standard: '', actual: '', okng: '' },
      { condition: '', standard: '', actual: '', okng: '' },
      { condition: '', standard: '', actual: '', okng: '' },
    ],
    pointOfCause: '',
    fiveWhyPOC: '',
    whys: ['', '', '', '', ''],
    rootCause: '',
    cmRootCause: '',
    shortTerm: '',
    longTerm: '',
    validateCM: '',
    standardize: '',
    sustain: '',
    readAcross: '',
  }
}

// ── Full 1x1 form ──────────────────────────────────────────────────────────────
function OneByOneForm({ initial, onSave, onBack }) {
  const [d, setD] = useState(initial || emptySheet())

  const set = (key, val) => setD(prev => ({ ...prev, [key]: val }))

  const setWhy = (i, val) => setD(prev => {
    const w = [...prev.whys]; w[i] = val; return { ...prev, whys: w }
  })
  const setPC = (i, key, val) => setD(prev => {
    const rows = prev.processConditions.map((r, idx) => idx === i ? { ...r, [key]: val } : r)
    return { ...prev, processConditions: rows }
  })

  const save = () => onSave({ ...d, updatedAt: new Date().toISOString() })

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 20px', fontFamily: 'Arial, sans-serif' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#1a3a6b', padding: '8px 16px', marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid #6ea3ff', color: '#aac4ff',
          padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
        }}>← Back to list</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
          1×1 Problem Solving Sheet
        </span>
        <button onClick={save} style={{
          background: '#00d4ff', border: 'none', color: '#000',
          padding: '5px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>Save Sheet</button>
      </div>

      {/* Paper form */}
      <div style={{ background: '#fff', margin: '0 16px', borderRadius: 6,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* ── FORM HEADER ───────────────────────────────────────────────── */}
        <div style={{ borderBottom: '2px solid #1a3a6b', padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
            {/* Left header fields */}
            <div style={{ flex: 2, borderRight: '1px solid #ccc', paddingRight: 10 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={F.label}>Plant</label>
                  <input style={F.input} value={d.plant} onChange={e => set('plant', e.target.value)} placeholder="Plant name" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={F.label}>Station</label>
                  <input style={F.input} value={d.station} onChange={e => set('station', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={F.label}>Line</label>
                  <input style={F.input} value={d.line} onChange={e => set('line', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={F.label}>Process</label>
                  <input style={F.input} value={d.process} onChange={e => set('process', e.target.value)} placeholder="e.g. Printing Labels" />
                </div>
              </div>
            </div>

            {/* Centre title */}
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRight: '1px solid #ccc', padding: '0 10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#1a3a6b', letterSpacing: 1 }}>1×1 Problem Solving Sheet</div>
              </div>
            </div>

            {/* Right header fields */}
            <div style={{ flex: 1.2, paddingLeft: 10 }}>
              <div style={{ marginBottom: 4 }}>
                <label style={F.label}>Name</label>
                <input style={F.input} value={d.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={F.label}>Date</label>
                <input style={F.input} value={d.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>
                LN-T-5562 1x1 PS Sheet Rev 6<br />Issue Date: 04-JAN-2023
              </div>
            </div>
          </div>
        </div>

        {/* ── TWO-COLUMN BODY ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', minHeight: 800 }}>

          {/* ════════════════ LEFT COLUMN ════════════════════════════════ */}
          <div style={{ borderRight: '2px solid #1a3a6b', padding: '10px 12px' }}>

            {/* SECTION 1 */}
            <div style={F.sectionWrap}>
              <div style={F.sectionHeader}>
                1. Problem / Phenomenon <span style={{ fontWeight: 400, fontSize: 10 }}>(The abnormality that you see)</span>
              </div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4, fontStyle: 'italic' }}>
                Sketch of abnormal condition with KEY POINT
              </div>
              <SketchPad height={100} label="Sketch the abnormal condition" />
              <textarea
                rows={3} style={{ ...F.textarea, marginTop: 6 }}
                placeholder="Describe the problem / abnormality you see…"
                value={d.phenomenon}
                onChange={e => set('phenomenon', e.target.value)}
              />
            </div>

            {/* SECTION 2 */}
            <div style={{ ...F.sectionWrap, borderTop: '1px solid #ccc', paddingTop: 8 }}>
              <div style={F.sectionHeader}>
                2. Quantify <span style={{ fontWeight: 400, fontSize: 10 }}>(What is impact to line performance? What is history?)</span>
              </div>
              <textarea
                rows={3} style={F.textarea}
                placeholder="History (frequency, dates)…&#10;Impact on line performance…"
                value={d.quantify}
                onChange={e => set('quantify', e.target.value)}
              />
            </div>

            {/* SECTION 3 */}
            <div style={{ ...F.sectionWrap, borderTop: '1px solid #ccc', paddingTop: 8 }}>
              <div style={F.sectionHeader}>
                3. Place of Occurrence <span style={{ fontWeight: 400, fontSize: 10 }}>(When &amp; Where did the abnormality occur?)</span>
              </div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4, fontStyle: 'italic' }}>
                Sketch abnormal condition in process flow with Key Point — mark "Abnormality occurs here"
              </div>
              <SketchPad height={90} label="Process flow sketch" />
              <div style={{ ...F.row, marginTop: 8 }}>
                <div style={F.field(1)}>
                  <label style={F.label}>Place of Occurrence</label>
                  <input style={F.input} value={d.placeOfOccurrence} onChange={e => set('placeOfOccurrence', e.target.value)} placeholder="e.g. Packing Station" />
                </div>
              </div>
              <div style={F.row}>
                <div style={F.field(1)}>
                  <label style={F.label}>Exactly When &amp; Where the Abnormality Occurred</label>
                  <input style={F.input} value={d.exactlyWhenWhere} onChange={e => set('exactlyWhenWhere', e.target.value)} placeholder="e.g. At label printing stage during pack-fill…" />
                </div>
              </div>
            </div>

            {/* SECTION 4 */}
            <div style={{ ...F.sectionWrap, borderTop: '1px solid #ccc', paddingTop: 8 }}>
              <div style={F.sectionHeader}>
                4. Point of Cause <span style={{ fontWeight: 400, fontSize: 10 }}>(Necessary Process condition not met causing abnormality?)</span>
              </div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>
                A. Rule in or Rule out Necessary Process Conditions (or Input)<br />
                B. Determine the Necessary Process condition that DIRECTLY caused abnormality
              </div>

              {/* Process conditions table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: '#e8f0fe' }}>
                    {['Necessary Process Condition', 'Standard', 'Actual', 'OK / NG'].map((h, i) => (
                      <th key={i} style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'left',
                                           fontWeight: 700, color: '#1a3a6b', fontSize: 10,
                                           width: i === 3 ? 60 : 'auto' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.processConditions.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                      <td style={{ border: '1px solid #ddd', padding: '3px 4px' }}>
                        <input style={{ ...F.input, borderBottom: 'none', fontSize: 11 }}
                          value={row.condition} onChange={e => setPC(i, 'condition', e.target.value)} />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3px 4px' }}>
                        <input style={{ ...F.input, borderBottom: 'none', fontSize: 11 }}
                          value={row.standard} onChange={e => setPC(i, 'standard', e.target.value)} />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3px 4px' }}>
                        <input style={{ ...F.input, borderBottom: 'none', fontSize: 11 }}
                          value={row.actual} onChange={e => setPC(i, 'actual', e.target.value)} />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3px 4px', textAlign: 'center' }}>
                        <select value={row.okng} onChange={e => setPC(i, 'okng', e.target.value)}
                          style={{ fontSize: 11, border: 'none', background: 'transparent',
                                   cursor: 'pointer', fontWeight: 700,
                                   color: row.okng === 'OK' ? '#007700' : row.okng === 'NG' ? '#cc0000' : '#555' }}>
                          <option value="">—</option>
                          <option value="OK">OK</option>
                          <option value="NG">NG</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SketchPad height={80} label="Sketch of point of cause with KEY POINT" />

              <div style={{ marginTop: 8 }}>
                <label style={{ ...F.label, fontWeight: 700, color: '#c00' }}>Point of Cause:</label>
                <input style={{ ...F.input, borderBottom: '2px solid #c00', fontSize: 12, fontWeight: 600 }}
                  value={d.pointOfCause} onChange={e => set('pointOfCause', e.target.value)}
                  placeholder="State the root cause condition…" />
              </div>
            </div>
          </div>

          {/* ════════════════ RIGHT COLUMN ═══════════════════════════════ */}
          <div style={{ padding: '10px 12px' }}>

            {/* SECTION 5 — 5-Why */}
            <div style={F.sectionWrap}>
              <div style={F.sectionHeader}>
                5. 5-Why <span style={{ fontWeight: 400, fontSize: 10 }}>(Point of Cause:&nbsp;</span>
                <input
                  style={{ ...F.input, display: 'inline', width: 180, fontSize: 10, fontWeight: 400, color: '#333', borderBottomColor: '#888' }}
                  value={d.fiveWhyPOC}
                  onChange={e => set('fiveWhyPOC', e.target.value)}
                  placeholder="state point of cause"
                />
                <span style={{ fontWeight: 400, fontSize: 10 }}>)</span>
              </div>

              {d.whys.map((why, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                  {/* Why chain icon */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#1a3a6b', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      W{i + 1}
                    </div>
                    {i < 4 && <div style={{ width: 1, height: 10, background: '#bbb', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...F.label, fontWeight: 600, color: '#333' }}>Why</label>
                    <textarea rows={2} style={{ ...F.textarea, fontSize: 11 }}
                      placeholder={`Why ${i + 1}…`}
                      value={why}
                      onChange={e => setWhy(i, e.target.value)} />
                  </div>
                  {/* Therefore arrow */}
                  <div style={{
                    fontSize: 16, color: '#1a3a6b', paddingTop: 18, flexShrink: 0,
                    fontWeight: 900, opacity: why ? 1 : 0.25,
                  }}>
                    →
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '2px solid #c00', paddingTop: 8, marginTop: 4 }}>
                <label style={{ ...F.label, fontWeight: 700, color: '#c00', fontSize: 11 }}>
                  R/C — Root Cause
                </label>
                <input style={{ ...F.input, borderBottom: '2px solid #c00', fontSize: 12, fontWeight: 600, color: '#900' }}
                  value={d.rootCause} onChange={e => set('rootCause', e.target.value)}
                  placeholder="State the confirmed root cause…" />
              </div>
            </div>

            {/* SECTION 6 — Countermeasures */}
            <div style={{ ...F.sectionWrap, borderTop: '1px solid #ccc', paddingTop: 8 }}>
              <div style={F.sectionHeader}>
                6. Countermeasures <span style={{ fontWeight: 400, fontSize: 10 }}>(Root Cause:&nbsp;</span>
                <input
                  style={{ ...F.input, display: 'inline', width: 160, fontSize: 10, fontWeight: 400, color: '#333', borderBottomColor: '#888' }}
                  value={d.cmRootCause}
                  onChange={e => set('cmRootCause', e.target.value)}
                  placeholder="root cause"
                />
                <span style={{ fontWeight: 400, fontSize: 10 }}>)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ ...F.label, fontWeight: 700 }}>Short Term</label>
                  <textarea rows={3} style={F.textarea}
                    placeholder="Immediate actions…"
                    value={d.shortTerm} onChange={e => set('shortTerm', e.target.value)} />
                </div>
                <div>
                  <label style={{ ...F.label, fontWeight: 700 }}>Long Term</label>
                  <textarea rows={3} style={F.textarea}
                    placeholder="Permanent fix…"
                    value={d.longTerm} onChange={e => set('longTerm', e.target.value)} />
                </div>
              </div>

              <SketchPad height={80} label="Sketch of countermeasure with KEY POINT" />

              <div style={{ marginTop: 8 }}>
                <label style={F.label}><strong>Validate the C/M:</strong></label>
                <textarea rows={2} style={F.textarea}
                  placeholder="How will you validate the countermeasure works?"
                  value={d.validateCM} onChange={e => set('validateCM', e.target.value)} />
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={F.label}><strong>Standardize:</strong></label>
                <textarea rows={2} style={F.textarea}
                  placeholder="How will this be standardised? (SOP, training, etc.)"
                  value={d.standardize} onChange={e => set('standardize', e.target.value)} />
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={F.label}><strong>Sustain:</strong></label>
                <textarea rows={2} style={F.textarea}
                  placeholder="How will you sustain the fix? (audits, checks, etc.)"
                  value={d.sustain} onChange={e => set('sustain', e.target.value)} />
              </div>
            </div>

            {/* SECTION 7 — Read Across */}
            <div style={{ ...F.sectionWrap, borderTop: '1px solid #ccc', paddingTop: 8 }}>
              <div style={F.sectionHeader}>7. Read Across</div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4, fontStyle: 'italic' }}>
                Where else could this same problem occur? List all similar stations / lines.
              </div>
              <textarea rows={4} style={F.textarea}
                placeholder="e.g. All MARS Printing Stations — WM15 through WM24…"
                value={d.readAcross} onChange={e => set('readAcross', e.target.value)} />
            </div>

          </div>{/* end right column */}
        </div>{/* end two-column body */}

        {/* ── FORM FOOTER ───────────────────────────────────────────────── */}
        <div style={{ borderTop: '2px solid #1a3a6b', padding: '8px 12px',
                      display: 'flex', justifyContent: 'flex-end', gap: 10,
                      background: '#f5f7ff' }}>
          <button onClick={onBack} style={{
            padding: '6px 20px', borderRadius: 4, cursor: 'pointer',
            background: '#fff', border: '1px solid #999', fontSize: 12, color: '#555',
          }}>Cancel</button>
          <button onClick={save} style={{
            padding: '6px 24px', borderRadius: 4, cursor: 'pointer',
            background: '#1a3a6b', border: 'none', fontSize: 12,
            color: '#fff', fontWeight: 700,
          }}>💾 Save Sheet</button>
        </div>
      </div>
    </div>
  )
}

// ── Scanned sheet viewer ───────────────────────────────────────────────────────
function ScannedViewer({ sheet, onBack, onConvert }) {
  const isPDF = sheet.fileType === 'application/pdf'
  return (
    <div style={{ padding: '0 0 20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#1a3a6b', padding: '8px 16px', marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid #6ea3ff', color: '#aac4ff',
          padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
        }}>← Back to list</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
          📎 Scanned 1×1 Sheet — {sheet.filename}
        </span>
        <button onClick={onConvert} style={{
          background: '#00d4ff', border: 'none', color: '#000',
          padding: '5px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>+ Convert to Digital</button>
      </div>
      <div style={{ margin: '0 16px', background: '#fff', borderRadius: 6,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.25)', overflow: 'hidden',
                    display: 'flex', justifyContent: 'center', padding: 16 }}>
        {isPDF ? (
          <iframe
            src={sheet.scanData}
            title="Scanned Sheet"
            style={{ width: '100%', minHeight: 800, border: 'none' }}
          />
        ) : (
          <img
            src={sheet.scanData}
            alt="Scanned 1×1 sheet"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
        )}
      </div>
    </div>
  )
}

// ── Sheet list card ────────────────────────────────────────────────────────────
function SheetCard({ sheet, onOpen, onDelete }) {
  // ── Scanned variant ──────────────────────────────────────────────────────
  if (sheet.type === 'scanned') {
    const isPDF = sheet.fileType === 'application/pdf'
    return (
      <div style={{
        background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
        padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#a78bfa'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
        onClick={() => onOpen(sheet)}
      >
        {/* Thumbnail */}
        <div style={{
          width: 64, height: 80, flexShrink: 0, borderRadius: 4,
          background: '#161b22', border: '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {!isPDF && sheet.scanData ? (
            <img src={sheet.scanData} alt="scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 28 }}>📄</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 3 }}>
                {sheet.filename}
              </div>
              <div style={{ fontSize: 11, color: '#8b949e' }}>
                Uploaded {new Date(sheet.createdAt).toLocaleDateString('en-GB')}
                {sheet.name && ` · ${sheet.name}`}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(sheet.id) }}
              style={{ background: 'transparent', border: 'none', color: '#ff4444',
                       cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}
              title="Delete"
            >✕</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag label="📎 Scanned" color="#a78bfa" />
            <Tag label={isPDF ? 'PDF' : 'Image'} color="#6e7681" />
          </div>
        </div>
      </div>
    )
  }

  // ── Digital variant ──────────────────────────────────────────────────────
  const hasRC = !!sheet.rootCause
  const pocFilled = sheet.processConditions?.filter(r => r.condition).length || 0
  const whysFilled = sheet.whys?.filter(Boolean).length || 0
  const pct = Math.round(
    ([sheet.phenomenon, sheet.quantify, sheet.placeOfOccurrence, sheet.pointOfCause,
      sheet.rootCause, sheet.shortTerm, sheet.readAcross].filter(Boolean).length / 7) * 100
  )

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
      padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#00d4ff'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#21262d'}
      onClick={() => onOpen(sheet)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 3 }}>
            {sheet.process || '(No process)'} — {sheet.station || 'All Stations'}
          </div>
          <div style={{ fontSize: 11, color: '#8b949e' }}>
            {sheet.plant && `${sheet.plant}  ·  `}
            Line {sheet.line || '?'}  ·  {sheet.name || 'Unknown'}  ·  {sheet.date}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(sheet.id) }}
          style={{ background: 'transparent', border: 'none', color: '#ff4444',
                   cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
          title="Delete"
        >✕</button>
      </div>

      {/* Problem snippet */}
      {sheet.phenomenon && (
        <div style={{ margin: '8px 0', fontSize: 11, color: '#8b949e',
                      borderLeft: '2px solid #30363d', paddingLeft: 8,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {sheet.phenomenon}
        </div>
      )}

      {/* Progress bar + tags */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Tag label={`${pocFilled}/4 conditions`}  color={pocFilled === 4 ? '#00ff88' : '#ffcc00'} />
          <Tag label={`${whysFilled}/5 whys`}       color={whysFilled === 5 ? '#00ff88' : '#ffcc00'} />
          <Tag label={hasRC ? 'Root cause ✓' : 'No root cause'} color={hasRC ? '#00ff88' : '#ff4444'} />
        </div>
        <div style={{ height: 3, background: '#21262d', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#00ff88' : '#00d4ff',
                        borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 10, color: '#6e7681', marginTop: 3 }}>{pct}% complete</div>
      </div>
    </div>
  )
}

function Tag({ label, color }) {
  return (
    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
                   border: `1px solid ${color}`, color, background: 'transparent' }}>
      {label}
    </span>
  )
}

// ── Main tab export ────────────────────────────────────────────────────────────
export default function OneByOneTab() {
  const storageKey = 'lsb_1x1_sheets'
  const [sheets, setSheets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [editing, setEditing] = useState(null) // null = list, object = form/viewer
  const fileInputRef = useRef(null)

  const persist = (updated) => {
    setSheets(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleSave = (sheet) => {
    const idx = sheets.findIndex(s => s.id === sheet.id)
    const updated = idx >= 0
      ? sheets.map(s => s.id === sheet.id ? sheet : s)
      : [sheet, ...sheets]
    persist(updated)
    setEditing(null)
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this 1×1 sheet?')) persist(sheets.filter(s => s.id !== id))
  }

  // Convert a scanned sheet into a blank digital sheet pre-filled with filename as process
  const handleConvertToDigital = (scanned) => {
    const digital = {
      ...emptySheet(),
      process: scanned.filename.replace(/\.[^.]+$/, ''), // strip extension
      name: scanned.name || '',
      date: new Date(scanned.createdAt).toLocaleDateString('en-GB'),
    }
    setEditing(digital)
  }

  // File upload handler
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!ACCEPTED.includes(file.type)) {
      alert('Please upload an image (JPG, PNG, WEBP) or PDF file.')
      e.target.value = ''
      return
    }

    const MAX_MB = 10
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`File is too large. Maximum size is ${MAX_MB} MB.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const sheet = {
        id: Date.now(),
        type: 'scanned',
        createdAt: new Date().toISOString(),
        filename: file.name,
        fileType: file.type,
        scanData: ev.target.result,
        name: '',
      }
      persist([sheet, ...sheets])
    }
    reader.readAsDataURL(file)
    e.target.value = '' // reset so same file can be re-uploaded
  }

  const digitalCount = sheets.filter(s => s.type !== 'scanned').length
  const scannedCount = sheets.filter(s => s.type === 'scanned').length

  // ── List view ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={{ padding: 20 }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>1×1 Problem Solving Sheets</div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>
              LN-T-5562 Rev 6  ·  {digitalCount} digital  ·  {scannedCount} scanned
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'transparent', border: '1px solid #a78bfa', color: '#a78bfa',
                padding: '8px 18px', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              📎 Upload Scan
            </button>
            <button onClick={() => setEditing(emptySheet())} style={{
              background: '#00d4ff', border: 'none', color: '#000',
              padding: '8px 20px', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
            }}>
              + New 1×1 Sheet
            </button>
          </div>
        </div>

        {/* Empty state */}
        {sheets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6e7681' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>No 1×1 sheets yet</div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              Click <strong style={{ color: '#00d4ff' }}>+ New 1×1 Sheet</strong> to create a digital form
            </div>
            <div style={{ fontSize: 12, color: '#6e7681' }}>
              or <strong style={{ color: '#a78bfa' }}>📎 Upload Scan</strong> to attach a scanned physical sheet
            </div>
          </div>
        )}

        {/* Sheet cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {sheets.map(s => (
            <SheetCard key={s.id} sheet={s}
              onOpen={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Scanned viewer ─────────────────────────────────────────────────────────
  if (editing.type === 'scanned') {
    return (
      <ScannedViewer
        sheet={editing}
        onBack={() => setEditing(null)}
        onConvert={() => handleConvertToDigital(editing)}
      />
    )
  }

  // ── Digital form view ──────────────────────────────────────────────────────
  return (
    <OneByOneForm
      initial={editing}
      onSave={handleSave}
      onBack={() => setEditing(null)}
    />
  )
}
