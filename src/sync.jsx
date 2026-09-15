import React, { useEffect, useRef, useState } from 'react'
import { SYNC_API } from './config.js'

// One Out Past account across Mac and phone. This talks to a sync backend and
// syncs the shared fields: north star, mission, and tasks. Self-contained so it
// never touches the rest of the app's state directly; it writes localStorage and
// reloads when the remote is newer, and polls to push local changes up.
// Cloud sync is OPTIONAL: with no SYNC_API configured (VITE_SYNC_API in .env),
// the whole engine stays silent and the app runs purely local.

const API = SYNC_API ? SYNC_API + '/account' : ''

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
const uid = () => 't_' + Math.random().toString(36).slice(2, 9)
const minToHHMM = (min) => (min == null ? '' : String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'))
const hhmmToMin = (s) => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m }

// ---- Live field-level sync clock ----
// Every shared field carries the time it was last edited on THIS machine. The
// server keeps the newest per field, so the Mac and the phone both read and
// write live and neither ever wipes the other. The Mac only accepts a remote
// field when the server's clock for it beats the Mac's own.
const SYNC_FIELDS = ['northStar', 'mission', 'tasks', 'events', 'photos', 'profileName', 'profilePhoto', 'nonNegotiables', 'sleep', 'targetHours']
const loadTs = () => load('grow_ts', {})
const saveTs = (t) => save('grow_ts', t)
// Bump the clock on every field whose value changed here since the last sync.
function stampChanges(blob) {
  const ts = loadTs(), snap = load('grow_ts_snap', {}), now = Date.now()
  let changed = false
  SYNC_FIELDS.forEach((k) => { const s = JSON.stringify(blob[k] === undefined ? null : blob[k]); if (snap[k] !== s) { ts[k] = now; snap[k] = s; changed = true } })
  saveTs(ts); save('grow_ts_snap', snap)
  return { ts, changed }
}
// Write back ONLY the fields the server has a newer clock for, and only the ones
// blobToMac actually knows how to restore. Events, photos and sleep stay out on
// purpose: the Mac owns those and they travel one way, Mac -> phone.
function macMergeIn(d) {
  if (!d || !d.data) return false
  const sts = d.ts || {}, ts = loadTs(), apply = {}
  let changed = false
  ;['northStar', 'mission', 'tasks', 'targetHours', 'profileName', 'profilePhoto', 'nonNegotiables'].forEach((k) => { const st = sts[k] || 0, lt = ts[k] || 0; if (st > lt && d.data[k] !== undefined) { apply[k] = d.data[k]; ts[k] = st; changed = true } })
  if (changed) {
    blobToMac(apply); saveTs(ts)
    const snap = load('grow_ts_snap', {}), b = macToBlob()
    SYNC_FIELDS.forEach((k) => { snap[k] = JSON.stringify(b[k] === undefined ? null : b[k]) })
    save('grow_ts_snap', snap)
  }
  return changed
}

// ---- Memory photos: shrink on the Mac, upload once, sync the notes ----
const MEDIA_UP = SYNC_API ? SYNC_API + '/media/upload' : ''
const keyFor = (p) => { let h = 0; const s = String(p); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'p' + h.toString(36) }
const uploaded = () => load('grow_uploaded_media', [])
const markUploaded = (k) => { const a = uploaded(); if (!a.includes(k)) { a.push(k); save('grow_uploaded_media', a) } }

// data URL -> smaller JPEG blob (max 1400px) so photos stay light
function shrink(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        const max = 1400
        let { width: w, height: h } = img
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        c.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    } catch (e) { resolve(null) }
  })
}

// Walk the Mac photo journal, upload any new image, and cache the metadata that
// travels in the blob. Folders are flattened, the phone has no folders.
async function refreshPhotos(token) {
  if (!token || !(window.kd && window.kd.memories)) return
  let list = []
  try { list = (await window.kd.memories.get()) || [] } catch (e) { return }
  const out = []
  for (const m of list) {
    if (!m || m.type === 'folder') continue
    const atts = Array.isArray(m.atts) ? m.atts : []
    const keys = []
    for (const a of atts) {
      const p = a && (a.display || a.path)
      if (!p || !a.isImage) continue
      const k = keyFor(p)
      if (!MEDIA_UP) continue
      if (!uploaded().includes(k)) {
        try {
          const dataUrl = await window.kd.media.readDataUrl(p)
          if (!dataUrl) continue
          const blob = await shrink(dataUrl)
          if (!blob) continue
          const r = await fetch(MEDIA_UP + '?token=' + encodeURIComponent(token) + '&key=' + encodeURIComponent(k), {
            method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob
          })
          const d = await r.json()
          if (d && d.ok) markUploaded(k); else continue
        } catch (e) { continue }
      }
      keys.push(k)
    }
    if (keys.length || (m.note && m.note.trim())) out.push({ id: m.id, at: m.at || 0, note: m.note || '', keys })
  }
  save('grow_photos', out)
}

// data URL -> smaller data URL (for the profile picture)
function shrinkToDataUrl(dataUrl, max) {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    } catch (e) { resolve(null) }
  })
}

// Pull the profile picture out of the Electron store, shrink it, and cache it
// so it can ride along in the blob.
async function refreshProfilePhoto() {
  try {
    if (!(window.kd && window.kd.profile)) return
    const full = await window.kd.profile.get()
    if (!full) return
    const small = await shrinkToDataUrl(full, 256)
    if (small) save('grow_pp_small', small)
  } catch (e) {}
}

// Pull the Mac's real sleep log (detected device sleep) so the phone can carve
// out the same rest and get the SAME wasted number the Mac shows.
async function refreshSleep() {
  try {
    if (!(window.kd && window.kd.sleep && window.kd.sleep.log)) return
    const s = await window.kd.sleep.log()
    const ideal = parseFloat(localStorage.getItem('grow_ideal_sleep'))
    save('grow_mac_sleep', { intervals: (s && s.intervals) || [], idealMin: isNaN(ideal) ? null : Math.round(ideal * 60) })
  } catch (e) {}
}

// Mac localStorage -> shared blob (phone-shaped)
function macToBlob() {
  const north = load('grow_north_star', '')
  const mission = load('grow_mission', null)
  const tasksObj = load('grow_tasks', {})
  const tasks = []
  Object.keys(tasksObj || {}).forEach((key) => {
    (tasksObj[key] || []).forEach((t) => {
      tasks.push({ id: t.id || uid(), title: t.text || '', date: key, time: minToHHMM(t.time), mins: t.dur || 60, done: !!t.done })
    })
  })
  // Calendar events, one way Mac -> phone (the Mac owns them via Google). Trim
  // to a window and the fields the phone needs, to keep the blob small.
  const now = Date.now(), lo = now - 31 * 864e5, hi = now + 31 * 864e5
  const events = (load('grow_cached_events', []) || [])
    .filter((e) => { const t = new Date(e.start).getTime(); return t >= lo && t <= hi })
    .map((e) => ({ id: e.id, summary: e.summary || '', start: e.start, end: e.end, allDay: !!e.allDay }))
  // Who you are: name, profile picture, and the 3 non negotiables.
  const coach = load('grow_coach_profile', null) || {}
  const dg = load('grow_daily_goals', null) || {}
  const nn = Array.isArray(dg.goals) ? dg.goals.filter(Boolean).slice(0, 3) : []
  return {
    v: 1,
    northStar: north || '',
    mission,
    tasks,
    events,
    photos: load('grow_photos', []),
    profileName: coach.name || '',
    profilePhoto: load('grow_pp_small', '') || '',
    nonNegotiables: nn,
    sleep: load('grow_mac_sleep', null),
    // Daily productive-hours target (drives the capacity on both devices).
    targetHours: (() => { const v = parseFloat(localStorage.getItem('grow_target_hours')); return isNaN(v) ? 19 : Math.max(1, Math.min(24, v)) })()
  }
}
// shared blob -> Mac localStorage
function blobToMac(b) {
  if (!b) return
  if (b.northStar) save('grow_north_star', b.northStar)
  if (b.mission) save('grow_mission', b.mission)
  if (b.targetHours != null && !isNaN(b.targetHours)) { try { localStorage.setItem('grow_target_hours', String(b.targetHours)) } catch (e) {} }
  if (Array.isArray(b.tasks)) {
    const obj = {}
    b.tasks.forEach((t) => {
      const key = t.date
      if (!key) return
      ;(obj[key] = obj[key] || []).push({ id: t.id || uid(), text: t.title || '', time: hhmmToMin(t.time), end: null, dur: t.mins || 60, done: !!t.done, tag: '' })
    })
    save('grow_tasks', obj)
  }
  // Who you are, coming back the other way. The Mac used to push these three and
  // never take them, so editing your name, your picture or your non negotiables
  // on the phone changed nothing here and the two devices drifted apart.
  if (b.profileName) {
    const coach = load('grow_coach_profile', null) || {}
    if (coach.name !== b.profileName) { coach.name = b.profileName; save('grow_coach_profile', coach) }
  }
  if (b.profilePhoto) save('grow_pp_small', b.profilePhoto)
  if (Array.isArray(b.nonNegotiables)) {
    const dg = load('grow_daily_goals', null) || {}
    dg.goals = b.nonNegotiables.filter(Boolean).slice(0, 3)
    save('grow_daily_goals', dg)
  }
}
// stable signature so we only reload / push when something really changed
function sig(b) {
  if (!b) return ''
  const t = (b.tasks || []).slice().sort((x, y) => (x.id > y.id ? 1 : -1)).map((x) => x.id + '|' + x.title + '|' + x.date + '|' + x.time + '|' + x.done).join(';')
  const ev = (b.events || []).slice().sort((x, y) => (x.id > y.id ? 1 : -1)).map((x) => x.id + '|' + x.start + '|' + x.end + '|' + x.summary).join(';')
  const ph = (b.photos || []).slice().sort((x, y) => (x.id > y.id ? 1 : -1)).map((x) => x.id + '|' + x.note + '|' + (x.keys || []).join('+')).join(';')
  const me = (b.profileName || '') + '|' + (b.nonNegotiables || []).join('~') + '|' + ((b.profilePhoto || '').length) + '|' + ((b.sleep && b.sleep.intervals ? b.sleep.intervals.length : 0))
  return JSON.stringify({ n: b.northStar || '', m: b.mission || null, t, ev, ph, me })
}
// Signature of ONLY what a pull can actually write back locally (north star, mission,
// tasks). Events and photos travel one way, Mac -> phone, and blobToMac never restores
// them, so comparing them made every pull look different and reloaded the app forever.
function sigIn(b) {
  if (!b) return ''
  const t = (b.tasks || []).slice().sort((x, y) => (x.id > y.id ? 1 : -1)).map((x) => x.id + '|' + x.title + '|' + x.date + '|' + x.time + '|' + x.done).join(';')
  return JSON.stringify({ n: b.northStar || '', m: b.mission || null, t })
}

async function api(payload) {
  if (!API) return {}   // cloud sync disabled: no endpoint configured
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  return r.json()
}


// ---- The engine. Always mounted in App, renders nothing. Keeps the account
// pulled, pushed, and the photo journal uploaded. ----
export function SyncEngine() {
  const [tick, setTick] = useState(0)
  const lastSig = useRef(sig(macToBlob()))
  useEffect(() => {
    if (!SYNC_API) return   // cloud sync disabled: run fully local
    const acc0 = load('grow_account', null)
    if (!acc0 || !acc0.token) {
      // watch for a sign-in happening in Settings
      const w = setInterval(() => { const a = load('grow_account', null); if (a && a.token) setTick((t) => t + 1) }, 2000)
      return () => clearInterval(w)
    }
    // LIVE both ways. Field-level clocks mean the Mac can safely receive the
    // phone's newer edits without ever clobbering its own — the old push-only
    // rule existed only because a naive full pull used to wipe the Mac.
    if (acc0.token) {
      Promise.all([refreshProfilePhoto(), refreshSleep()])
        .then(() => refreshPhotos(acc0.token))
        .then(() => {
          const b = macToBlob(); const { ts } = stampChanges(b)
          return api({ action: 'push', token: acc0.token, data: b, ts })
        })
        .then((r) => { if (macMergeIn(r)) location.reload() })
        .catch(() => {})
    }
    const photoTimer = setInterval(() => { const a = load('grow_account', null); if (a && a.token) { refreshProfilePhoto(); refreshSleep(); refreshPhotos(a.token) } }, 60000)
    const push = setInterval(async () => {
      const acc = load('grow_account', null); if (!acc || !acc.token) return
      const blob = macToBlob(); const { ts, changed } = stampChanges(blob)
      try {
        // When we have a local change, push (the response carries the merged
        // truth). When we don't, pull so the phone's edits land here.
        const r = changed ? await api({ action: 'push', token: acc.token, data: blob, ts }) : await api({ action: 'pull', token: acc.token })
        if (macMergeIn(r)) location.reload()
      } catch (e) {}
    }, 5000)
    return () => { clearInterval(push); clearInterval(photoTimer) }
  }, [tick])
  return null
}

// ---- The panel that lives inside Settings ----
export default function SyncPanel() {
  const [account, setAccount] = useState(() => load('grow_account', null))
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')
  const pollRef = useRef(null)
  const signedIn = !!(account && account.token)

  function afterSignIn(d) {
    const acc = { token: d.token, email: d.email }
    save('grow_account', acc); setAccount(acc); setMsg('Signed in. Uploading your data...'); setPass('')
    const local = macToBlob(); const { ts } = stampChanges(local)
    // Push our data up (stamped), then take back any field the phone edited more
    // recently. Field-level clocks keep both sides safe.
    api({ action: 'push', token: d.token, data: local, ts }).then((r) => { if (macMergeIn(r)) location.reload() }).catch(() => {})
    Promise.all([refreshProfilePhoto(), refreshSleep()]).then(() => refreshPhotos(d.token)).then(() => {
      const b = macToBlob(); const s = stampChanges(b)
      api({ action: 'push', token: d.token, data: b, ts: s.ts }).then((r) => { if (macMergeIn(r)) location.reload() }).catch(() => {})
      setMsg('Everything is synced with your phone now.')
    })
  }

  function googleSignIn() {
    if (!SYNC_API) { setMsg('Cloud sync is not configured. Set VITE_SYNC_API in .env to enable it.'); return }
    const sid = 'mac_' + Math.random().toString(36).slice(2) + Date.now()
    const url = SYNC_API + '/oauth/start?sid=' + encodeURIComponent(sid)
    try { window.kd && window.kd.content && window.kd.content.open(url) } catch (e) { window.open(url, '_blank') }
    setMsg('Waiting for Google. Finish in your browser, then come back here.')
    let tries = 0
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (++tries > 60) { clearInterval(pollRef.current); setMsg(''); return }
      try { const d = await api({ action: 'oauthpoll', sid }); if (d && d.token) { clearInterval(pollRef.current); afterSignIn(d) } } catch (e) {}
    }, 3000)
  }

  async function doAuth(mode) {
    if (!email || !pass) { setMsg('Enter your email and password.'); return }
    setMsg(mode === 'signup' ? 'Creating your account...' : 'Signing in...')
    let d
    try { d = await api({ action: mode, email: email.trim(), password: pass }) } catch (e) { setMsg('No connection. Try again.'); return }
    if (d.error) { setMsg({ exists: 'That email already has an account. Sign in instead.', 'no-account': 'No account with that email. Create one.', 'wrong-password': 'Wrong password.', 'bad-credentials': 'Use a real email and a password of 4 or more characters.', 'not-configured': 'Sync is not switched on yet.' }[d.error] || 'Could not sign in.'); return }
    afterSignIn(d)
  }
  async function syncNow() {
    const acc = load('grow_account', null); if (!acc || !acc.token) return
    setMsg('Syncing...')
    try {
      await refreshProfilePhoto()
      await refreshPhotos(acc.token)
      const b = macToBlob(); const { ts } = stampChanges(b)
      const r = await api({ action: 'push', token: acc.token, data: b, ts })
      if (macMergeIn(r)) return location.reload()
      setMsg('Synced.')
    } catch (e) { setMsg('Could not reach the server.') }
  }
  function signOut() { localStorage.removeItem('grow_account'); setAccount(null); setMsg('') }

  const field = { width: '100%', background: 'var(--bg, #000)', border: '1px solid var(--line, #26282c)', borderRadius: 10, color: 'var(--text, #fff)', fontSize: 15, padding: '11px 13px', marginTop: 10, fontFamily: 'inherit', boxSizing: 'border-box' }
  const btn = { background: 'var(--gold, #f5d060)', color: 'var(--on-gold, #1a1405)', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
  const ghost = { ...btn, background: 'transparent', color: 'var(--text,#fff)', border: '1px solid var(--line,#26282c)' }

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Your Out Past account</div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Sign in and your mission, tasks, calendar and photo journal follow you to your phone.
      </div>
      {signedIn ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>☁ {account.email}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btn} onClick={syncNow}>Sync now</button>
            <button style={ghost} onClick={signOut}>Sign out</button>
          </div>
        </>
      ) : (
        <>
          <button style={{ ...btn, width: '100%' }} onClick={googleSignIn}>Continue with Google</button>
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, margin: '12px 0 2px' }}>or use an email and password</div>
          <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={field} type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doAuth('signin') }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button style={btn} onClick={() => doAuth('signin')}>Sign in</button>
            <button style={ghost} onClick={() => doAuth('signup')}>Create account</button>
          </div>
        </>
      )}
      {msg && <div style={{ color: 'var(--gold,#f5d060)', fontSize: 12.5, marginTop: 10 }}>{msg}</div>}
    </div>
  )
}
