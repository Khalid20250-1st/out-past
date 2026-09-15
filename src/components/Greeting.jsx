import React, { useEffect, useState } from 'react'
import GAILogo from './GAILogo.jsx'

// The war-cry that fires when Grow opens. Fresh line daily, zero tokens.
export default function Greeting({ who, line, sleepText, sleepOpinion, birthday, onClose }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      pointerEvents: 'none', paddingTop: 'clamp(40px, 8vh, 120px)',
      background: show ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
      backdropFilter: show ? 'blur(3px)' : 'blur(0px)',
      transition: 'background 0.5s ease, backdrop-filter 0.5s ease'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        pointerEvents: 'auto',
        width: 'min(560px, 92vw)',
        background: 'var(--panel)',
        border: '1px solid var(--teal-dim)',
        borderRadius: 22,
        padding: 'clamp(22px, 3vw, 34px)',
        boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8), 0 0 40px rgba(230,194,92,0.12)',
        transform: show ? 'translateY(0) scale(1)' : 'translateY(-24px) scale(0.96)',
        opacity: show ? 1 : 0,
        transition: 'transform 0.55s cubic-bezier(0.2,0.9,0.2,1), opacity 0.45s ease',
        textAlign: 'center'
      }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 16px', filter: 'drop-shadow(0 0 14px var(--gold))' }}>
          <GAILogo size={64} />
        </div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14, fontWeight: 700 }}>
          KAI · {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
        </div>
        {birthday && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 20, background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-2) 100%)', color: 'var(--on-gold)', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15, marginBottom: 16, boxShadow: '0 0 26px rgba(230,194,92,0.4)' }}>
            🎂 Happy Birthday{who ? `, ${who}` : ''}!
          </div>
        )}
        {sleepText && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--teal-dim)', color: 'var(--gold)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
            🌙 You slept {sleepText}
          </div>
        )}
        {sleepText && sleepOpinion && (
          <div style={{ color: 'var(--muted)', fontSize: 'clamp(12px, 1vw, 14px)', lineHeight: 1.5, marginBottom: 18, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            {sleepOpinion}
          </div>
        )}
        {who && <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{who}.</div>}
        <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(20px, 2.4vw, 30px)', fontWeight: 800, lineHeight: 1.25, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 22 }}>
          {line}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {/* Hype only. Just closes the popup — no navigation, no side effects. */}
          <button onClick={onClose} style={{
            background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-2) 100%)',
            color: 'var(--on-gold)', border: 'none', borderRadius: 12,
            padding: '13px 44px', fontFamily: 'var(--display)', fontWeight: 800,
            fontSize: 16, letterSpacing: 1, cursor: 'pointer'
          }}>LET'S GO →</button>
        </div>
      </div>
    </div>
  )
}
