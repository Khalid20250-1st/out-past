import React from 'react'

// KAI's "thinking" animation — the logo comes alive: the outer ring slowly
// spins, its six nodes pulse in sequence like a train of thought lighting up,
// the core breathes, and a soft glow swells. Use it anywhere KAI is working
// (regenerating content, loading). Zero deps, pure SVG + CSS.
export default function GAIThinking({ size = 84, label = 'Wait a moment…' }) {
  const nodes = [
    { x: 200, y: 95 }, { x: 295, y: 148 }, { x: 295, y: 252 },
    { x: 200, y: 305 }, { x: 105, y: 252 }, { x: 105, y: 148 }
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <style>{`
        @keyframes gai-spin { to { transform: rotate(360deg) } }
        @keyframes gai-core { 0%,100% { transform: scale(1); opacity: 0.9 } 50% { transform: scale(1.28); opacity: 1 } }
        @keyframes gai-node { 0%,100% { opacity: 0.25; transform: scale(0.8) } 50% { opacity: 1; transform: scale(1.35) } }
        @keyframes gai-glow { 0%,100% { opacity: 0.35 } 50% { opacity: 0.9 } }
        @keyframes gai-dots { 0%,20% { opacity: 0.2 } 50% { opacity: 1 } 80%,100% { opacity: 0.2 } }
        .gai-ring  { transform-origin: 200px 200px; animation: gai-spin 9s linear infinite }
        .gai-core  { transform-origin: 200px 200px; animation: gai-core 1.8s ease-in-out infinite }
        .gai-glow  { transform-origin: 200px 200px; animation: gai-glow 2.2s ease-in-out infinite }
        .gai-node  { transform-origin: center; transform-box: fill-box; animation: gai-node 1.6s ease-in-out infinite }
        .gai-dot   { animation: gai-dots 1.4s ease-in-out infinite }
      `}</style>
      <svg viewBox="0 0 400 400" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 18px rgba(245,208,96,0.45))' }}>
        <defs>
          <radialGradient id="gait-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a0800" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <linearGradient id="gait-g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d98a68" />
            <stop offset="100%" stopColor="#a94e2e" />
          </linearGradient>
          <filter id="gait-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx="200" cy="200" r="195" fill="url(#gait-bg)" />
        <circle className="gai-glow" cx="200" cy="200" r="150" fill="none" stroke="#d98a68" strokeWidth="1.5" opacity="0.4" />

        {/* spinning ring of nodes + their spokes */}
        <g className="gai-ring">
          {nodes.map((n, i) => (
            <line key={'l' + i} x1="200" y1="200" x2={n.x} y2={n.y} stroke="url(#gait-g1)" strokeWidth="1.5" opacity="0.4" />
          ))}
          {nodes.map((n, i) => (
            <circle key={'n' + i} className="gai-node" cx={n.x} cy={n.y} r="11" fill="url(#gait-g1)" filter="url(#gait-glow)"
              style={{ animationDelay: `${(i * 1.6) / 6}s` }} />
          ))}
        </g>

        {/* breathing core */}
        <g className="gai-core">
          <circle cx="200" cy="200" r="20" fill="url(#gait-g1)" filter="url(#gait-glow)" opacity="0.95" />
          <circle cx="200" cy="200" r="10" fill="#000" opacity="0.5" />
          <circle cx="200" cy="200" r="5" fill="#d98a68" />
        </g>
      </svg>

      {label && (
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, color: 'var(--gold)', letterSpacing: 0.3, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {label}
          <span className="gai-dot" style={{ animationDelay: '0s' }}>.</span>
          <span className="gai-dot" style={{ animationDelay: '0.2s' }}>.</span>
          <span className="gai-dot" style={{ animationDelay: '0.4s' }}>.</span>
        </div>
      )}
    </div>
  )
}
