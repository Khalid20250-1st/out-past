import React, { useEffect, useRef, useState } from 'react'
import { TOPICS, PEOPLE, TOPIC_Q, LIBRARY, thumbFor, searchVideos, matchesTopic } from '../lib/content.js'
import { autocorrect } from '../lib/autocorrect.js'

// The real YouTube watch page, inside the app (Electron webview, real youtube.com
// origin), so every video plays, including ones that disable embedding. A Focus Lock
// blocks youtube.com in browsers, but this app is exempt: main.cjs maps youtube.com to
// its real IP for this app only, so the content page keeps working while Safari stays
// dead. Contained here so the timer keeps running and the watch logs.
// Injected into the YouTube page: auto-skips ads. Clicks the Skip button the moment
// it appears, and for unskippable ads mutes and jumps to the end so it is over instantly.
const AD_SKIP_JS = `(function(){
  if (window.__opAdSkip) return; window.__opAdSkip = true;
  setInterval(function(){
    try {
      var p = document.querySelector('.html5-video-player');
      var v = document.querySelector('video');
      var skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button');
      if (skip) { skip.click(); }
      if (p && p.classList.contains('ad-showing') && v) {
        v.muted = true;
        if (isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration;
      }
      document.querySelectorAll('.ytp-ad-overlay-close-button, .ytp-ad-overlay-slot, .ytp-ad-overlay-container').forEach(function(x){ x.remove(); });
    } catch(e){}
  }, 350);
})();`

function Player({ videoId }) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) el.setAttribute('src', `https://www.youtube.com/watch?v=${videoId}`) }, [videoId])
  // Re-inject the ad-skipper every time the webview navigates to a new video.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const inject = () => { try { el.executeJavaScript(AD_SKIP_JS) } catch (e) {} }
    el.addEventListener('dom-ready', inject)
    return () => { try { el.removeEventListener('dom-ready', inject) } catch (e) {} }
  }, [])
  // backgroundThrottling=false keeps the video/audio running full speed even when the
  // app is not the focused window or the Content tab is parked off-screen.
  return <webview ref={ref} allowpopups="false" webpreferences="backgroundThrottling=false" style={{ display: 'inline-flex', width: '100%', height: '100%' }} />
}

function fmtTimer(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`
}
function fmtDur(ms) { const m = Math.round((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }
function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
function loadHistory() { try { return JSON.parse(localStorage.getItem('grow_content_history')) || [] } catch { return [] } }
function saveHistory(list) { try { localStorage.setItem('grow_content_history', JSON.stringify(list.slice(-500))) } catch (e) {} }

// Broad topic search — returns 50 videos across many different channels in one call.
const BROAD = {
  discipline: 'self discipline motivation', procrastination: 'how to stop procrastinating',
  business: 'how to start a business', money: 'personal finance investing',
  marketing: 'marketing strategy', sales: 'sales techniques closing',
  leadership: 'leadership skills', documentaries: 'business documentary', ai: 'AI tools tutorial'
}

// Skills go stale — for these, only keep videos from the last 2 years.
const SKILL_TOPICS = new Set(['marketing', 'sales', 'ai'])
const TWO_YEARS_MS = 2 * 366 * 24 * 3600 * 1000
function withinTwoYears(pub) {
  if (!pub) return true
  // Real ISO date from the YouTube API -> exact age check.
  if (/^\d{4}-\d{2}-\d{2}/.test(pub)) { const d = new Date(pub); return isNaN(d) ? true : (Date.now() - d.getTime()) <= TWO_YEARS_MS }
  // Relative text ("3 years ago") from the scrape fallback.
  const m = /(\d+)\s*year/.exec(pub)
  if (m) return parseInt(m[1], 10) <= 2
  return true
}

export default function ContentView({ onLogWatch }) {
  const [phase, setPhase] = useState('idle')   // idle | topics | video | watching
  const [topic, setTopic] = useState(null)
  const [video, setVideo] = useState(null)
  const [batch, setBatch] = useState([])          // the 50 videos to scroll
  const [batchPerson, setBatchPerson] = useState('')
  const [loading, setLoading] = useState(false)
  const [watchStart, setWatchStart] = useState(null)
  const [, tick] = useState(0)
  const [history, setHistory] = useState(loadHistory)
  const [notesFull, setNotesFull] = useState(false)
  const [detail, setDetail] = useState(null)
  const seenRef = useRef(new Set())
  const lastPersonRef = useRef(null)

  useEffect(() => { if (!watchStart) return; const id = setInterval(() => tick((t) => t + 1), 1000); return () => clearInterval(id) }, [watchStart])

  const entry = video ? history.find((e) => e.id === video.id) : null
  const persist = (updater) => setHistory((h) => { const nh = updater(h); saveHistory(nh); return nh })

  // Per refresh: run SEVERAL searches (one broad topic search + a few random
  // experts), merge and dedupe, then cap each channel at 2 so 50 videos come from
  // 25+ different channels. On-topic + recent first; fill to 50 if the filters
  // would leave it short.
  const loadNext = async (t) => {
    setLoading(true); setBatch([]); setBatchPerson('')
    const roster = PEOPLE[t.id] || []
    const mod = TOPIC_Q[t.id] || ''
    // 4 distinct random experts + the broad topic query = 5 searches.
    const pool = [...roster], picks = []
    while (picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    const queries = [...new Set([(BROAD[t.id] || t.label || '').trim(), ...picks.map((p) => `${p} ${mod}`.trim())].filter(Boolean))]

    const batches = await Promise.all(queries.map((q) => searchVideos(q).catch(() => [])))
    const seen = new Set(), merged = []
    for (const b of batches) for (const v of (b || [])) { if (v && v.id && !seen.has(v.id)) { seen.add(v.id); merged.push(v) } }

    // Recency for skill topics (only enforce if it still leaves us plenty).
    let src = merged
    if (SKILL_TOPICS.has(t.id)) { const recent = merged.filter((v) => withinTwoYears(v.published)); if (recent.length >= 25) src = recent }

    // On-topic first, then the rest — both shuffled so refreshes differ.
    const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]] } return x }
    const ordered = [...shuffle(src.filter((v) => matchesTopic(v.title, t.id))), ...shuffle(src.filter((v) => !matchesTopic(v.title, t.id)))]

    // Cap 2 per channel → 50 videos, 25+ channels.
    const perCh = {}, out = []
    for (const v of ordered) { const c = v.channel || '?'; if ((perCh[c] || 0) >= 2) continue; perCh[c] = (perCh[c] || 0) + 1; out.push(v); if (out.length >= 50) break }
    // If the cap left us short of 50, top up ignoring the cap.
    if (out.length < 50) { const have = new Set(out.map((v) => v.id)); for (const v of ordered) { if (have.has(v.id)) continue; out.push(v); have.add(v.id); if (out.length >= 50) break } }

    const list = out.length ? out : (LIBRARY[t.id] || [])
    const channels = new Set(list.map((v) => v.channel).filter(Boolean)).size
    setBatch(list.slice(0, 50)); setBatchPerson(channels ? channels + ' channels' : ''); setLoading(false)
  }
  const chooseTopic = (t) => { setTopic(t); setBatch([]); setPhase('video'); loadNext(t) }
  const regenerate = () => { if (topic) loadNext(topic) }
  const startWatch = (v) => {
    const vid = v || video
    if (!vid) return
    setVideo(vid)
    persist((h) => h.find((e) => e.id === vid.id) ? h : [...h, { id: vid.id, title: vid.title, channel: vid.channel, topic: topic?.id || '', at: Date.now(), watchedMs: 0, finished: false, notes: '' }])
    setWatchStart(Date.now()); setPhase('watching')
  }
  const setNotes = (text) => persist((h) => h.map((e) => e.id === video.id ? { ...e, notes: text } : e))
  const setDetailNotes = (id, text) => persist((h) => h.map((e) => e.id === id ? { ...e, notes: text } : e))
  const toggleFinished = () => persist((h) => h.map((e) => e.id === video.id ? { ...e, finished: !e.finished } : e))
  const stopWatch = () => {
    if (watchStart && video) {
      const ms = Date.now() - watchStart
      persist((h) => h.map((e) => e.id === video.id ? { ...e, watchedMs: (e.watchedMs || 0) + ms } : e))
      if (ms >= 60 * 1000) { const start = new Date(watchStart), end = new Date(); onLogWatch && onLogWatch({ title: `${video.title} · ${video.channel}`, start: start.toISOString(), end: end.toISOString() }) }
    }
    setWatchStart(null); setNotesFull(false); setPhase('video')
  }
  const rewatch = (e) => { setTopic(TOPICS.find((t) => t.id === e.topic) || null); setDetail(null); startWatch({ id: e.id, title: e.title, channel: e.channel }) }
  const delHist = (id) => persist((h) => h.filter((e) => e.id !== id))
  const setFinishedId = (id, val) => persist((h) => h.map((e) => e.id === id ? { ...e, finished: val } : e))

  const sortedHist = [...history].sort((a, b) => b.at - a.at)
  const stats = { count: history.length, finished: history.filter((e) => e.finished).length, mins: Math.round(history.reduce((s, e) => s + (e.watchedMs || 0), 0) / 60000) }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Content</h1>
          <div className="sub">One great thing to watch, chosen for you. No feed, no rabbit hole.</div>
        </div>
        {phase !== 'watching' && (
          <div style={{ display: 'flex', gap: 10 }}>
            {phase === 'history'
              ? <button onClick={() => setPhase('idle')} style={ghost}>← Generate</button>
              : <button onClick={() => setPhase('history')} style={ghost}>History</button>}
            {(phase === 'topics' || phase === 'video') && <button onClick={() => { setPhase('idle'); setTopic(null); setVideo(null) }} style={ghost}>Start over</button>}
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '54px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>🎯</div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>Feed your mind, not the scroll</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 460 }}>Pick a topic and get one hand-picked video. Watch it here, take notes, and the time books itself onto your calendar as real work.</div>
          <button onClick={() => setPhase('topics')} style={{ ...gold, fontSize: 16, padding: '14px 34px', marginTop: 6 }}>Generate content</button>
        </div>
      )}

      {phase === 'topics' && (
        <div className="panel">
          <h3>Pick a topic</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {TOPICS.map((t) => (
              <button key={t.id} onClick={() => chooseTopic(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                <span style={{ fontSize: 30 }}>{t.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'history' && <History sorted={sortedHist} stats={stats} onOpen={setDetail} onDelete={(id) => { persist((h) => h.filter((x) => x.id !== id)); setDetail((d) => (d && d.id === id ? null : d)) }} />}

      {phase === 'video' && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{topic?.emoji} {topic?.label}{batchPerson ? ` · ${batchPerson}` : ''}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={regenerate} style={gold} disabled={loading}>↻ New set</button>
              <button onClick={() => setPhase('topics')} style={ghost}>Change topic</button>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: '54px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>Finding you 50 good ones…</div>
          ) : batch.length ? (
            <>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{batch.length} videos. Scroll and pick one to watch, or hit New set for a fresh batch.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, maxHeight: '64vh', overflowY: 'auto', paddingRight: 4 }}>
                {batch.map((v) => (
                  <div key={v.id} onClick={() => startWatch(v)} title="Click to watch" style={{ cursor: 'pointer', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg)', transition: 'border-color .15s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}>
                    <img src={thumbFor(v.id)} alt="" style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }} />
                    <div style={{ padding: '9px 11px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{v.channel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px 0' }}>Nothing found here. Try New set or another topic.</div>}
        </div>
      )}

      {phase === 'watching' && video && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, height: '72vh', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 62%', minWidth: 320, background: '#000', borderRadius: 12, overflow: 'hidden' }}>
              <Player videoId={video.id} />
            </div>
            <div style={{ flex: '1 1 30%', minWidth: 260, display: 'flex', flexDirection: 'column', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notes</span>
                <button onClick={() => setNotesFull(true)} title="Full screen notes" style={iconBtn}>⛶</button>
              </div>
              <textarea value={entry?.notes || ''} onChange={(e) => setNotes(e.target.value)} onBlur={(e) => setNotes(autocorrect(e.target.value))} spellCheck={true} placeholder="Type your notes here. They save automatically." style={notesArea} />
              <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>Saved automatically</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48vw' }}>{video.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Watching for <span style={{ color: 'var(--gold)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(Date.now() - (watchStart || Date.now()))}</span> · books onto your calendar</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={toggleFinished} style={{ ...ghost, borderColor: entry?.finished ? 'var(--done)' : 'var(--line)', color: entry?.finished ? 'var(--done)' : 'var(--muted)' }}>{entry?.finished ? '✓ Finished' : 'Mark finished'}</button>
              <button onClick={() => window.kd.content.open(`https://www.youtube.com/watch?v=${video.id}`)} style={ghost}>Open on YouTube</button>
              <button onClick={stopWatch} style={{ ...gold, fontSize: 15, padding: '12px 26px' }}>Stop & log to calendar</button>
            </div>
          </div>
        </div>
      )}

      {notesFull && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 12600, background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70vw' }}>Notes · {video?.title}</div>
            <button onClick={() => setNotesFull(false)} style={gold}>Done</button>
          </div>
          <textarea value={entry?.notes || ''} onChange={(e) => setNotes(e.target.value)} onBlur={(e) => setNotes(autocorrect(e.target.value))} spellCheck={true} placeholder="Write freely. Saves automatically." autoFocus style={{ flex: 1, resize: 'none', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: '20px 24px', color: 'var(--text)', fontSize: 18, lineHeight: 1.6, outline: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }} />
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 12500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1040px, 97vw)', height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, boxShadow: '0 40px 100px -20px rgba(0,0,0,0.85)' }}>
            <div style={{ display: 'flex', gap: 18, marginBottom: 16, flexShrink: 0 }}>
              <img src={thumbFor(detail.id)} alt="" style={{ width: 200, borderRadius: 12, border: '1px solid var(--line)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, color: 'var(--text)', lineHeight: 1.3 }}>{detail.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{detail.channel}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => { const nv = !detail.finished; setFinishedId(detail.id, nv); setDetail((d) => d ? { ...d, finished: nv } : d) }} title="Click to change status" style={{ fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', background: detail.finished ? 'rgba(74,222,128,0.15)' : 'var(--bg)', color: detail.finished ? 'var(--done)' : 'var(--muted)', border: '1px solid ' + (detail.finished ? 'var(--done)' : 'var(--teal-dim)') }}>{detail.finished ? '✓ Finished' : '◦ In progress'}</button>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.finished ? 'Tap to mark unfinished' : 'Tap the badge to mark finished'}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Watched {fmtDur(detail.watchedMs)} · {fmtDate(detail.at)}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, flexShrink: 0 }}>YOUR NOTES</div>
            <textarea value={history.find((e) => e.id === detail.id)?.notes || ''} onChange={(e) => setDetailNotes(detail.id, e.target.value)} onBlur={(e) => setDetailNotes(detail.id, autocorrect(e.target.value))} spellCheck={true} placeholder="No notes yet." style={{ flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', resize: 'none', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: '22px 26px', color: 'var(--text)', fontSize: 19, lineHeight: 1.75, outline: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
              <button onClick={() => { delHist(detail.id); setDetail(null) }} style={{ ...ghost, color: 'var(--red)', borderColor: 'var(--red)' }}>Delete</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDetail(null)} style={ghost}>Close</button>
                <button onClick={() => rewatch(detail)} style={gold}>▶ Rewatch</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function History({ sorted, stats, onOpen, onDelete }) {
  const [menu, setMenu] = useState(null)   // { x, y, id } right-click delete menu
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [menu])
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>History</h3>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{stats.count} watched · {stats.finished} finished · {stats.mins}m total</div>
      </div>
      {sorted.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>Nothing watched yet. What you watch shows up here with your notes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((e) => (
            <div key={e.id} onClick={() => onOpen(e)} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setMenu({ x: ev.clientX, y: ev.clientY, id: e.id }) }} title="Right-click to delete" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer' }}>
              <img src={thumbFor(e.id)} alt="" style={{ width: 84, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{e.channel} · {fmtDur(e.watchedMs)} · {fmtDate(e.at)}{e.notes ? ' · 📝 notes' : ''}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, flexShrink: 0, background: e.finished ? 'rgba(74,222,128,0.15)' : 'transparent', color: e.finished ? 'var(--done)' : 'var(--muted)', border: '1px solid var(--line)' }}>{e.finished ? '✓ Finished' : '◦ In progress'}</span>
            </div>
          ))}
        </div>
      )}
      {menu && (
        <div style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 170), top: Math.min(menu.y, window.innerHeight - 60), zIndex: 13000, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 5, boxShadow: '0 12px 34px -10px rgba(0,0,0,0.7)' }} onClick={(ev) => ev.stopPropagation()}>
          <button onClick={() => { onDelete(menu.id); setMenu(null) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: 150, background: 'transparent', border: 'none', color: 'var(--red)', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '9px 12px', borderRadius: 7, textAlign: 'left' }}>🗑 Delete</button>
        </div>
      )}
    </div>
  )
}

const gold = { background: 'var(--gold)', color: 'var(--on-gold)', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', padding: '10px 18px', fontFamily: 'var(--display)' }
const ghost = { background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--teal-dim)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '10px 18px' }
const iconBtn = { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const notesArea = { flex: 1, resize: 'none', background: 'transparent', border: 'none', padding: '12px 14px', color: 'var(--text)', fontSize: 15, lineHeight: 1.5, outline: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }
