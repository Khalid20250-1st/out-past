import React, { useEffect, useState } from 'react'

// Red 12-hour clock in US Eastern Time.
export default function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const text = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  return (
    <div className="clock no-drag" title="Eastern Time">
      {text}
      <span className="zone">ET</span>
    </div>
  )
}
