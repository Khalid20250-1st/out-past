import React, { useState } from 'react'

// Shown when not connected. Lets the user paste their Google OAuth desktop
// credentials (if not yet saved) and kick off the loopback sign-in.
export default function Login({ status, onSaveCreds, onLogin }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const needsCreds = !status?.hasCredentials

  async function handleSaveCreds(e) {
    e.preventDefault()
    setError('')
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret are required.')
      return
    }
    await onSaveCreds({ clientId, clientSecret })
  }

  async function handleLogin() {
    setBusy(true)
    setError('')
    try {
      await onLogin()
    } catch (err) {
      setError(err?.message || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="card">
     <div style={{textAlign:"center",marginBottom:"8px"}}>
          <div style={{fontFamily:"'Brush Script MT',cursive",fontSize:"52px",background:"linear-gradient(180deg,#d98a68,#a94e2e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1.2}}>Welcome</div>
          <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",letterSpacing:"2px",marginTop:"4px"}}>BY KIDUS DIGITAL GROUP</div>
        </div>
        <h1>Out Past</h1>
        <p className="lead">
          Connect Google Calendar to track how much of your 4am–11pm window you actually use.
          Pulls events from <strong>every</strong> calendar, including secondary ones like “Habbits.”
        </p>

        {needsCreds ? (
          <form onSubmit={handleSaveCreds}>
            <div className="field">
              <label>Google OAuth Client ID</label>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx.apps.googleusercontent.com"
              />
            </div>
            <div className="field">
              <label>Google OAuth Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Your Google OAuth client secret"
              />
            </div>
            <button className="btn primary" type="submit">
              Save credentials
            </button>
          </form>
        ) : (
          <button className="btn primary" onClick={handleLogin} disabled={busy}>
            {busy ? 'Waiting for browser…' : 'Connect Google Calendar'}
          </button>
        )}

        {error && <div className="error">{error}</div>}

        <div className="hint">
          <strong>First time?</strong> Create a free OAuth client:
          <ol>
            <li>
              Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud → Credentials</a>
            </li>
            <li>Enable the <em>Google Calendar API</em></li>
            <li>Create an <em>OAuth client ID</em> of type <em>Desktop app</em></li>
            <li>Add yourself as a test user on the OAuth consent screen</li>
            <li>Paste the Client ID &amp; Secret above</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
