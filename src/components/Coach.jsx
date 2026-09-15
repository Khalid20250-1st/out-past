import React, { useState, useEffect, useRef } from 'react'
import KaiIcon from './KaiIcon.jsx'
import GAIThinking from './GAIThinking.jsx'
import { answerFromKB, generalAnswer, matchKB, isReviewQuestion, reviewMyDays, isSleepQuestion, answerSleep, isSleepRule, answerSleepRule, parseEventCommand, isTimeQuestion, answerFreeTime, isScheduleRequest, smartSchedule, parseCalendarCommand, isRestRequest, restPushback } from '../lib/kb.js'
import { fmtTime } from '../lib/format.js'

const ROLE_OPTIONS = ['Entrepreneur','Student','Creator','Executive','Freelancer','Other']
const PROBLEM_OPTIONS = ['Procrastination','Too many distractions','No structure','Burnout',"Can't focus",'Other']
const PROFILE_KEY = 'grow_coach_profile'
const HISTORY_KEY = 'grow_chat_history'
// Fully local brain. The Kidus Brain (KB) handles ~90% for free; on a true miss
// KAI answers on-device via Apple Intelligence, then a ~1GB Ollama model. No
// cloud, no key, no cost.

function TypingDots() {
  return (
    <div style={{display:'flex',gap:4,padding:'12px 16px',alignItems:'center'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{width:7,height:7,borderRadius:'50%',background:'var(--gold)',animation:`bounce 1s ${i*0.2}s infinite`}}/>
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  )
}

// Robust copy: navigator.clipboard is often blocked in packaged Electron
// (file:// isn't a secure context), so fall back to a hidden textarea.
function copyText(t) {
  const fallback = () => {
    try {
      const ta = document.createElement('textarea')
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    } catch (e) {}
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback)
  else fallback()
}

function fmtHM(ms) { const m = Math.round((ms || 0) / 60000), h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m` }
function fmtElapsed(ms) { const s = Math.floor((ms || 0) / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; const p = (n) => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}` }
const SLEEP_CMDS = ['sleep', 'sleep now', 'go to sleep', 'i want to sleep', 'im going to sleep', "i'm going to sleep", 'going to sleep', 'going to bed', 'goodnight', 'good night', 'sleep mode', 'put me to sleep', 'nap', 'take a nap']

const CopyIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>)
const EditIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>)
const RedoIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>)

function ActionBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={e=>e.currentTarget.style.color='var(--gold)'}
      onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}
      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',display:'grid',placeItems:'center',padding:4,borderRadius:6,transition:'color .15s'}}>
      {children}
    </button>
  )
}

function UserAvatar({ photo, initial }) {
  return (
    <div style={{width:38,height:38,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      {photo ? <img src={photo} alt="you" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{color:'var(--on-gold)',fontWeight:800,fontSize:15}}>{initial}</span>}
    </div>
  )
}

function Msg({msg, onCopy, onEdit, onResend, showUserAvatar, userPhoto, userInitial}) {
  const isAI = msg.role==='ai'
  const [copied, setCopied] = useState(false)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:isAI?'flex-start':'flex-end',marginBottom:16}}>
      <div style={{display:'flex',justifyContent:isAI?'flex-start':'flex-end',alignItems:'flex-end',gap:8,maxWidth:'100%'}}>
        {isAI && <div style={{width:38,height:38,borderRadius:'50%',overflow:'hidden',flexShrink:0}}><KaiIcon size={38}/></div>}
        <div style={{
          maxWidth:isAI?'86%':'80%',padding:'13px 17px',
          borderRadius:isAI?'6px 18px 18px 18px':'18px 6px 18px 18px',
          background:isAI?'rgba(245,208,96,0.10)':'var(--panel-2)',
          border:isAI?'1px solid rgba(245,208,96,0.22)':'1px solid var(--line)',
          color:'var(--text)',fontSize:19,fontWeight:isAI?600:600,lineHeight:1.55,letterSpacing:'0.1px',whiteSpace:'pre-wrap'
        }}>
          {msg.text}
        </div>
        {!isAI && showUserAvatar && <UserAvatar photo={userPhoto} initial={userInitial}/>}
      </div>
      <div style={{display:'flex',gap:4,marginTop:6,paddingLeft:isAI?46:0,paddingRight:(!isAI&&showUserAvatar)?46:0}}>
        {isAI ? (
          <ActionBtn title={copied?'Copied':'Copy'} onClick={()=>{ onCopy && onCopy(msg.text); setCopied(true); setTimeout(()=>setCopied(false),1200) }}>
            {copied ? <span style={{fontSize:13,color:'var(--done)'}}>✓</span> : <CopyIcon/>}
          </ActionBtn>
        ) : (
          <>
            <ActionBtn title="Edit" onClick={()=>onEdit && onEdit(msg.text)}><EditIcon/></ActionBtn>
            <ActionBtn title="Ask again" onClick={()=>onResend && onResend(msg.text)}><RedoIcon/></ActionBtn>
          </>
        )}
      </div>
    </div>
  )
}

function buildCalendarSummary(events) {
  if (!events || events.length === 0) return 'No calendar data available.'
  const now = new Date()
  const last7 = new Date(now); last7.setDate(last7.getDate() - 7)
  const recent = events.filter(e => {
    const d = new Date(e.start || e.startISO || '')
    return d >= last7 && d <= now
  })
  if (recent.length === 0) return 'No recent events in the last 7 days.'
  const byDay = {}
  recent.forEach(e => {
    const d = (e.start || e.startISO || '').split('T')[0]
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(e.summary || e.title || 'Untitled')
  })
  return Object.entries(byDay).slice(-7).map(([date, evts]) =>
    `${date}: ${evts.join(', ')}`
  ).join('\n')
}

export default function Coach({ onClose, events, onStartSleep, sleep, onCreateEvent, mode = 'mentor', photo, account, member, onUpgrade }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) } catch { return null } })()
  const savedHistory = (() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] } })()

  const [messages, setMessages] = useState(savedHistory)
  const [stage, setStage] = useState(saved ? 'done' : 'name')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [profile, setProfile] = useState(saved || {name:'',role:'',problem:''})
  const [options, setOptions] = useState(null)
  const [chatMode, setChatMode] = useState(!!saved)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const firstScroll = useRef(true)

  // On open: jump straight to the last convo (no animation). New replies: smooth.
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: firstScroll.current ? 'auto' : 'smooth' }); firstScroll.current = false }, [messages, typing])

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-50)))
  }, [messages])

  function addMsg(role, text) { setMessages(m => [...m, {role, text}]) }

  function addAI(text, delay=1000) {
    return new Promise(resolve => {
      setTyping(true)
      setTimeout(() => { setTyping(false); addMsg('ai', text); resolve() }, delay)
    })
  }

  useEffect(() => {
    if (savedHistory.length > 0) return
    if (saved) {
      addAI(`Welcome back, ${saved.name}. I have access to your calendar. What do you want to work on today?`, 600)
    } else {
      setTimeout(() => {
        setTyping(true)
        setTimeout(() => {
          setTyping(false)
          addMsg('ai', "Hey — I'm KAI, your time intelligence coach. Before we start, I want to understand you. What's your name?")
        }, 1000)
      }, 300)
    }
  }, [])

  async function handleSend(text) {
    if (!text.trim() || loading) return
    const val = text.trim()
    setInput(''); setOptions(null); setError('')
    addMsg('user', val)

    if (!chatMode) {
      if (stage==='name') {
        setProfile(p=>({...p,name:val}))
        await addAI(`Nice to meet you, ${val}. What best describes what you do?`, 1000)
        setOptions(ROLE_OPTIONS); setStage('role')
      } else if (stage==='role') {
        setProfile(p=>({...p,role:val}))
        await addAI(`Got it. As a ${val}, what is your biggest time challenge right now?`, 1000)
        setOptions(PROBLEM_OPTIONS); setStage('problem')
      } else if (stage==='problem') {
        const newProfile = {...profile, problem:val}
        setProfile(newProfile)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile))
        setStage('done')
        await addAI(`That is honest. Most ${profile.role}s struggle with the same thing.`, 1400)
        await addAI(`Here is the truth: you cannot manage time, you can only manage yourself. I am going to coach you on building a structure that fights ${val.toLowerCase()} by design.`, 1800)
        await addAI(`I am now reading your calendar. Ask me anything — your weaknesses, how to improve, or how to plan better.`, 1200)
        setChatMode(true)
      }
    } else {
      const low = val.toLowerCase().trim()
      // Manual sleep flow: "sleep" -> confirm -> sleep the Mac + start timer.
      if (low === 'yes, sleep my mac') { setOptions(null); addMsg('ai', "Sleeping your Mac now. When you wake up, hit STOP on the timer. Under 20 minutes won't count."); onStartSleep && onStartSleep(); return }
      if (low === 'no, not now') { setOptions(null); addMsg('ai', "Alright, staying up. Then stop stalling and get back to it."); return }
      if (SLEEP_CMDS.includes(low)) {
        setOptions(['Yes, sleep my Mac', 'No, not now'])
        addMsg('ai', "Put your Mac to sleep now? I'll start a timer — hit Stop when you wake up. Under 20 minutes won't count as sleep.")
        return
      }

      // Sleep rule — "if I sleep more than 5 hours that's not ok". KAI locks the
      // rule and judges last night against it. Free, checked first.
      if (isSleepRule(val)) { addMsg('ai', answerSleepRule(sleep, profile).text); return }

      // Sleep — KAI knows the exact window (from → to), the hours, and gives a
      // KB-backed opinion. Checked BEFORE review so "how was my sleep" hits here.
      if (isSleepQuestion(val)) { addMsg('ai', answerSleep(sleep, profile).text); return }

      // CALENDAR ASSISTANT (the floating KAI): obey. Book, block, schedule — no
      // lecturing. Only push back on blocking a business day for rest.
      if (mode === 'assistant') {
        if (isRestRequest(val)) { addMsg('ai', restPushback(profile).text); return }
        const c = parseCalendarCommand(val) || parseEventCommand(val)
        if (c && onCreateEvent) {
          onCreateEvent({ summary: c.summary, start: c.start, end: c.end, allDay: c.allDay })
          const when = c.allDay
            ? `all day ${new Date(c.start).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`
            : `${new Date(c.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmtTime(c.start)} to ${fmtTime(c.end)}`
          addMsg('ai', `Done. "${c.summary}" is on your calendar — ${when}. Drag it if you want to move it.`)
          return
        }
        if (isScheduleRequest(val)) { const r = smartSchedule(events, profile, val); if (r.create && onCreateEvent) onCreateEvent(r.create); addMsg('ai', r.text); return }
        if (isTimeQuestion(val)) { addMsg('ai', answerFreeTime(events, profile, val).text); return }
        addMsg('ai', `I'm your scheduling hand here. Tell me what to put on the calendar — like "block Monday all day for a meeting", "add gym 6 to 7", or "find time for a client call".`)
        return
      }

      // Type-to-create — "add gym 6 to 7". KAI drops the block on your calendar.
      const cmd = parseEventCommand(val)
      if (cmd && onCreateEvent) {
        onCreateEvent({ summary: cmd.summary, start: cmd.start, end: cmd.end })
        addMsg('ai', `Done. Added "${cmd.summary}" ${cmd.dayOffset ? 'tomorrow' : 'today'}, ${fmtTime(cmd.start)} to ${fmtTime(cmd.end)}. It's on your calendar now. Drag it if you want to move it.`)
        return
      }

      // "Do I have time / analyze my schedule" — analysis only, tells you when
      // you're free. It does NOT book anything.
      if (isTimeQuestion(val)) { addMsg('ai', answerFreeTime(events, profile, val).text); return }

      // "Find time for X / schedule X" — KAI decides business vs personal, then
      // books it: business gets a priority prime-hours slot, personal fills a gap.
      if (isScheduleRequest(val)) {
        const r = smartSchedule(events, profile, val)
        if (r.create && onCreateEvent) onCreateEvent(r.create)
        addMsg('ai', r.text)
        return
      }

      // Free stats review — "review my days / what to fix". KAI reads the app's
      // own numbers (productive, wasted, gaps) and answers in code. Zero tokens.
      if (isReviewQuestion(val)) { addMsg('ai', reviewMyDays(events, profile, val).text); return }

      // KB next — the Kidus Brain. If it knows the topic, KAI hits back
      // instantly for $0. Sharp as an attack, no slow typing.
      const kb = answerFromKB(val, events, profile)
      if (kb) { addMsg('ai', kb.text); return }

      // True miss — KB had no direct lesson. Answer on-device, free: Apple
      // Intelligence first, then a local ~1GB model, both speaking as KAI with
      // the app's own numbers and the closest KB lesson in hand. Nothing leaves
      // the Mac, no key, no cost. If neither engine is ready, KAI still hits
      // back with a free KB lesson. No raw error is ever shown.
      setLoading(true)
      const calSummary = buildCalendarSummary(events)
      const near = matchKB(val)
      const system = [
        "You are KAI, a sharp, direct mentor inside the Out Past app. You talk like a demanding coach who believes in the person: short, concrete, no fluff, no emoji, no dashes. Name the hard truth, then give one clear move to make right now.",
        `The person: ${profile.name || 'the user'}, role ${profile.role || 'unknown'}, working on ${profile.problem || 'their mission'}.`,
        `Their last 7 days:\n${calSummary}`,
        near ? `A lesson from your training you can lean on (${near.person}, ${near.source}): ${near.lesson} Move: ${near.action}` : ''
      ].filter(Boolean).join('\n\n')
      try {
        const r = (window.kd && window.kd.ai) ? await window.kd.ai.local(system, val) : null
        if (r && r.answer) addMsg('ai', r.answer)
        else addMsg('ai', generalAnswer(events, profile).text)
      } catch(e) {
        addMsg('ai', generalAnswer(events, profile).text)
      }
      setLoading(false)
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid var(--line)',background:'var(--panel)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:'50%',overflow:'hidden',flexShrink:0,boxShadow:'0 0 12px rgba(245,208,96,0.3)'}}><KaiIcon size={38}/></div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>KAI</div>
            <div style={{fontSize:10,color:'var(--muted)',letterSpacing:2,textTransform:'uppercase'}}>{chatMode?`${profile.name} · ${profile.role}`:'Initializing...'}</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:'var(--line)',border:'1px solid var(--line)',color:'var(--muted-2)',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>Close</button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'20px 18px'}}>
        {messages.map((msg,i)=><Msg key={i} msg={msg} onCopy={copyText} onEdit={(t)=>setInput(t)} onResend={(t)=>handleSend(t)} showUserAvatar={mode==='mentor'} userPhoto={photo || account?.picture} userInitial={((account?.name||account?.email||'U').trim()[0]||'U').toUpperCase()} />)}
        {(typing || loading) && (
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <GAIThinking size={40} label=""/>
            <span style={{fontSize:13,color:'var(--muted)',fontWeight:600}}>KAI is thinking…</span>
          </div>
        )}
        {error && <div style={{color:'var(--red)',fontSize:12,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:8,border:'1px solid rgba(255,68,102,0.2)'}}>{error}</div>}
        <div ref={bottomRef}/>
      </div>

      {/* Option buttons */}
      {options && (
        <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'10px 18px',borderTop:'1px solid var(--line)'}}>
          {options.map(o=>(
            <button key={o} onClick={()=>handleSend(o)} style={{background:'rgba(245,208,96,0.06)',border:'1px solid rgba(245,208,96,0.25)',color:'var(--gold)',borderRadius:20,padding:'7px 16px',fontSize:12,cursor:'pointer',fontWeight:600,transition:'all .2s'}}>
              {o}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{display:'flex',gap:10,padding:'12px 18px',borderTop:'1px solid var(--line)',background:'var(--panel)'}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleSend(input)}
          placeholder={chatMode?'Ask KAI anything about your time...':'Type your answer...'}
          style={{flex:1,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:12,padding:'11px 16px',color:'var(--text)',fontSize:13,outline:'none'}}
        />
        <button
          onClick={()=>handleSend(input)}
          disabled={loading}
          style={{background:'linear-gradient(135deg,var(--gold),var(--gold-2))',border:'none',borderRadius:12,padding:'11px 20px',color:'#000',fontWeight:800,fontSize:13,cursor:loading?'not-allowed':'pointer',opacity:loading?0.6:1}}
        >
          {loading?'...':'Send'}
        </button>
      </div>
    </div>
  )
}
