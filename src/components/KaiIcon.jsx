import React from 'react'

// KAI as a chat icon: a clay speech bubble with the white |>_<| face inside.
// The app brand stays the square tile (GAILogo); KAI reads as someone to talk to.
export default function KaiIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <path
        d="M20 8 h60 a16 16 0 0 1 16 16 v34 a16 16 0 0 1 -16 16 h-33 l-20 16 v-16 h-7 a16 16 0 0 1 -16 -16 v-34 a16 16 0 0 1 16 -16 z"
        fill="var(--clay)"
      />
      <g fill="var(--on-clay)" transform="translate(27,9) scale(0.045)">
        <rect x="154" y="366" width="41" height="277" />
        <polygon points="202,429 202,647 427,538" />
        <polygon points="821,433 821,643 595,538" />
        <rect x="829" y="366" width="41" height="277" />
        <rect x="412" y="670" width="200" height="26" />
      </g>
    </svg>
  )
}
