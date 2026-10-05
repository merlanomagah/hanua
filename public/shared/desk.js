// Plan my day: rules shared by the page and the server (no page imports here).
// One small file per day on this Mac (data/room/desk/<day>.json) holds the day's page (Mel, 6 Oct 2026): three focuses,
// three tasks to complete, and the To-Do List in sections (General first, then her own, each with its own header).
// Earlier days are the archive and are never rewritten: what the morning sweep decides about an unfinished item is
// written into *today's* file (`settled`). Older files with a plain `general` list open as the General section.
import { addDays } from "./dates.js";

export const FOCUS_N = 3, KEY_N = 3;
export const MAX_TEXT = 200, MAX_LINES = 40, MAX_SECTIONS = 12, MAX_NAME = 40;
export const CARRY_DAYS = 7; // the sweep looks back a week; anything older stays in the archive
export const SECTION_ROWS = 4; // every section has at least this many lines to write on
export const GENERAL = "general";

// A real day, written YYYY-MM-DD, or null (guards /api/desk/:day like weekKey does for the menu)
export function dayKey(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
}

// The day n days away (calendar days, so daylight saving never skips or repeats one)
export const stepDay = (day, n) => addDays(day, n);

const clip = (v, n = MAX_TEXT) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const idOf = (v, i, p = "l") => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : `${p}${i}`);
const list = (a) => (Array.isArray(a) ? a : []);
const linesOf = (a) => {
  const out = list(a).slice(0, MAX_LINES).map((l, i) => ({ id: idOf(l?.id, i), text: clip(l?.text), done: Boolean(l?.text && l?.done) }));
  while (out.length && !out.at(-1).text) out.pop(); // no trailing blanks kept; blanks in the middle stay (lines keep their place)
  return out;
};

// Whatever was sent or saved, tidied into the one shape: never more lines than fit, text trimmed and capped
export function deskShape(x) {
  const o = x && typeof x === "object" ? x : {};
  const focus = Array.from({ length: FOCUS_N }, (_, i) => clip(list(o.focus)[i]));
  const key = Array.from({ length: KEY_N }, (_, i) => { const k = list(o.key)[i] || {}; return { text: clip(k.text), done: Boolean(k.text && k.done) }; });
  const given = list(o.sections).slice(0, MAX_SECTIONS);
  const gen = given.find((s) => s?.id === GENERAL);
  const sections = [{ id: GENERAL, name: "General", col: 0, lines: linesOf(gen ? gen.lines : o.general) }];
  given.forEach((s, i) => {
    if (!s || s.id === GENERAL) return;
    const id = idOf(s.id, i, "s");
    if (sections.some((x) => x.id === id)) return;
    sections.push({ id, name: clip(s.name, MAX_NAME), col: s.col === 1 ? 1 : 0, lines: linesOf(s.lines) });
  });
  // unfinished items from earlier days, dealt with in the morning sweep: "<day>:<id>" → today / done / gone
  const settled = {};
  for (const [k, v] of Object.entries(o.settled && typeof o.settled === "object" ? o.settled : {})) {
    if (/^\d{4}-\d{2}-\d{2}:[\w-]{1,40}$/.test(k) && ["today", "done", "gone"].includes(v)) settled[k] = v;
  }
  return { focus, key, sections, settled, started: Boolean(o.started) };
}

// Which column a new section goes in: the shorter one (General always heads the left)
const height = (s) => 1 + Math.max(SECTION_ROWS, s.lines.length + 1);
export function shorterCol(sections) {
  const h = [0, 0];
  for (const s of sections) h[s.col] += height(s);
  return h[1] < h[0] ? 1 : 0;
}

// A new day starts with yesterday's section headers (empty), so "House" or "Admin" is waiting each morning.
// Only once: after that the day is Mel's to change (a section she removes doesn't come back).
export function startDay(day, earlier, today) {
  const d = deskShape(day);
  if (d.started) return d;
  const last = Object.keys(earlier || {}).filter((k) => dayKey(k) && k < today).sort().reverse()
    .map((k) => deskShape(earlier[k])).find((x) => x.sections.length > 1);
  for (const s of last?.sections.slice(1) || []) {
    if (!d.sections.some((x) => x.name.toLowerCase() === s.name.toLowerCase())) d.sections.push({ id: s.id, name: s.name, col: s.col, lines: [] });
  }
  d.started = true;
  return d;
}

// The morning sweep: unfinished tasks and lines from the last week that haven't been dealt with yet.
// days: { "YYYY-MM-DD": shape } including today's (whose `settled` says what's been dealt with).
export function leftovers(days, today) {
  const settled = {};
  for (const d of Object.values(days)) Object.assign(settled, deskShape(d).settled);
  const out = [];
  for (const [day, raw] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!dayKey(day) || day >= today || day < stepDay(today, -CARRY_DAYS)) continue;
    const d = deskShape(raw);
    d.key.forEach((k, i) => { if (k.text && !k.done) out.push({ key: `${day}:k${i}`, day, section: null, text: k.text }); });
    for (const s of d.sections) for (const l of s.lines) if (l.text && !l.done) out.push({ key: `${day}:${l.id}`, day, section: s.name, text: l.text });
  }
  return out.filter((x) => !settled[x.key]);
}

// Bring an unfinished item into today: a task into an empty task slot (else General), a line back under its own
// header (made again if today hasn't got it). Changes and returns today's shape.
export function bringForward(d, item, newId) {
  d.settled[item.key] = "today";
  if (!item.section) {
    const slot = d.key.find((k) => !k.text);
    if (slot) { slot.text = item.text; slot.done = false; return d; }
  }
  const name = item.section || "General";
  let sec = d.sections.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!sec) { sec = { id: `s${newId}`, name, col: shorterCol(d.sections), lines: [] }; d.sections.push(sec); }
  const blank = sec.lines.find((l) => !l.text);
  if (blank) { blank.text = item.text; blank.done = false; } else sec.lines.push({ id: newId, text: item.text, done: false });
  return d;
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
export const deskSections = (atWork) => (atWork ? [] : ["focus", "key", "todo"]);

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
