// The desk's notebook: rules shared by the page and the server (no page imports here).
// One small file per day on this Mac (data/room/desk/<day>.json) holds what only lives here: the day's three focus
// areas, three key tasks and the General jottings. Work lines are only held here until they've rested for five
// minutes (Mel brainstorms and changes her mind); then they go to the Work book in Notion, their real home.
import { addDays } from "./dates.js";

export const FOCUS_N = 3, KEY_N = 3;
export const MAX_TEXT = 200, MAX_LINES = 40;
export const WORK_WAIT_MS = 5 * 60_000; // a Work line goes to Notion five minutes after its last edit
export const CARRY_DAYS = 7; // unfinished General jottings are offered again for up to a week

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

// Unfinished General jottings from the last week that haven't been brought forward or let go.
// days: { "YYYY-MM-DD": deskShape } including today's. Worked out on load, never copied forward by itself.
export function carriedOver(days, today) {
  const settled = {};
  for (const d of Object.values(days)) Object.assign(settled, deskShape(d).settled);
  const out = [];
  for (const [day, d] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!dayKey(day) || day >= today || day < stepDay(today, -CARRY_DAYS)) continue;
    for (const g of deskShape(d).general) {
      const key = `${day}:${g.id}`;
      if (g.text && !g.done && !settled[key]) out.push({ key, day, id: g.id, text: g.text });
    }
  }
  return out;
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

// Work lines that have rested long enough to go to Notion
export const workReady = (work, now = Date.now()) => work.filter((w) => w.text && w.edited && now - w.edited >= WORK_WAIT_MS);

// Which sections show: at work only Work (focus areas, key tasks and General can be personal)
export const deskSections = (atWork) => (atWork ? ["work"] : ["focus", "key", "general", "work"]);
