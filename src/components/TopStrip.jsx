import React from 'react'
import Clock from './Clock.jsx'
import { fmtRelative } from '../lib/format.js'

// A quiet strip across the top of the page. The greeting on the left, the live
// state on the right: streak, clock, sync, refresh. Nothing that competes with
// the page under it.

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export default function TopStrip({ streak = 0, onRefresh, refreshing, syncError, onReconnect, lastSync }) {
  return (
    <header className="topstrip">
      <div className="ts-drag" />
      <div className="ts-right no-drag">
        <div className={`streak ${streak > 0 ? '' : 'dead'}`} title={streak > 0 ? `${streak} day streak` : 'No streak yet'}>
          <span className="fire">{streak > 0 ? '🔥' : '🕯'}</span>{streak}
        </div>
        <Clock />
        {refreshing ? (
          <span className="sync-note">syncing…</span>
        ) : syncError ? (
          <button className="reconnect" onClick={onReconnect} title="Google session expired">Reconnect →</button>
        ) : (
          <span className="sync-note">synced {fmtRelative(lastSync)}</span>
        )}
        <button className={`icon-btn ${refreshing ? 'spin' : ''}`} onClick={onRefresh} title="Refresh now" disabled={refreshing}><RefreshIcon /></button>
      </div>
    </header>
  )
}
