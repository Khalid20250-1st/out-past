import React, { useEffect, useState } from 'react'
import GAILogo from './GAILogo.jsx'

// First run (and after a KAI mind wipe) KAI sets your sleep standard. Ideal
// sleep drives the whole model: anything over it counts as wasted, not rest.
// Rule: if you're 40 or under and pick 8h+, KAI challenges you once. Over 40,
// KAI respects whatever you choose and never pushes.

const LAZY_QUOTES = [
  `"There is no substitute for hard work." — Thomas Edison`,
  `"Don't wish it were easier, wish you were better." — Jim Rohn`,
  `"The only place success comes before work is in the dictionary." — Vince Lombardi`,
  `"Opportunity is missed by most because it is dressed in overalls and looks like work." — Thomas Edison`,
]
function pick(a) { return a[Math.floor(Math.random() * a.length)] }

export default function Onboarding({ onDone }) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState('age')   // age (birthday) | ideal | challenge | appreciate
  const [bday, setBday] = useState('')       // yyyy-mm-dd
  const [ideal, setIdeal] = useState('')
  const [quote] = useState(() => pick(LAZY_QUOTES))
  useEffect(() => { const t = setTimeout(() => setShow(true), 30); return () => clearTimeout(t) }, [])

  // Age is derived from the birthday, so KAI knows the whole date and can wish
  // you a happy birthday on the day.
  function ageFromBday(iso) {
    if (!iso) return 0
    const b = new Date(iso + 'T00:00:00'); if (isNaN(b)) return 0
    const now = new Date(); let a = now.getFullYear() - b.getFullYear()
    const m = now.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
    return a
  }
  const ageN = ageFromBday(bday)
  const idealN = parseFloat(ideal)

  function finish(finalIdeal) {
    try {
      if (bday) localStorage.setItem('grow_user_birthday', bday)
      localStorage.setItem('grow_user_age', String(ageN || 0))
      localStorage.setItem('grow_ideal_sleep', String(finalIdeal))
      localStorage.setItem('grow_onboard_done', '1')
    } catch (e) {}
    onDone(finalIdeal)
  }

  function submitAge() { if (!bday || ageN < 5 || ageN > 120) return; setStep('ideal') }
  function submitIdeal() {
    if (!idealN || idealN < 1 || idealN > 16) return
    if (ageN > 40) return finish(idealN)          // over 40: accept, no push
    if (idealN >= 8) return setStep('challenge')  // young + soft: challenge once
    finish(idealN)
  }

  const card = {
    width: 'min(520px, 94vw)', background: 'var(--panel)', border: '1px solid var(--teal-dim)', borderRadius: 22,
    padding: 'clamp(24px,4vw,38px)', boxShadow: '0 40px 110px -25px rgba(0,0,0,0.85), 0 0 50px rgba(245,208,96,0.10)',
    opacity: show ? 1 : 0, transform: show ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.96)',
    transition: 'transform 0.5s cubic-bezier(0.2,0.9,0.2,1), opacity 0.4s ease', textAlign: 'center'
  }
  const input = { width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', color: 'var(--text)', fontSize: 18, fontFamily: 'var(--display)', fontWeight: 700, textAlign: 'center', outline: 'none' }
  const gold = { background: 'linear-gradient(180deg,var(--gold),var(--gold-2))', color: 'var(--on-gold)', border: 'none', borderRadius: 13, padding: '13px 30px', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
  const ghost = { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 13, padding: '13px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 14000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)', backdropFilter: show ? 'blur(10px)' : 'blur(0)', transition: 'background 0.4s ease, backdrop-filter 0.4s ease', padding: 20 }}>
      <div style={card}>
        <div style={{ width: 56, height: 56, margin: '0 auto 14px', filter: 'drop-shadow(0 0 14px var(--gold))' }}><GAILogo size={56} /></div>

        {step === 'age' && (
          <>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 6px' }}>First, when's your birthday?</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>So I know how hard to push you on rest, and can wish you a happy birthday on the day.</p>
            <input autoFocus type="date" value={bday} onChange={(e) => setBday(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAge()} style={input} />
            {bday && ageN >= 5 && ageN <= 120 && <p style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 700, margin: '12px 0 0' }}>You're {ageN}. Got it.</p>}
            <div style={{ marginTop: 20 }}><button onClick={submitAge} style={gold}>Next →</button></div>
          </>
        )}

        {step === 'ideal' && (
          <>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 6px' }}>Your ideal sleep per day?</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>Hours. Anything past this counts as wasted, not rest.</p>
            <input autoFocus type="number" step="0.5" value={ideal} onChange={(e) => setIdeal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitIdeal()} placeholder="e.g. 5" style={input} />
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setStep('age')} style={ghost}>Back</button>
              <button onClick={submitIdeal} style={gold}>Set it →</button>
            </div>
          </>
        )}

        {step === 'challenge' && (
          <>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 23, color: 'var(--text)', margin: '0 0 10px' }}>{idealN}+ hours? Are you sure?</h2>
            <p style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.5, margin: '0 0 14px' }}>We're here to work hard and grow, not to rest. That much sleep is time your competition is spending on their dream.</p>
            <p style={{ color: 'var(--gold)', fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 22px' }}>{quote}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setStep('appreciate')} style={gold}>Cut it down</button>
              <button onClick={() => finish(idealN)} style={ghost}>Keep {idealN}h anyway</button>
            </div>
          </>
        )}

        {step === 'appreciate' && (
          <>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 23, color: 'var(--text)', margin: '0 0 8px' }}>Respect. That's the move.</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 18px' }}>Set your real target. Lower is hungrier.</p>
            <input autoFocus type="number" step="0.5" value={ideal} onChange={(e) => setIdeal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && idealN >= 1 && finish(idealN)} placeholder="e.g. 5" style={input} />
            <div style={{ marginTop: 20 }}><button onClick={() => idealN >= 1 && finish(idealN)} style={gold}>Lock it in →</button></div>
          </>
        )}
      </div>
    </div>
  )
}
