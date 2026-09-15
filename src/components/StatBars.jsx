import React, { useEffect, useState } from 'react'
import { fmtDuration } from '../lib/format.js'

export default function StatBars({ productive, wasted, done, scaleMax, doneMax, productiveMax, productiveTarget }) {
  const [pcts, setPcts] = useState([0, 0, 0])
  const max = scaleMax || Math.max(productive + wasted, 1)
  const dMax = doneMax || Math.max(done, 1)
  // productive bar fills toward its OWN target (e.g. today's scheduled total),
  // so 9h done out of 16h reads as a bar ~56% full — real progress.
  const pMax = productiveMax || max
  const targets = [
    Math.min(100, (productive / pMax) * 100),
    (wasted / max) * 100,
    (done / dMax) * 100
  ]

  useEffect(() => {
    setPcts([0, 0, 0])
    const duration = 1200
    const start = performance.now()
    const easeOut = t => 1 - Math.pow(1 - t, 3)
    const frame = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const e = easeOut(t)
      setPcts(targets.map(target => target * e))
      if (t < 1) requestAnimationFrame(frame)
    }
    const timer = setTimeout(() => requestAnimationFrame(frame), 300)
    return () => clearTimeout(timer)
  }, [productive, wasted, done])

  return (
    <div className="statbars">
      {/* The number is what you ACTUALLY worked. It used to print the target
          here instead, so the row read "20h" next to a bar that was 5% full. */}
      <Bar name="Productive" color="var(--productive)" amount={fmtDuration(productive)} sub={productiveTarget} pct={pcts[0]} />
      <Bar name="Wasted" color="var(--wasted)" amount={fmtDuration(wasted)} pct={pcts[1]} />
      <Bar name="Done" color="var(--done)" amount={`${done} ${done === 1 ? 'event' : 'events'}`} pct={pcts[2]} />
    </div>
  )
}

function Bar({ name, color, amount, sub, pct }) {
  return (
    <div className="statbar">
      <div className="row">
        <span className="name"><span className="dot" style={{ background: color }} />{name}</span>
        <span className="amt" style={{ color }}>{amount}{sub && <span className="of"> of {sub}</span>}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  )
}
