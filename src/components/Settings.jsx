import React, { useState } from "react"
import { fmtRelative } from "../lib/format.js"
import { loadTargetHours, saveTargetHours, targetLabel, TARGET_MIN, TARGET_MAX } from "../lib/targets.js"

import SyncPanel from '../sync.jsx'
import { GAI_WORKER_URL } from '../config.js'

const SCHED_WORKER_URL = GAI_WORKER_URL
const SCHED_DAYS = [
  { dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }, { dow: 0, label: 'Sun' }
]
function loadSchedCfg() { try { return JSON.parse(localStorage.getItem('grow_sched_cfg')) || {} } catch { return {} } }
function timeToMin(t) { const [h, m] = String(t || '09:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
function minToTime(m) { const h = Math.floor(m / 60), mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }

export default function Settings({ status, lastSync, onClose, onLogout, onResetAI, onEditGoals, member, onUpgrade, onCreateEvent, idealSleep, onIdealSleep }) {
  const [aiReset, setAiReset] = useState(false)
  // KAI profile — the first-time answers (name, what you do, your challenge).
  // Editable here so you can change what KAI knows without wiping its memory.
  const loadProfile = () => { try { return JSON.parse(localStorage.getItem("grow_coach_profile")) || {} } catch { return {} } }
  const [prof, setProf] = useState(() => { const p = loadProfile(); return { name: p.name || "", role: p.role || "", problem: p.problem || "" } })
  const [profSaved, setProfSaved] = useState(false)
  // Target productive hours per day: what the daily capacity and the % are measured against.
  const [target, setTarget] = useState(() => loadTargetHours())
  const [targetSaved, setTargetSaved] = useState(false)
  function commitTarget(v) {
    const clean = saveTargetHours(v)
    setTarget(clean)
    setTargetSaved(true)
    setTimeout(() => setTargetSaved(false), 1500)
  }

  // Ideal sleep per day: how much rest actually counts. Sleep past this stops
  // being rest and falls back into the awake day as wasted time. Blank = no cap.
  const [sleepH, setSleepH] = useState(() => (idealSleep != null ? String(idealSleep) : ''))
  const [sleepSaved, setSleepSaved] = useState(false)
  function commitSleep(v) {
    const n = parseFloat(v)
    if (String(v).trim() === '' || isNaN(n)) { setSleepH(''); if (onIdealSleep) onIdealSleep(null) }
    else { const clean = Math.min(16, Math.max(1, Math.round(n * 2) / 2)); setSleepH(String(clean)); if (onIdealSleep) onIdealSleep(clean) }
    setSleepSaved(true)
    setTimeout(() => setSleepSaved(false), 1500)
  }

  function saveProfile() {
    const clean = { name: prof.name.trim(), role: prof.role.trim(), problem: prof.problem.trim() }
    localStorage.setItem("grow_coach_profile", JSON.stringify(clean))
    setProfSaved(true)
    setTimeout(() => setProfSaved(false), 1800)
  }

  // Scheduling link: a public page where someone else picks an open slot,
  // which then gets synced into your real calendar. The worker never sees
  // your Google token, so it only knows the weekly template below, not
  // whatever else is already on your calendar. Sync Now is what reconciles.
  const initSched = loadSchedCfg()
  const [schedSecret, setSchedSecret] = useState(initSched.secret || '')
  const [schedSlug, setSchedSlug] = useState(initSched.slug || '')
  const [schedTitle, setSchedTitle] = useState(initSched.title || '')
  const [schedDuration, setSchedDuration] = useState(initSched.durationMin || 30)
  const [schedStart, setSchedStart] = useState(minToTime(initSched.startMin != null ? initSched.startMin : 9 * 60))
  const [schedEnd, setSchedEnd] = useState(minToTime(initSched.endMin != null ? initSched.endMin : 17 * 60))
  const [schedActiveDays, setSchedActiveDays] = useState(() => new Set(initSched.activeDows || [1, 2, 3, 4, 5]))
  const [schedStatus, setSchedStatus] = useState('')
  const [schedSyncing, setSchedSyncing] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  function copySchedLink() {
    const slug = schedSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug) return
    if (!SCHED_WORKER_URL) { setSchedStatus('Connect an AI endpoint in .env to enable this'); setTimeout(() => setSchedStatus(''), 3000); return }
    navigator.clipboard.writeText(SCHED_WORKER_URL + '/book/' + slug)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  const toggleSchedDay = (dow) => setSchedActiveDays((s) => { const n = new Set(s); n.has(dow) ? n.delete(dow) : n.add(dow); return n })

  async function saveSchedLink() {
    const slug = schedSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug || !schedSecret.trim()) { setSchedStatus('Slug and secret are required'); return }
    if (!SCHED_WORKER_URL) { setSchedStatus('Connect an AI endpoint in .env to enable this'); setTimeout(() => setSchedStatus(''), 3000); return }
    const startMin = timeToMin(schedStart), endMin = timeToMin(schedEnd)
    const days = [...schedActiveDays].map((dow) => ({ dow, startMin, endMin }))
    localStorage.setItem('grow_sched_cfg', JSON.stringify({ secret: schedSecret, slug, title: schedTitle, durationMin: schedDuration, startMin, endMin, activeDows: [...schedActiveDays] }))
    try {
      const res = await fetch(SCHED_WORKER_URL + '/sched/config', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sched-secret': schedSecret }, body: JSON.stringify({ slug, title: schedTitle, durationMin: schedDuration, days }) })
      const data = await res.json()
      setSchedStatus(res.ok ? 'Saved. Link is live.' : (data.error || 'Save failed'))
    } catch (e) { setSchedStatus('Could not reach the worker') }
    setTimeout(() => setSchedStatus(''), 3000)
  }

  async function syncSchedBookings() {
    const slug = schedSlug.trim().toLowerCase()
    if (!slug || !schedSecret.trim()) { setSchedStatus('Save the link first'); return }
    if (!SCHED_WORKER_URL) { setSchedStatus('Connect an AI endpoint in .env to enable this'); setTimeout(() => setSchedStatus(''), 3000); return }
    setSchedSyncing(true)
    try {
      const res = await fetch(SCHED_WORKER_URL + '/sched/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sched-secret': schedSecret }, body: JSON.stringify({ slug }) })
      const data = await res.json()
      const pending = data.bookings || []
      for (const b of pending) {
        await onCreateEvent({ summary: 'Meeting with ' + b.name + (b.note ? ': ' + b.note : ''), start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), colorId: '11' })
      }
      if (pending.length) {
        await fetch(SCHED_WORKER_URL + '/sched/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sched-secret': schedSecret }, body: JSON.stringify({ slug, ackIds: pending.map((b) => b.id) }) })
      }
      setSchedStatus(pending.length ? `Added ${pending.length} new booking${pending.length > 1 ? 's' : ''} to your calendar.` : 'No new bookings.')
    } catch (e) { setSchedStatus('Sync failed') }
    setSchedSyncing(false)
    setTimeout(() => setSchedStatus(''), 3000)
  }

  function resetAI() {
    localStorage.removeItem("grow_coach_profile")
    localStorage.removeItem("grow_chat_history")
    if (onResetAI) onResetAI()
    setAiReset(true)
    setTimeout(() => setAiReset(false), 1500)
  }

  const fieldStyle = { width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "11px 13px", color: "var(--text)", fontSize: 14, outline: "none", marginTop: 6 }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 12 }

  return (
    <div className="settings-page">
      <div className="set-inner">
        <div className="row-between" style={{ marginBottom: 20 }}>
          <h1>Settings</h1>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="row-between" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{status?.account?.email || "Not connected"}</div>
            <div className="muted">Last synced {fmtRelative(lastSync)}</div>
          </div>
          {status?.connected && (
            <button className="btn ghost" onClick={onLogout}>Disconnect</button>
          )}
        </div>
        <div className="set-card">
          <div className="set-title">Membership</div>
          <div className="muted" style={{ marginBottom: 12 }}>{member ? "You're an Out Past member. The full AI mentor is unlocked." : "Free plan. The calendar and coded mentor are yours; unlock the live AI mentor and AI scheduling."}</div>
          {member
            ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontWeight: 800, fontSize: 14 }}>✦ Member</div>
            : <button className="btn ghost" onClick={onUpgrade} style={{ color: "var(--on-gold)", background: "var(--gold)", border: "none", fontWeight: 800 }}>✦ Unlock membership</button>}
        </div>
        <SyncPanel />
        <div className="set-card">
          <div className="set-title">Target productive hours per day</div>
          <div className="muted" style={{ marginBottom: 6 }}>Your daily capacity. Everything you get done is measured against this, so the big number and the percent on Daily follow it.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <input type="number" min={TARGET_MIN} max={TARGET_MAX} step="0.5" value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={(e) => commitTarget(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitTarget(e.target.value) }}
              style={{ ...fieldStyle, width: 110, marginTop: 0, fontSize: 20, fontWeight: 800, textAlign: "center" }} />
            <span className="muted" style={{ fontSize: 14 }}>hours a day</span>
            <button className="btn ghost" onClick={() => commitTarget(target)} style={{ color: "var(--on-gold)", background: "var(--gold)", border: "none", fontWeight: 800 }}>
              {targetSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Now set to {targetLabel(loadTargetHours())} a day.</div>
        </div>
        <div className="set-card">
          <div className="set-title">Ideal sleep per day</div>
          <div className="muted" style={{ marginBottom: 6 }}>How much rest actually counts. A gray or Sleep block on your calendar is read as rest up to this number. Anything past it stops counting as rest and lands back in your awake day as wasted time. Leave it blank to count all of it.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <input type="number" min="1" max="16" step="0.5" value={sleepH}
              onChange={(e) => setSleepH(e.target.value)}
              onBlur={(e) => commitSleep(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitSleep(e.target.value) }}
              placeholder="off"
              style={{ ...fieldStyle, width: 110, marginTop: 0, fontSize: 20, fontWeight: 800, textAlign: "center" }} />
            <span className="muted" style={{ fontSize: 14 }}>hours a night</span>
            <button className="btn ghost" onClick={() => commitSleep(sleepH)} style={{ color: "var(--on-gold)", background: "var(--gold)", border: "none", fontWeight: 800 }}>
              {sleepSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {idealSleep != null ? `Now set to ${idealSleep} hours. Sleep past that counts as wasted.` : 'No cap right now, every hour of sleep counts as rest.'}
          </div>
        </div>
        <div className="set-card">
          <div className="set-title">What KAI knows about you</div>
          <div className="muted" style={{ marginBottom: 6 }}>The answers KAI asked for the first time. Change them here anytime, no need to wipe its memory.</div>
          <div style={labelStyle}>Your name</div>
          <input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} placeholder="Kidus" style={fieldStyle} />
          <div style={labelStyle}>What you do</div>
          <input value={prof.role} onChange={(e) => setProf({ ...prof, role: e.target.value })} placeholder="Founder, building a growth app" style={fieldStyle} />
          <div style={labelStyle}>Your biggest challenge right now</div>
          <input value={prof.problem} onChange={(e) => setProf({ ...prof, problem: e.target.value })} placeholder="Staying consistent, focus, procrastination…" style={fieldStyle} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button className="btn ghost" onClick={saveProfile} style={{ color: "var(--on-gold)", background: "var(--gold)", border: "none", fontWeight: 800 }}>
              {profSaved ? "Saved ✓" : "Save"}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>Applies next time you open KAI.</span>
          </div>
        </div>
        <div className="set-card">
          <div className="set-title">KAI Coach</div>
          <div className="muted" style={{ marginBottom: 12 }}>Reset KAI memory — clears your profile and full chat history.</div>
          <button className="btn ghost" onClick={resetAI} style={{ color: "var(--red)", borderColor: "var(--line)" }}>
            {aiReset ? "Reset" : "Reset KAI Memory"}
          </button>
        </div>
        <div className="set-card">
          <div className="set-title">Non-Negotiables</div>
          <div className="muted" style={{ marginBottom: 12 }}>Update your 3 non-negotiables for today.</div>
          <button className="btn ghost" onClick={onEditGoals} style={{ color: "var(--gold)", borderColor: "var(--teal-dim)" }}>
            Edit Today Goals
          </button>
        </div>
        <div className="set-card">
          <div className="set-title">Scheduling link</div>
          <div className="muted" style={{ marginBottom: 12 }}>A page anyone can open to book time with you, from your weekly availability below. It only knows this template, not the rest of your calendar, so hit Sync Now after someone books to pull it in and catch any clash yourself.</div>
          <div style={labelStyle}>Worker secret</div>
          <input type="password" value={schedSecret} onChange={(e) => setSchedSecret(e.target.value)} placeholder="Set once with wrangler secret put SCHED_SECRET" style={fieldStyle} />
          <div style={labelStyle}>Link slug</div>
          <input value={schedSlug} onChange={(e) => setSchedSlug(e.target.value)} placeholder="kidus" style={fieldStyle} />
          {schedSlug && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{SCHED_WORKER_URL}/book/{schedSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}</div>
              <button className="btn ghost" onClick={copySchedLink} style={{ flexShrink: 0, padding: "5px 12px", fontSize: 12, color: "var(--gold)", borderColor: "var(--teal-dim)" }}>{linkCopied ? "Copied" : "Copy link"}</button>
            </div>
          )}
          <div style={labelStyle}>Title shown on the page</div>
          <input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder="Book time with Kidus" style={fieldStyle} />
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 140 }}>
              <div style={labelStyle}>Meeting length</div>
              <select value={schedDuration} onChange={(e) => setSchedDuration(Number(e.target.value))} style={{ ...fieldStyle, cursor: "pointer" }}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 100 }}>
              <div style={labelStyle}>Open from</div>
              <input type="time" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} style={{ ...fieldStyle, colorScheme: "light" }} />
            </label>
            <label style={{ flex: 1, minWidth: 100 }}>
              <div style={labelStyle}>Until</div>
              <input type="time" value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} style={{ ...fieldStyle, colorScheme: "light" }} />
            </label>
          </div>
          <div style={labelStyle}>Days open</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {SCHED_DAYS.map((d) => {
              const on = schedActiveDays.has(d.dow)
              return (
                <button key={d.dow} onClick={() => toggleSchedDay(d.dow)} style={{ padding: "8px 14px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", border: on ? "none" : "1px solid var(--line)", background: on ? "var(--gold)" : "transparent", color: on ? "var(--on-gold)" : "var(--muted)" }}>{d.label}</button>
              )
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={saveSchedLink} style={{ color: "var(--on-gold)", background: "var(--gold)", border: "none", fontWeight: 800 }}>Save link</button>
            <button className="btn ghost" onClick={syncSchedBookings} disabled={schedSyncing} style={{ color: "var(--gold)", borderColor: "var(--teal-dim)", opacity: schedSyncing ? 0.6 : 1 }}>{schedSyncing ? "Syncing…" : "Sync now"}</button>
            {schedStatus && <span className="muted" style={{ fontSize: 12 }}>{schedStatus}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
