// The day your record begins. Anything logged before this was setup and test
// data, not real days, so nothing counts it: not the Home lifetime chart, not
// its all-time tiles, and not the carry-in on the mission chart.
//
// One constant for all of them on purpose. When the Home chart and the mission
// chart floored at different days they disagreed about the same number, which
// is exactly the confusion this avoids.
export const HISTORY_START = '2026-07-22'

// True if a 'YYYY-MM-DD' day key is part of your record.
export const inHistory = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= HISTORY_START
