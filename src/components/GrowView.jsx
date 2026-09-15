import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractText } from '../lib/extractText'
import PanChart from './PanChart.jsx'
import { inHistory } from '../lib/history.js'
import { parseTask, describe as tbDescribe } from '../lib/tb.js'
import { GAI_WORKER_URL } from '../config.js'

// The Grow mission page — the command center you land on. Decade north star →
// yearly → current mission → this week → today's kill list. Tasks carry an
// editable time so you plan the day here without opening the calendar, and
// "Fill my calendar" drops them into open slots only (never over an event),
// flags any clash red, and keeps the two in sync when you move a time.

const K_NORTH = 'grow_north_star'
const K_MISSION = 'grow_mission'
const K_TASKS = 'grow_tasks'
const K_GOALS = 'grow_daily_goals'
// Every mission you finish gets written here before the new one takes its place.
// Without it a new mission simply overwrote the old and the record was gone, so
// the Home page had no way to say what you had already been through.
export const K_MISSION_LOG = 'grow_mission_log'

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
const dk = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const uid = () => 't_' + Math.random().toString(36).slice(2, 9)
function minToHHMM(m) { if (m == null) return ''; const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0') }
function hhmmToMin(s) { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m }
// Real length: if a finish time is set, that wins (start→finish); otherwise the duration option.
function effDur(t) { return (t.time != null && t.end != null && t.end > t.time) ? (t.end - t.time) : (t.dur || 60) }
// The minute-of-day a task is due to be finished (finish time if set, else start + duration).
function finishMin(t) { if (t.time == null) return null; return (t.end != null && t.end > t.time) ? t.end : t.time + (t.dur || 60) }
function fmtDur(m) { if (m < 60) return m + 'm'; const h = Math.floor(m / 60), mm = m % 60; return h + 'h' + (mm ? ' ' + mm + 'm' : '') }
function fmtDay(d) { return new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) }

const WORKER_URL = GAI_WORKER_URL
function startOfWeekMon(d) { const x = midnight(d); const wd = (x.getDay() + 6) % 7; return new Date(x.getTime() - wd * 864e5) }

// Mission horizon options, from 1 week up to 1 year. Stored as a week count.
const HORIZONS = [
  { w: 1, label: '1 week' }, { w: 2, label: '2 weeks' }, { w: 3, label: '3 weeks' },
  { w: 4, label: '1 month' }, { w: 8, label: '2 months' }, { w: 12, label: '3 months' },
  { w: 16, label: '4 months' }, { w: 24, label: '6 months' }, { w: 36, label: '9 months' }, { w: 52, label: '1 year' }
]
const horizonLabel = (w) => { const h = HORIZONS.find((x) => x.w === w); if (h) return h.label; if (w < 4) return w + (w === 1 ? ' week' : ' weeks'); const mo = Math.round(w / 4); return mo + (mo === 1 ? ' month' : ' months') }

// Quotes to keep you honest. Discipline ones when you slip / push tasks; consistency
// ones when you're on track.
const DISCIPLINE_Q = [
  { q: '"Motivation is garbage. You will never always be motivated, so you have to learn to be disciplined."', by: 'David Goggins' },
  { q: '"Discipline equals freedom."', by: 'Jocko Willink' },
  { q: '"Suffer the pain of discipline or suffer the pain of regret."', by: 'Jim Rohn' },
  { q: '"Don\'t stop when you\'re tired. Stop when you\'re done."', by: 'David Goggins' },
  { q: '"We don\'t rise to the level of our goals, we fall to the level of our systems."', by: 'James Clear' },
  { q: '"The pain you feel today is the strength you feel tomorrow."', by: 'Arnold Schwarzenegger' },
  { q: '"You can\'t cheat the grind. It knows exactly how much you invested."', by: 'Eric Thomas' }
]
const CONSISTENCY_Q = [
  { q: '"Small disciplines repeated with consistency lead to great achievements."', by: 'John Maxwell' },
  { q: '"Success is the sum of small efforts repeated day in and day out."', by: 'Robert Collier' },
  { q: '"You\'re on fire. Protect the streak and show up tomorrow like today."', by: 'KAI' },
  { q: '"It never gets easier, you just get better. Keep stacking days."', by: 'KAI' },
  { q: '"Consistency beats intensity. Never break the chain."', by: 'KAI' }
]
const pickQuote = (arr) => arr[Math.floor(Math.random() * arr.length)]
const dayQuote = (arr, seed) => arr[seed % arr.length]

export default function GrowView({ events = [], now, onCreateEvent, onUpdateEvent, onDeleteEvent, onRegisterUndo, email, member }) {
  const [sub, setSub] = useState('today')                 // stats|today|week|month|year|decade
  const [viewDate, setViewDate] = useState(() => midnight(now || new Date()))
  const [north, setNorth] = useState(() => load(K_NORTH, 'Build Grow into a $10M growth ecosystem and become the mentor a million people run their life on.'))
  const [mission, setMission] = useState(() => load(K_MISSION, { title: 'Master marketing', months: 4, startISO: new Date().toISOString() }))
  const [tasks, setTasks] = useState(() => load(K_TASKS, {}))
  const [editNorth, setEditNorth] = useState(false)
  const [editMission, setEditMission] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [planMsg, setPlanMsg] = useState('')
  const [fileMsg, setFileMsg] = useState('')
  const [dropOver, setDropOver] = useState(false)
  const stratFileRef = useRef(null)

  // Read a dropped/picked strategy file (PDF, Word .docx, or text) into the box.
  async function ingestStrategyFile(file) {
    if (!file) return
    setFileMsg('Reading ' + file.name + '…')
    try {
      const text = await extractText(file)
      if (!text || !text.trim()) { setFileMsg('No readable text found in ' + file.name); setTimeout(() => setFileMsg(''), 4000); return }
      setMission((m) => ({ ...m, strategy: (m.strategy && m.strategy.trim() ? m.strategy.trim() + '\n\n' : '') + text.trim() }))
      setFileMsg('✓ Loaded ' + file.name + ' (' + text.trim().length.toLocaleString() + ' chars)')
    } catch (e) {
      setFileMsg(e && e.message ? e.message : 'Could not read that file')
    }
    setTimeout(() => setFileMsg(''), 5000)
  }

  useEffect(() => save(K_NORTH, north), [north])
  useEffect(() => save(K_MISSION, mission), [mission])
  useEffect(() => save(K_TASKS, tasks), [tasks])

  // Archive the outgoing mission the moment a different one starts. Keyed on
  // title + start, so renaming a typo or nudging the length does NOT create a
  // phantom past mission — only a genuinely new one does.
  const missionId = (m) => (m ? (m.title || '') + '|' + (m.startISO || '') : '')
  const lastMissionId = useRef(missionId(mission))
  const lastMission = useRef(mission)
  useEffect(() => {
    const id = missionId(mission)
    if (id === lastMissionId.current) { lastMission.current = mission; return }
    const prev = lastMission.current
    if (prev && prev.title) {
      const log = load(K_MISSION_LOG, [])
      if (!log.some((e) => missionId(e) === missionId(prev))) {
        log.push({ title: prev.title, startISO: prev.startISO || null, endISO: new Date().toISOString(), horizonWeeks: prev.horizonWeeks || (prev.months ? prev.months * 4 : 16) })
        save(K_MISSION_LOG, log.slice(-60))
      }
    }
    lastMissionId.current = id
    lastMission.current = mission
  }, [mission])

  // Undo history for the whole mission page — every edit (tasks, times, done,
  // north star, mission, strategy) snapshots the state before it changes, so
  // Ctrl/Cmd+Z on this tab steps back one edit at a time.
  const undoStack = useRef([])
  const prevSnap = useRef({ north, mission, tasks })
  const applyingUndo = useRef(false)
  const mounted = useRef(false)
  const pendingSnap = useRef(null)
  const snapTimer = useRef(null)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; prevSnap.current = { north, mission, tasks }; return }
    if (applyingUndo.current) {
      applyingUndo.current = false
      prevSnap.current = { north, mission, tasks }
      if (snapTimer.current) { clearTimeout(snapTimer.current); snapTimer.current = null }
      pendingSnap.current = null
      return
    }
    // Typing fires this on EVERY keystroke. Hold the first pre-edit snapshot and
    // commit it once you pause, so one undo reverses one real action instead of
    // one character (which also used to blow the 80-entry cap in a sentence).
    if (pendingSnap.current == null) pendingSnap.current = prevSnap.current
    prevSnap.current = { north, mission, tasks }
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      undoStack.current.push(pendingSnap.current)
      if (undoStack.current.length > 80) undoStack.current.shift()
      pendingSnap.current = null
      snapTimer.current = null
    }, 600)
  }, [north, mission, tasks])
  const [undoMsg, setUndoMsg] = useState('')
  const doUndo = useCallback(() => {
    const snap = undoStack.current.pop()
    if (!snap) return false
    applyingUndo.current = true
    setNorth(snap.north); setMission(snap.mission); setTasks(snap.tasks)
    setUndoMsg('↩ Undone'); setTimeout(() => setUndoMsg(''), 1400)
    return true
  }, [])
  useEffect(() => { onRegisterUndo && onRegisterUndo(doUndo); return () => { onRegisterUndo && onRegisterUndo(null) } }, [onRegisterUndo, doUndo])

  const key = dk(viewDate)
  const dayTasks = tasks[key] || []
  const setDayTasks = (updater) => setTasks((all) => ({ ...all, [key]: updater(all[key] || []) }))
  const setTasksFor = (k, updater) => setTasks((all) => ({ ...all, [k]: updater(all[k] || []) }))

  // Sync the day's top 3 tasks into the 3 non-negotiables (grow_daily_goals),
  // so the greeting and daily view stay in step. Only for today, only when the
  // user hasn't hand-set them.
  useEffect(() => {
    if (key !== dk(now || new Date())) return
    const top = dayTasks.slice(0, 3).map((t) => t.text).filter(Boolean)
    if (!top.length) return
    // Never stomp non-negotiables you set by hand in the Goals screen. Only the
    // ones this page auto-filled from your top 3 tasks get refreshed.
    const today = new Date().toDateString()
    const cur = load(K_GOALS, null)
    if (cur && cur.date === today && !cur.auto) return
    save(K_GOALS, { date: today, auto: true, goals: [top[0] || '', top[1] || '', top[2] || ''] })
  }, [tasks, key]) // eslint-disable-line

  // ---- calendar helpers ----
  const dayEventsFor = (d) => (events || []).filter((e) => !e.allDay && dk(e.start) === dk(d))
  // Red flag = this task's time block overlaps ANOTHER task on the same day (your own kill
  // list fighting itself). It does NOT flag against events you put on your calendar by hand.
  const clash = (t) => {
    if (t.time == null) return false
    const s = t.time, e = t.time + effDur(t)
    return (dayTasks || []).some((o) => { if (o.id === t.id || o.time == null) return false; const os = o.time, oe = o.time + effDur(o); return s < oe && e > os })
  }

  const addTask = (k) => setTasksFor(k, (list) => [...list, { id: uid(), text: '', time: null, end: null, dur: 60, done: false, tag: '' }])
  // Paste a whole list (from Claude chat or anywhere) → one task per line. Strips
  // "1." / "2)" / "-" / "•" numbering. Pure code, no tokens.
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const parseList = (text) => (text || '').split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•·]\s+/, '').replace(/^\s*\d+[.)\-:]?\s+/, '').trim())
    .filter(Boolean)
  const addPasted = (k) => {
    const texts = parseList(pasteText)
    if (!texts.length) return
    setTasksFor(k, (list) => [...list, ...texts.map((t) => ({ id: uid(), text: t.slice(0, 200), time: null, end: null, dur: 60, done: false, tag: '' }))])
    setPasteText(''); setPasteOpen(false)
  }
  // A plain function (not a component) so the textarea keeps focus while typing.
  const renderPaste = (k) => (
    <div style={{ marginTop: 8 }}>
      {!pasteOpen
        ? <button onClick={() => setPasteOpen(true)} style={addRow}>⤵ Paste a list (one task per line)</button>
        : <div style={{ border: '1px solid var(--gold)', borderRadius: 12, padding: 12, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Paste your list. Each line becomes its own task. Numbering like "1." or "-" is stripped automatically.</div>
            <textarea autoFocus value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'1. Film chicken video\n2. Edit beef video\n3. Post lobster video'} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 14, lineHeight: 1.6, padding: '12px 14px', minHeight: 130, resize: 'vertical', fontFamily: '-apple-system, system-ui, sans-serif' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
              <button onClick={() => addPasted(k)} disabled={!parseList(pasteText).length} style={{ ...btn, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none', opacity: parseList(pasteText).length ? 1 : 0.5 }}>Add {parseList(pasteText).length || ''} task{parseList(pasteText).length === 1 ? '' : 's'}</button>
              <button onClick={() => { setPasteOpen(false); setPasteText('') }} style={btn}>Cancel</button>
            </div>
          </div>}
    </div>
  )
  const patchTask = (k, id, patch) => setTasksFor(k, (list) => list.map((t) => t.id === id ? { ...t, ...patch } : t))

  // ---- TB · Task Brain -------------------------------------------------
  // Write the task the way you'd say it and the time fills itself in. Runs
  // when you press Enter or leave the box, never mid-word, so it doesn't
  // fight you while you're still typing. Pure code, offline, instant.
  //
  // A task with no time in it stays a plain task. Nothing to confirm, nothing
  // to dismiss. If the slot is already taken it just overlaps, same as the
  // calendar does — it will not argue with you.
  const [tbLine, setTbLine] = useState({})            // taskId -> the line under the row
  const tbTimer = useRef({})
  const flashTB = (id, text) => {
    setTbLine((m) => ({ ...m, [id]: text }))
    clearTimeout(tbTimer.current[id])
    tbTimer.current[id] = setTimeout(() => setTbLine((m) => { const n = { ...m }; delete n[id]; return n }), 6000)
  }
  const commitTask = (k, id, raw) => {
    const text = String(raw || '').trim()
    if (!text) return
    const dayDate = new Date(k + 'T00:00:00')
    const r = parseTask(text, { now: now || new Date(), date: dayDate, events })
    if (!r) return                                     // no time in it, leave it alone
    if (!r.ok) {
      // The one thing TB can't work out on its own is a sun time in a timezone
      // it doesn't have coordinates for. It says so on the row and stops there
      // — no prompt, no dialog, nothing to dismiss.
      if (r.reason === 'location') flashTB(id, "Don't know where " + r.anchor + " falls in your timezone yet.")
      return
    }
    applyTB(k, id, r)
  }
  const applyTB = (k, id, r) => {
    // The block lands on the day the sentence named, which may not be the day
    // you typed it on. "gym tomorrow 7pm" moves itself.
    const target = new Date(k + 'T00:00:00')
    target.setDate(target.getDate() + (r.dayShift || 0))
    const targetKey = dk(target)
    const filled = { text: r.title, time: r.startMin, end: r.startMin + r.durMin, dur: r.durMin }
    if (targetKey === k) patchTask(k, id, filled)
    else {
      setTasksFor(k, (list) => list.filter((t) => t.id !== id))
      setTasksFor(targetKey, (list) => [...list, { id: uid(), done: false, tag: '', ...filled }])
    }
    // A repeat copies the block onto every matching day for the next week. One
    // week, not forever, so a typo can never carpet your whole calendar.
    if (r.repeat && r.repeat.days) {
      const start = new Date(target)
      for (let i = 1; i <= 7; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i)
        if (!r.repeat.days.includes(d.getDay())) continue
        const dkey = dk(d)
        setTasksFor(dkey, (list) => list.some((t) => t.text === r.title && t.time === r.startMin)
          ? list
          : [...list, { id: uid(), done: false, tag: '', ...filled }])
      }
    }
    flashTB(id, tbDescribe(r))
  }

  const removeTask = (k, id) => {
    // If this task was booked on the calendar, pull that block off too.
    const t = (tasks[k] || []).find((x) => x.id === id)
    if (t && t.text && onDeleteEvent) {
      const ev = (events || []).find((e) => !e.allDay && dk(e.start) === k && (e.summary || '') === t.text)
      if (ev) onDeleteEvent({ id: ev.id, calendarId: ev.calendarId })
    }
    setTasksFor(k, (list) => list.filter((x) => x.id !== id))
  }

  // Drag a task from one day onto another day in the week planner.
  const dragTask = useRef(null)                 // { ids:[], fromKey }
  const [dragOverKey, setDragOverKey] = useState(null)
  const [selIds, setSelIds] = useState(() => new Set())   // tasks picked in the week view to move together
  const toggleSel = (id) => setSelIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  // Move one or many tasks from one day to another in a single drop.
  const moveTasks = (ids, fromKey, toKey) => {
    if (!ids || !ids.length || !fromKey || fromKey === toKey) return
    setTasks((all) => {
      const from = all[fromKey] || []
      const moving = from.filter((x) => ids.includes(x.id))
      if (!moving.length) return all
      return { ...all, [fromKey]: from.filter((x) => !ids.includes(x.id)), [toKey]: [...(all[toKey] || []), ...moving] }
    })
    setSelIds(new Set())
  }
  const addDaysKey = (k, days) => { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + days); return dk(d) }
  const dayDiff = (fromKey, toKey) => Math.round((new Date(toKey + 'T00:00:00').getTime() - new Date(fromKey + 'T00:00:00').getTime()) / 864e5)
  // "Move to Nd": the ORIGINAL stays put and is marked missed (unfinished — hurts
  // your status), and a fresh COPY lands N days out. So a slip is on the record.
  const rescheduleForward = (ids, fromKey, days) => {
    if (!ids || !ids.length || days === 0) return   // moving to the same day is a no-op
    const toKey = addDaysKey(fromKey, days)
    setTasks((all) => {
      const from = all[fromKey] || []
      const moving = from.filter((t) => ids.includes(t.id))
      if (!moving.length) return all
      const dupes = moving.map((t) => ({ ...t, id: uid(), done: false, missed: false }))
      const newFrom = from.map((t) => ids.includes(t.id) ? { ...t, done: false, missed: true } : t)
      return { ...all, [fromKey]: newFrom, [toKey]: [...(all[toKey] || []), ...dupes] }
    })
    setSelIds(new Set())
    { const qq = pickQuote(DISCIPLINE_Q); setQuoteFlash(qq.q + '  by ' + qq.by); setTimeout(() => setQuoteFlash(''), 7000) }
  }
  // Bulk delete selected tasks (and their calendar blocks).
  const deleteTasks = (ids, k) => {
    if (!ids || !ids.length) return
    const list = tasks[k] || []
    if (onDeleteEvent) ids.forEach((id) => { const t = list.find((x) => x.id === id); if (t && t.text) { const ev = (events || []).find((e) => !e.allDay && dk(e.start) === k && (e.summary || '') === t.text); if (ev) onDeleteEvent({ id: ev.id, calendarId: ev.calendarId }) } })
    setTasksFor(k, (l) => l.filter((t) => !ids.includes(t.id)))
    setSelIds(new Set())
  }
  // Right-click menu for a task (or the whole selection).
  const [menu, setMenu] = useState(null)   // { x, y, ids, key }
  const openMenu = (e, id, k) => { e.preventDefault(); e.stopPropagation(); const ids = (selIds.has(id) && selIds.size) ? [...selIds] : [id]; setMenu({ x: e.clientX, y: e.clientY, ids, key: k }) }
  const bulkPill = { background: 'var(--bg)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }
  // Bar shown when tasks are selected: move the whole group N days out, or delete them.
  const BulkBar = ({ k }) => selIds.size === 0 ? null : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: 'rgba(245,208,96,0.08)', border: '1px solid var(--gold)', borderRadius: 10 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)' }}>{selIds.size} selected</span>
      <span className="muted" style={{ fontSize: 12 }}>· Move to (leaves a miss here, sends a copy):</span>
      {k !== todayKey && <button onClick={() => rescheduleForward([...selIds], k, dayDiff(k, todayKey))} style={bulkPill}>Today</button>}
      {[1, 2, 3, 4, 5, 6, 7].map((d) => <button key={d} onClick={() => rescheduleForward([...selIds], k, d)} style={bulkPill}>{d === 1 ? 'Tomorrow' : d + 'd'}</button>)}
      <button onClick={() => deleteTasks([...selIds], k)} style={{ ...bulkPill, borderColor: 'var(--red)', color: 'var(--red)' }}>Delete</button>
      <button onClick={() => setSelIds(new Set())} style={{ ...bulkPill, borderColor: 'var(--line)', color: 'var(--muted)' }}>Clear</button>
    </div>
  )

  // When a task's time changes, move its calendar event too (matched by title).
  const changeTime = (id, hhmm) => {
    const t = dayTasks.find((x) => x.id === id); if (!t) return
    const min = hhmmToMin(hhmm)
    patchTask(key, id, { time: min })
    if (min != null && onUpdateEvent) {
      const ev = dayEventsFor(viewDate).find((e) => (e.summary || '') === t.text)
      if (ev) { const base = midnight(viewDate).getTime(); onUpdateEvent({ id: ev.id, calendarId: ev.calendarId, start: new Date(base + min * 60000).toISOString(), end: new Date(base + (min + effDur(t)) * 60000).toISOString() }) }
    }
  }

  // Fill the calendar with the day's tasks. Only tasks that have a start time,
  // whether you typed it or TB read it out of your sentence. A task with no time
  // is a task you never scheduled, so it stays off the calendar. Never books the
  // same task twice.
  const [fillMsg, setFillMsg] = useState('')
  const fillCalendar = () => {
    if (!onCreateEvent) return
    const d = new Date(key + 'T00:00:00')                     // the day being filled
    const base = midnight(d).getTime()
    const palette = ['11', '5', '7', '10', '6', '3', '2', '4', '1', '8']
    const list = tasks[key] || []
    // Only what you actually timed goes on the calendar. Type a time yourself or
    // let TB read it out of your sentence. A row with no time never gets booked
    // and never gets a time invented for it — you did not schedule it, so it is
    // not on your day.
    let added = 0, dupes = 0, notime = 0
    // Seed with what is already on the day, then add as we go. The events prop is a
    // render snapshot that does not update inside this loop, so without a running set
    // the same title gets booked again and again.
    const seen = new Set(dayEventsFor(d).map((e) => (e.summary || '').trim().toLowerCase()).filter(Boolean))
    list.forEach((t, i) => {
      const text = (t.text || '').trim()
      if (!text) return                                       // never book an empty block
      if (t.time == null) { notime++; return }                // untimed, stays off the calendar
      const id = text.toLowerCase()
      if (seen.has(id)) { dupes++; return }                   // already booked, or a repeat in this run
      seen.add(id)
      onCreateEvent({ summary: text, start: new Date(base + t.time * 60000).toISOString(), end: new Date(base + (t.time + effDur(t)) * 60000).toISOString(), colorId: palette[i % palette.length] })
      added++
    })
    // Say exactly what happened, including what got left off for having no time.
    const parts = []
    if (added) parts.push(added + ' booked')
    if (dupes) parts.push(dupes + ' already there')
    if (notime) parts.push(notime + ' with no time, skipped')
    setFillMsg(parts.length ? parts.join(' · ') : (list.length ? 'Nothing to book, add some tasks first' : 'No tasks here yet'))
    setTimeout(() => setFillMsg(''), 3000)
  }

  const missionWeeks = mission.horizonWeeks || (mission.months ? mission.months * 4 : 16)

  // ONE anchor for everything about the mission: the Monday week 1 starts on.
  // The stats window, "Weeks in", and the week planner all derive from this, so
  // they can never disagree. They used to be computed three different ways —
  // that is why the planner could show days the stats refused to count.
  const missionAnchor = useMemo(() => {
    const nowD = now || new Date()
    const todayMon = startOfWeekMon(nowD)
    let startMon = startOfWeekMon(mission.startISO ? new Date(mission.startISO) : nowD)
    // A stale start from an older mission leaves a window that already ran out,
    // which would report the OLD mission. Re-anchor to this week.
    if (startMon.getTime() + missionWeeks * 7 * 864e5 <= midnight(nowD).getTime()) startMon = todayMon
    const week = Math.min(missionWeeks, Math.max(1, Math.round((todayMon.getTime() - startMon.getTime()) / (7 * 864e5)) + 1))
    return { startMon, week }
  }, [mission.startISO, missionWeeks, now])
  const missionWeek = missionAnchor.week

  // KAI (Opus 4.8) breaks the mission into weekly themes + this week's daily
  // tasks, and drops them onto the right dates. Editable after, like anything.
  // Switching to a different mission has to reset the plan, otherwise the old
  // mission's tasks stay on the same dates and the stats keep reporting the old one.
  const editStartTitleRef = useRef('')
  const openMissionEdit = () => { editStartTitleRef.current = (mission.title || '').trim(); setEditMission(true) }
  const saveMission = () => {
    const before = editStartTitleRef.current
    const after = (mission.title || '').trim()
    if (after && before && after.toLowerCase() !== before.toLowerCase()) {
      const startKey = dk(startOfWeekMon(now || new Date()))
      // Keep the past as history, clear this mission window forward.
      setTasks((all) => { const copy = {}; Object.keys(all).forEach((k) => { if (k < startKey) copy[k] = all[k] }); return copy })
      setMission((m) => ({ ...m, weeks: null, startISO: new Date().toISOString() }))
    } else {
      setMission((m) => ({ ...m, startISO: m.startISO || new Date().toISOString() }))
    }
    setEditMission(false)
  }

  async function planWithKai() {
    if (planning) return
    if (!email) { setPlanMsg('Sign in first'); setTimeout(() => setPlanMsg(''), 2200); return }
    if (!WORKER_URL) { setPlanMsg('Connect an AI endpoint in .env to enable this'); setTimeout(() => setPlanMsg(''), 3000); return }
    setPlanning(true); setPlanMsg('KAI is planning your mission…')
    // Context so KAI plans around your real life, not blind: your profile, your
    // recent pace, and this week's fixed calendar commitments.
    const profile = (() => { try { const p = JSON.parse(localStorage.getItem('grow_coach_profile')); return p ? { role: p.role, problem: p.problem } : {} } catch { return {} } })()
    const wk = startOfWeekMon(now || new Date())
    let done = 0, planned = 0
    for (let i = 0; i < 7; i++) { const list = tasks[dk(new Date((now || new Date()).getTime() - i * 864e5))] || []; planned += list.length; done += list.filter((t) => t.done).length }
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const commitments = []
    for (let i = 0; i < 7; i++) { const d = new Date(wk.getTime() + i * 864e5); dayEventsFor(d).forEach((e) => { const s = new Date(e.start); commitments.push(dayNames[i] + ' ' + s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' + (e.summary || 'busy')) }) }
    // Journal: recent notes from the growth journal so KAI knows where you are.
    let journal = ''
    try { const mems = (await window.kd?.memories?.get?.()) || []; journal = mems.filter((m) => m && m.note).slice(-6).map((m) => m.note).join(' · ').slice(0, 900) } catch (e) {}
    try {
      const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'plan', email, northStar: north, mission: { title: mission.title, months: mission.months }, weeks: missionWeeks, week: missionWeek, description: mission.description || '', strategy: mission.strategy || '', profile, journal, progress: { done, planned }, commitments }) })
      const data = await res.json()
      const p = data && data.plan
      // New shape: p.calendar = [{week, days}] for ALL weeks. Old shape: p.days (this week only).
      const cal = p && (Array.isArray(p.calendar) ? p.calendar : (p.days ? [{ week: missionWeek, days: p.days }] : null))
      if (p && cal) {
        // The plan is written starting from THIS week, so stamp the start date to match.
        // Otherwise the mission window drifts off the plan and reports old days.
        setMission((m) => ({ ...m, weeks: Array.isArray(p.weeks) ? p.weeks.slice(0, missionWeeks) : m.weeks, startISO: new Date().toISOString() }))
        const base = startOfWeekMon(now || new Date())
        const startKey = dk(base)
        const todayK = dk(midnight(now || new Date()))
        const order = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
        // Exactly the horizon asked for, no more no less: drop any week the model
        // returned past the mission length.
        const capped = cal.filter((w) => Math.max(0, (parseInt(w.week) || 1) - 1) < missionWeeks).slice(0, missionWeeks)
        setTasks((all) => {
          // Keep the past as history; rebuild everything from this week forward so an
          // older, longer plan does not leave orphan tasks behind the new horizon.
          const copy = {}
          Object.keys(all).forEach((k) => { if (k < startKey) copy[k] = all[k] })
          capped.forEach((wkObj) => {
            const wIdx = Math.max(0, (parseInt(wkObj.week) || 1) - 1) // week 1 => this week, then forward
            const days = wkObj.days || {}
            Object.keys(order).forEach((dn) => {
              const d = new Date(base.getTime() + (wIdx * 7 + order[dn]) * 864e5); const k2 = dk(d)
              if (k2 < todayK) return  // days already gone this week stay blank; the plan starts today
              const arr = (days[dn] || []).filter(Boolean).map((txt) => ({ id: uid(), text: String(txt).slice(0, 160), time: null, dur: 60, done: false }))
              if (arr.length) copy[k2] = arr
            })
          })
          return copy
        })
        setPlanMsg('KAI planned ' + capped.length + (capped.length === 1 ? ' week' : ' weeks') + '. Open Week to see every day, set times, fill your calendar.')
      } else if (data && data.locked) { setPlanMsg('KAI planning is a membership feature.') }
      else { setPlanMsg('Could not plan right now. Try again.') }
    } catch (e) { setPlanMsg('Could not plan right now. Try again.') }
    setPlanning(false)
    setTimeout(() => setPlanMsg(''), 4000)
  }

  // next 21 days for the week planner
  // Span the whole mission so every KAI-planned week is reachable, from the start of this week forward.
  // Show EXACTLY the mission horizon, nothing past it. A 1 week mission shows week 1 only.
  const upcoming = useMemo(() => { const base = missionAnchor.startMon; const n = Math.max(7, missionWeeks * 7); return Array.from({ length: n }, (_, i) => midnight(new Date(base.getTime() + i * 864e5))) }, [missionAnchor, missionWeeks])

  // Group those days into weeks (Mon–Sun) so the planner collapses instead of listing 100+ days at once.
  const weekGroups = useMemo(() => { const g = []; for (let i = 0; i < upcoming.length; i += 7) { const idx = i / 7; g.push({ idx, dates: upcoming.slice(i, i + 7), theme: (Array.isArray(mission.weeks) && mission.weeks[idx]) || '' }) } return g }, [upcoming, mission.weeks])
  const weekBase = missionAnchor.startMon
  const currentWeekIdx = Math.max(0, Math.floor((midnight(viewDate).getTime() - weekBase.getTime()) / (7 * 864e5)))
  const [openWeeks, setOpenWeeks] = useState(() => new Set([0]))
  useEffect(() => { setOpenWeeks((prev) => prev.has(currentWeekIdx) ? prev : new Set(prev).add(currentWeekIdx)) }, [currentWeekIdx])
  const toggleWeek = (i) => setOpenWeeks((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  // Selecting is per-day; drop the picks when you switch to another day.
  useEffect(() => { setSelIds(new Set()) }, [key])

  // Keep the Today tab pinned to the REAL current day — it follows the clock past midnight.
  const todayKey = dk(now || new Date())
  useEffect(() => { if (sub === 'today') setViewDate(midnight(now || new Date())) }, [sub, todayKey]) // eslint-disable-line

  // The current mission's window: the week the mission started, running for its horizon.
  // Keys are YYYY-MM-DD so plain string compare gives the range.
  const missionWindow = useMemo(() => ({
    startKey: dk(missionAnchor.startMon),
    endKey: dk(new Date(missionAnchor.startMon.getTime() + missionWeeks * 7 * 864e5))
  }), [missionAnchor, missionWeeks])

  // Every number and chart on this page reads from THIS, so the stats always belong to
  // the mission you are on. Start a new mission and the stats start clean with it.
  const missionTasks = useMemo(() => {
    const out = {}
    Object.keys(tasks).forEach((k) => { if (k >= missionWindow.startKey && k < missionWindow.endKey) out[k] = tasks[k] })
    return out
  }, [tasks, missionWindow])

  // Neutral until a task actually resolves: a task not yet due (future day, or
  // today before its end time) counts toward nothing either way. It only enters
  // the ratio once it's done (pushes the % up) or its time has passed undone
  // (pushes the % down). So opening the app never drops the % on its own.
  const missionStats = useMemo(() => {
    const nowD = now || new Date()
    const nowMin = nowD.getHours() * 60 + nowD.getMinutes()
    const todayK = dk(midnight(nowD))
    // total/done: the real count across every task in the mission, right now.
    // Add a task anywhere in the mission and total goes up immediately; delete
    // one and it goes down. This is what "Tasks done" shows.
    let total = 0, done = 0
    // dueCount/dueDone: only tasks whose time has actually passed. Not the
    // headline number any more — kept so the colour can judge you on pace.
    let dueCount = 0, dueDone = 0
    Object.keys(missionTasks).forEach((k) => {
      const dayPast = k < todayK
      const isTod = k === todayK
      ;(missionTasks[k] || []).forEach((t) => {
        total++
        if (t.done) { done++; dueCount++; dueDone++; return }
        const overdue = t.missed || dayPast || (isTod && t.end != null && nowMin > t.end)
        if (overdue) dueCount++
      })
    })
    // The headline % is the WHOLE mission: how much of everything you set out to
    // do is actually finished. It only climbs by doing tasks.
    const pct = total ? Math.round((done / total) * 100) : 0
    // How far through the mission's calendar you are. Used only to colour the
    // number: on a 4 week mission, 25% done at the end of week 1 IS on pace, so
    // judging that raw 25% against a fixed "good is 60%" bar would just glow red
    // for the entire mission and tell you nothing.
    const spanMs = missionWeeks * 7 * 864e5
    const elapsedPct = Math.min(100, Math.max(0, ((midnight(nowD).getTime() - missionAnchor.startMon.getTime()) / spanMs) * 100))
    return { planned: total, done, due: dueCount, pct, elapsedPct, onPace: pct >= elapsedPct }
  }, [missionTasks, now, missionWeeks, missionAnchor])
  // The big quote on the mission card — discipline when behind, consistency when ahead.
  const missionQuote = useMemo(() => {
    const seed = parseInt(todayKey.replace(/-/g, ''), 10) || 0
    // Behind means behind YOUR PACE, not below a fixed number. The whole-mission
    // % is naturally small early on, so a fixed bar would call you behind for
    // almost the entire mission no matter how well you were doing.
    const behind = !missionStats.onPace
    const arr = behind ? DISCIPLINE_Q : CONSISTENCY_Q
    const item = arr[seed % arr.length]
    return { body: item.q, by: item.by, behind }
  }, [missionStats.onPace, todayKey])

  const [quoteFlash, setQuoteFlash] = useState('')

  const isToday = key === dk(now || new Date())
  // A task is "missed" if it's not done and either the day is already past, or it's
  // today and its finish time has passed. Checking it later clears the miss on its own.
  const nowMin = (() => { const d = now || new Date(); return d.getHours() * 60 + d.getMinutes() })()
  const dayIsPast = midnight(viewDate).getTime() < midnight(now || new Date()).getTime()
  const isOverdue = (t) => !t.done && (t.missed || dayIsPast || (isToday && t.end != null && nowMin > t.end))

  return (
    <div style={{ maxWidth: 'none', margin: '0 auto', padding: '18px 26px 60px' }}>
      {undoMsg && <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--panel)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 12, padding: '10px 18px', fontWeight: 800, fontSize: 13, zIndex: 9000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>{undoMsg}</div>}
      {quoteFlash && <div style={{ position: 'fixed', bottom: 26, right: 26, maxWidth: 420, background: 'var(--panel)', border: '1px solid var(--gold)', color: 'var(--text)', borderRadius: 14, padding: '14px 18px', fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.5, zIndex: 9000, boxShadow: '0 14px 40px rgba(0,0,0,0.6)' }}>⚔ {quoteFlash}</div>}
      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 250), top: Math.min(menu.y, window.innerHeight - 170), zIndex: 9999, width: 236, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{menu.ids.length} task{menu.ids.length > 1 ? 's' : ''}</div>
            <div className="muted" style={{ fontSize: 11.5, margin: '4px 0 8px' }}>Move to (leaves a miss here, sends a copy forward):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {menu.key !== todayKey && <button onClick={() => { rescheduleForward(menu.ids, menu.key, dayDiff(menu.key, todayKey)); setMenu(null) }} style={bulkPill}>Today</button>}
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <button key={d} onClick={() => { rescheduleForward(menu.ids, menu.key, d); setMenu(null) }} style={bulkPill}>{d === 1 ? 'Tomorrow' : d + 'd'}</button>)}
            </div>
            <button onClick={() => { deleteTasks(menu.ids, menu.key); setMenu(null) }} style={{ width: '100%', marginTop: 10, background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 8, padding: '7px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
          </div>
        </>
      )}
      {/* tabs */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {['stats', 'today', 'week', 'month', 'year', 'decade'].map((s) => (
            <button key={s} onClick={() => setSub(s)} style={{ background: sub === s ? 'var(--gold)' : 'transparent', color: sub === s ? 'var(--on-gold)' : 'var(--muted)', border: 'none', fontWeight: 700, fontSize: 13, padding: '9px 17px', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
      </div>

      {sub !== 'stats' && (
        <>
          {/* north star */}
          <div className="panel" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>The decade · your north star</div>
              {editNorth
                ? <textarea autoFocus value={north} onChange={(e) => setNorth(e.target.value)} onBlur={() => setEditNorth(false)} style={{ width: '100%', marginTop: 8, background: 'var(--bg)', border: '1px solid var(--teal-dim)', borderRadius: 10, color: 'var(--text)', fontSize: 20, fontWeight: 800, padding: 10, fontFamily: 'var(--display)', resize: 'none', minHeight: 70 }} />
                : <div onDoubleClick={() => setEditNorth(true)} title="Double-click to edit" style={{ fontSize: 22, fontWeight: 900, marginTop: 8, lineHeight: 1.2, cursor: 'text' }}>{north}</div>}
            </div>
            <button onClick={() => setEditNorth(true)} style={btn}>Edit north star</button>
          </div>

          {/* mission — only on the execution horizon (today/week/month); year & decade are their own systems */}
          {(sub === 'today' || sub === 'week' || sub === 'month') && (
          <div className="panel" style={{ marginBottom: 18, background: 'rgba(245,208,96,0.06)', borderColor: 'var(--teal-dim)' }}>
            {editMission ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input autoFocus value={mission.title} onChange={(e) => setMission((m) => ({ ...m, title: e.target.value }))} placeholder="Mission (e.g. Master marketing)" style={{ flex: 1, minWidth: 220, background: 'var(--bg)', border: '1px solid var(--teal-dim)', borderRadius: 10, color: 'var(--text)', fontSize: 16, fontWeight: 800, padding: '10px 12px' }} />
                  <select value={missionWeeks} onChange={(e) => setMission((m) => ({ ...m, horizonWeeks: parseInt(e.target.value) }))} title="How long is this mission" style={{ background: 'var(--bg)', border: '1px solid var(--teal-dim)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 700, padding: '10px' }}>
                    {HORIZONS.map((h) => <option key={h.w} value={h.w}>{h.label}</option>)}
                  </select>
                  <button onClick={saveMission} style={{ ...btn, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none' }}>Save</button>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>What this is</div>
                <textarea value={mission.description || ''} onChange={(e) => setMission((m) => ({ ...m, description: e.target.value }))} placeholder="What is this actually? What it is, what it sells, who it's for, where you are today. Context so KAI plans off the real thing." style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--teal-dim)', borderRadius: 10, color: 'var(--text)', fontSize: 15, lineHeight: 1.6, padding: '16px 18px', resize: 'vertical', minHeight: 200, fontFamily: '-apple-system, system-ui, sans-serif' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gold)' }}>The {horizonLabel(missionWeeks)} strategy · paste or drop a file</div>
                  <input ref={stratFileRef} type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.rtf,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; ingestStrategyFile(f) }} />
                  <button type="button" onClick={() => stratFileRef.current && stratFileRef.current.click()} style={{ ...btn, padding: '6px 12px', fontSize: 12.5, borderColor: 'var(--gold)', color: 'var(--gold)' }}>📎 Attach PDF / Word / text</button>
                  {fileMsg && <span className="muted" style={{ fontSize: 12 }}>{fileMsg}</span>}
                </div>
                <textarea value={mission.strategy || ''} onChange={(e) => setMission((m) => ({ ...m, strategy: e.target.value }))}
                  onDragOver={(e) => { e.preventDefault(); if (!dropOver) setDropOver(true) }}
                  onDragLeave={() => setDropOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDropOver(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) ingestStrategyFile(f) }}
                  placeholder={'Paste your full strategy here (from Claude chat or wherever), or drop a PDF / Word doc onto this box. KAI does NOT invent one. It takes THIS and spreads it across your ' + horizonLabel(missionWeeks) + ' into hard daily execution: the phases, channels, campaigns, milestones. Give it all.'} style={{ width: '100%', boxSizing: 'border-box', background: dropOver ? 'rgba(245,208,96,0.10)' : 'var(--bg)', border: (dropOver ? '2px dashed' : '1px solid') + ' var(--gold)', borderRadius: 10, color: 'var(--text)', fontSize: 15, lineHeight: 1.6, padding: '16px 18px', resize: 'vertical', minHeight: 340, fontFamily: '-apple-system, system-ui, sans-serif' }} />
              </div>
            ) : (
              <div onDoubleClick={openMissionEdit} title="Double-click to edit the mission" style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18 }}>🎯</span>
                    <span style={{ fontWeight: 900, fontSize: 18 }}>Current mission · {mission.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {planMsg && <span className="muted" style={{ fontSize: 12.5 }}>{planMsg}</span>}
                    <button onClick={(e) => { e.stopPropagation(); openMissionEdit() }} style={btn}>Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); planWithKai() }} disabled={planning} style={{ ...btn, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none', opacity: planning ? 0.6 : 1 }}>{planning ? 'Planning…' : '✦ Plan with KAI'}</button>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{horizonLabel(missionWeeks)} lock-in · Week {Math.min(missionWeek, missionWeeks)} of {missionWeeks} · click Edit to change</div>
                {/* No wall of text — just where you stand, and a quote to carry the day. */}
                <div style={{ display: 'flex', gap: 30, marginTop: 14, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', flexShrink: 0 }}>
                    <div><div style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 900 }}>{missionStats.done}<span className="muted" style={{ fontSize: 16, fontWeight: 700 }}> / {missionStats.planned}</span></div><div className="muted" style={{ fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' }}>Done, whole mission</div></div>
                    <div><div style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 900, color: missionStats.onPace ? 'var(--done)' : missionStats.pct >= missionStats.elapsedPct * 0.6 ? 'var(--gold)' : 'var(--red)' }}>{missionStats.pct}%</div><div className="muted" style={{ fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' }} title={`${Math.round(missionStats.elapsedPct)}% of the mission's time has gone`}>of the mission</div></div>
                    <div><div style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 900 }}>{Math.min(missionWeek, missionWeeks)}<span className="muted" style={{ fontSize: 16, fontWeight: 700 }}> / {missionWeeks}</span></div><div className="muted" style={{ fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' }}>Weeks in</div></div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0 14px', borderLeft: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(17px, 1.9vw, 30px)', fontWeight: 900, lineHeight: 1.25, color: missionQuote.behind ? 'var(--gold)' : 'var(--done)' }}>{missionQuote.body}</div>
                    {missionQuote.by && <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', marginTop: 10 }}>by {missionQuote.by}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 12, marginTop: 12, color: mission.strategy ? 'var(--done)' : 'var(--gold)', fontWeight: 700 }}>{mission.strategy ? '✓ Strategy loaded · KAI spreads it across your days' : '↳ Click Edit to add the description & strategy so KAI plans off the real thing'}</div>
                <div style={{ height: 8, borderRadius: 6, background: '#1c2527', overflow: 'hidden', marginTop: 12 }}><span style={{ display: 'block', height: '100%', width: Math.min(100, (missionWeek / missionWeeks) * 100) + '%', background: 'linear-gradient(90deg,var(--gold),var(--gold-2))' }} /></div>
              </div>
            )}
          </div>
          )}
        </>
      )}

      {/* ===== TODAY ===== */}
      {sub === 'today' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 19 }}>{isToday ? 'Today · ' : ''}{fmtDay(viewDate)}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {fillMsg && <span className="muted" style={{ fontSize: 13 }}>{fillMsg}</span>}
              <button onClick={fillCalendar} style={{ ...btn, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none' }}>↦ Fill my calendar</button>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Your kill list. Set a start and a finish time on each, then fill your calendar. Top 3 are your non-negotiables. Anything not checked by its finish time counts as missed.</div>
          {(() => { const n = dayTasks.filter(isOverdue).length; return n > 0 ? <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', marginBottom: 12 }}>⚠ {n} not done {dayIsPast ? 'that day' : 'and past their finish time'}. You came up short. Check them off to fix your score.</div> : null })()}
          <BulkBar k={key} />
          <TaskList tasks={dayTasks} clash={clash} onText={(id, v) => patchTask(key, id, { text: v })} onTime={changeTime} onEnd={(id, v) => patchTask(key, id, { end: hhmmToMin(v) })} onDur={(id, v) => patchTask(key, id, { dur: v })} onDone={(id) => patchTask(key, id, { done: !dayTasks.find((t) => t.id === id).done })} onDel={(id) => removeTask(key, id)} overdue={isOverdue} selectable selIds={selIds} onToggleSel={toggleSel} onMenu={(e, id) => openMenu(e, id, key)} nonNeg onCommit={(id, v) => commitTask(key, id, v)} tbLine={tbLine} />
          <button onClick={() => addTask(key)} style={addRow}>+ Add a task</button>
          {renderPaste(key)}
        </div>
      )}

      {/* ===== WEEK — click any day, even weeks out, to edit ===== */}
      {sub === 'week' && (
        <div className="panel">
          <div style={{ fontWeight: 900, fontSize: 19, marginBottom: 4 }}>Plan ahead</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Weeks are collapsed to keep it clean. Only the current week is open. Click a week to open it, click any day to edit. Click a task's ⠿ grip to select several, then drag any one to move them all together.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {weekGroups.map((wg) => {
              const open = openWeeks.has(wg.idx)
              const isCur = wg.idx === currentWeekIdx
              const wdone = wg.dates.reduce((a, d) => a + (tasks[dk(d)] || []).filter((t) => t.done).length, 0)
              const wtot = wg.dates.reduce((a, d) => a + (tasks[dk(d)] || []).length, 0)
              const theme = wg.theme ? wg.theme.replace(/^Week\s*\d+\s*[:\-–]\s*/i, '') : ''
              return (
                <div key={wg.idx} style={{ border: '1px solid ' + (isCur ? 'var(--gold)' : 'var(--line)'), borderRadius: 12, overflow: 'hidden' }}>
                  <button onClick={() => toggleWeek(wg.idx)} style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: isCur ? 'rgba(245,208,96,0.08)' : 'var(--bg)', border: 'none', padding: '11px 14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: isCur ? 'var(--gold)' : 'var(--text)' }}>Week {wg.idx + 1}{isCur ? ' · now' : ''}</span>
                      {theme && <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span className="muted" style={{ fontSize: 12 }}>{wtot ? `${wdone}/${wtot} done` : 'empty'}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {open && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, padding: '4px 12px 12px' }}>
                      {wg.dates.map((d) => {
                        const k = dk(d); const list = tasks[k] || []; const done = list.filter((t) => t.done).length
                        const sel = k === key; const over = dragOverKey === k
                        return (
                          <button key={k} onClick={() => setViewDate(d)}
                            onDragOver={(e) => { e.preventDefault(); if (dragOverKey !== k) setDragOverKey(k) }}
                            onDragLeave={() => setDragOverKey((cur) => cur === k ? null : cur)}
                            onDrop={(e) => { e.preventDefault(); const dt = dragTask.current; if (dt) moveTasks(dt.ids, dt.fromKey, k); dragTask.current = null; setDragOverKey(null) }}
                            style={{ textAlign: 'left', background: over ? 'rgba(245,208,96,0.18)' : (sel ? 'rgba(245,208,96,0.10)' : 'var(--bg)'), border: '1px solid ' + (over ? 'var(--gold)' : (sel ? 'var(--gold)' : 'var(--line)')), borderRadius: 10, padding: '9px 10px', cursor: 'pointer', minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 12.5, color: sel || over ? 'var(--gold)' : 'var(--text)' }}>{new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                            <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{over ? 'drop →' : (list.length ? `${done}/${list.length}` : '·')}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{fmtDay(viewDate)}</div>
            <BulkBar k={key} />
            <TaskList tasks={dayTasks} clash={clash} onText={(id, v) => patchTask(key, id, { text: v })} onTime={changeTime} onEnd={(id, v) => patchTask(key, id, { end: hhmmToMin(v) })} onDur={(id, v) => patchTask(key, id, { dur: v })} onDone={(id) => patchTask(key, id, { done: !dayTasks.find((t) => t.id === id).done })} onDel={(id) => removeTask(key, id)} overdue={isOverdue} selectable selIds={selIds} onToggleSel={toggleSel} onMenu={(e, id) => openMenu(e, id, key)} onCommit={(id, v) => commitTask(key, id, v)} tbLine={tbLine} onDragStart={(id) => { const ids = selIds.has(id) && selIds.size ? [...selIds] : [id]; dragTask.current = { ids, fromKey: key } }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <button onClick={() => addTask(key)} style={addRow}>+ Add a task for this day</button>
              <button onClick={fillCalendar} style={{ ...btn, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none' }}>↦ Fill calendar for this day</button>
              {fillMsg && <span className="muted" style={{ fontSize: 13 }}>{fillMsg}</span>}
            </div>
            {renderPaste(key)}
          </div>
        </div>
      )}

      {sub === 'month' && (
        <div className="panel">
          <div style={{ fontWeight: 900, fontSize: 19, marginBottom: 4 }}>Mission · {mission.title}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{horizonLabel(missionWeeks)}, {missionWeeks} weeks. {mission.weeks ? 'KAI broke it into weekly themes. Open a week in the Week tab to work its days.' : 'Use Plan with KAI up top to break it into weekly themes.'}</div>
          {Array.isArray(mission.weeks) && mission.weeks.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {mission.weeks.map((w, i) => (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid ' + (i + 1 === missionWeek ? 'var(--gold)' : 'var(--line)'), borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: i + 1 === missionWeek ? 'var(--gold)' : 'var(--text)' }}>{w}{i + 1 === missionWeek ? '  · now' : ''}</div>
                </div>
              ))}
            </div>
          ) : <div className="muted" style={{ fontSize: 14, padding: '10px 0' }}>No plan yet.</div>}
        </div>
      )}
      {sub === 'year' && <YearLadder north={north} now={now} />}
      {sub === 'decade' && <SimpleGoal title="The decade" sub={north} big />}
      {sub === 'stats' && <Stats tasks={missionTasks} allTasks={tasks} now={now} anchor={missionAnchor} weeks={missionWeeks} />}
    </div>
  )
}

function TaskList({ tasks, clash, onText, onTime, onEnd, onDur, onDone, onDel, nonNeg, onDragStart, selectable, selIds, onToggleSel, overdue, onMenu, onCommit, tbLine }) {
  if (!tasks.length) return <div className="muted" style={{ fontSize: 14, padding: '14px 0' }}>No tasks yet. Add the things you must get done.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tasks.map((t, i) => {
        const red = clash(t)
        const miss = overdue && overdue(t)
        const picked = selectable && selIds && selIds.has(t.id)
        const bord = picked ? 'var(--gold)' : (miss ? 'var(--red)' : (red ? 'var(--red)' : 'var(--line)'))
        const said = tbLine && tbLine[t.id]
        return (
          <div key={t.id}>
          <div onContextMenu={onMenu ? (e) => onMenu(e, t.id) : undefined} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', border: '1px solid ' + bord, borderRadius: 12, background: picked ? 'rgba(245,208,96,0.10)' : ((miss || red) ? 'rgba(255,68,102,0.06)' : 'var(--bg)') }}>
            {/* SELECT checkbox — pick tasks to move or delete together (separate from Done) */}
            {selectable && <div onClick={() => onToggleSel && onToggleSel(t.id)} title="Select (to move or delete several)" style={{ width: 20, height: 20, borderRadius: 5, border: '2px solid ' + (picked ? 'var(--gold)' : 'var(--teal-dim)'), background: picked ? 'var(--gold)' : 'transparent', color: 'var(--on-gold)', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>{picked ? '✓' : ''}</div>}
            {onDragStart && <span draggable onDragStart={() => onDragStart(t.id)} title="Drag onto another day to move it (selected move together)" style={{ cursor: 'grab', color: picked ? 'var(--gold)' : 'var(--muted)', fontSize: 15, flexShrink: 0, userSelect: 'none', lineHeight: 1 }}>⠿</span>}
            <div onClick={() => onDone(t.id)} title="Mark done" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid ' + (t.done ? 'var(--gold)' : (miss ? 'var(--red)' : 'var(--teal)')), background: t.done ? 'var(--gold)' : 'transparent', color: 'var(--on-gold)', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>{t.done ? '✓' : ''}</div>
            {nonNeg && i < 3 && <span title="Non-negotiable" style={{ color: 'var(--gold)', fontSize: 13, flexShrink: 0 }}>★</span>}
            <input value={t.text} onChange={(e) => onText(t.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && onCommit) { e.preventDefault(); onCommit(t.id, e.target.value); e.target.blur() } }}
              onBlur={(e) => onCommit && onCommit(t.id, e.target.value)}
              placeholder="What needs to get done, e.g. pray 5am to 6am" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: t.done ? 'var(--muted)' : 'var(--text)', fontSize: 14, fontWeight: 700, outline: 'none', textDecoration: t.done ? 'line-through' : 'none' }} />
            {t.missed && !t.done && <span title="You pushed this to another day, so it stays here as unfinished" style={{ color: 'var(--red)', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>moved</span>}
            {miss && !t.missed && <span title="Not done by its finish time" style={{ color: 'var(--red)', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>missed</span>}
            {t.time == null
              ? <button onClick={() => onTime(t.id, '09:00')} title="Add a start time" style={{ background: 'var(--panel)', border: '1px solid var(--teal-dim)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, fontWeight: 700, padding: '5px 11px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>＋ time</button>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <input type="time" value={minToHHMM(t.time)} onChange={(e) => onTime(t.id, e.target.value)} title="Start" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, padding: '5px 8px' }} />
                  <span className="muted" style={{ fontSize: 12 }}>→</span>
                  <input type="time" value={minToHHMM(finishMin(t))} onChange={(e) => onEnd && onEnd(t.id, e.target.value)} title="Finish by" style={{ background: 'var(--panel)', border: '1px solid ' + (miss ? 'var(--red)' : 'var(--line)'), borderRadius: 8, color: 'var(--text)', fontSize: 13, padding: '5px 8px' }} />
                </span>}
            {(() => {
              // Duration and finish drive each other: pick a duration → it fills the finish
              // time from the start; set a finish → the duration shown here follows it.
              const cur = (t.time != null && t.end != null && t.end > t.time) ? (t.end - t.time) : (t.dur || 60)
              const base = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720]
              const opts = base.includes(cur) ? base : [...base, cur].sort((a, b) => a - b)
              const fmt = (m) => m < 60 ? m + 'm' : Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + 'hr'
              return (
                <select value={cur} title="Duration, sets the finish time from the start" onChange={(e) => { const v = parseInt(e.target.value); if (t.time != null && onEnd) onEnd(t.id, minToHHMM(Math.min(1439, t.time + v))); onDur(t.id, v) }} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, padding: '5px 6px', flexShrink: 0 }}>
                  {opts.map((m) => <option key={m} value={m}>{fmt(m)}</option>)}
                </select>
              )
            })()}
            {red && !miss && <span title="Overlaps another task on this same day" style={{ color: 'var(--red)', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>clash</span>}
            <button onClick={() => onDel(t.id)} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
          </div>
          {said && <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 0 47px', color: 'var(--teal)', fontSize: 12, fontWeight: 700 }}><span style={{ color: 'var(--gold)' }}>✦</span>{said}</div>}
          </div>
        )
      })}
    </div>
  )
}

function SimpleGoal({ title, sub, big }) {
  return (
    <div className="panel">
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>{title}</div>
      <div style={{ fontSize: big ? 22 : 16, fontWeight: big ? 900 : 700, marginTop: 10, lineHeight: 1.3, maxWidth: 760, color: big ? 'var(--text)' : 'var(--muted)' }}>{sub}</div>
    </div>
  )
}

// Pull a target amount out of the north star, e.g. "100 million dollar" -> 1e8.
function parseTarget(s) {
  const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(billion|bn|b|million|mm|m|k|thousand)?/i)
  if (!m) return null
  let n = parseFloat(m[1]); if (!isFinite(n) || n <= 0) return null
  const u = (m[2] || '').toLowerCase()
  const mult = u.startsWith('b') ? 1e9 : (u.startsWith('m') ? 1e6 : ((u === 'k' || u === 'thousand') ? 1e3 : 1))
  return n * mult
}
function fmtMoney(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K'
  return '$' + Math.round(n)
}

// The Year system: it stands alone, feeding the DECADE north star only — nothing to do
// with the current mission. It splits the north star into 10 climbing yearly targets.
function YearLadder({ north, now }) {
  const K = 'grow_year_ladder'
  const base = now || new Date()
  const target = parseTarget(north)
  const [over, setOver] = useState(() => load(K, {}))
  useEffect(() => save(K, over), [over])
  const ratio = 1.9
  const seed = (i) => target ? target * (Math.pow(ratio, i + 1) - 1) / (Math.pow(ratio, 10) - 1) : null
  const setYear = (yr, v) => setOver((o) => ({ ...o, [yr]: v }))
  // The decade runs 10 years from TODAY, so it accounts for the month and day. If today is
  // mid-2026, year 1 finishes mid-2027 and the deadline lands mid-2036 — not calendar 2035.
  const endDate = (i) => new Date(base.getFullYear() + i + 1, base.getMonth(), base.getDate())
  const fmtBy = (d) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  const deadline = endDate(9)
  return (
    <div className="panel">
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>The decade → 10 years</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, lineHeight: 1.25 }}>{north}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {target ? `Your north star split into a climbing target for each of the next 10 years, reaching ${fmtMoney(target)} by ${fmtBy(deadline)}, ten years from today. This ladder answers only to the decade, not the mission. Click any year to set your own number.`
          : 'Break your north star into 10 years, measured from today. Click any year to write what it must look like. This ladder answers only to the decade, not the mission.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginTop: 16 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const end = endDate(i)
          const yr = end.getFullYear()
          const isNow = i === 0
          const seeded = target ? fmtMoney(seed(i)) : ''
          const val = (over[yr] != null ? over[yr] : seeded)
          return (
            <div key={yr} style={{ background: 'var(--bg)', border: '1px solid ' + (isNow ? 'var(--gold)' : 'var(--line)'), borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, color: isNow ? 'var(--gold)' : 'var(--muted)' }}>Year {i + 1} · by {fmtBy(end)}{isNow ? ' · now' : ''}</div>
              <input value={val} onChange={(e) => setYear(yr, e.target.value)} placeholder={target ? seeded : 'What must this year hit?'} style={{ width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 19, fontWeight: 900, outline: 'none', fontFamily: 'var(--display)' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Charts from real task-completion data. Each range is a wide time series that runs from the
// past into the future (KAI's planned days), with a "now" marker — you pan it like a chart.
function Stats({ tasks, allTasks, now, anchor, weeks }) {
  const [range, setRange] = useState('daily')
  const nowD = now || new Date()
  const today = midnight(nowD)
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes()
  // The chart covers the MISSION, not an arbitrary ±60 days. Drawing months of
  // axis outside the mission window just painted a long flat zero line and made
  // it look like you did nothing.
  const winStart = anchor ? anchor.startMon : startOfWeekMon(today)
  const winWeeks = Math.max(1, weeks || 4)
  const winDays = winWeeks * 7
  // Recompute once a minute. The series used to memo on [range, tasks] alone
  // while reading nowMin from the closure, so a task going overdue (or the "now"
  // marker moving) never showed up until the tasks themselves changed.
  const tick = dk(today) + ':' + nowMin
  // Score a bucket: each done task is +1, each MISSED task is -1 (a task is missed if
  // it's not done and the day is past, it was pushed to another day, or today its finish
  // time has passed). So a bad day goes NEGATIVE.
  const tally = (list, day) => {
    // Days before your record starts score nothing, so the mission line begins
    // at zero instead of inheriting setup data from before you were tracking.
    if (!inHistory(dk(day))) return { done: 0, missed: 0, planned: 0 }
    const dayPast = midnight(day).getTime() < today.getTime()
    const isTod = dk(day) === dk(today)
    let done = 0, missed = 0
    for (const t of list) { if (t.done) done++; else if (t.missed || dayPast || (isTod && t.end != null && t.end < nowMin)) missed++ }
    return { done, missed, planned: list.length }
  }
  const rng = (t) => t.time != null ? (minToHHMM(t.time) + ' → ' + minToHHMM(finishMin(t))) : 'no time set'
  const itemsFrom = (list, prefix) => list.map((t) => ({ text: t.text || '(untitled)', when: (prefix ? prefix + ' ' : '') + rng(t), done: t.done }))
  // Everything you did BEFORE the first bucket on screen still counts. The line
  // starts from your running record instead of resetting to zero, so a new
  // mission continues the same climb the Home page draws.
  // Reads the FULL history, not the mission-clipped copy. `tasks` here is
  // already trimmed to this mission, so carrying from it would always be zero.
  const carryBefore = (startKey) => {
    const src = allTasks || tasks
    let run = 0
    Object.keys(src).forEach((k) => {
      if (!inHistory(k) || k >= startKey) return
      const q = tally(src[k] || [], new Date(k + 'T00:00:00'))
      run += q.done - q.missed
    })
    return run
  }
  const series = useMemo(() => {
    const pts = []
    let nowIndex = 0
    // The line is a RUNNING TOTAL, not each day standing alone. Every done task is
    // +1 on it, every missed one is -1. One missed task moves it down exactly
    // one step. Before this, each day was plotted on its own, so a 20-task day
    // scoring +5 next to a 1-task day scoring -1 looked like a collapse when it
    // was really just a smaller day. `delta` keeps that day's own score for the
    // dots, the tooltip, and the climbing/slipping headline.
    let run = 0
    const add = (o) => { run += o.delta; pts.push({ ...o, value: run }) }
    if (range === 'hourly') {
      const daysEach = 3
      run = carryBefore(dk(new Date(today.getTime() - daysEach * 864e5)))
      for (let dOff = -daysEach; dOff <= daysEach; dOff++) {
        const day = new Date(today.getTime() + dOff * 864e5)
        const list = tasks[dk(day)] || []
        for (let h = 0; h < 24; h++) {
          // Bucket by FINISH time — the task counts in the hour it's due to be done.
          const inHour = list.filter((t) => { const f = finishMin(t); return f != null && Math.min(23, Math.floor(f / 60)) === h })
          if (dOff === 0 && h === nowD.getHours()) nowIndex = pts.length
          const hl = h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'
          const q = tally(inHour, day)
          add({ label: hl, header: day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + hl, delta: q.done - q.missed, done: q.done, missed: q.missed, goal: q.planned, items: itemsFrom(inHour) })
        }
      }
      return { type: 'line', points: pts, nowIndex, view: 14 }
    }
    if (range === 'daily') {
      run = carryBefore(dk(winStart))
      // Exactly the mission's days, start to end. Nothing outside it exists.
      for (let i = 0; i < winDays; i++) {
        const d = new Date(winStart.getTime() + i * 864e5)
        const list = tasks[dk(d)] || []
        const q = tally(list, d)
        if (dk(d) === dk(today)) nowIndex = pts.length
        add({ label: new Date(d).toLocaleDateString(undefined, { day: 'numeric' }), header: new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), delta: q.done - q.missed, done: q.done, missed: q.missed, goal: q.planned, items: itemsFrom(list) })
      }
      if (today.getTime() > winStart.getTime() + (winDays - 1) * 864e5) nowIndex = pts.length - 1
      return { type: 'line', points: pts, nowIndex, view: 14 }
    }
    if (range === 'weekly') {
      run = carryBefore(dk(winStart))
      // Week numbers here now mean the MISSION's weeks, the same ones the mission
      // card and the week planner show. They used to be counted from this week,
      // so "Wk 1" could sit on top of what the card called Week 3.
      for (let w = 0; w < winWeeks; w++) {
        const ws = new Date(winStart.getTime() + w * 7 * 864e5); let done = 0, missed = 0, g = 0; const items = []
        for (let i = 0; i < 7; i++) { const d = new Date(ws.getTime() + i * 864e5); const q = tally(tasks[dk(d)] || [], d); done += q.done; missed += q.missed; g += q.planned; items.push(...itemsFrom(tasks[dk(d)] || [], d.toLocaleDateString(undefined, { weekday: 'short' }))) }
        if (today.getTime() >= ws.getTime() && today.getTime() < ws.getTime() + 7 * 864e5) nowIndex = pts.length
        const we = new Date(ws.getTime() + 6 * 864e5)
        const dateRange = ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' to ' + we.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        add({ label: 'Wk ' + (w + 1), header: 'Week ' + (w + 1) + ' · ' + dateRange, delta: done - missed, done, missed, goal: g, items })
      }
      return { type: 'line', points: pts, nowIndex, view: 12 }
    }
    const winEnd = new Date(winStart.getTime() + (winDays - 1) * 864e5)
    if (range === 'monthly') {
      // Only the months the mission actually touches.
      const first = new Date(winStart.getFullYear(), winStart.getMonth(), 1)
      run = carryBefore(dk(first))
      const months = (winEnd.getFullYear() - first.getFullYear()) * 12 + (winEnd.getMonth() - first.getMonth())
      for (let mo = 0; mo <= months; mo++) {
        const dt = new Date(first.getFullYear(), first.getMonth() + mo, 1); let done = 0, missed = 0, g = 0; const items = []
        for (let day = 1; day <= 31; day++) { const d = new Date(dt.getFullYear(), dt.getMonth(), day); if (d.getMonth() !== dt.getMonth()) continue; const q = tally(tasks[dk(d)] || [], d); done += q.done; missed += q.missed; g += q.planned; items.push(...itemsFrom(tasks[dk(d)] || [], d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))) }
        if (dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth()) nowIndex = pts.length
        add({ label: dt.toLocaleDateString(undefined, { month: 'short' }), header: dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), delta: done - missed, done, missed, goal: g, items })
      }
      return { type: 'line', points: pts, nowIndex, view: 12 }
    }
    // Yearly: only the years the mission spans.
    for (let yr = winStart.getFullYear(); yr <= winEnd.getFullYear(); yr++) {
      let done = 0, missed = 0, g = 0
      Object.keys(tasks).forEach((k) => { if (k.startsWith(yr + '-')) { const q = tally(tasks[k] || [], new Date(k + 'T00:00:00')); done += q.done; missed += q.missed; g += q.planned } })
      if (yr === today.getFullYear()) nowIndex = pts.length
      // Bars are per-year on purpose: a bar is that year's own score, so it is
      // not part of the running total the line charts draw.
      pts.push({ label: String(yr), header: String(yr), value: done - missed, delta: done - missed, done, missed, goal: g, items: [] })
    }
    return { type: 'bar', points: pts, nowIndex, view: 8 }
  }, [range, tasks, allTasks, tick, winStart, winDays, winWeeks]) // eslint-disable-line

  // Headline over the past up to now.
  const past = series.points.slice(0, series.nowIndex + 1)
  // Judge on EVERY bucket that had tasks planned, including the bad ones. This
  // used to filter to p.value > 0 first, so a run of negative days was invisible
  // and it always claimed you were climbing — even with no data at all.
  // Judge on each bucket's OWN score (delta), never the running total — a total
  // only ever climbs, so comparing totals would always report you as winning.
  const scored = past.filter((p) => p.goal > 0)
  const avg = (a) => a.length ? a.reduce((s, p) => s + (p.delta != null ? p.delta : p.value), 0) / a.length : 0
  const half = Math.floor(scored.length / 2)
  const up = scored.length < 2 ? avg(scored) >= 0 : avg(scored.slice(half)) >= avg(scored.slice(0, half))
  // The bucket you are currently IN is not over yet, so it can't be a failed one.
  const settled = past.slice(0, -1)
  const withPlan = settled.filter((p) => p.goal > 0).length
  const hits = settled.filter((p) => p.goal > 0 && (p.done || 0) >= p.goal).length
  const unit = range === 'yearly' ? 'years' : range === 'monthly' ? 'months' : range === 'weekly' ? 'weeks' : range === 'hourly' ? 'hours' : 'days'
  return (
    <div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>Are you getting it done?</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8 }}>{up ? "You're getting it done " : "You're slipping "}<span style={{ color: up ? 'var(--done)' : 'var(--red)' }}>{up ? '↑' : '↓'}</span></div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{withPlan ? `You hit the full goal on ${hits} of ${withPlan} ${unit} with tasks planned.` : (up ? 'Your line is climbing. Keep hunting.' : 'Your line is dropping. Tighten up.')}</div>
      </div>
      <div className="panel">
        <div style={{ marginBottom: 16 }}>
          {['hourly', 'daily', 'weekly', 'monthly', 'yearly'].map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ background: range === r ? 'var(--gold)' : 'var(--bg)', color: range === r ? 'var(--on-gold)' : 'var(--muted)', border: '1px solid ' + (range === r ? 'var(--gold)' : 'var(--line)'), fontWeight: 700, fontSize: 13, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', marginRight: 8, textTransform: 'capitalize' }}>{r}</button>
          ))}
        </div>
        <PanChart type={series.type} points={series.points} nowIndex={series.nowIndex} defaultView={series.view} rangeKey={range} />
        <div className="muted" style={{ fontSize: 12, marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--done)', fontSize: 14 }}>●</span> hit the goal</span>
          <span><span style={{ color: 'var(--red)', fontSize: 14 }}>◌</span> came up short</span>
          <span><span style={{ color: 'var(--gold)', fontSize: 14 }}>◌</span> still going</span>
          <span><span style={{ color: 'var(--gold)' }}>┊</span> now</span>
          <span>drag to pan, it keeps gliding · scroll to zoom on the cursor · drag the bottom axis to squeeze time · drag the left axis to stretch the values · arrow keys step one, hold shift for five · double click to reset</span>
        </div>
      </div>
    </div>
  )
}


const btn = { background: 'transparent', border: '1px solid var(--teal-dim)', color: 'var(--gold)', borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }
const addRow = { marginTop: 12, background: 'transparent', border: '1px dashed var(--teal-dim)', color: 'var(--muted)', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'left' }
