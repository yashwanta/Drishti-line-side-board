import React, { useState } from 'react'
import { api } from '../api/client'

const COLORS = { bg: '#0a0e14', panel: '#0d1117', card: '#161b22', border: '#21262d', cyan: '#00d4ff', green: '#00ff88', amber: '#ffaa00', red: '#ff4444', text: '#e6edf3', muted: '#8b949e' }
const mono = "'Courier New', monospace"

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', background: COLORS.bg, color: COLORS.text,
  border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: '10px 12px',
  fontSize: 13, outline: 'none', fontFamily: mono,
}
const buttonStyle = (color = COLORS.cyan) => ({
  background: `${color}18`, border: `1px solid ${color}`, color, borderRadius: 8,
  padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
})

export default function SetupScreen({ onComplete }) {
  const [choice, setChoice] = useState(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ server: '', port: 1433, database: '', username: '', password: '' })
  const [testing, setTesting] = useState(false)
  const [connectionMessage, setConnectionMessage] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null)

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function useDemo() {
    setError('')
    try {
      await api.setupDemo()
      onComplete()
    } catch (err) {
      setError(err.message || 'Could not enable demo mode')
    }
  }

  async function testConnection(event) {
    event.preventDefault()
    setTesting(true)
    setError('')
    setConnectionMessage('')
    try {
      const result = await api.testConnection({ ...form, port: Number(form.port) || 1433 })
      if (!result.ok) throw new Error(result.error || 'Connection failed')
      setConnectionMessage(`✓ ${result.message}`)
      setStep(2)
    } catch (err) {
      setError(`✕ ${err.message || 'Connection failed'}`)
    } finally {
      setTesting(false)
    }
  }

  async function importWorkbook(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError('')
    setSummary(null)
    try {
      const result = await api.importExcel(file)
      setSummary(result)
      window.setTimeout(onComplete, 1800)
    } catch (err) {
      setError(err.message || 'Excel import failed')
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: 'min(760px, 100%)', background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, boxShadow: '0 22px 70px #000a', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${COLORS.border}`, background: 'linear-gradient(135deg, #0d1117, #161b22)' }}>
          <div style={{ color: COLORS.cyan, fontFamily: mono, fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>LINE SIDE BOARD</div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>First-run production setup</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {[1, 2].map(number => <div key={number} style={{ height: 4, flex: 1, borderRadius: 3, background: number <= step ? COLORS.cyan : COLORS.border }} />)}
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {step === 1 && (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>How should this board get its data?</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 22 }}>Connect the plant SQL Server for live production, or start immediately with safe demo data.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                <button onClick={() => setChoice('sql')} style={{ ...buttonStyle(choice === 'sql' ? COLORS.cyan : COLORS.muted), textAlign: 'left', padding: 18, background: choice === 'sql' ? '#00d4ff16' : COLORS.card }}>
                  <div style={{ fontSize: 17, marginBottom: 7 }}>🗄 Connect to SQL Server</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.5 }}>Use live MARS and production database records.</div>
                </button>
                <button onClick={useDemo} style={{ ...buttonStyle(COLORS.muted), textAlign: 'left', padding: 18, background: COLORS.card }}>
                  <div style={{ fontSize: 17, marginBottom: 7, color: COLORS.text }}>📊 Run with Demo Data</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.5 }}>Explore every dashboard feature without a database.</div>
                </button>
              </div>

              {choice === 'sql' && (
                <form onSubmit={testConnection} style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <Field label="Server"><input required value={form.server} onChange={e => update('server', e.target.value)} style={fieldStyle} placeholder="MARSDB01" /></Field>
                    <Field label="Port"><input required type="number" min="1" max="65535" value={form.port} onChange={e => update('port', e.target.value)} style={fieldStyle} /></Field>
                  </div>
                  <Field label="Database Name"><input required value={form.database} onChange={e => update('database', e.target.value)} style={fieldStyle} placeholder="MARS_PROD" /></Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Username"><input required value={form.username} onChange={e => update('username', e.target.value)} style={fieldStyle} autoComplete="username" /></Field>
                    <Field label="Password"><input type="password" value={form.password} onChange={e => update('password', e.target.value)} style={fieldStyle} autoComplete="current-password" /></Field>
                  </div>
                  <button disabled={testing} type="submit" style={{ ...buttonStyle(COLORS.cyan), marginTop: 8, opacity: testing ? 0.6 : 1 }}>{testing ? 'Testing connection…' : 'Test & Save Connection'}</button>
                </form>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ color: COLORS.green, fontSize: 12, fontFamily: mono, marginBottom: 12 }}>{connectionMessage}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 7 }}>Your database is connected and empty.</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 22 }}>Would you like to import historical data?</div>
              <div style={{ background: COLORS.card, border: `1px dashed ${COLORS.cyan}66`, borderRadius: 10, padding: 24, textAlign: 'center' }}>
                {!summary && <>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📎</div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>Assembly OEE workbook format · .xlsx only</div>
                  <label style={{ ...buttonStyle(COLORS.cyan), display: 'inline-block', opacity: importing ? 0.6 : 1 }}>
                    {importing ? 'Importing workbook…' : '📎 Upload Excel File'}
                    <input disabled={importing} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importWorkbook} style={{ display: 'none' }} />
                  </label>
                  {importing && <div style={{ height: 4, background: COLORS.border, borderRadius: 3, margin: '18px auto 0', maxWidth: 320, overflow: 'hidden' }}><div style={{ width: '55%', height: '100%', background: COLORS.cyan, boxShadow: `0 0 12px ${COLORS.cyan}` }} /></div>}
                </>}
                {summary && (
                  <div style={{ color: COLORS.green }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Imported {summary.stations ?? 0} stations, {summary.oee_entries ?? 0} OEE entries, {summary.issues ?? 0} issues</div>
                    {!!summary.errors?.length && <div style={{ color: COLORS.amber, fontSize: 11, marginTop: 9 }}>{summary.errors.join(' · ')}</div>}
                    <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 9 }}>Opening dashboard…</div>
                  </div>
                )}
              </div>
              {!summary && <button disabled={importing} onClick={onComplete} style={{ ...buttonStyle(COLORS.muted), marginTop: 16 }}>⏭ Skip — start fresh</button>}
            </>
          )}

          {error && <div style={{ marginTop: 16, color: COLORS.red, background: '#ff444414', border: '1px solid #ff444444', borderRadius: 7, padding: '10px 12px', fontSize: 12 }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label style={{ display: 'block', marginBottom: 12 }}><span style={{ display: 'block', color: COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{label}</span>{children}</label>
}
