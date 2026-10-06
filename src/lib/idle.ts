// Signing people out after inactivity. Leaders hold sensitive data and
// often use shared office computers; members mostly use their own phones.
export const LEADER_IDLE_MINUTES = 30;
export const MEMBER_IDLE_MINUTES = 7 * 24 * 60;

// httpOnly cookies the proxy reads: when this browser last made a request,
// and this login's allowed idle time (set by the server for their role).
export const LAST_SEEN_COOKIE = "sx_seen";
export const IDLE_LIMIT_COOKIE = "sx_idle";

// Shared between tabs so activity in one keeps the others signed in.
export const ACTIVITY_STORAGE_KEY = "sx-last-activity";
