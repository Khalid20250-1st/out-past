import React from 'react'

// The enforcement engine (the Mac-level focus lock and site blocking) is
// intentionally NOT part of this open source build. This placeholder keeps the
// "Lock In" tab present so the rest of the app builds and runs unchanged.
export default function LockInView() {
  const wrap = {
    maxWidth: 560,
    margin: '48px auto',
    padding: '28px 30px',
    background: 'var(--card, #fff)',
    border: '1px solid var(--line, #e6e8ec)',
    borderRadius: 16,
    color: 'var(--text, #111)'
  }
  const h = { margin: '0 0 10px', fontSize: 22, fontWeight: 700 }
  const p = { margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--muted, #666)' }
  return (
    <div style={wrap}>
      <h2 style={h}>Lock In</h2>
      <p style={p}>The enforcement engine is not part of the open source build.</p>
    </div>
  )
}
