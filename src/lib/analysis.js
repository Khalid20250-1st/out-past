// Core time-accounting logic.
//
// The day is the full 24 hours, midnight to midnight. There is no protected
// window: the only time that is neither productive nor wasted is time you were
// asleep, and sleep has to be shown — a gray block you drew or Mac-detected
// sleep. Nothing else buys you an excuse.
//   - Time covered by a (timed) event = PRODUCTIVE.
//   - Every other elapsed minute you were not asleep = WASTED, 2am included.
//   - An event occurring on its scheduled date = DONE.
//   - An event whose recurring instance was moved to a later day = PUSHED;
//     its original slot is just an empty gap, i.e. wasted.

export function dayKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Under half an hour is not sleep. Lying down for twenty minutes did not rest
// you and it does not buy you a hole in the day: if a work block covers it the
// work simply runs straight through, and if nothing covers it those minutes are
// wasted like any other empty gap. Runs of sleep are merged BEFORE this test, so
// two twenty-minute blocks back to back are one forty-minute sleep and count.
const MIN_SLEEP = 30
function realSleep(merged) {
  return merged.filter(([s, e]) => e - s >= MIN_SLEEP)
}

// minutes elapsed from window start (clamped to [0, winMins])
function toOffset(time, winStart, winMins) {
  return Math.max(0, Math.min(winMins, (time - winStart) / 60000))
}

// merge overlapping [start,end] minute-intervals so overlapping events don't
// double-count toward productive time
function mergeIntervals(intervals) {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged = [sorted[0].slice()]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1])
    else merged.push(cur.slice())
  }
  return merged
}

function sumIntervals(intervals) {
  return intervals.reduce((acc, [s, e]) => acc + (e - s), 0)
}

// Keep only the first `maxTotal` minutes of sleep. Anything past your ideal is
// oversleep — it stops counting as rest and falls back into the awake day
// (where an empty stretch becomes WASTED).
function capIntervals(intervals, maxTotal) {
  if (maxTotal == null) return intervals
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const out = []
  let acc = 0
  for (const [s, e] of sorted) {
    if (acc >= maxTotal) break
    const dur = e - s
    if (acc + dur <= maxTotal) { out.push([s, e]); acc += dur }
    else { out.push([s, s + (maxTotal - acc)]); acc = maxTotal; break }
  }
  return out
}

// invert covered intervals within [0, limit] → the empty gaps
function gapsWithin(intervals, limit) {
  const gaps = []
  let cursor = 0
  for (const [s, e] of intervals) {
    if (s > cursor) gaps.push([cursor, Math.min(s, limit)])
    cursor = Math.max(cursor, e)
    if (cursor >= limit) break
  }
  if (cursor < limit) gaps.push([cursor, limit])
  return gaps.filter(([s, e]) => e - s >= 1)
}

function offsetToTime(winStart, offset) {
  return new Date(winStart.getTime() + offset * 60000)
}

function startOfDayMs(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }

// Analyze a single calendar day. The day is the full 24 hours, midnight to
// midnight (proper DATE, not just time). OFF time is carved out and is neither
// productive nor wasted, and OFF means sleep and only sleep: a gray block you
// drew, or Mac-detected sleep. Everywhere else a calendar event = productive and
// an empty gap = wasted, at 2am the same as at 2pm.
// completion is measured against your WHOLE awake day, so it never jumps to
// 100% just because you're mid-event early in the morning.
export function analyzeDay(events, date, now = new Date(), sleep = null) {
  const key = dayKey(date)
  const isToday = dayKey(now) === key
  const winStart = new Date(startOfDayMs(date))       // 12:00am
  const winStartMs = winStart.getTime()
  const DAY = 24 * 60
  const isFuture = winStartMs > now.getTime()

  const dayEndMs = winStartMs + DAY * 60000
  // A block that runs past midnight belongs to BOTH days, exactly like a night
  // of sleep does. Working 1pm to 1am is 11h of work on the first day and 1h on
  // the second, not 11h and then a hole. What decides is whether the block
  // OVERLAPS the day, not which day it happened to start on.
  const dayEvents = events.filter((ev) => {
    if (ev.allDay) return dayKey(ev.start) === key
    return new Date(ev.start).getTime() < dayEndMs && new Date(ev.end).getTime() > winStartMs
  })
  const timedAll = dayEvents.filter((ev) => !ev.allDay)
  // A "Sleep" (or nap) block on the calendar is REST, not work — never productive.
  // colorId '9' is the gray sleep color, so a block you just color gray counts
  // too, even if you never type the word "sleep" in the title.
  const isSleepEv = (ev) => ev.colorId === '9' || /\bsleep\b|\bnap\b|asleep/.test((ev.summary || '').toLowerCase())
  const timed = timedAll.filter((ev) => !isSleepEv(ev))
  // Sleep blocks are gathered from the WHOLE event list, not just the ones that
  // start today, because sleep crosses midnight. An 11pm→1am block belongs to
  // both days: 1h on the night you started, 1h on the morning you woke up. Each
  // day takes the slice that lands inside it.
  const sleepEvIntervals = mergeIntervals(
    timedAll.filter(isSleepEv)
      .map((ev) => [toOffset(new Date(ev.start), winStart, DAY), toOffset(new Date(ev.end), winStart, DAY)])
      .filter(([s, e]) => e > s)
  )

  // event (productive) intervals, in minutes from midnight
  const evIntervals = mergeIntervals(
    timed
      .map((ev) => [toOffset(new Date(ev.start), winStart, DAY), toOffset(new Date(ev.end), winStart, DAY)])
      .filter(([s, e]) => e > s)
  )

  // Mac-detected sleep is a guess: the lid being shut is not proof you slept.
  // So it stays capped at your ideal, and anything past that falls back into the
  // awake day as wasted.
  let detectedOff = (sleep && Array.isArray(sleep.intervals))
    ? sleep.intervals
        .map((iv) => [toOffset(new Date(iv.start), winStart, DAY), toOffset(new Date(iv.end), winStart, DAY)])
        .filter(([s, e]) => e > s)
    : []
  if (sleep && sleep.idealMin != null) detectedOff = capIntervals(mergeIntervals(detectedOff), sleep.idealMin)
  // A gray Sleep block you drew yourself is not a guess, it is you saying "this
  // is when I slept". It counts in full, exactly as drawn, so moving or resizing
  // it moves your sleep hours with it.
  //
  // OFF is sleep and only sleep. There used to be a free window here (12am to
  // 4am and 11pm to midnight were written off as rest no matter what), which
  // meant an all-nighter spent doing nothing cost you zero. It does not any
  // more: if there is no sign you slept, an empty 2am is wasted exactly like an
  // empty 2pm. Work through the night and the night still counts, both the
  // productive part and the empty part.
  const sleepOff = [...detectedOff, ...sleepEvIntervals]
  const off = realSleep(mergeIntervals(sleepOff))
  const awakeWindow = Math.max(0, DAY - sumIntervals(off))   // your real available time

  // how far into the day we've actually gone
  let elapsed = DAY
  if (isFuture) elapsed = 0
  else if (isToday) elapsed = Math.max(0, Math.min(DAY, (now.getTime() - winStartMs) / 60000))

  const clampEl = (arr) => arr.map(([s, e]) => [s, Math.min(e, elapsed)]).filter(([s, e]) => e > s)
  const plannedProductive = sumIntervals(evIntervals)   // full-day scheduled productive time, until 11:59pm

  // Merge events + sleep ONCE, and derive everything from it so nothing is
  // double-counted. This guarantees: productive + sleep + wasted = elapsed, and
  // the Wasted number is EXACTLY the sum of the empty gaps shown below.
  const covered = mergeIntervals([...clampEl(evIntervals), ...clampEl(off)])
  const busy = sumIntervals(covered)
  const offElapsed = sumIntervals(clampEl(off))
  // REAL sleep = what you actually slept, and nothing else. The implied off
  // above (the hours before your first event and after your last) is not sleep,
  // it just is not work, so it must never inflate this number. Only your gray
  // Sleep blocks and Mac-detected sleep count here, which is why moving or
  // resizing a block moves this number by exactly the same amount.
  //
  // A night also belongs to the morning you wake up on. An 11pm→1am block is 2h
  // of sleep for THIS day, not the 1h slice that happens to land after midnight,
  // so the number matches the block you actually drew. Blocks are attributed to
  // the day they END on, which is why one night is never counted on two days.
  const endsThisDay = (ev) => dayKey(new Date(new Date(ev.end).getTime() - 1)) === key
  const sleepNight = events
    .filter((ev) => !ev.allDay && isSleepEv(ev) && endsThisDay(ev))
    .map((ev) => [
      Math.max(-DAY, (new Date(ev.start).getTime() - winStartMs) / 60000),
      (new Date(ev.end).getTime() - winStartMs) / 60000
    ])
    .filter(([s, e]) => e > s)
  // The length test runs on the whole block, before it is cut down to how far
  // the day has gone. A 45m sleep you are 10m into is still sleep.
  const sleptElapsed = sumIntervals(
    realSleep(mergeIntervals([...detectedOff, ...sleepNight]))
      .map(([s, e]) => [s, Math.min(e, elapsed)])
      .filter(([s, e]) => e > s && e > 0)
  )
  const productiveElapsed = Math.max(0, busy - offElapsed)   // events, minus any that overlapped sleep
  // WORKED = the raw sum of your event durations so far (two 4h events = 8h).
  // Not reduced by sleep — this is literally "how much time your events cover".
  const workedElapsed = sumIntervals(clampEl(evIntervals))
  const awakeElapsed = Math.max(0, elapsed - offElapsed)
  const wasted = Math.max(0, elapsed - busy)                 // empty awake = exactly the gaps below

  const gaps = gapsWithin(covered, elapsed).map(([s, e]) => ({
    start: offsetToTime(winStart, s),
    end: offsetToTime(winStart, e),
    minutes: Math.round(e - s)
  }))

  const done = []
  const upcoming = []
  for (const ev of timed) {
    const endT = new Date(ev.end)
    if (!isToday) done.push(ev)
    else if (endT <= now) done.push(ev)
    else upcoming.push(ev)
  }

  const pushed = events.filter(
    (ev) => ev.pushed && ev.originalStart && dayKey(ev.originalStart) === key
  )

  const completion = awakeWindow > 0 ? (productiveElapsed / awakeWindow) * 100 : 0
  const wastedPct = awakeWindow > 0 ? (wasted / awakeWindow) * 100 : 0

  return {
    key,
    date: new Date(date),
    isToday,
    isFuture,
    productive: productiveElapsed,
    worked: workedElapsed,
    plannedProductive,
    wasted,
    sleepMinutes: sleptElapsed,
    offMinutes: offElapsed,
    awake: awakeElapsed,
    elapsed,
    completion,
    wastedPct,
    windowMinutes: awakeWindow,
    intervals: evIntervals,
    gaps,
    doneEvents: done,
    upcomingEvents: upcoming,
    pushedEvents: pushed,
    doneCount: done.length,
    allEvents: dayEvents
  }
}

// last N days ending today (oldest first)
export function lastNDays(n, now = new Date()) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(12, 0, 0, 0)
    days.push(d)
  }
  return days
}

export function analyzeRange(events, days, now = new Date(), sleep = null) {
  const perDay = days.map((d) => analyzeDay(events, d, now, sleep))
  const elapsedDays = perDay.filter((d) => d.elapsed > 0)
  const totalProductive = perDay.reduce((a, d) => a + d.productive, 0)
  const totalWasted = perDay.reduce((a, d) => a + d.wasted, 0)
  const totalDone = perDay.reduce((a, d) => a + d.doneCount, 0)
  const avgCompletion = elapsedDays.length
    ? elapsedDays.reduce((a, d) => a + d.completion, 0) / elapsedDays.length
    : 0
  const avgProductive = elapsedDays.length ? totalProductive / elapsedDays.length : 0
  return {
    perDay,
    totalProductive,
    totalWasted,
    totalDone,
    avgCompletion,
    avgProductive
  }
}

// Your CURRENT RUN: how long you have been awake since the last time you slept,
// and how much of that you actually worked. Midnight does not reset it, only
// sleep does. Work from 9pm Monday into 2am Tuesday and the run keeps counting
// straight through the date change, because nothing about you reset at 12am.
//
// The per-day numbers above are untouched. This sits next to them.
export function currentRun(events, now = new Date(), sleep = null) {
  const nowMs = now.getTime()
  const isSleepEv = (ev) => ev.colorId === '9' || /\bsleep\b|\bnap\b|asleep/.test((ev.summary || '').toLowerCase())

  // Every stretch of sleep we know about: gray blocks you drew, plus Mac-detected
  // sleep. Uncapped here on purpose — this is asking "when did you last wake up",
  // not "how much rest do you deserve credit for".
  const sleeps = []
  ;(events || []).forEach((ev) => {
    if (ev.allDay || !isSleepEv(ev)) return
    const s = new Date(ev.start).getTime(), e = new Date(ev.end).getTime()
    if (e > s) sleeps.push([s, e])
  })
  if (sleep && Array.isArray(sleep.intervals)) {
    sleep.intervals.forEach((iv) => {
      const s = new Date(iv.start).getTime(), e = new Date(iv.end).getTime()
      if (e > s) sleeps.push([s, e])
    })
  }
  // Same rule as the day: anything under half an hour never happened, so a
  // twenty-minute lie-down does not reset the run you are on.
  const merged = mergeIntervals(sleeps).filter(([s, e]) => e - s >= MIN_SLEEP * 60000)

  // Asleep right now: there is no run to report yet.
  if (merged.some(([s, e]) => s <= nowMs && e > nowMs)) return { asleep: true }

  // The run starts the moment you last woke up. With nothing on record there is
  // no honest answer, so say nothing rather than invent a start.
  let runStart = null
  merged.forEach(([, e]) => { if (e <= nowMs && (runStart == null || e > runStart)) runStart = e })
  if (runStart == null) return null

  const awake = (nowMs - runStart) / 60000
  const worked = sumIntervals(mergeIntervals(
    (events || [])
      .filter((ev) => !ev.allDay && !isSleepEv(ev))
      .map((ev) => [
        Math.max(runStart, new Date(ev.start).getTime()),
        Math.min(nowMs, new Date(ev.end).getTime())
      ])
      .filter(([s, e]) => e > s)
      .map(([s, e]) => [(s - runStart) / 60000, (e - runStart) / 60000])
  ))

  return {
    asleep: false,
    since: new Date(runStart),
    awake,
    worked,
    wasted: Math.max(0, awake - worked),
    // True once the run has crossed a midnight, which is the whole point of it.
    crossedMidnight: dayKey(new Date(runStart)) !== dayKey(now)
  }
}
