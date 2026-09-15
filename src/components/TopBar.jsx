import React from 'react'
import Clock from './Clock.jsx'
import Avatar from './Avatar.jsx'
import GAILogo from './GAILogo.jsx'
import { fmtRelative } from '../lib/format.js'

// Out Past 5.0 menu. One quiet row: the mark opens the Missionary page, the
// five pages sit in the middle, and the day-to-day controls sit on the right.
// Home carries the time. Planning carries the plan. Nothing shouts.

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'planning', label: 'Planning' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'content', label: 'Content' },
  { id: 'lockin', label: 'Lock In' }
]

function Mark() {
  // Same mark as the app icon and KAI.
  return <GAILogo size={26} />
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export default function TopBar({ tab, streak = 0, theme = 'light', onToggleTheme, onTab, onRefresh, refreshing, syncError, onReconnect, lastSync, photo, account, onPhoto, onSettings, onCoach, onOpenMemories }) {
  const onMission = tab === 'grow'
  return (
    <div className="topbar">
      <button
        className="brand no-drag"
        onClick={() => onTab('grow')}
        title="Out Past — the Missionary page"
        aria-current={onMission ? 'page' : undefined}
      >
        <Mark />
        <span className="wordmark">Out Past</span>
      </button>

      <nav className="nav no-drag">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={'nav-item' + (tab === p.id ? ' active' : '')}
            onClick={() => onTab(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div className="right no-drag">
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
        <button className="icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Light' : 'Dark'}>{theme === 'dark' ? '☀' : '☾'}</button>
        <button className="icon-btn" onClick={onSettings} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
        <button onClick={onCoach} title="KAI" className="gai-btn"><GAILogo size={38} /></button>
        <Avatar photo={photo} account={account} onOpen={onOpenMemories} />
      </div>
    </div>
  )
}
