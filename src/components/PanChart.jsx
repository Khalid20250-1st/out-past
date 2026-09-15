import React, { useEffect, useRef, useState } from 'react'

// A pannable, now-centered chart: drag left/right through time, zoom in/out, jump back to now.
// Hover (or press-hold) a point to see that bucket's tasks and their from → to times.
export default function PanChart({ type, points, nowIndex, defaultView, rangeKey, marks, height }) {
  const n = points.length
  // view (how many buckets fit across) and center (which bucket sits mid-plot)
  // move together, so they live in ONE state. Zooming has to change both in the
  // same commit to keep the bucket under your cursor pinned where it is.
  const [vp, setVp] = useState({ view: defaultView, center: nowIndex })
  const [yZoom, setYZoom] = useState(1)
  const [hover, setHover] = useState(null)          // { i, mx, my, sx, sy, val, zone }
  const drag = useRef(null)
  const glide = useRef(null)
  const wrapRef = useRef(null)

  // Wide viewBox so at full window width the SVG scale is ~1 and the numbers render standard size.
  // Height is the viewBox height, so it sets the aspect ratio the chart renders
  // at. Home runs a shorter one so the whole page fits without scrolling.
  const W = 1900, H = height || 620, pl = 52, pr = 24, pt = 22, pb = 42, iw = W - pl - pr, ih = H - pt - pb

  function stopGlide() { if (glide.current) { cancelAnimationFrame(glide.current); glide.current = null } }
  useEffect(() => { stopGlide(); setVp({ view: defaultView, center: nowIndex }); setYZoom(1); setHover(null) }, [rangeKey, defaultView, nowIndex])
  useEffect(() => () => stopGlide(), [])

  const view = vp.view, center = vp.center
  // You may pan PAST the ends. Scrolling the last bucket away from the edge
  // leaves empty room to read into, which is the whole point of a right margin.
  const clampC = (c, v) => Math.max(-v * 0.15, Math.min(n - 1 + v * 0.45, c))
  const clampV = (v) => Math.max(4, Math.min(Math.max(8, n), v))

  const gap = iw / Math.max(1, view)
  const cx = (i) => pl + iw / 2 + (i - center) * gap
  const idxAt = (sx) => center + (sx - pl - iw / 2) / gap

  // Value axis. Auto-fits by default; dragging the axis stretches it around the
  // middle so a flat stretch can be blown up without touching time.
  const vals = points.map((p) => p.value)
  let aMax = Math.max(1, ...vals); aMax = Math.max(5, Math.ceil(aMax / 5) * 5)
  // Score can go NEGATIVE (misses subtract), so extend the axis below zero when needed.
  const minV = Math.min(0, ...vals)
  const aMin = minV < 0 ? -Math.max(5, Math.ceil(-minV / 5) * 5) : 0
  const mid = (aMax + aMin) / 2
  const half = Math.max(0.5, (aMax - aMin) / 2 / yZoom)
  const max = mid + half, min = mid - half
  const span = max - min
  const y = (v) => pt + ih * (1 - (v - min) / span)
  const valAt = (sy) => min + (1 - (sy - pt) / ih) * span
  const y0 = y(0)
  const bw = gap * 0.58
  const step = Math.max(1, Math.round(view / 20))  // dense x-axis labels, few gaps

  // Which strip is the pointer over? The two axes are their own controls.
  const zoneAt = (sx, sy) => (sy > pt + ih ? 'x' : sx < pl ? 'y' : 'plot')
  const svgPt = (e) => {
    const r = wrapRef.current.getBoundingClientRect()
    return { sx: (e.clientX - r.left) / r.width * W, sy: (e.clientY - r.top) / r.height * H, mx: e.clientX - r.left, my: e.clientY - r.top, r }
  }

  // Zoom keeps the bucket under the cursor pinned to the same pixel. Zooming
  // around the middle instead is the thing that makes a chart feel cheap.
  const zoomAt = (dir, iAnchor) => {
    stopGlide()
    setVp((s) => {
      const v2 = clampV(Math.round(s.view + dir * Math.max(1, s.view * 0.25)))
      const f = 0.5 + (iAnchor - s.center) / s.view
      return { view: v2, center: clampC(iAnchor - (f - 0.5) * v2, v2) }
    })
  }

  // Let go mid-drag and the chart keeps gliding, then eases to a stop.
  function startGlide(v0) {
    let v = v0, last = performance.now()
    const tick = (t) => {
      const dt = Math.min(48, t - last); last = t
      v *= Math.pow(0.94, dt / 16)
      if (Math.abs(v) < 0.0008) { glide.current = null; return }
      setVp((s) => ({ ...s, center: clampC(s.center + v * dt, s.view) }))
      glide.current = requestAnimationFrame(tick)
    }
    glide.current = requestAnimationFrame(tick)
  }

  const onDown = (e) => {
    stopGlide()
    const p = svgPt(e)
    drag.current = {
      zone: zoneAt(p.sx, p.sy), x: e.clientX, y: e.clientY,
      c0: center, v0: view, yz0: yZoom, right: center + view / 2,
      pxPerIdx: (p.r.width / W) * gap, moved: false,
      // Velocity is measured over a short WINDOW of recent moves, not the single
      // last one. The last event before release is often a repeat at the same
      // position, and reading only that reported zero speed and killed the glide.
      samples: [{ x: e.clientX, t: e.timeStamp }]
    }
    setHover(null)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
  }
  const onMove = (e) => {
    const p = svgPt(e)
    const d = drag.current
    if (d) {
      const dpx = e.clientX - d.x, dpy = e.clientY - d.y
      if (Math.abs(dpx) > 3 || Math.abs(dpy) > 3) d.moved = true
      if (d.zone === 'x') {
        // Squeeze or stretch TIME, anchored on the right edge so the newest
        // bucket stays put and history slides toward it.
        const v2 = clampV(d.v0 / (1 + dpx / 320))
        setVp({ view: v2, center: clampC(d.right - v2 / 2, v2) })
      } else if (d.zone === 'y') {
        // Stretch or flatten the VALUES. Time is untouched.
        setYZoom(Math.max(0.25, Math.min(8, d.yz0 * (1 + -dpy / 320))))
      } else {
        d.samples.push({ x: e.clientX, t: e.timeStamp })
        while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 110) d.samples.shift()
        setVp((s) => ({ ...s, center: clampC(d.c0 - dpx / d.pxPerIdx, s.view) }))
      }
      return
    }
    const raw = Math.round(idxAt(p.sx))
    setHover({ i: raw >= 0 && raw <= n - 1 ? raw : null, mx: p.mx, my: p.my, sx: p.sx, sy: p.sy, val: valAt(p.sy), zone: zoneAt(p.sx, p.sy) })
  }
  const onUp = (e) => {
    const d = drag.current
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) {}
    if (!d || d.zone !== 'plot' || !d.moved) return
    const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1]
    // Stop dead if you paused before letting go. Holding still then releasing
    // means you picked your spot, so flinging you off it would be wrong.
    if (e.timeStamp - s1.t > 90) return
    const dt = s1.t - s0.t
    if (dt < 8) return
    const vx = ((s1.x - s0.x) / d.pxPerIdx) / dt
    if (Math.abs(vx) > 0.002) startGlide(-vx)
  }
  const onLeave = () => { drag.current = null; setHover(null) }
  // Bound natively with passive:false so preventDefault actually works. React's
  // onWheel is registered passive, which means the wheel zoomed the chart AND
  // scrolled the page underneath it at the same time.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const h = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const sx = (e.clientX - r.left) / r.width * W
      zoomAt(e.deltaY > 0 ? 1 : -1, idxAt(sx))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  })
  const resetAll = () => { stopGlide(); setVp({ view: defaultView, center: nowIndex }); setYZoom(1) }
  const onDblClick = (e) => {
    const p = svgPt(e)
    const z = zoneAt(p.sx, p.sy)
    if (z === 'y') setYZoom(1)
    else if (z === 'x') setVp((s) => ({ view: defaultView, center: clampC(s.center, defaultView) }))
    else resetAll()
  }
  const onKeyDown = (e) => {
    const stepBy = (d) => { stopGlide(); setVp((s) => ({ ...s, center: clampC(s.center + d, s.view) })) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(e.shiftKey ? -5 : -1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(e.shiftKey ? 5 : 1) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(-1, center) }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1, center) }
    else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); resetAll() }
  }
  const cursor = drag.current
    ? (drag.current.zone === 'plot' ? 'grabbing' : drag.current.zone === 'x' ? 'ew-resize' : 'ns-resize')
    : hover && hover.zone === 'x' ? 'ew-resize'
    : hover && hover.zone === 'y' ? 'ns-resize'
    : 'crosshair'

  const grid = []
  for (let k = 0; k <= 4; k++) { const val = max - span * k / 4; const gy = y(val); const zero = Math.abs(val) < 0.01; grid.push(<g key={'g' + k}><line x1={pl} y1={gy} x2={W - pr} y2={gy} stroke={zero ? 'var(--muted)' : 'var(--line)'} strokeOpacity={zero ? 0.6 : 1} /><text x={pl - 10} y={gy + 5} fill="var(--muted)" fontSize="15" textAnchor="end">{Math.round(val)}</text></g>) }
  // Draw the score line only through today — the future has no results yet.
  // And if NOTHING has resolved in the bucket you're still in (nothing done,
  // nothing past its finish time), it has no score yet — it is pending, not
  // zero. Plotting it as 0 drew a cliff straight down from yesterday and read
  // as a crash when in fact nothing had happened. The line stops at the last
  // real result and extends the moment something actually lands.
  const cur = points[nowIndex]
  const curPending = !!cur && (cur.done || 0) === 0 && (cur.missed || 0) === 0
  const lineEnd = curPending ? Math.max(0, nowIndex - 1) : nowIndex
  const hist = points.slice(0, lineEnd + 1)
  const linePts = hist.map((p, i) => cx(i) + ',' + y(p.value)).join(' ')
  const dot = (p, i) => {
    const g = p.goal || 0
    if (g === 0 || i > lineEnd) return null        // nothing planned, pending, or future → no dot
    const done = p.done || 0
    if (done >= g) return <circle key={i} cx={cx(i)} cy={y(p.value)} r="8.5" fill="var(--done)" stroke="#0c1113" strokeWidth="2.5" />
    // The bucket you are still IN has not failed — it just isn't finished. Marking
    // it red said "came up short" about a day that still had hours left in it.
    if (i === nowIndex) return <circle key={i} cx={cx(i)} cy={y(p.value)} r="8" fill="#0c1113" stroke="var(--gold)" strokeWidth="4" />
    return <circle key={i} cx={cx(i)} cy={y(p.value)} r="8" fill="#0c1113" stroke="var(--red)" strokeWidth="4" />
  }
  const hi = hover && hover.i != null ? hover.i : null
  const hp = hi != null ? points[hi] : null
  const tipItems = hp && hp.items ? hp.items : []
  const showCross = !!hover && hover.zone === 'plot'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button onClick={resetAll} style={{ ...chartBtn, borderColor: 'var(--gold)', color: 'var(--gold)' }}>⦿ Now</button>
        <button onClick={() => zoomAt(-1, center)} title="Zoom in" style={chartBtn}>＋</button>
        <button onClick={() => zoomAt(1, center)} title="Zoom out" style={chartBtn}>－</button>
      </div>
      <div ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} onDoubleClick={onDblClick} style={{ position: 'relative', cursor, touchAction: 'none', userSelect: 'none', outline: 'none' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d98a68" /><stop offset="100%" stopColor="#a94e2e" /></linearGradient>
            <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(245,208,96,0.26)" /><stop offset="100%" stopColor="rgba(245,208,96,0)" /></linearGradient>
            <clipPath id="plot"><rect x={pl} y="0" width={iw} height={H} /></clipPath>
          </defs>
          {grid}
          <g clipPath="url(#plot)">
            {/* Mission boundaries. The line runs straight through them on
                purpose: a new mission continues your record, it does not
                restart it. The marker only says where one handed over. */}
            {(marks || []).map((mk, k) => (
              <g key={'mk' + k}>
                <line x1={cx(mk.i)} y1={pt} x2={cx(mk.i)} y2={pt + ih} stroke="var(--teal)" strokeWidth="2" strokeOpacity="0.55" strokeDasharray="3 7" />
                <text x={cx(mk.i) + 7} y={pt + ih - 8} fill="var(--teal)" fontSize="14" fontWeight="700" opacity="0.9">{mk.label}</text>
              </g>
            ))}
            {/* now marker */}
            <line x1={cx(nowIndex)} y1={pt} x2={cx(nowIndex)} y2={pt + ih} stroke="var(--gold)" strokeWidth="3" strokeDasharray="7 6" strokeOpacity="0.8" />
            <text x={cx(nowIndex)} y={pt + 16} fill="var(--gold)" fontSize="15" fontWeight="700" textAnchor="middle">now</text>
            {/* crosshair: the vertical arm SNAPS to the nearest bucket, the
                horizontal arm is free and follows the pixel, same as a real chart */}
            {showCross && hi != null && <line x1={cx(hi)} y1={pt} x2={cx(hi)} y2={pt + ih} stroke="var(--text)" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="6 5" />}
            {showCross && <line x1={pl} y1={hover.sy} x2={W - pr} y2={hover.sy} stroke="var(--text)" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="6 5" />}
            {type === 'bar'
              ? points.map((p, i) => { const vy = y(p.value); const top = Math.min(vy, y0); return (
                  <rect key={i} x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(0, Math.abs(vy - y0))} rx="6" fill={p.value < 0 ? 'var(--red)' : 'url(#gg)'} opacity={hi === i ? 1 : 0.92} />
                ) })
              : <>
                  <polygon points={`${cx(0)},${y0} ${linePts} ${cx(lineEnd)},${y0}`} fill="url(#ga)" />
                  <polyline points={linePts} fill="none" stroke="#d98a68" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p, i) => dot(p, i))}
                  {showCross && hi != null && <circle cx={cx(hi)} cy={y(points[hi].value)} r="7" fill="var(--text)" />}
                </>}
            {points.map((p, i) => i % step === 0 ? <text key={'l' + i} x={cx(i)} y={H - 12} fill="var(--muted)" fontSize="14" textAnchor="middle">{p.label}</text> : null)}
          </g>
          {/* Crosshair readouts, drawn on the axis strips outside the clip. */}
          {showCross && (
            <g>
              <rect x={2} y={hover.sy - 15} width={pl - 6} height={30} rx="6" fill="var(--gold)" />
              <text x={pl - 9} y={hover.sy + 6} fill="var(--on-gold)" fontSize="15" fontWeight="800" textAnchor="end">{Math.round(hover.val)}</text>
              {hi != null && <>
                <rect x={cx(hi) - 58} y={H - pb + 4} width={116} height={28} rx="6" fill="var(--gold)" />
                <text x={cx(hi)} y={H - pb + 24} fill="var(--on-gold)" fontSize="15" fontWeight="800" textAnchor="middle">{points[hi].label}</text>
              </>}
            </g>
          )}
        </svg>
        {hp && showCross && (
          <div style={{ position: 'absolute', left: Math.min(Math.max(8, hover.mx + 14), (wrapRef.current ? wrapRef.current.clientWidth : 600) - 268), top: Math.max(6, hover.my - 10), width: 254, background: 'var(--panel)', border: '1px solid var(--gold)', borderRadius: 12, padding: '10px 12px', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 5 }}>
            <div style={{ fontWeight: 900, fontSize: 13.5, marginBottom: 2 }}>{hp.header || hp.label}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: tipItems.length ? 8 : 0 }}>{hp.goal ? `${hp.done || 0} of ${hp.goal} done · ${(hp.delta != null ? hp.delta : hp.value) > 0 ? '+' : ''}${hp.delta != null ? hp.delta : hp.value} here · running ${hp.value}` : 'nothing planned'}</div>
            {tipItems.slice(0, 8).map((it, k) => (
              <div key={k} style={{ display: 'flex', gap: 7, alignItems: 'baseline', marginTop: 5 }}>
                <span style={{ color: it.done ? 'var(--done)' : 'var(--muted)', fontSize: 12, flexShrink: 0 }}>{it.done ? '✓' : '○'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: it.done ? 'var(--muted)' : 'var(--text)', textDecoration: it.done ? 'line-through' : 'none' }}>{it.text}</span>
                  <span className="muted" style={{ fontSize: 11, display: 'block' }}>{it.when}</span>
                </span>
              </div>
            ))}
            {tipItems.length > 8 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>+{tipItems.length - 8} more</div>}
          </div>
        )}
      </div>
    </div>
  )
}
export const chartBtn = { background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 9, padding: '5px 11px', fontWeight: 800, fontSize: 13, cursor: 'pointer', lineHeight: 1 }
