import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'

// In-app calendar. Day + week views. Drag on an empty stretch to create, drag a
// block to move it, drag its bottom edge to resize, click it to edit or delete.
// Every change is written back to Google by the parent (onCreate/onUpdate/onDelete).

const HOUR_PX = 76
const WK_PX = 40
const DAY_MIN = 1440
const SNAP = 15

// The day view keeps going past both ends of the day. Midnight is not a wall:
// you go to bed at 11pm and wake at 1am, so that has to be ONE block you can
// draw, drag and stretch in a single view instead of two halves that each lose
// the other. PAD_MIN is how far either side of the day you can reach.
const PAD_MIN = 240                    // 4h before 12am, 4h after
const MIN_LO = -PAD_MIN
const MIN_HI = DAY_MIN + PAD_MIN
const SPAN_MIN = MIN_HI - MIN_LO
// Minutes from THIS day's midnight to a pixel offset in the grid. Negative
// minutes are yesterday evening, past 1440 is tomorrow morning.
const topPx = (min) => ((min - MIN_LO) / 60) * HOUR_PX
const GRID_PX = (SPAN_MIN / 60) * HOUR_PX

// Block colors. Keys are Google Calendar colorIds so the choice syncs + persists.
const COLOR_MAP = {
  '10': { bg: 'rgba(74,222,128,0.15)', bd: '#4ade80' },   // green
  '5': { bg: 'rgba(245,208,96,0.16)', bd: '#d98a68' },    // gold
  '11': { bg: 'rgba(255,90,90,0.14)', bd: '#ff5a5a' },    // red
  '7': { bg: 'rgba(91,156,240,0.15)', bd: '#5b9cf0' },    // blue
  '3': { bg: 'rgba(180,124,240,0.15)', bd: '#b47cf0' },   // purple
  // Same colorId the auto-detected Sleep blocks use, so a block you color
  // gray yourself counts as sleep too, not just ones titled "Sleep".
  '9': { bg: 'rgba(255,255,255,0.06)', bd: '#565e63' }    // gray / sleep
}
const COLORS = [
  { id: '10', name: 'Green' }, { id: '5', name: 'Gold' }, { id: '11', name: 'Red' },
  { id: '7', name: 'Blue' }, { id: '3', name: 'Purple' }, { id: '9', name: 'Gray (sleep)' }
]

function midnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function sameDay(a, b) { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate() }
function snap(m) { return Math.round(m / SNAP) * SNAP }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

// Minutes can run past both ends of the day now, so wrap into a real clock time
// before formatting. -60 is 11 PM, 1500 is 1 AM.
function fmtMin(min) {
  const t = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN
  const h = Math.floor(t / 60), m = t % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`
}
function fmtHourLabel(h) {
  const x = ((h % 24) + 24) % 24
  if (x === 0) return '12 AM'
  if (x === 12) return '12 PM'
  return x > 12 ? `${x - 12} PM` : `${x} AM`
}
// Which day an hour index belongs to, relative to the day you're looking at.
function dayTag(h) { return h < 0 ? 'Yesterday' : h >= 24 ? 'Tomorrow' : '' }
function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return null
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${a})`
}
function colorFor(ev) {
  const cid = ev && ev.colorId
  if (cid && COLOR_MAP[cid]) return COLOR_MAP[cid]
  const s = ((ev && ev.summary) || '').toLowerCase()
  if (s.includes('sleep')) return { bg: 'rgba(255,255,255,0.06)', bd: '#565e63' }
  if (s.includes('plan')) return COLOR_MAP['5']
  // No explicit block color: fall back to the calendar it lives on (e.g. a
  // secondary calendar like "Habbits"), so each calendar reads as its own color.
  const cc = ev && ev.calendarColor
  const rgba = cc && hexToRgba(cc, 0.15)
  if (rgba) return { bg: rgba, bd: cc }
  return COLOR_MAP['10']
}

// `lo`/`hi` are minutes from this day's midnight. The week and month grids stay
// on the plain 0..1440 day; the day grid passes the padded range so a block that
// crosses midnight shows whole instead of chopped at the boundary.
function eventsForDay(events, date, lo = 0, hi = DAY_MIN) {
  const base = midnight(date).getTime()
  const from = base + lo * 60000
  const to = base + hi * 60000
  return (events || [])
    // Any block that OVERLAPS this day, not just one that starts on it. A night of
    // sleep running 4:59pm to 3:28am has to show on both days, or the morning looks empty.
    .filter((ev) => {
      if (ev.allDay) return false
      const s = new Date(ev.start).getTime()
      const e = new Date(ev.end).getTime()
      return e > from && s < to
    })
    .map((ev) => {
      const s = clamp(Math.round((new Date(ev.start).getTime() - base) / 60000), lo, hi)
      const e = clamp(Math.round((new Date(ev.end).getTime() - base) / 60000), lo, hi)
      return { ...ev, sMin: s, eMin: Math.max(s + SNAP, e) }
    })
    .sort((a, b) => a.sMin - b.sMin)
}

// Notion / Google style layout: blocks that overlap in time split the width and sit
// SIDE BY SIDE instead of covering each other. Blocks are grouped into clusters of
// transitively overlapping items, then each gets the first free column.
function layoutDay(evs) {
  const items = evs.slice().sort((a, b) => a.sMin - b.sMin || a.eMin - b.eMin)
  const out = []
  let cluster = []
  let clusterEnd = -1
  const flush = () => {
    if (!cluster.length) return
    const colEnds = []
    cluster.forEach((it) => {
      let c = colEnds.findIndex((end) => end <= it.sMin)
      if (c === -1) { c = colEnds.length; colEnds.push(it.eMin) } else colEnds[c] = it.eMin
      it.col = c
    })
    cluster.forEach((it) => { it.cols = colEnds.length; out.push(it) })
    cluster = []
    clusterEnd = -1
  }
  items.forEach((ev) => {
    const it = { ...ev }
    if (cluster.length && it.sMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.eMin)
  })
  flush()
  return out
}

function startOfWeek(d) { const x = midnight(d); x.setDate(x.getDate() - x.getDay()); return x }

function localKey(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
function allDayKey(ev) { const s = String(ev.start); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : localKey(ev.start) }
function allDayForDay(events, date) { const k = localKey(date); return (events || []).filter((e) => e.allDay && allDayKey(e) === k) }

// Which calendars are hidden from the overlay, persisted across launches.
function loadHiddenCals() {
  try { return new Set(JSON.parse(localStorage.getItem('grow_hidden_cals') || '[]')) } catch (e) { return new Set() }
}
function saveHiddenCals(set) { try { localStorage.setItem('grow_hidden_cals', JSON.stringify([...set])) } catch (e) {} }

export default function CalendarView({ events, now, onCreate, onUpdate, onDelete, onPlanDay, planning }) {
  const [mode, setMode] = useState('day')
  const [viewDate, setViewDate] = useState(() => midnight(now || new Date()))
  const [drag, setDrag] = useState(null)      // {kind, id, calendarId, grabMin, sMin, eMin, curS, curE, moved}
  const [draft, setDraft] = useState(null)    // {sMin, eMin, title}
  const [editing, setEditing] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [selected, setSelected] = useState(null)   // clicked block id
  const [renaming, setRenaming] = useState(null)   // {id, text}
  const [hiddenCals, setHiddenCals] = useState(loadHiddenCals)
  const [showCals, setShowCals] = useState(false)
  const gridRef = useRef(null)
  const scrollRef = useRef(null)
  const ghostRef = useRef(null)
  const rectRef = useRef(null)          // grid rect cached at drag start (no reflow per move)
  const dayEventsRef = useRef([])
  const clipRef = useRef(null)          // copied block {summary, colorId, durMin, sMin}
  const toastTimer = useRef(null)
  const [toast, setToast] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const flashToast = useCallback((m) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 1200) }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = mode === 'day' ? topPx(7 * 60) : 7 * HOUR_PX
  }, [mode])
  useEffect(() => { setSelected(null); setRenaming(null) }, [mode, viewDate])

  // Trackpad: a two-finger sideways swipe pages the week or month, so you never
  // have to reach for the ‹ › buttons. Vertical scroll still scrolls the grid.
  const navCooldown = useRef(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || mode === 'day') return
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return
      e.preventDefault()
      const t = Date.now()
      if (t < navCooldown.current) return
      navCooldown.current = t + 500
      shiftDay(e.deltaX > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mode]) // eslint-disable-line

  // Every calendar seen in the synced events, for the overlay list. Keyed by
  // calendarId so the same calendar across a resync stays one stable entry.
  const calendarList = useMemo(() => {
    const byId = new Map()
    ;(events || []).forEach((e) => {
      if (!e.calendarId || byId.has(e.calendarId)) return
      byId.set(e.calendarId, { id: e.calendarId, name: e.calendarName || e.calendarId, color: e.calendarColor || null })
    })
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [events])

  const toggleCal = (id) => setHiddenCals((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); saveHiddenCals(n); return n })

  const visibleEvents = useMemo(() => (events || []).filter((e) => !hiddenCals.has(e.calendarId)), [events, hiddenCals])

  const dayEvents = useMemo(() => layoutDay(eventsForDay(visibleEvents, viewDate, MIN_LO, MIN_HI)), [visibleEvents, viewDate])
  const dayAllDay = useMemo(() => allDayForDay(visibleEvents, viewDate), [visibleEvents, viewDate])
  dayEventsRef.current = dayEvents

  // Minutes from a Y coord, using the rect cached at drag start (no layout
  // thrash on every mousemove).
  function yToMin(clientY) {
    const rect = rectRef.current || (gridRef.current && gridRef.current.getBoundingClientRect())
    if (!rect) return 0
    return clamp(snap(((clientY - rect.top) / HOUR_PX) * 60 + MIN_LO), MIN_LO, MIN_HI)
  }
  function dateAt(min) { return new Date(midnight(viewDate).getTime() + min * 60000) }

  // ---- keyboard actions: copy / paste / duplicate / nudge / new ----
  function copyBlock(ev) { clipRef.current = { summary: ev.summary, colorId: ev.colorId, durMin: ev.eMin - ev.sMin, sMin: ev.sMin }; flashToast('Copied') }
  function pasteBlock() {
    const c = clipRef.current; if (!c || !onCreate) return
    const dur = c.durMin
    let s = clamp(c.sMin, MIN_LO, MIN_HI - dur)
    const collide = (m) => dayEvents.some((ev) => m < ev.eMin && (m + dur) > ev.sMin)
    let guard = 0
    while (collide(s) && s < MIN_HI - dur && guard < 96) { s = Math.min(s + SNAP, MIN_HI - dur); guard++ }
    onCreate({ summary: c.summary, colorId: c.colorId, start: dateAt(s).toISOString(), end: dateAt(s + dur).toISOString() })
    flashToast('Pasted')
  }
  function duplicateBlock(ev) { const dur = ev.eMin - ev.sMin; clipRef.current = { summary: ev.summary, colorId: ev.colorId, durMin: dur, sMin: Math.min(ev.eMin, MIN_HI - dur) }; pasteBlock() }
  function nudgeBlock(ev, delta) { const dur = ev.eMin - ev.sMin; const ns = clamp(ev.sMin + delta, MIN_LO, MIN_HI - dur); if (ns === ev.sMin || !onUpdate) return; onUpdate({ id: ev.id, calendarId: ev.calendarId, start: dateAt(ns).toISOString(), end: dateAt(ns + dur).toISOString() }) }
  function newBlockNow() { let m = 9 * 60; const nowD = now || new Date(); if (sameDay(nowD, viewDate)) m = clamp(snap(nowD.getHours() * 60 + nowD.getMinutes()), MIN_LO, MIN_HI - 60); setDraft({ date: viewDate, sMin: m, eMin: m + 60 }) }

  // Bind the drag listeners ONCE per drag (deps on the boolean, not the object)
  // so we don't re-subscribe every frame. One state update per animation frame,
  // and only the dragged block re-renders (React.memo on the rest).
  const dragging = drag != null
  useEffect(() => {
    if (!dragging) return
    let raf = null, lastY = 0, ended = false
    const apply = () => {
      raf = null
      setDrag((d) => {
        if (!d) return d
        const m = yToMin(lastY)
        if (d.kind === 'create') return { ...d, curE: Math.max(d.sMin + SNAP, m), moved: true }
        if (d.kind === 'resize-bottom') { const ce = clamp(m, d.sMin + SNAP, MIN_HI); return { ...d, curE: ce, moved: ce !== d.eMin } }
        if (d.kind === 'resize-top') { const cs = clamp(m, MIN_LO, d.eMin - SNAP); return { ...d, curS: cs, moved: cs !== d.sMin } }
        const dur = d.eMin - d.sMin
        const ns = clamp(m - d.grabMin + d.sMin, MIN_LO, MIN_HI - dur)
        return { ...d, curS: ns, curE: ns + dur, moved: ns !== d.sMin }
      })
    }
    const end = () => {
      if (ended) return
      ended = true
      if (raf != null) { cancelAnimationFrame(raf); raf = null }
      setDrag((d) => {
        if (!d) return null
        if (d.kind === 'create') { if (d.moved && d.curE - d.sMin >= SNAP) setDraft({ date: viewDate, sMin: d.sMin, eMin: d.curE }) }
        else if (d.moved) { onUpdate({ id: d.id, calendarId: d.calendarId, start: dateAt(d.curS).toISOString(), end: dateAt(d.curE).toISOString() }) }
        else if (d.kind === 'move') { setSelected(d.id); setRenaming(null) }
        return null
      })
      rectRef.current = null
    }
    const move = (e) => {
      if (e.buttons === 0) { end(); return }   // button released (maybe off-window) — never get stuck
      lastY = e.clientY
      if (raf == null) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('blur', end)
    return () => { if (raf != null) cancelAnimationFrame(raf); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); window.removeEventListener('blur', end) }
  }, [dragging, viewDate]) // eslint-disable-line

  const cacheRect = () => { if (gridRef.current) rectRef.current = gridRef.current.getBoundingClientRect() }
  function onGridDown(e) {
    if (e.target.dataset.grid !== '1') return
    setSelected(null); setRenaming(null)
    cacheRect()
    const m = yToMin(e.clientY)
    setDrag({ kind: 'create', sMin: m, curS: m, curE: m + SNAP, moved: false })
  }

  // Keyboard on a SELECTED block: Delete removes it, Enter or any letter starts
  // a rename (typing replaces the name), Escape deselects.
  const commitRename = useCallback(() => {
    setRenaming((r) => {
      if (r) { const ev = dayEventsRef.current.find((x) => x.id === r.id); const text = (r.text || '').trim(); if (ev && text && text !== ev.summary) onUpdate({ id: ev.id, calendarId: ev.calendarId, summary: text }) }
      return null
    })
  }, [onUpdate])
  const onRenameChange = useCallback((t) => setRenaming((r) => r ? { ...r, text: t } : r), [])
  const onRenameCancel = useCallback(() => setRenaming(null), [])
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || renaming || editing || draft) return
      const meta = e.metaKey || e.ctrlKey
      const k = (e.key || '').toLowerCase()
      const ev = selected ? dayEvents.find((x) => x.id === selected) : null

      if (e.key === '?') { e.preventDefault(); setShowHelp((s) => !s); return }
      if (showHelp && e.key === 'Escape') { setShowHelp(false); return }

      if (meta) {
        if (k === 'c' && ev) { e.preventDefault(); copyBlock(ev) }
        else if (k === 'v') { e.preventDefault(); pasteBlock() }
        else if (k === 'd' && ev) { e.preventDefault(); duplicateBlock(ev) }
        return   // leave Cmd+Z (undo) and other combos to the app-level handler
      }

      if (ev) {   // a block is selected
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete({ id: ev.id, calendarId: ev.calendarId }); setSelected(null) }
        else if (e.key === 'Escape') setSelected(null)
        else if (e.key === 'Enter') { e.preventDefault(); setRenaming({ id: selected, text: ev.summary || '' }) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); nudgeBlock(ev, -SNAP) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); nudgeBlock(ev, SNAP) }
        else if (e.key.length === 1 && !e.altKey) { e.preventDefault(); setRenaming({ id: selected, text: e.key }) }
        return
      }

      // nothing selected: navigation, views, new, plan
      if (e.key === 'ArrowLeft') { e.preventDefault(); shiftDay(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); shiftDay(1) }
      else if (k === 't') goToday()
      else if (k === 'n') newBlockNow()
      else if (k === 'd') setMode('day')
      else if (k === 'w') setMode('week')
      else if (k === 'm') setMode('month')
      else if (k === 'p' && onPlanDay && !planning) onPlanDay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, renaming, editing, draft, dayEvents, viewDate, mode, showHelp, onPlanDay, planning]) // eslint-disable-line

  // Drag the "Add a block" chip onto the calendar. Wherever you drop it becomes
  // the block's slot, then the picker pops up.
  function resolveDrop(clientX, clientY) {
    let el = document.elementFromPoint(clientX, clientY)
    while (el && !el.dataset?.drop) el = el.parentElement
    if (!el) return null
    const kind = el.dataset.drop
    const rect = el.getBoundingClientRect()
    if (kind === 'day') { const min = clamp(snap((clientY - rect.top) / HOUR_PX * 60 + MIN_LO), MIN_LO, MIN_HI - 60); return { date: viewDate, sMin: min, eMin: min + 60 } }
    if (kind === 'week') { const min = clamp(snap((clientY - rect.top) / WK_PX * 60), 0, DAY_MIN - 60); return { date: new Date(el.dataset.date), sMin: min, eMin: min + 60 } }
    if (kind === 'month') { return { date: new Date(el.dataset.date), sMin: 9 * 60, eMin: 10 * 60 } }
    return null
  }
  useEffect(() => {
    if (!placing) return
    let ended = false
    const up = (e) => { if (ended) return; ended = true; setPlacing(false); const slot = resolveDrop(e.clientX, e.clientY); if (slot) setDraft(slot) }
    const move = (e) => { if (e.buttons === 0) { up(e); return } const g = ghostRef.current; if (g) { g.style.left = (e.clientX + 14) + 'px'; g.style.top = (e.clientY + 14) + 'px' } }
    const onBlur = () => setPlacing(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('blur', onBlur) }
  }, [placing, viewDate]) // eslint-disable-line
  // Click/drag the block body = MOVE (a plain click selects). Resize only via
  // the top/bottom handles that appear once a block is selected — so you never
  // resize by accident without clicking it first.
  const onBlockDown = useCallback((e, ev) => {
    e.stopPropagation()
    if (gridRef.current) rectRef.current = gridRef.current.getBoundingClientRect()
    const rect = rectRef.current
    const m = rect ? clamp(snap(((e.clientY - rect.top) / HOUR_PX) * 60 + MIN_LO), MIN_LO, MIN_HI) : ev.sMin
    setDrag({ kind: 'move', id: ev.id, calendarId: ev.calendarId, grabMin: m, sMin: ev.sMin, eMin: ev.eMin, curS: ev.sMin, curE: ev.eMin, moved: false })
  }, [])
  const onResizeDown = useCallback((e, ev, kind) => {
    e.stopPropagation(); e.preventDefault()
    if (gridRef.current) rectRef.current = gridRef.current.getBoundingClientRect()
    setDrag({ kind, id: ev.id, calendarId: ev.calendarId, sMin: ev.sMin, eMin: ev.eMin, curS: ev.sMin, curE: ev.eMin, moved: false })
  }, [])

  const shiftDay = (n) => setViewDate((d) => { const x = new Date(d); if (mode === 'month') x.setMonth(x.getMonth() + n); else if (mode === 'week') x.setDate(x.getDate() + n * 7); else x.setDate(x.getDate() + n); return midnight(x) })
  const goToday = () => setViewDate(midnight(now || new Date()))

  const headLabel = mode === 'month'
    ? viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? (() => { const s = startOfWeek(viewDate); const e = new Date(s); e.setDate(e.getDate() + 6); return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` })()
      : viewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ userSelect: 'none', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px 12px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Calendar</h1>
          <button onClick={() => shiftDay(-1)} style={navBtn}>‹</button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 13 }}>Today</button>
          <button onClick={() => shiftDay(1)} style={navBtn}>›</button>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 4 }}>{headLabel}</div>
          <button onMouseDown={(e) => { e.preventDefault(); setPlacing(true) }} title="Drag me onto the calendar to place a block" style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: 'var(--on-gold)', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13, cursor: placing ? 'grabbing' : 'grab' }}><span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Add a block</button>
          {onPlanDay && <button onClick={onPlanDay} disabled={planning} title="KAI books your 3 non-negotiables into today's open time" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13, cursor: planning ? 'default' : 'pointer', opacity: planning ? 0.6 : 1 }}><span style={{ fontSize: 15, lineHeight: 1 }}>✦</span> {planning ? 'Planning…' : 'Plan my day'}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>Drag to create · click a block then ⌘C / ⌘V to copy & paste · drag gold handles to resize</span>
          <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" style={{ background: 'var(--panel)', color: 'var(--gold)', border: '1px solid var(--teal-dim)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>⌨ Shortcuts</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowCals((s) => !s)} title="Show or hide calendars" style={{ background: 'var(--panel)', color: 'var(--gold)', border: '1px solid var(--teal-dim)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>📅 Calendars</button>
            {showCals && (
              <div onMouseLeave={() => setShowCals(false)} style={{ position: 'absolute', top: '110%', right: 0, zIndex: 400, minWidth: 220, background: 'var(--panel)', border: '1px solid var(--teal-dim)', borderRadius: 12, padding: 10, boxShadow: '0 14px 40px -12px rgba(0,0,0,0.7)' }}>
                {calendarList.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, padding: '4px 6px' }}>No calendars synced yet</div>}
                {calendarList.map((c) => {
                  const on = !hiddenCals.has(c.id)
                  const dot = c.color || COLOR_MAP['10'].bd
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', cursor: 'pointer', borderRadius: 8 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleCal(c.id)} style={{ accentColor: dot }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: on ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
            {['day', 'week', 'month'].map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 700, textTransform: 'capitalize', border: 'none', cursor: 'pointer', background: mode === m ? 'var(--gold)' : 'transparent', color: mode === m ? 'var(--on-gold)' : 'var(--muted)' }}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid var(--line)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {mode === 'day'
            ? <DayGrid gridRef={gridRef} dayEvents={dayEvents} allDay={dayAllDay} viewDate={viewDate} now={now} drag={drag} onGridDown={onGridDown} onBlockDown={onBlockDown} onResizeDown={onResizeDown} onEdit={setEditing} draft={draft} selected={selected} renaming={renaming} onRenameChange={onRenameChange} onRenameCommit={commitRename} onRenameCancel={onRenameCancel} />
            : mode === 'week'
              ? <WeekGrid events={visibleEvents} viewDate={viewDate} now={now} onOpenDay={(d) => { setViewDate(midnight(d)); setMode('day') }} setDraft={setDraft} onEdit={setEditing} />
              : <MonthGrid events={visibleEvents} viewDate={viewDate} now={now} onOpenDay={(d) => { setViewDate(midnight(d)); setMode('day') }} setDraft={setDraft} onEdit={setEditing} />}
        </div>
      </div>

      {placing && (
        <div ref={ghostRef} style={{ position: 'fixed', left: -999, top: -999, zIndex: 13000, pointerEvents: 'none', background: 'var(--gold)', color: 'var(--on-gold)', padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>Drop to place</div>
      )}
      {draft && (
        <CreateModal draft={draft}
          onSave={(payload) => { onCreate(payload); setDraft(null) }}
          onCancel={() => setDraft(null)} />
      )}
      {editing && (
        <EditModal ev={editing}
          onSave={(title, recurrence, description, location) => {
            // Changing the repeat edits the whole series (its master event).
            const id = (recurrence !== undefined && editing.recurringEventId) ? editing.recurringEventId : editing.id
            onUpdate({ id, calendarId: editing.calendarId, summary: title, recurrence, description, location })
            setEditing(null)
          }}
          onDelete={() => { onDelete({ id: editing.id, calendarId: editing.calendarId }); setEditing(null) }}
          onCancel={() => setEditing(null)} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 15000, background: 'var(--panel)', border: '1px solid var(--teal-dim)', color: 'var(--text)', borderRadius: 12, padding: '9px 18px', fontWeight: 700, fontSize: 14, boxShadow: '0 14px 40px -12px rgba(0,0,0,0.7)', pointerEvents: 'none' }}>{toast}</div>
      )}

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 15200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 94vw)', background: 'var(--panel)', border: '1px solid var(--teal-dim)', borderRadius: 20, padding: 26, boxShadow: '0 40px 100px -25px rgba(0,0,0,0.85)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, color: 'var(--text)' }}>Calendar shortcuts</div>
              <button onClick={() => setShowHelp(false)} style={{ background: 'var(--line)', border: 'none', color: 'var(--muted)', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Close</button>
            </div>
            {[
              ['Copy block', '⌘ C'], ['Paste block', '⌘ V'], ['Duplicate block', '⌘ D'], ['Undo', '⌘ Z'],
              ['Move selected block', '↑ ↓'], ['Delete block', 'Delete'], ['Rename block', 'Enter or type'],
              ['New block', 'N'], ['Plan my day', 'P'], ['Today', 'T'], ['Previous / next day', '← →'],
              ['Day / Week / Month', 'D / W / M'], ['This help', '?'],
            ].map(([label, keys], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span style={{ color: 'var(--text)', fontSize: 14 }}>{label}</span>
                <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 800, fontFamily: 'var(--display)' }}>{keys}</span>
              </div>
            ))}
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>Tip: copy a block, press → to the next day, then paste to repeat it at the same time.</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hour indices across the whole padded grid: negative ones are yesterday
// evening, 24 and up are tomorrow morning.
const HOURS = Array.from({ length: SPAN_MIN / 60 + 1 }, (_, i) => MIN_LO / 60 + i)

const HourLabels = React.memo(() => (
  <>{HOURS.map((h) => {
    const tag = dayTag(h)
    return (
      <div key={h} style={{ position: 'absolute', top: topPx(h * 60) - (tag ? 13 : 8), right: 10, textAlign: 'right', fontSize: 13, fontWeight: 600, color: tag ? 'var(--muted-2)' : 'var(--muted)', opacity: tag ? 0.75 : 1 }}>
        <div>{fmtHourLabel(h)}</div>
        {tag && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 }}>{tag}</div>}
      </div>
    )
  })}</>
))
const HourLines = React.memo(() => (
  <>{HOURS.map((h) => (<div key={h} data-grid="1" style={{ position: 'absolute', left: 0, right: 0, top: topPx(h * 60), borderTop: '1px solid var(--line)', pointerEvents: 'none' }} />))}</>
))

// The two midnights. Everything above the first line is yesterday, everything
// below the second is tomorrow, so the day you're on is never ambiguous.
const DayEdges = React.memo(() => (
  <>{[[0, 'Today'], [DAY_MIN, 'Tomorrow']].map(([min, label]) => (
    <div key={label} style={{ position: 'absolute', left: 0, right: 0, top: topPx(min), borderTop: '2px solid var(--teal)', opacity: 0.55, pointerEvents: 'none', zIndex: 4 }}>
      <span style={{ position: 'absolute', right: 8, top: 3, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--teal)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 6 }}>{label} 12 AM</span>
    </div>
  ))}</>
))

const Block = React.memo(function Block({ ev, sMin, eMin, isSel, isRen, renameText, onBlockDown, onResizeDown, onEdit, onRenameChange, onRenameCommit, onRenameCancel }) {
  const c = colorFor(ev)
  const top = topPx(sMin)
  const height = Math.max(26, (eMin - sMin) / 60 * HOUR_PX - 2)
  // Share the width with anything it overlaps, so nothing is buried.
  const cols = Math.max(1, ev.cols || 1)
  const col = Math.min(ev.col || 0, cols - 1)
  const leftCss = `calc(${(col / cols) * 100}% + 8px)`
  const widthCss = `calc(${(1 / cols) * 100}% - ${cols > 1 ? 12 : 20}px)`
  return (
    <div onMouseDown={(evt) => onBlockDown(evt, ev)} onContextMenu={(evt) => { evt.preventDefault(); evt.stopPropagation(); onEdit && onEdit(ev) }} title="Right-click to edit title & repeat" style={{ position: 'absolute', left: leftCss, width: widthCss, top, height, background: c.bg, borderLeft: `4px solid ${c.bd}`, borderRadius: '0 8px 8px 0', padding: '6px 13px', cursor: 'grab', overflow: 'hidden', boxShadow: isSel ? '0 0 0 2px var(--gold), 0 8px 24px rgba(0,0,0,0.4)' : 'none', zIndex: isSel ? 3 : 1 }}>
      {isRen
        ? <input autoFocus value={renameText} onMouseDown={(evt) => evt.stopPropagation()} onChange={(evt) => onRenameChange(evt.target.value)} onKeyDown={(evt) => { if (evt.key === 'Enter') { evt.preventDefault(); onRenameCommit() } else if (evt.key === 'Escape') { evt.preventDefault(); onRenameCancel() } }} onBlur={onRenameCommit} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--gold)', borderRadius: 5, color: 'var(--text)', fontSize: 15, fontWeight: 700, padding: '2px 5px', outline: 'none' }} />
        : <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.summary}</div>}
      {!isRen && (eMin - sMin) >= 34 && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{fmtMin(sMin)} - {fmtMin(eMin)}</div>}
      {isSel && <div onMouseDown={(evt) => onResizeDown(evt, ev, 'resize-top')} style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 12, cursor: 'ns-resize', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}><div style={{ width: 34, height: 5, borderRadius: 3, background: 'var(--gold)', marginTop: 2 }} /></div>}
      {isSel && <div onMouseDown={(evt) => onResizeDown(evt, ev, 'resize-bottom')} style={{ position: 'absolute', bottom: -3, left: 0, right: 0, height: 12, cursor: 'ns-resize', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><div style={{ width: 34, height: 5, borderRadius: 3, background: 'var(--gold)', marginBottom: 2 }} /></div>}
    </div>
  )
})

function DayGrid({ gridRef, dayEvents, allDay = [], viewDate, now, drag, onGridDown, onBlockDown, onResizeDown, onEdit, draft, selected, renaming, onRenameChange, onRenameCommit, onRenameCancel }) {
  // "Now" is measured from THIS day's midnight, so it still shows while you are
  // looking at tomorrow's early hours or yesterday's late ones.
  const nowD = now || new Date()
  const rawNowMin = (nowD.getTime() - midnight(viewDate).getTime()) / 60000
  const nowMin = rawNowMin >= MIN_LO && rawNowMin <= MIN_HI ? rawNowMin : null
  return (
   <>
    {allDay.length > 0 && (
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <div style={{ width: 68, flexShrink: 0, fontSize: 11, color: 'var(--muted)', padding: '10px 10px', textAlign: 'right' }}>all-day</div>
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 8px' }}>
          {allDay.map((ev) => { const c = colorFor(ev); return <div key={ev.id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', background: c.bg, borderLeft: `3px solid ${c.bd}`, borderRadius: '0 6px 6px 0', padding: '5px 12px' }}>{ev.summary}</div> })}
        </div>
      </div>
    )}
    <div style={{ display: 'flex' }}>
      <div style={{ width: 68, flexShrink: 0, position: 'relative', height: GRID_PX }}>
        <HourLabels />
      </div>
      <div ref={gridRef} data-grid="1" data-drop="day" onMouseDown={onGridDown} style={{ position: 'relative', flex: 1, height: GRID_PX, cursor: 'crosshair' }}>
        {/* Yesterday and tomorrow are dimmed so the day you're on still reads as the day you're on. */}
        <div data-grid="1" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: topPx(0), background: 'rgba(0,0,0,0.16)', pointerEvents: 'none' }} />
        <div data-grid="1" style={{ position: 'absolute', left: 0, right: 0, top: topPx(DAY_MIN), bottom: 0, background: 'rgba(0,0,0,0.16)', pointerEvents: 'none' }} />
        <HourLines />
        <DayEdges />

        {dayEvents.map((ev) => {
          const active = drag && drag.id === ev.id
          const isRen = !!(renaming && renaming.id === ev.id)
          return (
            <Block key={ev.id} ev={ev}
              sMin={active ? drag.curS : ev.sMin}
              eMin={active ? drag.curE : ev.eMin}
              isSel={selected === ev.id}
              isRen={isRen}
              renameText={isRen ? renaming.text : ''}
              onBlockDown={onBlockDown} onResizeDown={onResizeDown} onEdit={onEdit}
              onRenameChange={onRenameChange} onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel} />
          )
        })}

        {drag && drag.kind === 'create' && drag.moved && (
          <div style={{ position: 'absolute', left: 6, right: 8, top: topPx(drag.sMin), height: (drag.curE - drag.sMin) / 60 * HOUR_PX, background: 'rgba(74,222,128,0.12)', border: '1px dashed var(--done)', borderRadius: 8, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, color: 'var(--done)', padding: '3px 8px' }}>{fmtMin(drag.sMin)} - {fmtMin(drag.curE)}</div>
          </div>
        )}
        {draft && (
          <div style={{ position: 'absolute', left: 6, right: 8, top: topPx(draft.sMin), height: (draft.eMin - draft.sMin) / 60 * HOUR_PX, background: 'rgba(74,222,128,0.12)', border: '1px dashed var(--done)', borderRadius: 8, pointerEvents: 'none' }} />
        )}

        {nowMin != null && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: topPx(nowMin), borderTop: '2px solid var(--red)', pointerEvents: 'none', zIndex: 5 }}>
            <span style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
          </div>
        )}
      </div>
    </div>
   </>
  )
}

function MonthGrid({ events, viewDate, now, onOpenDay, setDraft, onEdit }) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const gridStart = new Date(first); gridStart.setDate(1 - first.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d })
  const month = viewDate.getMonth()

  // Drag across day cells to span multiple days in one block (e.g. a trip or a
  // multi-day project). A drag that never leaves its start cell still opens
  // the day, same as a plain click always did.
  const [drag, setDrag] = useState(null)   // {startIdx, curIdx, moved}
  const dragging = drag != null
  useEffect(() => {
    if (!dragging) return
    let ended = false
    const move = (e) => {
      if (e.buttons === 0) { end(); return }
      let el = document.elementFromPoint(e.clientX, e.clientY)
      while (el && el.dataset && el.dataset.idx == null) el = el.parentElement
      if (!el || !el.dataset) return
      const idx = parseInt(el.dataset.idx, 10)
      if (Number.isNaN(idx)) return
      setDrag((d) => d ? { ...d, curIdx: idx, moved: idx !== d.startIdx } : d)
    }
    const end = () => {
      if (ended) return
      ended = true
      setDrag((d) => {
        if (d) {
          const lo = Math.min(d.startIdx, d.curIdx), hi = Math.max(d.startIdx, d.curIdx)
          if (d.moved) setDraft({ date: cells[lo], endDate: cells[hi], sMin: 9 * 60, eMin: 10 * 60 })
          else onOpenDay(cells[d.startIdx])
        }
        return null
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('blur', end)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); window.removeEventListener('blur', end) }
  }, [dragging]) // eslint-disable-line

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginBottom: 8 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: 1 }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'minmax(128px,1fr)', gap: 8 }}>
        {cells.map((d, i) => {
          const evs = [...allDayForDay(events, d), ...eventsForDay(events, d)]
          const inMonth = d.getMonth() === month
          const today = sameDay(d, now || new Date())
          const inDragRange = drag && drag.moved && i >= Math.min(drag.startIdx, drag.curIdx) && i <= Math.max(drag.startIdx, drag.curIdx)
          return (
            <div key={i} data-idx={i} data-drop="month" data-date={d.toISOString()} onMouseDown={() => setDrag({ startIdx: i, curIdx: i, moved: false })} style={{ border: inDragRange ? '1px solid var(--done)' : '1px solid var(--line)', borderRadius: 10, padding: 9, cursor: 'pointer', opacity: inMonth ? 1 : 0.38, background: inDragRange ? 'rgba(74,222,128,0.10)' : today ? 'rgba(245,208,96,0.08)' : 'transparent', minHeight: 128, overflow: 'hidden' }}>
              <div style={{ fontSize: 16, fontWeight: today ? 800 : 600, color: today ? 'var(--gold)' : 'var(--text)', marginBottom: 6 }}>{d.getDate()}</div>
              {evs.slice(0, 4).map((ev) => {
                const c = colorFor(ev)
                return <div key={ev.id} title={ev.summary} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit && onEdit(ev) }} style={{ fontSize: 12.5, color: 'var(--text)', background: c.bg, borderLeft: `3px solid ${c.bd}`, borderRadius: '0 4px 4px 0', padding: '3px 7px', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{ev.summary}</div>
              })}
              {evs.length > 4 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>+{evs.length - 4} more</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ events, viewDate, now, onOpenDay, setDraft, onEdit }) {
  // WK_PX is module-level
  const s = startOfWeek(viewDate)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d })
  // Drag-to-create, same idea as the day view: mousedown starts it, mousemove
  // grows it, mouseup opens the same create modal. A plain click (no drag)
  // still opens the day, same as before.
  const [drag, setDrag] = useState(null)   // {dayIdx, sMin, curE, moved}
  const rectRef = useRef(null)

  const dragging = drag != null
  useEffect(() => {
    if (!dragging) return
    let ended = false
    const move = (e) => {
      if (e.buttons === 0) { end(); return }
      const rect = rectRef.current
      if (!rect) return
      const m = clamp(snap(((e.clientY - rect.top) / WK_PX) * 60), 0, DAY_MIN)
      setDrag((d) => d ? { ...d, curE: Math.max(d.sMin + SNAP, m), moved: true } : d)
    }
    const end = () => {
      if (ended) return
      ended = true
      setDrag((d) => {
        if (d && d.moved && (d.curE - d.sMin) >= SNAP) {
          setDraft({ date: days[d.dayIdx], sMin: d.sMin, eMin: d.curE })
        } else if (d) {
          onOpenDay(days[d.dayIdx])
        }
        return null
      })
      rectRef.current = null
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('blur', end)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); window.removeEventListener('blur', end) }
  }, [dragging]) // eslint-disable-line

  function onColDown(e, dayIdx) {
    const rect = e.currentTarget.getBoundingClientRect()
    rectRef.current = rect
    const m = clamp(snap(((e.clientY - rect.top) / WK_PX) * 60), 0, DAY_MIN)
    setDrag({ dayIdx, sMin: m, curE: m + SNAP, moved: false })
  }

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: 62, flexShrink: 0, position: 'relative', height: DAY_MIN / 60 * WK_PX, marginTop: 44 }}>
        {Array.from({ length: 25 }, (_, h) => (h % 2 === 0 ? <div key={h} style={{ position: 'absolute', top: h * WK_PX - 7, right: 10, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h === 0 || h === 24 ? '' : fmtHourLabel(h)}</div> : null))}
      </div>
      {days.map((d, i) => {
        const evs = eventsForDay(events, d)
        const today = sameDay(d, now || new Date())
        const active = drag && drag.dayIdx === i && drag.moved
        return (
          <div key={i} style={{ flex: 1, borderLeft: '1px solid var(--line)' }}>
            <div onClick={() => onOpenDay(d)} style={{ height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', color: today ? 'var(--on-gold)' : 'var(--muted)', background: today ? 'var(--gold)' : 'transparent', fontSize: 13 }}>
              <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{d.getDate()}</span>
            </div>
            <div onMouseDown={(e) => onColDown(e, i)} data-drop="week" data-date={d.toISOString()} style={{ position: 'relative', height: DAY_MIN / 60 * WK_PX, cursor: 'crosshair' }}>
              {Array.from({ length: 25 }, (_, h) => (h % 2 === 0 ? <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * WK_PX, borderTop: '1px solid var(--line)', pointerEvents: 'none' }} /> : null))}
              {evs.map((ev) => {
                const c = colorFor(ev)
                return (
                  <div key={ev.id} title={ev.summary} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit && onEdit(ev) }} style={{ position: 'absolute', left: 3, right: 3, top: ev.sMin / 60 * WK_PX, height: Math.max(18, (ev.eMin - ev.sMin) / 60 * WK_PX - 1), background: c.bg, borderLeft: `3px solid ${c.bd}`, borderRadius: '0 4px 4px 0', padding: '2px 6px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.summary}</div>
                  </div>
                )
              })}
              {active && (
                <div style={{ position: 'absolute', left: 2, right: 2, top: drag.sMin / 60 * WK_PX, height: (drag.curE - drag.sMin) / 60 * WK_PX, background: 'rgba(74,222,128,0.12)', border: '1px dashed var(--done)', borderRadius: 6, pointerEvents: 'none' }} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Overlay({ children, width }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div style={{ width: width || 'min(420px,92vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)' }}>{children}</div>
    </div>
  )
}

function toDateInput(d) { const x = new Date(d); const m = String(x.getMonth() + 1).padStart(2, '0'); const day = String(x.getDate()).padStart(2, '0'); return `${x.getFullYear()}-${m}-${day}` }
// Wraps like fmtMin does, so a slot dragged into yesterday evening (-60) fills
// the time field as 23:00 instead of a nonsense negative hour.
function minToTime(m) { const t = ((Math.round(m) % DAY_MIN) + DAY_MIN) % DAY_MIN; const h = Math.floor(t / 60), mm = t % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const TYPES = [
  { id: 'work', label: 'Work', desc: 'An on-time task' },
  { id: 'habit', label: 'Habit', desc: 'Every single day' },
  { id: 'custom', label: 'Custom', desc: 'Pick dates / repeat' }
]

// The block creator. Pick a type: Work (one-time task), Habit (repeats daily),
// or Custom (choose the date, one-time or repeating on the days you pick).
function timeToMinLocal(t){const [h,m]=String(t||'0:0').split(':').map(Number);return (h||0)*60+(m||0)}
function CreateModal({ draft, onSave, onCancel }) {
  const d0 = draft.date || new Date()
  const startAt = new Date(midnight(d0).getTime() + draft.sMin * 60000)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('work')
  const [color, setColor] = useState('10')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [dateStr, setDateStr] = useState(toDateInput(startAt))
  const [startT, setStartT] = useState(minToTime(draft.sMin))
  const [endT, setEndT] = useState(minToTime(draft.eMin))
  const [repeat, setRepeat] = useState('once')
  const [freq, setFreq] = useState('weekly')
  const [days, setDays] = useState(() => new Set([new Date(d0).getDay()]))
  const [untilStr, setUntilStr] = useState('')

  function save() {
    let start, end, recurrence
    if (type === 'custom') {
      start = new Date(`${dateStr}T${startT}:00`)
      end = new Date(`${dateStr}T${endT}:00`)
      if (isNaN(start)) return
      if (isNaN(end)) end = new Date(start.getTime() + 30 * 60000)
      else if (end < start) end = new Date(end.getTime() + DAY_MIN * 60000)
      else if (end.getTime() === start.getTime()) end = new Date(start.getTime() + 30 * 60000)
      if (repeat === 'repeat') {
        const until = untilStr ? `;UNTIL=${untilStr.replace(/-/g, '')}T235959Z` : ''
        if (freq === 'daily') recurrence = [`RRULE:FREQ=DAILY${until}`]
        else {
          const by = [...days].sort((a, b) => a - b).map((i) => WEEKDAY_CODES[i]).join(',') || WEEKDAY_CODES[new Date(dateStr).getDay()]
          recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${by}${until}`]
        }
      }
    } else {
      start = new Date(midnight(d0).getTime() + draft.sMin * 60000)
      end = new Date(midnight(draft.endDate || d0).getTime() + draft.eMin * 60000)
      if (end <= start) end = new Date(start.getTime() + 30 * 60000)
      if (type === 'habit') recurrence = ['RRULE:FREQ=DAILY']
    }
    onSave({ summary: title || (type === 'habit' ? 'Habit' : 'New block'), start: start.toISOString(), end: end.toISOString(), recurrence, colorId: color, description, location })
  }

  const toggleDay = (i) => setDays((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const showRepeatOpts = type === 'custom' && repeat === 'repeat'
  const durMin = type === 'custom'
    ? Math.max(0, (timeToMinLocal(endT) - timeToMinLocal(startT) + DAY_MIN) % DAY_MIN || DAY_MIN)
    : Math.max(0, draft.eMin - draft.sMin)
  const durTxt = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h ? h + 'h' : '') + (mm ? ' ' + mm + 'min' : (h ? '' : '0min'))).trim() }
  const placedDate = draft.endDate
    ? `${new Date(d0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(draft.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : startAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="ev-scrim" onMouseDown={onCancel}>
      <aside className="ev-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ev-bar">
          <span className="ev-kind">New block</span>
          <span className="ev-bar-actions">
            <button className="ev-x" onClick={onCancel} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </span>
        </div>

        <input className="ev-title" autoFocus value={title} placeholder="What is it?" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />

        <div className="ev-types">
          {TYPES.map((t) => (
            <button key={t.id} className={'ev-type' + (type === t.id ? ' on' : '')} onClick={() => setType(t.id)}>
              <span className="ev-type-l">{t.label}</span>
              <span className="ev-type-d">{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="ev-rows">
          {type !== 'custom' ? (
            <>
              <div className="ev-row">
                <EvIcon name="clock" />
                <span className="ev-time">{type === 'habit' ? fmtMin(draft.sMin) : fmtMin(draft.sMin)}</span>
                <span className="ev-arrow">→</span>
                <span className="ev-time">{fmtMin(draft.eMin)}</span>
                <span className="ev-dur">{durTxt(durMin)}</span>
              </div>
              <div className="ev-row"><span className="ev-ic-sp" /><span className="ev-date">{type === 'habit' ? 'Every day' : placedDate}</span></div>
            </>
          ) : (
            <>
              <label className="ev-row"><EvIcon name="clock" /><input className="ev-inline ev-timein" type="time" value={startT} onChange={(e) => setStartT(e.target.value)} /><span className="ev-arrow">→</span><input className="ev-inline ev-timein" type="time" value={endT} onChange={(e) => setEndT(e.target.value)} /><span className="ev-dur">{durTxt(durMin)}</span></label>
              <label className="ev-row"><span className="ev-ic-sp" /><input className="ev-inline" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} /></label>
              <div className="ev-row">
                <EvIcon name="repeat" />
                <div className="ev-seg">
                  {[['once', 'Does not repeat'], ['repeat', 'Repeats']].map(([v, l]) => (
                    <button key={v} className={repeat === v ? 'on' : ''} onClick={() => setRepeat(v)}>{l}</button>
                  ))}
                </div>
              </div>
              {showRepeatOpts && (
                <div className="ev-repeat">
                  <div className="ev-seg">
                    {[['daily', 'Daily'], ['weekly', 'Weekly']].map(([v, l]) => (
                      <button key={v} className={freq === v ? 'on' : ''} onClick={() => setFreq(v)}>{l}</button>
                    ))}
                  </div>
                  {freq === 'weekly' && (
                    <div className="ev-days">
                      {WEEKDAY_LABELS.map((l, i) => (
                        <button key={i} className={days.has(i) ? 'on' : ''} onClick={() => toggleDay(i)}>{l}</button>
                      ))}
                    </div>
                  )}
                  <label className="ev-until">Ends<input type="date" value={untilStr} onChange={(e) => setUntilStr(e.target.value)} /></label>
                </div>
              )}
            </>
          )}
        </div>

        <div className="ev-div" />

        <div className="ev-rows">
          <label className="ev-row soft"><EvIcon name="pin" /><input className="ev-inline" value={location} placeholder="Location" onChange={(e) => setLocation(e.target.value)} /></label>
          <label className="ev-row soft top"><EvIcon name="doc" /><textarea className="ev-inline ev-area" value={description} placeholder="Description" rows={2} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="ev-row"><span className="ev-swatch" style={{ background: COLOR_MAP[color].bd }} /><div className="ev-colors">
            {COLORS.map((c) => (
              <button key={c.id} title={c.name} className={'ev-color' + (color === c.id ? ' on' : '')} onClick={() => setColor(c.id)} style={{ background: COLOR_MAP[c.id].bd }} />
            ))}
          </div></div>
        </div>

        <div className="ev-foot">
          <button className="ev-save" onClick={save}>Add to calendar</button>
        </div>
      </aside>
    </div>
  )
}


function EvIcon({ name }) {
  const c = { fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' }
  const p = {
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    repeat:<><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
    pin:<><path d="M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></>,
    doc:<><path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M9 13h6M9 17h4"/></>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></>
  }
  return <svg className="ev-ic" width="17" height="17" viewBox="0 0 24 24" {...c}>{p[name]}</svg>
}

function EditModal({ ev, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(ev.summary || '')
  const [description, setDescription] = useState(ev.description || '')
  const [location, setLocation] = useState(ev.location || '')
  const [repeat, setRepeat] = useState('keep')
  const isRecurring = !!ev.recurringEventId
  const dur = Math.max(0, (ev.eMin || 0) - (ev.sMin || 0))
  const durTxt = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h ? h + 'h' : '') + (mm ? ' ' + mm + 'min' : (h ? '' : '0min'))).trim() }
  const dateTxt = ev.start ? new Date(ev.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  const save = () => onSave(title, repeat === 'keep' ? undefined : REPEAT_RULES[repeat], description, location)
  return (
    <div className="ev-scrim" onMouseDown={onCancel}>
      <aside className="ev-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ev-bar">
          <span className="ev-kind">Event</span>
          <span className="ev-bar-actions">
            <button className="ev-x" onClick={onDelete} title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </button>
            <button className="ev-x" onClick={onCancel} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </span>
        </div>

        <input className="ev-title" autoFocus value={title} placeholder="Title" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />

        <div className="ev-rows">
          <div className="ev-row">
            <EvIcon name="clock" />
            <span className="ev-time">{fmtMin(ev.sMin)}</span>
            <span className="ev-arrow">→</span>
            <span className="ev-time">{fmtMin(ev.eMin)}</span>
            <span className="ev-dur">{durTxt(dur)}</span>
          </div>
          {dateTxt && <div className="ev-row"><span className="ev-ic-sp" /><span className="ev-date">{dateTxt}</span></div>}
          <div className="ev-row">
            <EvIcon name="repeat" />
            <select className="ev-select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="keep">{isRecurring ? 'Every week' : 'Does not repeat'}</option>
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Every weekday</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </div>
        </div>

        <div className="ev-div" />

        <div className="ev-rows">
          <label className="ev-row soft">
            <EvIcon name="pin" />
            <input className="ev-inline" value={location} placeholder="Location" onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="ev-row soft top">
            <EvIcon name="doc" />
            <textarea className="ev-inline ev-area" value={description} placeholder="Description" rows={2} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div className="ev-foot">
          {repeat !== 'keep' && repeat !== 'none' && <span className="ev-note">Changing the repeat updates the whole series.</span>}
          <button className="ev-save" onClick={save}>Save</button>
        </div>
      </aside>
    </div>
  )
}

const navBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' }
const fieldLabel = { display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: 'var(--muted)', flex: 1, minWidth: 120 }
const ghostBtn = { background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }
const goldBtn = { background: 'var(--gold)', border: 'none', color: 'var(--on-gold)', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: 13 }
