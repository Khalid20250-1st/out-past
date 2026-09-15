// TB — Task Brain
//
// You type a task the way you'd say it out loud and the time fills itself in.
//
//   pray from 5am to 6am              -> 5:00 AM to 6:00 AM · 1h
//   gym at 7pm for 90 min             -> 7:00 PM to 8:30 PM · 1h 30m
//   work 9pm to 2am                   -> 9:00 PM to 2:00 AM · 5h (into tomorrow)
//   pray sometime after fajr for an hour
//
// Two layers, both free, both offline, both instant:
//
//   FTB  the explicit stuff. Clock times and durations. Straight arithmetic.
//   FPTB the language. Anchors (fajr, lunch, bed), relations (after, before),
//        repeats, and the words that carry no math at all (sometime, about,
//        roughly) which get deleted before anything else runs.
//
// TB never guesses its way into your row. It needs you to actually start a
// time: a clock ("at 7am"), a range ("5 to 6"), a length ("for an hour"), or a
// relation on an anchor ("after lunch"). A sentence with none of those is just
// a task and TB leaves it alone. An anchor word sitting on its own is not
// enough — that is how "design deep down" once became 3:53 AM, because "down"
// is one letter from "dawn".
//
// That last part is the whole trick. "pray sometime after fajr for about an
// hour" only looks hard because of `sometime` and `about`. Delete them and
// you're left with "pray after fajr for an hour", which is arithmetic.
//
// There is no paid tier and no network call. A sentence TB cannot read is a
// word it has not been taught, so it gets logged (see tbMisses) and the fix is
// one line in a dictionary here, not an API bill.

const DAY = 1440
const clampDay = (m) => ((Math.round(m) % DAY) + DAY) % DAY

// ---------------------------------------------------------------- dictionaries

// Words that carry no math. Deleting them is what makes the rest simple.
const NOISE = [
  'sometime', 'sometimes', 'some time', 'about', 'around', 'roughly', 'approximately',
  'maybe', 'like', 'ish', 'or so', 'please', 'i want to', 'i need to', 'i have to',
  'i wanna', 'wanna', 'gonna', 'lets', "let's", 'need to', 'want to', 'got to', 'gotta'
]

// Anchors with a fixed clock time. These are yours, not astronomy — a default
// that holds until you move it.
const CLOCK_ANCHORS = {
  midnight: 0, wake: 7 * 60, breakfast: 8 * 60, morning: 9 * 60, noon: 12 * 60,
  lunch: 13 * 60, afternoon: 15 * 60, evening: 19 * 60, dinner: 19 * 60,
  supper: 19 * 60, night: 21 * 60, bed: 23 * 60, bedtime: 23 * 60
}

// Anchors that move with the sun and the date. Solar math, computed below —
// hardcoding fajr to 4am would be wrong for most of the year.
const SUN_ANCHORS = ['fajr', 'sunrise', 'dhuhr', 'duhr', 'asr', 'maghrib', 'sunset', 'isha', 'dawn', 'dusk']

const RELATIONS = ['after', 'before', 'at', 'from', 'by', 'post', 'following', 'until', 'till']

const DAY_NAMES = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
const DAY_SHORT = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, quarter: 0.25
}

// ---------------------------------------------------------------- fuzzy match

// You type fast and you misspell. `aftr`, `sunsett`, `mondya` should all land.
// Distance is capped by word length so short words can't collide with each other.
function editDistance(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 9
  const prev = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}
function nearest(word, keys) {
  if (keys.includes(word)) return word
  const budget = word.length <= 3 ? 0 : word.length <= 6 ? 1 : 2
  if (!budget) return null
  let best = null, bestD = budget + 1
  keys.forEach((k) => { const d = editDistance(word, k); if (d < bestD) { bestD = d; best = k } })
  return best
}

// ---------------------------------------------------------------- solar math

// Prayer and sun times from latitude, longitude and the date. Offline, no API,
// correct every day of the year. Fajr in your city runs from about 3:30am in
// June to about 6:00am in December — a constant would be wrong half the time.
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

function solar(date, lat, lon) {
  const start = new Date(date.getFullYear(), 0, 0)
  const doy = Math.floor((date - start) / 864e5)
  const g = rad((360 / 365.25) * (doy + 10))
  // Declination and the equation of time, standard low-precision formulas.
  const decl = -rad(23.44) * Math.cos(g)
  const B = rad((360 / 365) * (doy - 81))
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)   // minutes
  // Local solar noon in local clock minutes.
  const tzMin = -date.getTimezoneOffset()
  const noon = 720 - 4 * lon - eot + tzMin
  // Minutes from noon to the moment the sun sits at altitude `alt`.
  const offsetFor = (alt) => {
    const cosH = (Math.sin(rad(alt)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl))
    if (cosH > 1 || cosH < -1) return null   // sun never reaches that altitude today
    return 4 * deg(Math.acos(cosH))
  }
  const sunAlt = -0.833   // refraction plus the sun's own disc
  const h0 = offsetFor(sunAlt)
  const hFajr = offsetFor(-18)     // Muslim World League
  const hIsha = offsetFor(-17)
  // Asr: the sun's altitude when a shadow equals the object plus its noon shadow.
  const noonAlt = 90 - Math.abs(deg(decl) - lat)
  const asrAlt = deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(90 - noonAlt))))))
  const hAsr = offsetFor(asrAlt)
  const at = (h, sign) => (h == null ? null : clampDay(noon + sign * h))
  return {
    fajr: at(hFajr, -1), dawn: at(hFajr, -1),
    sunrise: at(h0, -1),
    dhuhr: clampDay(noon), duhr: clampDay(noon),
    asr: at(hAsr, 1),
    sunset: at(h0, 1), maghrib: at(h0, 1), dusk: at(h0, 1),
    isha: at(hIsha, 1)
  }
}

// Where you are, taken from your system timezone. IANA zone names are city
// names, so this lands within a few minutes for prayer and sun times and costs
// nothing: no permission prompt, no popup, no network, no setting to fill in.
const TZ_COORDS = {
  'America/Toronto': [43.65, -79.38], 'America/Montreal': [45.50, -73.57],
  'America/New_York': [40.71, -74.01], 'America/Detroit': [42.33, -83.05],
  'America/Chicago': [41.88, -87.63], 'America/Winnipeg': [49.90, -97.14],
  'America/Denver': [39.74, -104.99], 'America/Edmonton': [53.55, -113.49],
  'America/Phoenix': [33.45, -112.07], 'America/Boise': [43.62, -116.20],
  'America/Los_Angeles': [34.05, -118.24], 'America/Vancouver': [49.28, -123.12],
  'America/Halifax': [44.65, -63.58], 'America/St_Johns': [47.56, -52.71],
  'America/Regina': [50.45, -104.62], 'America/Anchorage': [61.22, -149.90],
  'America/Indiana/Indianapolis': [39.77, -86.16], 'America/Kentucky/Louisville': [38.25, -85.76],
  'Pacific/Honolulu': [21.31, -157.86],
  'America/Mexico_City': [19.43, -99.13], 'America/Guatemala': [14.63, -90.51],
  'America/Costa_Rica': [9.93, -84.08], 'America/Panama': [8.98, -79.52],
  'America/Havana': [23.11, -82.37], 'America/Puerto_Rico': [18.47, -66.11],
  'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04],
  'America/Santiago': [-33.45, -70.67], 'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.60, -58.38], 'America/Buenos_Aires': [-34.60, -58.38],

  'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26],
  'Europe/Lisbon': [38.72, -9.14], 'Europe/Madrid': [40.42, -3.70],
  'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35],
  'Europe/Amsterdam': [52.37, 4.90], 'Europe/Berlin': [52.52, 13.40],
  'Europe/Zurich': [47.38, 8.54], 'Europe/Vienna': [48.21, 16.37],
  'Europe/Rome': [41.90, 12.50], 'Europe/Prague': [50.08, 14.44],
  'Europe/Warsaw': [52.23, 21.01], 'Europe/Stockholm': [59.33, 18.07],
  'Europe/Oslo': [59.91, 10.75], 'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Helsinki': [60.17, 24.94], 'Europe/Athens': [37.98, 23.73],
  'Europe/Bucharest': [44.43, 26.10], 'Europe/Budapest': [47.50, 19.04],
  'Europe/Kyiv': [50.45, 30.52], 'Europe/Kiev': [50.45, 30.52],
  'Europe/Moscow': [55.76, 37.62], 'Europe/Istanbul': [41.01, 28.98],

  'Africa/Addis_Ababa': [9.03, 38.74], 'Africa/Nairobi': [-1.29, 36.82],
  'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38],
  'Africa/Accra': [5.60, -0.19], 'Africa/Johannesburg': [-26.20, 28.05],
  'Africa/Casablanca': [33.57, -7.59], 'Africa/Algiers': [36.75, 3.06],
  'Africa/Tunis': [36.81, 10.18], 'Africa/Khartoum': [15.50, 32.56],
  'Africa/Dar_es_Salaam': [-6.79, 39.21], 'Africa/Kampala': [0.35, 32.58],
  'Africa/Mogadishu': [2.05, 45.32], 'Africa/Djibouti': [11.59, 43.15],
  'Africa/Asmara': [15.32, 38.93], 'Africa/Tripoli': [32.89, 13.19],
  'Africa/Kinshasa': [-4.44, 15.27], 'Africa/Abidjan': [5.36, -4.01],
  'Africa/Dakar': [14.72, -17.47],

  'Asia/Riyadh': [24.71, 46.68], 'Asia/Dubai': [25.20, 55.27],
  'Asia/Qatar': [25.29, 51.53], 'Asia/Kuwait': [29.38, 47.99],
  'Asia/Baghdad': [33.32, 44.36], 'Asia/Tehran': [35.69, 51.39],
  'Asia/Jerusalem': [31.77, 35.21], 'Asia/Amman': [31.95, 35.93],
  'Asia/Beirut': [33.89, 35.50], 'Asia/Damascus': [33.51, 36.29],
  'Asia/Kabul': [34.53, 69.17], 'Asia/Karachi': [24.86, 67.01],
  'Asia/Kolkata': [22.57, 88.36], 'Asia/Calcutta': [22.57, 88.36],
  'Asia/Dhaka': [23.81, 90.41], 'Asia/Colombo': [6.93, 79.86],
  'Asia/Kathmandu': [27.72, 85.32], 'Asia/Bangkok': [13.76, 100.50],
  'Asia/Jakarta': [-6.21, 106.85], 'Asia/Kuala_Lumpur': [3.14, 101.69],
  'Asia/Singapore': [1.35, 103.82], 'Asia/Manila': [14.60, 120.98],
  'Asia/Ho_Chi_Minh': [10.82, 106.63], 'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Shanghai': [31.23, 121.47], 'Asia/Taipei': [25.03, 121.57],
  'Asia/Seoul': [37.57, 126.98], 'Asia/Tokyo': [35.68, 139.65],
  'Asia/Almaty': [43.24, 76.89], 'Asia/Tashkent': [41.30, 69.24],
  'Asia/Baku': [40.41, 49.87], 'Asia/Tbilisi': [41.72, 44.79],
  'Asia/Yerevan': [40.18, 44.51],

  'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Brisbane': [-27.47, 153.03], 'Australia/Perth': [-31.95, 115.86],
  'Australia/Adelaide': [-34.93, 138.60], 'Pacific/Auckland': [-36.85, 174.76],
  'Pacific/Fiji': [-18.14, 178.44],

  'US/Eastern': [40.71, -74.01], 'US/Central': [41.88, -87.63],
  'US/Mountain': [39.74, -104.99], 'US/Pacific': [34.05, -118.24],
  'Canada/Eastern': [43.65, -79.38], 'Canada/Pacific': [49.28, -123.12]
}

export function tbLocation() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const c = TZ_COORDS[tz]
    return c ? { lat: c[0], lon: c[1], tz } : null
  } catch (e) { return null }
}

// ---------------------------------------------------------------- misses

// Every sentence TB could not read, kept raw. This is the whole roadmap: read
// the list, add the missing words. It is never sent anywhere.
const MISS_KEY = 'grow_tb_misses'
export function tbMisses() { try { return JSON.parse(localStorage.getItem(MISS_KEY) || '[]') } catch (e) { return [] } }
function logMiss(raw, reason) {
  try {
    const list = tbMisses()
    list.push({ raw, reason, at: new Date().toISOString() })
    localStorage.setItem(MISS_KEY, JSON.stringify(list.slice(-200)))
  } catch (e) {}
}


// ------------------------------------------------------- how long things take
//
// You said one time and nothing else, so TB works out the length from the word
// itself. "wake up at 4" is a moment, not an hour. "meeting at 7" is half an
// hour. A duration you state out loud always beats this table.
//
// Anything not in here is one minute. That is deliberate: an invented hour
// quietly eats your day and lies to your wasted number, a one minute block
// doesn't. If a word you use is missing, add it to a bucket below.
const DURATION_BUCKETS = [
  // A moment. Nothing to sit down for.
  [1, ['wake up', 'wake', 'get up', 'wakeup', 'alarm', 'set alarm', 'snooze', 'weigh', 'weigh in',
    'weight', 'vitamins', 'vitamin', 'supplement', 'supplements', 'pill', 'pills', 'meds', 'medicine',
    'brush teeth', 'brush', 'floss', 'deodorant', 'sunscreen', 'drink water', 'water', 'hydrate',
    'log', 'log it', 'check in', 'checkin', 'tick', 'mark', 'note', 'jot', 'remind', 'reminder',
    'ping', 'text', 'dm', 'message', 'send', 'submit', 'pay', 'transfer', 'confirm', 'rsvp', 'sign',
    'subscribe', 'unsubscribe', 'cancel', 'renew', 'top up', 'refill', 'lock', 'unlock', 'backup',
    'push', 'commit', 'deploy', 'restart', 'reboot', 'charge', 'plug in', 'feed', 'take out trash',
    'trash', 'bins', 'lights out', 'turn off', 'turn on', 'screenshot', 'save', 'bookmark', 'star',
    'flag', 'archive', 'delete', 'unfollow', 'mute', 'dua', 'salam', 'greet', 'stand up', 'glance',
    'skim', 'scan', 'weigh myself', 'take pill', 'open', 'close', 'clock in', 'clock out', 'punch in']],

  // Quick. In and out.
  [15, ['shower', 'bath', 'wash up', 'wash', 'coffee', 'tea', 'snack', 'protein shake', 'shake',
    'stretch', 'stretching', 'foam roll', 'warm up', 'warmup', 'cool down', 'cooldown', 'journal',
    'journaling', 'plan the day', 'tidy', 'tidy up', 'make bed', 'get dressed', 'dress', 'shave',
    'skincare', 'meditate', 'meditation', 'breathwork', 'breathing', 'pray', 'prayer', 'praying',
    'salah', 'salat', 'namaz', 'dhikr', 'quran', 'flashcards', 'vocab', 'standup', 'check email',
    'inbox', 'post', 'posting', 'upload', 'caption', 'thumbnail', 'comment', 'comments', 'engage',
    'replies', 'ice bath', 'cold plunge', 'cold shower', 'sauna', 'walk', 'quick walk', 'invoice',
    'receipts', 'expenses', 'stretch out', 'wudu', 'ablution', 'affirmations', 'gratitude',
    'visualize', 'weigh food', 'pack', 'unpack', 'water plants', 'feed the dog']],

  // Half an hour. The default shape of a normal thing.
  [30, ['meeting', 'meet', 'call', 'phone call', 'zoom', 'huddle', 'sync', 'one on one', '1:1',
    'interview', 'consult', 'consultation', 'appointment', 'checkup', 'doctor', 'dentist',
    'eat', 'eating', 'meal', 'breakfast', 'lunch', 'dinner', 'supper', 'brunch', 'cook', 'cooking',
    'meal prep', 'prep', 'groceries', 'grocery', 'shop', 'shopping', 'errand', 'errands', 'commute',
    'drive', 'ride', 'reply', 'respond', 'email', 'emails', 'admin', 'paperwork', 'bills', 'banking',
    'budget', 'read', 'reading', 'read a book', 'notes', 'review', 'recap', 'debrief', 'retro',
    'brief', 'briefing', 'demo', 'plan', 'planning', 'brainstorm', 'outline', 'draft', 'script',
    'research', 'learn', 'lesson', 'tutorial', 'podcast', 'listen', 'audiobook', 'walk the dog',
    'dog walk', 'laundry', 'vacuum', 'dishes', 'chores', 'clean', 'organize', 'sort', 'file',
    'update', 'test', 'qa', 'follow up', 'followup', 'outreach', 'cold call', 'sales call', 'dms',
    'network', 'coffee chat', 'catch up', 'catchup', 'cardio', 'jog', 'physio', 'stand up meeting',
    'check the numbers', 'numbers', 'analytics', 'stats', 'report', 'invoice clients', 'quote',
    'proposal', 'onboard', 'reply to comments', 'engage with comments', 'schedule posts']],

  // An hour. Real work, real training, real sitting down.
  [60, ['gym', 'workout', 'work out', 'training', 'train', 'lift', 'lifting', 'weights', 'run',
    'running', 'cycling', 'cycle', 'swim', 'swimming', 'yoga', 'pilates', 'boxing', 'sport',
    'football', 'soccer', 'basketball', 'tennis', 'class', 'lecture', 'seminar', 'course', 'study',
    'studying', 'revision', 'revise', 'exam', 'homework', 'assignment', 'project', 'deep work',
    'focus', 'focus block', 'lock in', 'code', 'coding', 'program', 'programming', 'build',
    'develop', 'dev', 'implement', 'refactor', 'ship', 'feature', 'debug', 'write', 'writing',
    'blog', 'article', 'essay', 'book', 'chapter', 'design', 'mockup', 'wireframe', 'prototype',
    'edit', 'editing', 'film', 'filming', 'shoot', 'shooting', 'record', 'recording', 'produce',
    'mix', 'master', 'render', 'export', 'photoshoot', 'content', 'create', 'market', 'marketing',
    'campaign', 'strategy', 'workshop', 'therapy', 'coaching', 'mentor', 'tutor', 'tutoring',
    'practice', 'rehearse', 'rehearsal', 'game', 'gaming', 'watch', 'movie', 'series', 'episode',
    'church', 'mosque', 'jummah', 'jumuah', 'khutbah', 'halaqa', 'sermon', 'volunteer',
    'deep clean', 'repair', 'fix', 'diy', 'garden', 'gardening', 'nap', 'rest', 'relax', 'unwind',
    'hangout', 'hang out', 'date', 'client work', 'build the app', 'ship the feature']]
]

// Some words settle a bare hour on their own. "wake up at 4" is the morning
// and "dinner at 7" is the evening, whatever the clock-lean rule would guess.
const AM_WORDS = ['wake up', 'wake', 'get up', 'wakeup', 'alarm', 'breakfast', 'fajr', 'sunrise', 'morning', 'brunch', 'dawn', 'sunrise walk']
const PM_WORDS = ['dinner', 'supper', 'bed', 'bedtime', 'evening', 'tonight', 'night', 'sunset', 'maghrib', 'isha', 'movie', 'after work']
function wordLean(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' '
  const has = (list) => list.some((w) => t.includes(' ' + w + ' ') || t.includes(' ' + w))
  if (has(AM_WORDS)) return 'am'
  if (has(PM_WORDS)) return 'pm'
  return null
}

// Flattened for lookup, longest phrases first so "walk the dog" beats "walk".
const DURATION_MAP = (() => {
  const m = new Map()
  DURATION_BUCKETS.forEach(([mins, words]) => words.forEach((w) => { if (!m.has(w)) m.set(w, mins) }))
  return m
})()
const DURATION_KEYS = [...DURATION_MAP.keys()]

// Scan the sentence left to right. The first thing it recognises wins, and at
// any one spot the longest phrase wins — so "read a book" is read, not book.
function defaultDuration(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9:\s]/g, ' ').split(/\s+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    for (let n = 3; n >= 1; n--) {
      if (i + n > words.length) continue
      const phrase = words.slice(i, i + n).join(' ')
      if (DURATION_MAP.has(phrase)) return DURATION_MAP.get(phrase)
    }
  }
  // Nothing matched outright — allow for your typing.
  for (const w of words) {
    if (w.length < 4) continue
    const k = nearest(w, DURATION_KEYS)
    if (k) return DURATION_MAP.get(k)
  }
  return 1
}

// ---------------------------------------------------------------- the parser

const norm = (s) => String(s || '')
  .replace(/[‒-―−]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

// Cut a matched span out of the sentence and remember it was there.
function cut(state, re, take) {
  const m = state.text.match(re)
  if (!m) return false
  const got = take(m)
  if (got == null) return false
  state.text = (state.text.slice(0, m.index) + ' ' + state.text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  return got
}

function wordNum(tok) {
  if (tok == null) return null
  if (/^\d+(\.\d+)?$/.test(tok)) return parseFloat(tok)
  const k = nearest(tok, Object.keys(NUM_WORDS))
  return k ? NUM_WORDS[k] : null
}

// "for 90 min", "for an hour and a half", "half an hour", "2h", "1h30"
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function readDuration(state) {
  let d = cut(state, /\bhalf\s+an?\s+(hour|hr)\b/i, () => 30)
  if (d) return d
  d = cut(state, /\b(?:for\s+)?(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:hours?|hrs?|h)\s+and\s+a\s+half\b/i,
    (m) => { const n = wordNum(m[1]); return n == null ? null : Math.round(n * 60 + 30) })
  if (d) return d
  d = cut(state, /\b(?:for\s+)?(\d{1,2})\s*h\s*(\d{1,2})\b/i, (m) => parseInt(m[1]) * 60 + parseInt(m[2]))
  if (d) return d
  d = cut(state, /\b(?:for\s+)?(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter)\s*(hours?|hrs?|h)\b/i,
    (m) => { const n = wordNum(m[1]); return n == null ? null : Math.round(n * 60) })
  if (d) return d
  d = cut(state, /\b(?:for\s+)?(\d+)\s*(minutes?|mins?|m)\b/i, (m) => parseInt(m[1]))
  if (d) return d
  // Misspelled unit ("an our", "30 mintues"). Safe because a number has to sit
  // in front of it — a bare typo can never be read as a duration.
  d = cut(state, /\b(?:for\s+)?(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+([a-z]{1,8})\b/i, (m) => {
    const n = wordNum(m[1]); if (n == null) return null
    const u = m[2].toLowerCase()
    const hit = ['hour', 'hours', 'hr', 'hrs', 'minute', 'minutes', 'min', 'mins']
      .find((k) => editDistance(u, k) <= 1)
    if (!hit) return null
    return Math.round(hit.startsWith('h') ? n * 60 : n)
  })
  return d || null
}

// "every day", "weekdays", "every mon wed fri"
function readRepeat(state) {
  let r = cut(state, /\b(every\s*day|everyday|daily)\b/i, () => ({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] }))
  if (r) return r
  r = cut(state, /\b(?:every\s+)?week\s?days?\b/i, () => ({ kind: 'days', days: [1, 2, 3, 4, 5] }))
  if (r) return r
  r = cut(state, /\b(?:every\s+)?week\s?ends?\b/i, () => ({ kind: 'days', days: [0, 6] }))
  if (r) return r
  r = cut(state, /\bevery\s+((?:(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*[\s,and]*)+)/i, (m) => {
    const days = []
    m[1].split(/[\s,]+/).filter(Boolean).forEach((w) => {
      if (w === 'and') return
      const k = nearest(w.toLowerCase(), Object.keys(DAY_NAMES)) || nearest(w.toLowerCase(), Object.keys(DAY_SHORT))
      const n = DAY_NAMES[k] != null ? DAY_NAMES[k] : DAY_SHORT[k]
      if (n != null && !days.includes(n)) days.push(n)
    })
    return days.length ? { kind: 'days', days } : null
  })
  return r || null
}

// "tomorrow", "friday", "next monday". Returns days to add to today.
function readDayShift(state, todayDow, hint) {
  let s = cut(state, /\b(today|tonight|this\s+(?:morning|afternoon|evening|night))\b/i, (m) => {
    const w = m[1].toLowerCase()
    if (/tonight|evening|night/.test(w)) hint.ap = 'pm'
    else if (/morning/.test(w)) hint.ap = 'am'
    else if (/afternoon/.test(w)) hint.ap = 'pm'
    return 0
  })
  if (s != null && s !== false) return s
  s = cut(state, /\b(tomorrow|tmr|tmrw|tomorow|tommorow)\b/i, () => 1)
  if (s) return s
  s = cut(state, /\b(yesterday)\b/i, () => -1)
  if (s) return s
  s = cut(state, /\b(?:(next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i, (m) => {
    const w = m[2].toLowerCase()
    const k = nearest(w, Object.keys(DAY_NAMES)) || nearest(w, Object.keys(DAY_SHORT))
    const target = DAY_NAMES[k] != null ? DAY_NAMES[k] : DAY_SHORT[k]
    if (target == null) return null
    let delta = (target - todayDow + 7) % 7
    if (delta === 0) delta = 7           // "friday" on a Friday means next Friday
    if (m[1]) delta = ((target - todayDow + 7) % 7) + 7
    return delta
  })
  return s || 0
}

// Resolve one anchor word to minutes from midnight, or null if unknown.
function anchorMin(word, ctx) {
  const w = word.toLowerCase()
  const clockKey = nearest(w, Object.keys(CLOCK_ANCHORS))
  if (clockKey) return { min: CLOCK_ANCHORS[clockKey], label: clockKey }
  const sunKey = nearest(w, SUN_ANCHORS)
  if (sunKey) {
    if (!ctx.loc) return { needsLocation: true, label: sunKey }
    const t = solar(ctx.date, ctx.loc.lat, ctx.loc.lon)[sunKey]
    return t == null ? { unknown: true, label: sunKey } : { min: t, label: sunKey }
  }
  // Not a dictionary word — try your own calendar. "after gym" works because
  // gym is a block sitting on today.
  const evs = ctx.events || []
  let hit = null
  evs.forEach((e) => {
    const name = String(e.summary || '').toLowerCase()
    if (!name) return
    if (name.includes(w) || w.includes(name)) hit = e
  })
  if (hit) {
    const base = new Date(ctx.date); base.setHours(0, 0, 0, 0)
    return {
      startMin: Math.round((new Date(hit.start).getTime() - base.getTime()) / 60000),
      endMin: Math.round((new Date(hit.end).getTime() - base.getTime()) / 60000),
      label: hit.summary
    }
  }
  return null
}

// A clock time. `strict` demands am/pm or a colon so "call 3 clients" is not
// read as 3 o'clock; loose mode is used inside a range or after at/from/by.
function clockAt(str, strict, meridiemHint) {
  const m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i)
  if (!m) return null
  const hasMark = !!m[2] || !!m[3]
  if (strict && !hasMark) return null
  let h = parseInt(m[1], 10)
  const mins = m[2] ? parseInt(m[2], 10) : 0
  if (h > 23 || mins > 59) return null
  const ap = (m[3] || meridiemHint || '').toLowerCase().replace(/\./g, '')
  if (ap === 'pm' && h < 12) h += 12
  else if (ap === 'am' && h === 12) h = 0
  else if (!ap && h <= 11 && m[2] == null && !/^\d{2}$/.test(m[1])) {
    // Bare hour with no am/pm: pick the reading closest to now, forward-leaning.
    // "gym 7 to 8" at 3pm means 7pm, not 7am.
  }
  return h * 60 + mins
}

// A bare hour with no am/pm. "study 2 to 4" means the afternoon, "work 9 to 5"
// means the morning — 1 through 6 reads as PM, 7 through 11 as AM. That is how
// people actually say it, and it is predictable, which matters more than clever.
function dayLean(min, ap) {
  if (min == null || min >= 12 * 60) return min
  if (ap === 'pm') return min < 12 * 60 ? min + 12 * 60 : min
  if (ap === 'am') return min
  const h = Math.floor(min / 60)
  return h >= 1 && h <= 6 ? min + 12 * 60 : min
}
// Given a start, place a bare end after it: same half-day, the next one, or
// tomorrow — whichever lands first.
function endAfter(start, rawEnd) {
  for (const cand of [rawEnd, rawEnd + 12 * 60, rawEnd + DAY, rawEnd + DAY + 12 * 60]) {
    if (cand > start && cand - start <= 16 * 60) return cand
  }
  return rawEnd > start ? rawEnd : rawEnd + DAY
}

const TIME_TOKEN = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)'
const hasMeridiem = (s) => /am|pm/i.test(s)

/**
 * Read one task sentence.
 *
 * Returns null when there is no time in it at all — that is a plain task, not
 * a failure, and costs nothing. Returns { ok: false, reason } when there was
 * clearly time language it could not pin down; that case is logged.
 */
export function parseTask(raw, opts = {}) {
  const original = String(raw || '')
  const now = opts.now || new Date()
  const baseDate = opts.date ? new Date(opts.date) : new Date(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const state = { text: norm(original).toLowerCase() }
  if (!state.text) return null
  const before = state.text

  // 1. Delete the words that carry no math. This is the step that makes
  //    "sometime after fajr for about an hour" ordinary.
  NOISE.forEach((n) => { state.text = state.text.replace(new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), ' ') })
  state.text = state.text.replace(/(\w{3,})-?ish\b/gi, '$1').replace(/\s+/g, ' ').trim()

  // 2. Repeat, then the day it lands on, then how long it runs.
  const repeat = readRepeat(state)
  const hint = { ap: null }
  const dayShift = readDayShift(state, baseDate.getDay(), hint)
  const dayDate = new Date(baseDate); dayDate.setDate(dayDate.getDate() + dayShift); dayDate.setHours(0, 0, 0, 0)
  if (!hint.ap) hint.ap = wordLean(original)
  const duration = readDuration(state)

  const ctx = { date: dayDate, loc: opts.location || tbLocation(), events: opts.events || [] }
  let needsLocation = null

  // 3. A range: "from 5am to 6am", "5-6pm", "between 2 and 4".
  let startMin = null, endMin = null, anchorLabel = null, anchorRel = 'after'
  const rangeRe = new RegExp('\\b(?:from|between)?\\s*' + TIME_TOKEN + '\\s*(?:-|to|till|until|and|thru|through)\\s*' + TIME_TOKEN + '\\b', 'i')
  cut(state, rangeRe, (m) => {
    const aTxt = m[1].trim(), bTxt = m[2].trim()
    const aHas = hasMeridiem(aTxt), bHas = hasMeridiem(bTxt)
    // "5 to 6pm" — the am/pm on the far side governs both, unless that would
    // put the start after the end.
    const rawA = clockAt(aTxt, false)
    const rawB = clockAt(bTxt, false)
    if (rawA == null || rawB == null) return null
    if (aHas) startMin = rawA
    else if (bHas) {
      const borrowed = clockAt(aTxt, false, (bTxt.match(/am|pm/i) || [''])[0])
      startMin = borrowed != null && borrowed < rawB ? borrowed : dayLean(rawA, hint.ap)
    } else startMin = dayLean(rawA, hint.ap)
    endMin = bHas ? rawB : endAfter(startMin, rawB)
    if (endMin <= startMin) endMin += DAY          // crosses midnight
    return true
  })

  // 4. No range. Look for a single point: a clock time, or an anchor.
  if (startMin == null) {
    cut(state, new RegExp('\\b(?:at|from|by|starting)\\s+' + TIME_TOKEN + '\\b', 'i'), (m) => {
      const t = clockAt(m[1].trim(), false)
      if (t == null) return null
      startMin = hasMeridiem(m[1]) ? t : dayLean(t, hint.ap)
      return true
    })
  }
  if (startMin == null) {
    cut(state, new RegExp('(?:^|\\s)' + TIME_TOKEN + '(?=\\s|$)', 'i'), (m) => {
      const t = clockAt(m[1].trim(), true)      // strict: needs am/pm or a colon
      if (t == null) return null
      startMin = t
      return true
    })
  }

  // 5. Still nothing? Try an anchor with a relation in front of it.
  //    "after fajr", "before bed", "at lunch", "after gym".
  if (startMin == null) {
    const toks = state.text.split(' ')
    for (let i = 0; i < toks.length - 1; i++) {
      const relWord = toks[i].replace(/[^a-z']/g, '')
      const rel = relWord && nearest(relWord, RELATIONS)
      if (!rel) continue
      const a = anchorMin(toks[i + 1].replace(/[^a-z']/g, ''), ctx)
      if (!a) continue
      if (a.needsLocation) { needsLocation = a.label; toks.splice(i, 2); state.text = toks.join(' ').trim(); break }
      if (a.unknown) { toks.splice(i, 2); state.text = toks.join(' ').trim(); break }
      anchorLabel = a.label
      anchorRel = (rel === 'before' || rel === 'until' || rel === 'till') ? 'before' : 'after'
      // A calendar block has two edges; a clock anchor has one.
      if (a.startMin != null) {
        if (anchorRel === 'before') endMin = a.startMin
        else startMin = a.endMin
      } else {
        if (anchorRel === 'before') endMin = a.min
        else startMin = a.min         // "after fajr" starts exactly at fajr
      }
      toks.splice(i, 2)
      state.text = toks.join(' ').trim()
      break
    }
  }

  // 6. Nothing but a length: "meeting for an hour", "eating for 30 minutes".
  //    That is still you naming a time, so it starts now, on the next five.
  //    Only on today — on another day there is no "now" to start from.
  if (startMin == null && endMin == null && duration != null) {
    if (sameDay(dayDate, now)) startMin = Math.min(DAY - 1, Math.ceil(nowMin / 5) * 5)
  }

  // 7. Close the block. Anything the sentence didn't say, fill in sanely.
  const natural = duration != null ? duration : defaultDuration(original)
  if (startMin == null && endMin != null) startMin = endMin - natural
  if (startMin != null && endMin == null) endMin = startMin + natural
  if (startMin != null && duration != null) endMin = startMin + duration

  // 8. The title is what you wrote. Exactly what you wrote. TB reads the
  //    sentence to fill the clock, then leaves your words alone — no
  //    capitalising, no trimming, no tidying. "wake up at 4" stays
  //    "wake up at 4".
  const title = original.trim()

  if (needsLocation) {
    logMiss(original, 'no location for ' + needsLocation)
    return { ok: false, reason: 'location', anchor: needsLocation, title: title || original.trim() }
  }
  if (startMin == null) {
    // No time in it at all is a plain task, not a miss. Only log when the
    // sentence clearly meant a time and TB could not read it.
    const meantTime = /\b(after|before|at|from|until|till|by|o'?clock|am|pm|hour|min)\b/i.test(before)
    if (meantTime) logMiss(original, 'no time found')
    return null
  }

  const cross = endMin >= DAY
  return {
    ok: true,
    title: title || original.trim(),
    startMin: clampDay(startMin),
    endMin: clampDay(endMin),
    durMin: Math.max(1, Math.round(endMin - startMin)),
    crossesMidnight: cross,
    dayShift,
    repeat,
    anchor: anchorLabel,
    anchorRel,
    // A gray block if you said sleep, green for everything else.
    colorId: /\b(sleep|nap|rest)\b/i.test(original) ? '9' : '10'
  }
}

// ---------------------------------------------------------------- formatting

export function fmtClock(min) {
  const t = clampDay(min)
  const h = Math.floor(t / 60), m = t % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`
}
export function fmtLen(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  if (!h) return m + 'm'
  return m ? `${h}h ${m}m` : `${h}h`
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The one line you see under the task once TB has read it.
export function describe(r) {
  if (!r || !r.ok) return ''
  const bits = [`${fmtClock(r.startMin)} to ${fmtClock(r.endMin)}`, fmtLen(r.durMin)]
  if (r.dayShift === 1) bits.push('tomorrow')
  else if (r.dayShift > 1) bits.push('in ' + r.dayShift + ' days')
  else if (r.dayShift < 0) bits.push(r.dayShift + ' days')
  if (r.crossesMidnight) bits.push('into the next day')
  if (r.anchor) bits.push((r.anchorRel || 'after') + ' ' + r.anchor)
  if (r.repeat) {
    const d = r.repeat.days
    bits.push(d.length === 7 ? 'every day'
      : d.length === 5 && d.every((x) => x >= 1 && x <= 5) ? 'weekdays'
      : d.map((x) => DOW[x]).join(' '))
  }
  return bits.join(' · ')
}
