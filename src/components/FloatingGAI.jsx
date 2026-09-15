import React from 'react'
import Coach from './Coach.jsx'
import KaiIcon from './KaiIcon.jsx'

// KAI as a floating chat, like KAI on the KDG site. The GAILogo sits in the
// bottom-right corner. Tap it and the chat pops up over whatever you're on,
// tap again (or the x inside) and it tucks back to just the button.
export default function FloatingGAI({ open, onToggle, ...coachProps }) {
  return (
    <>
      {open && (
        <div style={{
          position: 'fixed', right: 24, bottom: 96, zIndex: 11000,
          width: 'min(390px, 94vw)', height: 'min(620px, 74vh)',
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 30px 90px -20px rgba(0,0,0,0.7), 0 0 40px rgba(245,208,96,0.10)'
        }}>
          <Coach onClose={onToggle} {...coachProps} />
        </div>
      )}
      <button onClick={onToggle} title="KAI" aria-label="Open KAI" style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 11001,
        width: 62, height: 62, borderRadius: '50%', border: 'none',
        background: 'transparent', padding: 0, cursor: 'pointer',
        filter: 'drop-shadow(0 8px 20px rgba(245,208,96,0.4))'
      }}>
        <KaiIcon size={62} />
      </button>
    </>
  )
}
