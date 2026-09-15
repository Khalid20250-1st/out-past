import React from 'react'
import Avatar from './Avatar.jsx'
import GAILogo from './GAILogo.jsx'
import KaiIcon from './KaiIcon.jsx'

// Out Past 5.0 navigation, down the left the way Claude Console runs it.
// The mark up top opens the Missionary page, the pages sit in a column, and the
// account, settings and theme live at the foot.

function Mark() {
  // Same mark as the app icon and KAI.
  return <GAILogo size={24} />
}

const I = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  planning: <><path d="M4 5h16M4 12h16M4 19h10" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>,
  content: <><rect x="2.5" y="4.5" width="19" height="14" rx="2.5" /><path d="M10 9l5 3-5 3V9z" /></>,
  lockin: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" /></>,
  grow: <><path d="M4 5h16M4 12h16M4 19h10" /></>
}
function Ic({ name }) {
  return (
    <svg className="sb-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I[name]}</svg>
  )
}

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'grow', label: 'Planning' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'content', label: 'Content' },
  { id: 'lockin', label: 'Lock In' }
]

export default function Sidebar({ tab, settingsOpen, theme = 'light', onToggleTheme, onTab, onSettings, onCoach, photo, account, onOpenMemories }) {
  const onBrand = tab === 'grow'
  const name = (account && (account.name || (account.email || '').split('@')[0])) || 'You'
  return (
    <aside className="sidebar">
      <div className="sb-drag" />
      <button className={'sb-brand no-drag' + (onBrand ? ' active' : '')} onClick={() => onTab('grow')} title="Out Past — the Missionary page">
        <Mark />
        <span className="sb-word">Out Past</span>
      </button>

      <nav className="sb-nav no-drag">
        {PAGES.map((p) => (
          <button key={p.id} className={'sb-item' + (tab === p.id ? ' active' : '')} onClick={() => onTab(p.id)}>
            <Ic name={p.id} />
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-spacer" />

      <button className="sb-item kai no-drag" onClick={onCoach} title="Ask KAI">
        <span className="sb-kai-mark"><KaiIcon size={18} /></span>
        <span>KAI</span>
      </button>

      <div className="sb-foot no-drag">
        <button className="sb-mini" onClick={onToggleTheme} title={theme === 'dark' ? 'Light' : 'Dark'}>{theme === 'dark' ? '☀' : '☾'}</button>
        <button className={"sb-mini" + (settingsOpen ? " active" : "")} onClick={onSettings} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
        <div className="sb-account">
          <Avatar photo={photo} account={account} onOpen={onOpenMemories} />
          <span className="sb-account-name" onClick={onOpenMemories}>{name}</span>
        </div>
      </div>
    </aside>
  )
}
