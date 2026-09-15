import React from 'react'

// Circular profile photo. Click → opens your Growth journal (photos + notes).
export default function Avatar({ photo, account, onOpen }) {
  const src = photo || account?.picture
  const initial = (account?.name || account?.email || 'K').trim()[0]?.toUpperCase()

  return (
    <button className="avatar no-drag" onClick={onOpen}>
      {src ? <img src={src} alt="profile" /> : <span className="ph">{initial}</span>}
    </button>
  )
}
