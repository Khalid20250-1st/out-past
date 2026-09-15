import { useEffect, useState } from 'react'

function Ring({ pct, color, label, value, size = 110 }) {
  const [animPct, setAnimPct] = useState(0)
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * Math.min(animPct, 100) / 100)

  useEffect(() => {
    setAnimPct(0)
    const duration = 1400
    const start = performance.now()
    const easeOut = t => 1 - Math.pow(1 - t, 3)
    const frame = (now) => {
      const t = Math.min((now - start) / duration, 1)
      setAnimPct(pct * easeOut(t))
      if (t < 1) requestAnimationFrame(frame)
    }
    const timer = setTimeout(() => requestAnimationFrame(frame), 200)
    return () => clearTimeout(timer)
  }, [pct])

  return (
    <div className="ring-wrap" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="9"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <div style={{ color:'var(--text)', fontFamily:"var(--display)", fontWeight:800, letterSpacing:'-1px', fontSize: size > 100 ? 26 : 18 }}>{Math.round(animPct)}%</div>
          <div style={{ color:'var(--muted-2)', fontSize:11, fontWeight:600 }}>{value}</div>
        </div>
      </div>
      <div style={{ color:'var(--muted)', fontFamily:"var(--display)", fontWeight:700, fontSize:11, letterSpacing:'2px', marginTop:8 }}>{label.toUpperCase()}</div>
    </div>
  )
}

export default function Rings({ donePct, wastedPct, doneValue, wastedValue, size }) {
  return (
    <div className="rings">
      <Ring pct={donePct} color="var(--done)" label="Done" value={doneValue} size={size} />
      <Ring pct={wastedPct} color="var(--wasted)" label="Wasted" value={wastedValue} size={size} />
    </div>
  )
}
