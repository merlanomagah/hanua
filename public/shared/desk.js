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
// Time-blocking (6 Oct 2026): quick picks, not precise estimates; the gaps between blocks are the buffer
export const PRIORITIES = ["h", "m", "l"];
export const TIME_PICKS = [15, 30, 45, 60, 90, 120];
export const DEFAULT_MINS = 30, GAP = 5, MEETING_PAD = 5, BREAK_AFTER = 90, BREAK_MINS = 10, MAX_MEETINGS = 12;
export const WORKDAY = { start: "08:30", end: "17:30" };
// How a day is saved. Raise it whenever deskShape learns a new field: the page and server must agree, or a save is
// refused (never quietly trimmed). On 6 Oct 2026 a page newer than the running server lost its meetings that way.
export const DESK_VERSION = 2;
// Who's out of date when a save arrives: null when they match, "page" (reload it), "server" (Restart Hanua)
export function versionClash(sent, mine = DESK_VERSION) {
  const v = Number.isInteger(sent) ? sent : 0; // pages from before the check sent none
  return v === mine ? null : v < mine ? "page" : "server";
}
export const CLASH_TEXT = {
  page: "This page is older than Hanua: reload it (⌘R) to keep saving. What you typed is still on the page.",
  server: "Hanua was updated but is still running the old version: use Restart Hanua to keep saving. What you typed is still on the page.",
};

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
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeOr = (v, d) => (typeof v === "string" && HHMM.test(v) ? v : d);
const pri = (v) => (PRIORITIES.includes(v) ? v : "");
const mins = (v) => (TIME_PICKS.includes(Number(v)) ? Number(v) : 0);
const linesOf = (a) => {
  const out = list(a).slice(0, MAX_LINES).map((l, i) => ({ id: idOf(l?.id, i), text: clip(l?.text), done: Boolean(l?.text && l?.done), pri: pri(l?.pri), mins: mins(l?.mins) }));
  while (out.length && !out.at(-1).text) out.pop(); // no trailing blanks kept; blanks in the middle stay (lines keep their place)
  return out;
};

// Whatever was sent or saved, tidied into the one shape: never more lines than fit, text trimmed and capped
export function deskShape(x) {
  const o = x && typeof x === "object" ? x : {};
  const focus = Array.from({ length: FOCUS_N }, (_, i) => clip(list(o.focus)[i]));
  const key = Array.from({ length: KEY_N }, (_, i) => { const k = list(o.key)[i] || {}; return { text: clip(k.text), done: Boolean(k.text && k.done), pri: pri(k.pri), mins: mins(k.mins) }; });
  const given = list(o.sections).slice(0, MAX_SECTIONS);
  const gen = given.find((s) => s?.id === GENERAL);
  const sections = [{ id: GENERAL, name: "General", col: 0, work: Boolean(gen?.work), lines: linesOf(gen ? gen.lines : o.general) }];
  given.forEach((s, i) => {
    if (!s || s.id === GENERAL) return;
    const id = idOf(s.id, i, "s");
    if (sections.some((x) => x.id === id)) return;
    sections.push({ id, name: clip(s.name, MAX_NAME), col: s.col === 1 ? 1 : 0, work: Boolean(s.work), lines: linesOf(s.lines) });
  });
  // unfinished items from earlier days, dealt with in the morning sweep: "<day>:<id>" → today / done / gone
  const settled = {};
  for (const [k, v] of Object.entries(o.settled && typeof o.settled === "object" ? o.settled : {})) {
    if (/^\d{4}-\d{2}-\d{2}:[\w-]{1,40}$/.test(k) && ["today", "done", "gone"].includes(v)) settled[k] = v;
  }
  // meetings and events jotted for the day: a time, how long, what, and whether it's work
  const meetings = list(o.meetings).slice(0, MAX_MEETINGS).map((m, i) => ({ id: idOf(m?.id, i, "m"), time: timeOr(m?.time, ""), mins: mins(m?.mins), title: clip(m?.title), work: Boolean(m?.work) }));
  while (meetings.length && !meetings.at(-1).title && !meetings.at(-1).time) meetings.pop();
  const day = { start: timeOr(o.day?.start, WORKDAY.start), end: timeOr(o.day?.end, WORKDAY.end) };
  // the time-blocked plan, worked out by planDay when Mel presses Save & plan (never typed)
  const blocks = list(o.blocks).slice(0, 80).filter((b) => HHMM.test(b?.start) && HHMM.test(b?.end)).map((b) => ({ ref: typeof b.ref === "string" && /^[\w-]{1,40}$/.test(b.ref) ? b.ref : "", start: b.start, end: b.end, kind: b.kind === "break" ? "break" : "task" }));
  const overflow = list(o.overflow).filter((r) => typeof r === "string" && /^[\w-]{1,40}$/.test(r)).slice(0, 80);
  return { focus, key, keyWork: Boolean(o.keyWork), sections, meetings, day, blocks, overflow, settled, started: Boolean(o.started) };
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
    if (!d.sections.some((x) => x.name.toLowerCase() === s.name.toLowerCase())) d.sections.push({ id: s.id, name: s.name, col: s.col, work: s.work, lines: [] });
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
    d.key.forEach((k, i) => { if (k.text && !k.done) out.push({ key: `${day}:k${i}`, day, section: null, text: k.text, pri: k.pri, mins: k.mins }); });
    for (const s of d.sections) for (const l of s.lines) if (l.text && !l.done) out.push({ key: `${day}:${l.id}`, day, section: s.name, text: l.text, pri: l.pri, mins: l.mins });
  }
  return out.filter((x) => !settled[x.key]);
}

// Bring an unfinished item into today: a task into an empty task slot (else General), a line back under its own
// header (made again if today hasn't got it). Changes and returns today's shape.
export function bringForward(d, item, newId) {
  d.settled[item.key] = "today";
  if (!item.section) {
    const slot = d.key.find((k) => !k.text);
    if (slot) { Object.assign(slot, { text: item.text, done: false, pri: item.pri || "", mins: item.mins || 0 }); return d; }
  }
  const name = item.section || "General";
  let sec = d.sections.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!sec) { sec = { id: `s${newId}`, name, col: shorterCol(d.sections), lines: [] }; d.sections.push(sec); }
  const blank = sec.lines.find((l) => !l.text);
  const line = { text: item.text, done: false, pri: item.pri || "", mins: item.mins || 0 };
  if (blank) Object.assign(blank, line); else sec.lines.push({ id: newId, ...line });
  return d;
}

// ---- time-blocking ----
export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
export const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const up5 = (n) => Math.ceil(n / 5) * 5;
const RANK = { h: 0, m: 1, "": 1, l: 2 };

// Everything open today that could be planned: the three Tasks first, then each section's lines.
// ref is "k0".."k2" for a Task, or the line's id. atWork: only Work items (Mel, 6 Oct 2026).
export function openItems(d, atWork = false) {
  const out = [];
  if (!atWork || d.keyWork) d.key.forEach((k, i) => { if (k.text && !k.done) out.push({ ref: `k${i}`, title: k.text, pri: k.pri, mins: k.mins, first: true, work: d.keyWork }); });
  for (const s of d.sections) if (!atWork || s.work) for (const l of s.lines) if (l.text && !l.done) out.push({ ref: l.id, title: l.text, pri: l.pri, mins: l.mins, first: false, work: s.work, section: s.name });
  return out;
}

// Fill the free time between fixed things (meetings, calendar events) with the tasks: the three Tasks first, then
// High, Medium, Low (in the order written). Each, in that order, takes the earliest gap it fits, so a short task can
// still use a gap a long one couldn't. Time is a rough pick (blank = 30 min); a 5-minute gap round every block and
// meeting is the buffer, and after at least 45 minutes of unbroken work, anything that would go past about 90 gets a
// 10-minute break first. A task never splits; what doesn't fit before the end of the day is overflow.
// Times are "HH:MM"; fixed: [{ start, end }]; from: plan from now if that's later than the day's start.
export function planDay({ tasks, fixed = [], from = "00:00", day = WORKDAY }) {
  const end = toMin(day.end);
  const begin = up5(Math.max(toMin(day.start), toMin(from)));
  const fixedBusy = fixed.filter((f) => HHMM.test(f.start) && HHMM.test(f.end)).map((f) => [toMin(f.start) - GAP, toMin(f.end) + MEETING_PAD]);
  const placed = []; // { s, e, kind, ref }
  const freeAt = (t, len) => { // earliest start at or after t where len minutes don't touch anything busy or placed
    const busy = [...fixedBusy, ...placed.map((b) => [b.s - GAP, b.e + GAP])];
    for (let moved = true; moved;) {
      moved = false;
      for (const [b0, b1] of busy) if (t < b1 && t + len > b0) { t = up5(b1); moved = true; }
    }
    return t;
  };
  const runBefore = (t) => { // minutes of unbroken work (tasks a gap apart) ending just before t, and where it ends
    let run = 0, cur = t, last = null;
    for (let p; (p = placed.find((b) => b.kind === "task" && b.e <= cur && cur - b.e <= GAP));) { run += p.e - p.s; cur = p.s; last ??= p.e; }
    return { run, last };
  };
  const order = tasks.map((t, i) => ({ ...t, first: Boolean(t.first), i })).sort((a, b) => Number(b.first) - Number(a.first) || (a.first ? a.i - b.i : RANK[a.pri || ""] - RANK[b.pri || ""] || a.i - b.i));
  const overflow = [];
  for (const task of order) {
    const len = task.mins || DEFAULT_MINS;
    let t = begin, done = false;
    for (let tries = 0; tries < 200 && !done; tries++) {
      const s = freeAt(t, len);
      if (s + len > end) break;
      const { run, last } = runBefore(s);
      if (run >= 45 && run + len > BREAK_AFTER) {
        const bs = last + GAP;
        if (freeAt(bs, BREAK_MINS) === bs && bs + BREAK_MINS <= end) placed.push({ s: bs, e: bs + BREAK_MINS, kind: "break", ref: "" });
        t = Math.max(s, bs) + 5; // try again after the break (or a little later if it couldn't go there)
        continue;
      }
      placed.push({ s, e: s + len, kind: "task", ref: task.ref });
      done = true;
    }
    if (!done) overflow.push(task.ref);
  }
  placed.sort((a, b) => a.s - b.s);
  // a break with no work straight after it isn't one
  const kept = placed.filter((b) => b.kind === "task" || placed.some((x) => x.kind === "task" && x.s >= b.e && x.s - b.e <= GAP));
  return { blocks: kept.map((b) => ({ ref: b.ref, start: fromMin(b.s), end: fromMin(b.e), kind: b.kind })), overflow };
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
