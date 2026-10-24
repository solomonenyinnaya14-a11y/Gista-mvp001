// Shared session keys for long-away feed refreshes.
// A 30-minute absence is long enough to justify fresh discovery, while ordinary
// navigation and brief app switches preserve the current feed snapshot.
export const LONG_AWAY_REFRESH_THRESHOLD_MS = 30 * 60 * 1000;
export const LONG_AWAY_REFRESH_PENDING_KEY = "gista:feed-refresh-pending";
export const LAST_HIDDEN_AT_KEY = "gista:feed-last-hidden-at";
export const LONG_AWAY_REFRESH_EVENT = "gista:feed-long-return";
