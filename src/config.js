// Optional cloud endpoints. Out Past and its on-device KAI brain work fully
// without either of these — they only switch on extra, optional cloud features.
// Copy .env.example to .env and fill these in to enable them. Left empty, every
// feature that would use them degrades gracefully to a local no-op.
//
//   VITE_GAI_WORKER_URL — an AI/scheduling worker endpoint (KAI cloud planning,
//                         membership, keyed YouTube search, booking scheduler)
//   VITE_SYNC_API       — a cross-device account/sync backend
export const GAI_WORKER_URL = import.meta.env.VITE_GAI_WORKER_URL || ''
export const SYNC_API = import.meta.env.VITE_SYNC_API || ''
