// Target productive hours per day. One source of truth, set in Settings and read
// everywhere the daily capacity is shown. Stored as hours, used as minutes.
export const TARGET_KEY = 'grow_target_hours'
export const TARGET_DEFAULT = 19
export const TARGET_MIN = 1
export const TARGET_MAX = 24

export function loadTargetHours() {
  try {
    const v = parseFloat(localStorage.getItem(TARGET_KEY))
    if (isNaN(v)) return TARGET_DEFAULT
    return Math.max(TARGET_MIN, Math.min(TARGET_MAX, v))
  } catch (e) { return TARGET_DEFAULT }
}

export function saveTargetHours(h) {
  // Note: cannot use `|| TARGET_DEFAULT` here, 0 is falsy and must clamp to the min.
  const n = parseFloat(h)
  const v = isNaN(n) ? TARGET_DEFAULT : Math.max(TARGET_MIN, Math.min(TARGET_MAX, n))
  try { localStorage.setItem(TARGET_KEY, String(v)) } catch (e) {}
  return v
}

// Pretty label: 19 -> "19h", 7.5 -> "7h 30m"
export function targetLabel(h) {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  return mins ? whole + 'h ' + mins + 'm' : whole + 'h'
}
