import React, { useMemo, useState } from 'react'
import PanChart, { chartBtn } from './PanChart.jsx'
import { HISTORY_START, inHistory } from '../lib/history.js'

// The Home page: one screen that answers "where am I, across everything".
// The chart at the top is the LIFETIME one — it does not reset when a mission
// ends. Every day you have ever tracked is on it, with a marker where each
// mission started, so a new mission continues the same line instead of
// starting a fresh one from zero.

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch { return d } }
const dk = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const startOfWeekMon = (d) => { const x = midnight(d); const wd = (x.getDay() + 6) % 7; return new Date(x.getTime() - wd * 864e5) }
const finishMin = (t) => { if (t.time == null) return null; return (t.end != null && t.end > t.time) ? t.end : t.time + (t.dur || 60) }
const minToHHMM = (m) => { if (m == null) return ''; const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0') }
const fmtDur = (m) => { if (m == null) return '0m'; if (m < 60) return Math.round(m) + 'm'; const h = Math.floor(m / 60), mm = Math.round(m % 60); return h + 'h' + (mm ? ' ' + mm + 'm' : '') }

export default function HomeView({ now, day, yesterday, week, month, onGoTab }) {
  const [range, setRange] = useState('daily')
  const nowD = now || new Date()
  const today = midnight(nowD)
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes()
  const todayK = dk(today)

  // Read fresh on every mount. Home is unmounted when you leave the tab, so
  // this is always current with whatever the mission page just saved.
  const tasks = useMemo(() => load('grow_tasks', {}), [])
  const north = useMemo(() => load('grow_north_star', ''), [])
  const mission = useMemo(() => load('grow_mission', null), [])
  const missionLog = useMemo(() => load('grow_mission_log', []), [])

  // Every mission ever, oldest first, with the current one on the end.
  const missions = useMemo(() => {
    const list = missionLog.filter((m) => m && m.title).map((m) => ({ ...m, current: false }))
    if (mission && mission.title) {
      const already = list.some((m) => m.title === mission.title && m.startISO === mission.startISO)
      if (!already) list.push({ title: mission.title, startISO: mission.startISO || null, endISO: null, horizonWeeks: mission.horizonWeeks || (mission.months ? mission.months * 4 : 16), current: true })
    }
    return list.sort((a, b) => new Date(a.startISO || 0) - new Date(b.startISO || 0))
  }, [missionLog, mission])

  // Same scoring rule the mission Stats chart uses: done is +1, missed is -1.
  const tally = (list, dayDate) => {
    // A day before your record starts scores nothing, even when it falls inside
    // a week or month bucket that is otherwise counted.
    if (!inHistory(dk(dayDate))) return { done: 0, missed: 0, planned: 0 }
    const dayPast = midnight(dayDate).getTime() < today.getTime()
    const isTod = dk(dayDate) === todayK
    let done = 0, missed = 0
    for (const t of list) { if (t.done) done++; else if (t.missed || dayPast || (isTod && t.end != null && t.end < nowMin)) missed++ }
    return { done, missed, planned: list.length }
  }
  const rng = (t) => (t.time != null ? minToHHMM(t.time) + ' → ' + minToHHMM(finishMin(t)) : 'no time set')
  const itemsFrom = (list, prefix) => list.map((t) => ({ text: t.text || '(untitled)', when: (prefix ? prefix + ' ' : '') + rng(t), done: t.done }))

  // The span the lifetime chart covers: your very first tracked day through
  // today (or the end of the current mission, whichever is later).
  const bounds = useMemo(() => {
    // The line always opens on the day your record starts, even if the first
    // day with tasks on it came later. Sliding the start forward to the first
    // busy day would quietly move the axis around as the data changes.
    const first = midnight(new Date(HISTORY_START + 'T00:00:00'))
    let last = today
    if (mission && mission.startISO) {
      const wk = mission.horizonWeeks || (mission.months ? mission.months * 4 : 16)
      const end = new Date(startOfWeekMon(new Date(mission.startISO)).getTime() + wk * 7 * 864e5)
      if (end > last) last = midnight(end)
    }
    return { first: midnight(first), last }
  }, [tasks, missions, mission, todayK])

  const series = useMemo(() => {
    const pts = []
    let nowIndex = 0
    let run = 0
    const marks = []
    const add = (o) => { run += o.delta; pts.push({ ...o, value: run }) }
    // A marker sits on the bucket a mission began in, so you can see exactly
    // where one chapter handed over to the next without breaking the line.
    const markMissions = (bucketStart, bucketEnd, index) => {
      missions.forEach((m) => {
        if (!m.startISO) return
        const s = midnight(new Date(m.startISO)).getTime()
        if (s >= bucketStart && s < bucketEnd) marks.push({ i: index, label: m.title })
      })
    }
    const totalDays = Math.max(1, Math.round((bounds.last - bounds.first) / 864e5) + 1)

    if (range === 'daily') {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(bounds.first.getTime() + i * 864e5)
        const list = tasks[dk(d)] || []
        const q = tally(list, d)
        if (dk(d) === todayK) nowIndex = pts.length
        markMissions(midnight(d).getTime(), midnight(d).getTime() + 864e5, pts.length)
        add({ label: d.toLocaleDateString(undefined, { day: 'numeric' }), header: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), delta: q.done - q.missed, done: q.done, missed: q.missed, goal: q.planned, items: itemsFrom(list) })
      }
      return { type: 'line', points: pts, nowIndex, view: Math.min(30, Math.max(10, totalDays)), marks }
    }
    if (range === 'weekly') {
      const w0 = startOfWeekMon(bounds.first)
      const weeks = Math.max(1, Math.ceil((bounds.last - w0) / (7 * 864e5)))
      for (let w = 0; w < weeks; w++) {
        const ws = new Date(w0.getTime() + w * 7 * 864e5)
        let done = 0, missed = 0, g = 0; const items = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(ws.getTime() + i * 864e5)
          const list = tasks[dk(d)] || []
          const q = tally(list, d); done += q.done; missed += q.missed; g += q.planned
          items.push(...itemsFrom(list, d.toLocaleDateString(undefined, { weekday: 'short' })))
        }
        if (today >= ws && today < new Date(ws.getTime() + 7 * 864e5)) nowIndex = pts.length
        markMissions(ws.getTime(), ws.getTime() + 7 * 864e5, pts.length)
        const we = new Date(ws.getTime() + 6 * 864e5)
        add({ label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), header: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' to ' + we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), delta: done - missed, done, missed, goal: g, items })
      }
      return { type: 'line', points: pts, nowIndex, view: Math.min(20, Math.max(8, weeks)), marks }
    }
    if (range === 'monthly') {
      const first = new Date(bounds.first.getFullYear(), bounds.first.getMonth(), 1)
      const months = (bounds.last.getFullYear() - first.getFullYear()) * 12 + (bounds.last.getMonth() - first.getMonth())
      for (let mo = 0; mo <= months; mo++) {
        const dt = new Date(first.getFullYear(), first.getMonth() + mo, 1)
        const next = new Date(first.getFullYear(), first.getMonth() + mo + 1, 1)
        let done = 0, missed = 0, g = 0; const items = []
        for (let d = new Date(dt); d < next; d = new Date(d.getTime() + 864e5)) {
          const list = tasks[dk(d)] || []
          const q = tally(list, d); done += q.done; missed += q.missed; g += q.planned
          items.push(...itemsFrom(list, d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })))
        }
        if (dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth()) nowIndex = pts.length
        markMissions(dt.getTime(), next.getTime(), pts.length)
        add({ label: dt.toLocaleDateString(undefined, { month: 'short' }), header: dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), delta: done - missed, done, missed, goal: g, items })
      }
      return { type: 'line', points: pts, nowIndex, view: Math.min(18, Math.max(6, months + 1)), marks }
    }
    // Yearly bars: each bar is that year's own score, not a running total.
    for (let yr = bounds.first.getFullYear(); yr <= bounds.last.getFullYear(); yr++) {
      let done = 0, missed = 0, g = 0
      Object.keys(tasks).forEach((k) => {
        if (!k.startsWith(yr + '-')) return
        const q = tally(tasks[k] || [], new Date(k + 'T00:00:00')); done += q.done; missed += q.missed; g += q.planned
      })
      if (yr === today.getFullYear()) nowIndex = pts.length
      markMissions(new Date(yr, 0, 1).getTime(), new Date(yr + 1, 0, 1).getTime(), pts.length)
      pts.push({ label: String(yr), header: String(yr), value: done - missed, delta: done - missed, done, missed, goal: g, items: [] })
    }
    return { type: 'bar', points: pts, nowIndex, view: 8, marks }
  }, [range, tasks, bounds, missions, todayK, nowMin])

  // Where the current mission stands.
  const cur = useMemo(() => {
    if (!mission || !mission.title) return null
    const weeks = mission.horizonWeeks || (mission.months ? mission.months * 4 : 16)
    const startMon = startOfWeekMon(mission.startISO ? new Date(mission.startISO) : today)
    const week = Math.min(weeks, Math.max(1, Math.round((startOfWeekMon(today) - startMon) / (7 * 864e5)) + 1))
    let planned = 0, done = 0
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(startMon.getTime() + i * 864e5)
      const list = tasks[dk(d)] || []
      planned += list.length
      done += list.filter((t) => t.done).length
    }
    const pct = planned ? Math.round((done / planned) * 100) : 0
    const elapsed = Math.min(100, Math.max(0, ((today - startMon) / (weeks * 7 * 864e5)) * 100))
    return { title: mission.title, weeks, week, planned, done, pct, elapsed, onPace: pct >= elapsed }
  }, [mission, tasks, todayK])

  const todayList = tasks[todayK] || []
  const todayDone = todayList.filter((t) => t.done).length

  const rangeSleep = (r) => (r && r.perDay ? r.perDay.reduce((a, d) => a + (d.sleepMinutes || 0), 0) : 0)
  const bars = [
    { key: 'today', label: 'Today', p: day ? day.productive : 0, w: day ? day.wasted : 0, s: day ? day.sleepMinutes : 0 },
    { key: 'yday', label: 'Yesterday', p: yesterday ? yesterday.productive : 0, w: yesterday ? yesterday.wasted : 0, s: yesterday ? yesterday.sleepMinutes : 0 },
    { key: 'week', label: 'This week', p: week ? week.totalProductive : 0, w: week ? week.totalWasted : 0, s: rangeSleep(week) },
    { key: 'month', label: 'This month', p: month ? month.totalProductive : 0, w: month ? month.totalWasted : 0, s: rangeSleep(month) }
  ]

  return (
    <div>
      <div className="home-head">
        <div className="home-hello">Where your time is going</div>
        {north ? <div className="home-north" title="Your north star">{north}</div> : null}
      </div>
      <div className="timebars">
        {bars.map((b) => <TimeBar key={b.key} {...b} fmt={fmtDur} />)}
      </div>

      {/* The lifetime chart. It is the memory of everything, not just this mission. */}
      <div className="panel" style={{ marginBottom: 10, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>Everything you have ever done</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {`One line from ${new Date(HISTORY_START + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} to today. It carries across missions, it never resets.`}
            </div>
          </div>
          <div>
            {['daily', 'weekly', 'monthly', 'yearly'].map((r) => (
              <button key={r} onClick={() => setRange(r)} style={{ background: range === r ? 'var(--gold)' : 'var(--bg)', color: range === r ? 'var(--on-gold)' : 'var(--muted)', border: '1px solid ' + (range === r ? 'var(--gold)' : 'var(--line)'), fontWeight: 700, fontSize: 13, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', marginLeft: 8, textTransform: 'capitalize' }}>{r}</button>
            ))}
          </div>
        </div>
        <PanChart type={series.type} points={series.points} nowIndex={series.nowIndex} defaultView={series.view} rangeKey={'life-' + range} marks={series.marks} height={430} />
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--done)', fontSize: 14 }}>●</span> hit the goal</span>
          <span><span style={{ color: 'var(--red)', fontSize: 14 }}>◌</span> came up short</span>
          <span><span style={{ color: 'var(--gold)', fontSize: 14 }}>◌</span> still going</span>
          <span><span style={{ color: 'var(--teal)' }}>┋</span> a mission started</span>
          <span>drag to pan · scroll to zoom on the cursor · drag either axis to scale it</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10, alignItems: 'stretch' }}>
        <div className="panel">
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>Current mission</div>
          {cur ? (
            <>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, marginTop: 8 }}>{cur.title}</div>
              <div style={{ display: 'flex', gap: 26, marginTop: 14, flexWrap: 'wrap' }}>
                <Stat big={`${cur.done} / ${cur.planned}`} small="Done, whole mission" />
                <Stat big={`${cur.pct}%`} small="Of the mission" color={cur.onPace ? 'var(--done)' : 'var(--red)'} />
                <Stat big={`${cur.week} / ${cur.weeks}`} small="Weeks in" />
              </div>
              <div style={{ height: 8, background: 'var(--bg)', borderRadius: 6, marginTop: 16, overflow: 'hidden' }}>
                <div style={{ width: cur.pct + '%', height: '100%', background: 'var(--gold)' }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{Math.round(cur.elapsed)}% of the time is gone. {cur.onPace ? 'You are ahead of pace.' : 'You are behind pace.'}</div>
              <button onClick={() => onGoTab && onGoTab('grow')} style={{ ...chartBtn, marginTop: 14, borderColor: 'var(--gold)', color: 'var(--gold)' }}>Open the mission</button>
            </>
          ) : <div className="muted" style={{ marginTop: 10 }}>No mission set yet.</div>}
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>Today</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 26px', marginTop: 16 }}>
            <Stat big={`${todayDone} / ${todayList.length}`} small="Kill list" size="lg" />
            <Stat big={fmtDur(day ? day.worked : 0)} small="Worked" color="var(--done)" size="lg" />
            <Stat big={fmtDur(day ? day.wasted : 0)} small="Wasted" color="var(--red)" size="lg" />
            <Stat big={fmtDur(day ? day.sleepMinutes : 0)} small="Slept" color="var(--muted-2)" size="lg" />
          </div>
          <button onClick={() => onGoTab && onGoTab('daily')} style={{ ...chartBtn, marginTop: 'auto', alignSelf: 'flex-start' }}>Open today</button>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>Missions you have run</div>
          {missions.length ? (
            <div style={{ marginTop: 14 }}>
              {[...missions].reverse().map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '13px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ color: m.current ? 'var(--gold)' : 'var(--muted)', fontSize: 15 }}>{m.current ? '◆' : '◇'}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 19 }}>{m.title}</span>
                    <span className="muted" style={{ fontSize: 13, display: 'block', marginTop: 3 }}>
                      {m.startISO ? new Date(m.startISO).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'no start date'}
                      {m.current ? ' · running now' : m.endISO ? ' to ' + new Date(m.endISO).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="muted" style={{ marginTop: 10 }}>No missions yet.</div>}
          {missionLog.length === 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 'auto', paddingTop: 14, lineHeight: 1.55 }}>
              Missions started before today were never saved anywhere, so only the one you are on is listed. From now on every mission you finish is kept here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimeBar({ label, p, w, s, fmt }) {
  const total = Math.max(1, p + w + s)
  const pw = (p / total) * 100, ww = (w / total) * 100, sw = (s / total) * 100
  const focus = p + w > 0 ? Math.round((p / (p + w)) * 100) : 0
  return (
    <div className="tb-card">
      <div className="tb-top">
        <span className="tb-label">{label}</span>
        <span className="tb-focus" title="Share of your used-or-lost time that was productive">{focus}<i>%</i></span>
      </div>
      <div className="tb-track" role="img" aria-label={`${fmt(p)} productive, ${fmt(w)} wasted`}>
        {pw > 0 && <span className="tb-seg tb-p" style={{ width: pw + '%' }} />}
        {ww > 0 && <span className="tb-seg tb-w" style={{ width: ww + '%' }} />}
        {sw > 0 && <span className="tb-seg tb-s" style={{ width: sw + '%' }} />}
      </div>
      <div className="tb-legend">
        <span><i className="dot dot-p" />{fmt(p)} <em>productive</em></span>
        <span><i className="dot dot-w" />{fmt(w)} <em>wasted</em></span>
      </div>
    </div>
  )
}

function Stat({ big, small, color, size }) {
  const lg = size === 'lg'
  return (
    <div>
      <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: lg ? 'clamp(24px,2.1vw,36px)' : 'clamp(18px,1.5vw,26px)', color: color || 'var(--text)', lineHeight: 1.1 }}>{big}</div>
      <div style={{ color: 'var(--muted)', fontSize: lg ? 11.5 : 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: lg ? 5 : 3 }}>{small}</div>
    </div>
  )
}
