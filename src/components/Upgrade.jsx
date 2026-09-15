import React, { useState, useEffect } from 'react'
import GAILogo from './GAILogo.jsx'
import { startCheckout } from '../lib/membership.js'

// The paywall. Grow's on-device brain stays free; this unlocks the live AI
// mentor and Haiku scheduling. Framed as a growth ecosystem, not an app.
export default function Upgrade({ email, onClose }) {
  const [show, setShow] = useState(false)
  const [plan, setPlan] = useState('annual')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { const t = setTimeout(() => setShow(true), 20); return () => clearTimeout(t) }, [])

  async function go() {
    if (busy) return
    setErr(''); setBusy(true)
    const urlToOpen = await startCheckout(email, plan)
    setBusy(false)
    if (urlToOpen) { try { window.kd.content.open(urlToOpen) } catch (e) {} }
    else setErr('Payments are not switched on yet. Try again once checkout is live.')
  }

  const perks = [
    'KAI mentor answers anything, trained on the greatest minds',
    'Plan my day: AI decides the exact time each task needs',
    'Every new AI feature, first, at no extra cost',
    'Your growth data compounds into a mentor that knows you',
  ]

  const card = (id, title, price, sub, save) => (
    <button onClick={() => setPlan(id)} style={{
      textAlign: 'left', flex: 1, minWidth: 200, cursor: 'pointer',
      background: plan === id ? 'rgba(245,208,96,0.10)' : 'var(--bg)',
      border: '2px solid ' + (plan === id ? 'var(--gold)' : 'var(--line)'), borderRadius: 16, padding: '18px 20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{title}</span>
        {save && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--on-gold)', background: 'var(--gold)', borderRadius: 20, padding: '3px 9px' }}>{save}</span>}
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--display)', fontWeight: 900, fontSize: 30, color: 'var(--text)' }}>{price}</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{sub}</div>
    </button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 14800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)', backdropFilter: show ? 'blur(12px)' : 'blur(0)', WebkitBackdropFilter: show ? 'blur(12px)' : 'blur(0)', transition: 'background .35s ease, backdrop-filter .35s ease', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--teal-dim)', borderRadius: 22, padding: 'clamp(22px,3vw,34px)', boxShadow: '0 40px 110px -25px rgba(0,0,0,0.85), 0 0 50px rgba(245,208,96,0.10)', opacity: show ? 1 : 0, transform: show ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)', transition: 'transform .5s cubic-bezier(0.2,0.9,0.2,1), opacity .4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, filter: 'drop-shadow(0 0 12px var(--gold))' }}><GAILogo size={44} /></div>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, color: 'var(--text)', lineHeight: 1.1 }}>Unlock your mentor</div>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>GROW MEMBERSHIP</div>
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 18px' }}>
          The calendar, journal, and coded mentor are yours free. Membership turns on the living AI, the part that thinks with you and runs your day. Cheaper than a coach, in your corner every day.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
          {perks.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 900, flexShrink: 0 }}>✦</span>
              <span style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.4 }}>{p}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          {card('annual', 'Yearly', '$2000', '$166/mo, billed yearly', 'Save $400')}
          {card('monthly', 'Monthly', '$200', 'billed every month', null)}
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <button onClick={go} disabled={busy} style={{ width: '100%', background: 'linear-gradient(180deg, var(--gold), var(--gold-2))', color: 'var(--on-gold)', border: 'none', borderRadius: 13, padding: '15px', fontFamily: 'var(--display)', fontWeight: 900, fontSize: 16, letterSpacing: 0.5, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Opening checkout…' : (plan === 'annual' ? 'Become a member — $2000/yr' : 'Become a member — $200/mo')}
        </button>
        <button onClick={onClose} style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--muted)', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '8px' }}>Maybe later</button>
        <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>Secure checkout by Stripe. Cancel anytime.</div>
      </div>
    </div>
  )
}
