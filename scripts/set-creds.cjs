#!/usr/bin/env node
// Store Google OAuth credentials into the app's local data file without
// launching the app. Writes to the same file the Electron app reads.
//
//   node scripts/set-creds.cjs <CLIENT_ID> <CLIENT_SECRET>
//
// The data dir matches Electron's app.getPath('userData') for this app name.
const fs = require('fs')
const path = require('path')
const os = require('os')

const APP_NAME = 'Out Past'

function userDataDir() {
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME)
  if (process.platform === 'win32')
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME)
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME)
}

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/set-creds.cjs <CLIENT_ID> <CLIENT_SECRET>')
  process.exit(1)
}

const file = path.join(userDataDir(), 'out-past.json')
let data = {}
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch {
  /* first run — file doesn't exist yet */
}
data.credentials = { clientId: clientId.trim(), clientSecret: clientSecret.trim() }
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
console.log('✓ Credentials saved to', file)
console.log('  Launch the app and click "Connect Google Calendar".')
