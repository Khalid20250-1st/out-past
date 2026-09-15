import React, { useMemo, useState } from 'react'

// The Planning page. Its own room: the three that must get done today, one
// button to lay the day out, and today's schedule as it stands. This is where
// the day is decided, before the Calendar shows it hour by hour.
//
// PROPOSAL, flagged for Kidus. If the Planning page should hold something else
// (the week ahead, the mission's weekly targets), say so and it changes.

const todayKey = () => new Date().toDateString()

function loadGoals() {
  try {
    const s = localStorage.getItem('grow_daily_goals')
    if (s) { const p = JSON.parse(s); if (p.date === todayKey()) return p.goals || ['', '', ''] }
  } catch (e) {}
  return ['', '', '']
}

const hhmm = (iso) => {
  const d = new Date(iso); let h = d.getHours(); const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return h + ':' + String(m).padStart(2, '0') + ' ' + ap
}
const isSleep = (s) => /sleep|nap|rest/i.test(s || '')

export default function PlanningView({ events = [], onPlanDay, planning, onGoTab }) {
  const [goals, setGoals] = useState(loadGoals)

  const save = (next) => {
    setGoals(next)
    try { localStorage.setItem('grow_daily_goals', JSON.stringify({ date: todayKey(), goals: next })) } catch (e) {}
  }
  const setAt = (i, v) => { const n = [...goals]; n[i] = v; save(n) }

  const schedule = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0)
    const t1 = new Date(t0.getTime() + 864e5)
    return (events || [])
      .filter((e) => { const s = new Date(e.start); return s >= t0 && s < t1 })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
  }, [events])

  const filled = goals.filter((g) => g && g.trim()).length

  return (
    <div className="plan">
      <header className="plan-head">
        <p className="eyebrow">Planning</p>
        <h1 className="plan-title">Decide the day.</h1>
        <p className="plan-sub">Three things that have to happen, then lay the rest out around them.</p>
      </header>

      <section className="plan-card">
        <div className="plan-card-top">
          <h2>Your three non-negotiables</h2>
          <span className="plan-count">{filled}/3</span>
        </div>
        <div className="plan-goals">
          {goals.map((g, i) => (
            <label key={i} className="plan-goal">
              <span className="plan-num">{i + 1}</span>
              <input
                value={g}
                onChange={(e) => setAt(i, e.target.value)}
                placeholder={['The one that matters most…', 'The second…', 'The third…'][i]}
                spellCheck={false}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="plan-card">
        <div className="plan-card-top">
          <h2>Lay out the day</h2>
        </div>
        <p className="plan-sub" style={{ margin: '0 0 16px' }}>
          KAI reads your three, skips anything already on the calendar, and books the rest into your open hours.
        </p>
        <button className="plan-go" disabled={planning} onClick={() => onPlanDay && onPlanDay()}>
          {planning ? 'Planning…' : 'Plan my day'}
        </button>
      </section>

      <section className="plan-card">
        <div className="plan-card-top">
          <h2>Today</h2>
          <button className="plan-link" onClick={() => onGoTab && onGoTab('calendar')}>Open calendar →</button>
        </div>
        {schedule.length ? (
          <ul className="plan-timeline">
            {schedule.map((e, i) => (
              <li key={e.id || i} className={isSleep(e.summary) ? 'sleep' : ''}>
                <span className="plan-time">{hhmm(e.start)}</span>
                <span className="plan-rail"><i /></span>
                <span className="plan-what">{e.summary || 'Busy'}</span>
                <span className="plan-end">{hhmm(e.end)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="plan-empty">Nothing on today yet. Fill your three above and plan the day.</p>
        )}
      </section>
    </div>
  )
}
