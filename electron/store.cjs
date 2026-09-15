// Tiny JSON-file store living in the OS user-data dir. Avoids a native dep and
// keeps tokens / settings / profile photo out of the app bundle.
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const FILE = path.join(app.getPath('userData'), 'out-past.json')

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeAll(data) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('store write failed', err)
  }
}

module.exports = {
  get(key, fallback = null) {
    const all = readAll()
    return key in all ? all[key] : fallback
  },
  set(key, value) {
    const all = readAll()
    all[key] = value
    writeAll(all)
  },
  delete(key) {
    const all = readAll()
    delete all[key]
    writeAll(all)
  }
}
