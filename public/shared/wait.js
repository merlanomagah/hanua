// Waiting on Claude (Mel, 16 Oct 2026; brief docs/plans/2026-10-waiting.md): one request per press, however many times
// the button is pressed while it's out; the seconds it has been out, in words; when it counts as taking long.
// Shared by the page (public/wait.js) and the tests.
export const LONG_WAIT = 60; // seconds: then "Taking longer than usual · Stop waiting"
export function createWaits(now = () => Date.now()) {
  const out = new Map(); // key → { since, label }
  return {
    // false when that request is already out: the press sends nothing
    start(key, label = "") { if (out.has(key)) return false; out.set(key, { since: now(), label }); return true; },
    end(key) { out.delete(key); },
    has: (key) => out.has(key),
    get: (key) => out.get(key) || null,
    secs: (key) => (out.has(key) ? Math.max(0, Math.floor((now() - out.get(key).since) / 1000)) : 0),
  };
}
export const secsText = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
export const isLong = (s) => s >= LONG_WAIT;
