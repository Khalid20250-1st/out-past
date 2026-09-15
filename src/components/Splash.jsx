import { useEffect, useState } from 'react'
import Goals from './Goals.jsx'

const N = 34 // number of blocks that sweep across the screen

export default function Splash({ onDone }) {
  const [heights, setHeights] = useState(Array(N).fill(0))
  const [phase, setPhase] = useState('bars') // bars -> welcome -> goals
  const [progress, setProgress] = useState(0)
  const [showSub, setShowSub] = useState(false)

  // ascending heights (in vh): lowest on the left, tallest on the right — growth
  const targets = Array.from({ length: N }, (_, i) => 18 + (i / (N - 1)) * 76)

  // raise the blocks one after another, left -> right, then move to Welcome
  useEffect(() => {
    targets.forEach((t, i) => {
      setTimeout(() => {
        setHeights((prev) => { const n = [...prev]; n[i] = t; return n })
      }, i * 42)
    })
    const to = setTimeout(() => setPhase('welcome'), N * 42 + 850)
    return () => clearTimeout(to)
  }, [])

  // handwrite "Welcome" in cursive, then hold, then go to Goals
  useEffect(() => {
    if (phase !== 'welcome') return
    const dur = 2400
    const start = performance.now()
    let raf
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(step)
      else { setShowSub(true); setTimeout(() => setPhase('goals'), 1500) }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  if (phase === 'goals') {
    try {
      const s = localStorage.getItem('grow_daily_goals')
      if (s) { const p = JSON.parse(s); if (p.date === new Date().toDateString()) { onDone(); return null } }
    } catch (e) {}
    return <Goals onDone={onDone} />
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', height: '100vh', background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {phase === 'bars' ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(2px, 0.4vw, 10px)', width: '100%', height: '100vh', padding: '0 clamp(8px, 1.5vw, 40px)', boxSizing: 'border-box' }}>
            {heights.map((h, i) => (
              <div key={i} style={{
                flex: 1,
                height: h + 'vh',
                background: 'linear-gradient(180deg, #f0b48f 0%, #d98a68 30%, #a94e2e 65%, #2e2000 100%)',
                borderRadius: 'clamp(3px, 0.5vw, 8px) clamp(3px, 0.5vw, 8px) 0 0',
                transition: 'height 0.75s cubic-bezier(0.2, 0.9, 0.2, 1)',
                boxShadow: '0 0 22px rgba(245,208,96,0.18)'
              }} />
            ))}
          </div>
        ) : (
          <>
            <svg viewBox="0 0 1000 220" width="92%" style={{ maxWidth: 1200, overflow: 'visible' }}>
              <defs>
                <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f0b48f" />
                  <stop offset="55%" stopColor="#d98a68" />
                  <stop offset="100%" stopColor="#a94e2e" />
                </linearGradient>
              </defs>
              {/* handwriting stroke reveal */}
              <text x="500" y="160" textAnchor="middle" fontFamily="'Great Vibes', cursive" fontSize="190"
                fill="none" stroke="url(#gold)" strokeWidth="2"
                style={{ strokeDasharray: 4200, strokeDashoffset: 4200 - (progress * 4200) }}>
                Welcome
              </text>
              {/* fill in gold once mostly written */}
              <text x="500" y="160" textAnchor="middle" fontFamily="'Great Vibes', cursive" fontSize="190"
                fill="url(#gold)"
                style={{ opacity: progress > 0.75 ? (progress - 0.75) / 0.25 : 0 }}>
                Welcome
              </text>
            </svg>
            <div style={{ fontSize: 'clamp(11px, 1vw, 15px)', color: 'var(--muted)', letterSpacing: 3, marginTop: 12, textTransform: 'uppercase', opacity: showSub ? 1 : 0, transition: 'opacity 0.8s ease' }}>
              by Kidus Digital Group
            </div>
          </>
        )}
      </div>
    </>
  )
}
