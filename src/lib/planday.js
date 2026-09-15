// "Plan my day" engine. You write your 3 non-negotiables; KAI decides how long
// each one needs, then drops them into today's open time around whatever is
// already on your calendar. If you already scheduled a task yourself, KAI leaves
// it alone. Pure + deterministic + $0 — no network, works offline.
import { classifyTask, futureGaps, pickSlot } from './kb.js'
import { GAI_WORKER_URL } from '../config.js'

const STOP = new Set(['the', 'a', 'an', 'and', 'to', 'for', 'of', 'my', 'do', 'get', 'with', 'on', 'in', 'at', 'this', 'that', 'today', 'work', 'finish', 'make', 'some'])

// How long a task type deserves. KAI's read on the work — deep creative work
// gets a real block, quick admin gets a short one, and so on.
const DURATION_RULES = [
  { min: 90, terms: ['build', 'write', 'writing', 'code', 'coding', 'develop', 'design', 'create', 'strategy', 'strategize', 'proposal', 'pitch', 'deck', 'content', 'film', 'record', 'edit video', 'draft', 'research', 'course', 'deep work', 'project', 'plan out', 'outline', 'study'] },
  { min: 45, terms: ['meeting', 'call', 'client', 'interview', 'demo', 'consult', 'standup', 'sync', 'zoom', 'presentation', 'negotiat', 'onboard'] },
  { min: 60, terms: ['gym', 'workout', 'work out', 'run', 'running', 'train', 'training', 'exercise', 'lift', 'yoga'] },
  { min: 30, terms: ['email', 'emails', 'inbox', 'reply', 'invoice', 'admin', 'organize', 'pay', 'bills', 'follow up', 'followup', 'review', 'check', 'call back', 'errand', 'shop', 'shopping', 'clean', 'laundry', 'grocery', 'chore', 'read', 'walk', 'meditat', 'journal'] }
]

// Explicit duration in the text wins ("prep 2h", "emails 20min").
function explicitMinutes(text) {
  const m = /(\d+(?:\.\d+)?)\s*(min|minute|minutes|hour|hours|hr|hrs|h)\b/.exec((text || '').toLowerCase())
  if (!m) return null
  const n = parseFloat(m[1])
  return /^h|hour|hr/.test(m[2]) ? Math.round(n * 60) : Math.round(n)
}

// Ask Haiku (via the KAI worker — key stays on Cloudflare) to estimate minutes
// for each task. Returns an array aligned to `tasks`, or null on any failure so
// the caller falls back to the instant on-device estimate. Costs ~a tenth of a
// cent per call.
export async function aiEstimateMinutes(tasks, context, email) {
  const list = (tasks || []).map((t) => (t || '').trim()).filter(Boolean)
  if (!list.length) return null
  // No cloud endpoint configured: fall back to the instant on-device estimate.
  if (!GAI_WORKER_URL) return null
  try {
    const res = await fetch(GAI_WORKER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'schedule', tasks: list, context: context || '', email: email || '' })
    })
    const data = await res.json()
    if (!data || !Array.isArray(data.estimates) || data.estimates.length !== list.length) return null
    const out = data.estimates.map((n) => Math.max(15, Math.min(240, Math.round(Number(n) || 0))))
    return out.some((n) => !n) ? null : out
  } catch (e) { return null }
}

// KAI's estimate of how much time a task needs, in minutes.
export function estimateTaskMinutes(text) {
  const explicit = explicitMinutes(text)
  if (explicit && explicit >= 5) return explicit
  const s = ' ' + (text || '').toLowerCase() + ' '
  for (const rule of DURATION_RULES) {
    if (rule.terms.some((t) => s.includes(t))) return rule.min
  }
  return 60
}

function keywords(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))
}

// Is this goal already on today's calendar (you scheduled it yourself)? Match if
// a timed block today shares a meaningful word with the goal.
export function matchExistingGoal(goal, events, now) {
  const kw = keywords(goal); if (!kw.length) return null
  const isToday = (d) => { const x = new Date(d), y = new Date(now); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate() }
  for (const e of (events || [])) {
    if (e.allDay || !isToday(e.start)) continue
    const sum = (e.summary || '').toLowerCase()
    if (kw.some((w) => sum.includes(w))) return e
  }
  return null
}

// Build the plan. Returns one entry per goal:
//   { title, booked, start, end, minutes, business }  — newly scheduled
//   { title, already:true }                           — you already scheduled it
//   { title, unplaced:true, minutes }                 — no open time left for it
// `aiMinutes` (optional) is an array of Haiku-estimated minutes aligned to the
// cleaned goal list. When present it overrides the on-device estimate per task.
export function buildDayPlan(goals, events, now = new Date(), aiMinutes = null) {
  const clean = (goals || []).map((g) => (g || '').trim()).filter(Boolean)
  const results = []
  const pending = []
  clean.forEach((goal, idx) => {
    if (matchExistingGoal(goal, events, now)) { results.push({ title: goal, already: true }); return }
    const ai = Array.isArray(aiMinutes) && aiMinutes.length === clean.length ? aiMinutes[idx] : null
    const minutes = (ai && ai >= 15) ? ai : estimateTaskMinutes(goal)
    pending.push({ goal, minutes, business: classifyTask(goal).business })
  })
  if (!pending.length) return results

  // Fit to the time you actually have left today. If the work wants more than
  // there is, KAI shrinks each block proportionally (never below 20 min) so the
  // whole list still fits.
  const work = (events || []).slice()
  const freeMin = futureGaps(work, now).reduce((a, g) => a + g.minutes, 0)
  const wanted = pending.reduce((a, p) => a + p.minutes, 0)
  if (freeMin > 0 && wanted > freeMin) {
    const scale = freeMin / wanted
    for (const p of pending) p.minutes = Math.max(20, Math.round((p.minutes * scale) / 5) * 5)
  }

  // Business first (prime hours), keeping your original order within that.
  const ordered = pending.map((p, i) => ({ ...p, i })).sort((a, b) => (b.business - a.business) || (a.i - b.i))
  for (const p of ordered) {
    const slot = pickSlot(work, now, p.minutes, p.business)
    if (!slot) { results.push({ title: p.goal, unplaced: true, minutes: p.minutes }); continue }
    const block = { id: 'plan_' + p.i, allDay: false, summary: p.goal, start: slot.start.toISOString(), end: slot.end.toISOString() }
    work.push(block)
    results.push({ title: p.goal, booked: true, start: block.start, end: block.end, minutes: p.minutes, business: p.business })
  }
  // Return in the user's original goal order for a clean summary.
  return clean.map((g) => results.find((r) => r.title === g)).filter(Boolean)
}
