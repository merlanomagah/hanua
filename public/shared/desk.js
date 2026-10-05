// The desk's notebook: rules shared by the page and the server (no page imports here).
// One small file per day on this Mac (data/room/desk/<day>.json) holds the day's page: three focuses and the to-do
// lines (`general`, kept in place so a line typed halfway down stays there). Since 6 Oct 2026 the page is just
// Today's focuses and a To-Do List (Mel); older files may still carry key tasks and Work lines, which are ignored.
import { addDays } from "./dates.js";

export const FOCUS_N = 3, KEY_N = 3;
export const MAX_TEXT = 200, MAX_LINES = 40;
export const CARRY_DAYS = 7; // how far back the server looks for the last focuses (shown faintly as a hint)
export const TODO_ROWS = 14; // the To-Do List always has at least this many lines to write on

// A real day, written YYYY-MM-DD, or null (guards /api/desk/:day like weekKey does for the menu)
export function dayKey(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
}

// The day n days away (calendar days, so daylight saving never skips or repeats one)
export const stepDay = (day, n) => addDays(day, n);

const clip = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
const idOf = (v, i) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : `l${i}`);

// Whatever was sent or saved, tidied into the one shape: never more lines than fit, text trimmed and capped
export function deskShape(x) {
  const o = x && typeof x === "object" ? x : {};
  const list = (a) => (Array.isArray(a) ? a : []);
  const focus = Array.from({ length: FOCUS_N }, (_, i) => clip(list(o.focus)[i]));
  const key = Array.from({ length: KEY_N }, (_, i) => { const k = list(o.key)[i] || {}; return { text: clip(k.text), done: Boolean(k.done) }; });
  const general = list(o.general).slice(0, MAX_LINES).map((g, i) => ({ id: idOf(g?.id, i), text: clip(g?.text), done: Boolean(g?.done) }));
  const work = list(o.work).slice(0, MAX_LINES).map((w, i) => ({ id: idOf(w?.id, i), text: clip(w?.text), edited: Number(w?.edited) || 0 }));
  // carried jottings already dealt with: "<day>:<id>" → "today" (brought into this day) or "gone" (let go)
  const settled = {};
  for (const [k, v] of Object.entries(o.settled && typeof o.settled === "object" ? o.settled : {})) {
    if (/^\d{4}-\d{2}-\d{2}:[\w-]{1,40}$/.test(k) && (v === "today" || v === "gone")) settled[k] = v;
  }
  return { focus, key, general, work, settled };
}

// The focus areas last written on an earlier day (shown faintly as a hint; they never carry by themselves)
export function lastFocus(days, today) {
  const earlier = Object.keys(days).filter((d) => dayKey(d) && d < today).sort().reverse();
  for (const d of earlier) {
    const f = deskShape(days[d]).focus;
    if (f.some(Boolean)) return f;
  }
  return null;
}

// Which sections show: none at work (the page has no Work/personal split, so all of it counts as personal)
export const deskSections = (atWork) => (atWork ? [] : ["focus", "todo"]);

// The page's date, always written the same way: "Tue 06-Oct-2026"
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function planDate(day) {
  if (!dayKey(day)) return "";
  const [y, m, d] = day.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, "0")}-${MONTHS[m - 1]}-${y}`;
}

// ---- sticky notes on the desk's wall: typed by Mel, kept on this Mac (data/room/stickies.json) until taken down ----
export const STICKY_MAX = 12, STICKY_TEXT = 160;
export const STICKY_COLOURS = ["yellow", "pink", "green", "blue"];
// [{ id, text, colour, added (YYYY-MM-DD), down (YYYY-MM-DD, set when taken down: marked, never erased) }]
export function stickyShape(list) {
  return (Array.isArray(list) ? list : []).slice(0, 200).map((n, i) => ({
    id: idOf(n?.id, i),
    text: String(n?.text ?? "").slice(0, STICKY_TEXT),
    colour: STICKY_COLOURS.includes(n?.colour) ? n.colour : STICKY_COLOURS[i % STICKY_COLOURS.length],
    added: dayKey(n?.added) || null,
    down: dayKey(n?.down) || null,
  }));
}
// the notes still up, oldest first, never more than fit on the wall
export const stickiesUp = (list) => stickyShape(list).filter((n) => !n.down).slice(0, STICKY_MAX);
