import React from 'react'
import logoUrl from '../assets/app-logo.png'

// The in-app logo is the SAME image file as the Mac app icon (src/assets/app-logo.png,
// reskinned from brand/logo.png by brand/apply.sh), so the two can never drift apart.
export default function GAILogo({ size = 32 }) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="Out Past"
      draggable={false}
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  )
}
