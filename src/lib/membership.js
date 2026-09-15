// Talks to the KAI worker for membership status and Stripe checkout. The keys
// (Anthropic + Stripe) live on the worker, never here. Free features never need
// this; only the paid AI does.
import { GAI_WORKER_URL } from '../config.js'
const WORKER_URL = GAI_WORKER_URL

export async function checkMembership(email) {
  if (!email) return { member: false }
  if (!WORKER_URL) return { member: false }
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'status', email })
    })
    const data = await res.json()
    return { member: !!(data && data.member), plan: data && data.plan, until: data && data.until }
  } catch (e) { return { member: false } }
}

// Returns the Stripe checkout URL to open in the browser, or null on failure.
export async function startCheckout(email, plan) {
  if (!email) return null
  if (!WORKER_URL) return null
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'checkout', email, plan: plan === 'annual' ? 'annual' : 'monthly' })
    })
    const data = await res.json()
    return data && data.url ? data.url : null
  } catch (e) { return null }
}
