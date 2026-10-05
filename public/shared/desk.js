// Plan my day: rules shared by the page and the server (no page imports here).
// One small file per day on this Mac (data/room/desk/<day>.json) holds the day's page (Mel, 6 Oct 2026): three focuses
// and the To-Do List in sections (General first, then the fixed ones from config, then her own, each with its header).
// "Tasks to complete" was cut on 6 Oct 2026 (never used): an older day's three Tasks open as its first General lines.
// Earlier days are the archive and are never rewritten: what the morning sweep decides about an unfinished item is
// written into *today's* file (`settled`). Older files with a plain `general` list open as the General section.
import { addDays } from "./dates.js";

export const FOCUS_N = 3, KEY_N = 3; // KEY_N: only for reading older days
export const MAX_TEXT = 200, MAX_LINES = 40, MAX_SECTIONS = 12, MAX_NAME = 40;
export const CARRY_DAYS = 7; // the sweep looks back a week; anything older stays in the archive
export const SECTION_ROWS = 4; // every section has at least this many lines to write on
export const GENERAL = "general";
// Time-blocking (6 Oct 2026): quick picks, not precise estimates; the gaps between blocks are the buffer
export const PRIORITIES = ["h", "m", "l"];
// a line's rough time, in words with the minutes in brackets (Mel, 6 Oct 2026: "Quick (10m)"); meetings keep plain times
export const TIME_PICKS = [10, 15, 30, 45, 60, 120];
export const TIME_WORDS = { 10: "Quick", 15: "Short", 30: "Half hour", 45: "Solid", 60: "Hour", 120: "Big" };
export const MEETING_PICKS = [15, 30, 45, 60, 90, 120];
export const minsText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60) : ""}` : `${m}m`); // 15m … 1h30, 2h
export const timeLabel = (m) => (TIME_WORDS[m] ? `${TIME_WORDS[m]} (${minsText(m)})` : minsText(m));
const KEPT_MINS = [...new Set([...TIME_PICKS, ...MEETING_PICKS])]; // an older 90m line keeps its time
export const DEFAULT_MINS = 30, GAP = 5, MEETING_PAD = 5, BREAK_AFTER = 90, BREAK_MINS = 10, MAX_MEETINGS = 12;
export const WORKDAY = { start: "08:30", end: "17:30" };
// How a day is saved. Raise it whenever deskShape learns a new field: the page and server must agree, or a save is
// refused (never quietly trimmed). On 6 Oct 2026 a page newer than the running server lost its meetings that way.
export const DESK_VERSION = 3; // 3: no Tasks, fixed sections, time words, when things happened (6 Oct 2026)
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
const mins = (v) => (KEPT_MINS.includes(Number(v)) ? Number(v) : 0);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const when = (v) => (typeof v === "string" && ISO.test(v) ? v : undefined);
// a line, and when things happened to it (6 Oct 2026, for Close the day, the weekly summary and Patterns):
// added = first written, doneAt = ticked, from = the day it was first written when it's been carried forward
const lineOf = (l, i) => {
  const text = clip(l?.text), done = Boolean(text && l?.done);
  const out = { id: idOf(l?.id, i), text, done, pri: pri(l?.pri), mins: mins(l?.mins) };
  if (text && when(l?.added)) out.added = l.added;
  if (done && when(l?.doneAt)) out.doneAt = l.doneAt;
  if (text && dayKey(l?.from)) out.from = l.from;
  return out;
};
const linesOf = (a) => {
  const out = list(a).slice(0, MAX_LINES).map(lineOf);
  while (out.length && !out.at(-1).text) out.pop(); // no trailing blanks kept; blanks in the middle stay (lines keep their place)
  return out;
};

export const PLANS_KEPT = 10;
const blocksOf = (a) => list(a).slice(0, 80).filter((b) => HHMM.test(b?.start) && HHMM.test(b?.end)).map((b) => ({ ref: typeof b.ref === "string" && /^[\w-]{1,40}$/.test(b.ref) ? b.ref : "", start: b.start, end: b.end, kind: b.kind === "break" ? "break" : "task" }));
const refsOf = (a) => list(a).filter((r) => typeof r === "string" && /^[\w-]{1,40}$/.test(r)).slice(0, 80);

// Whatever was sent or saved, tidied into the one shape: never more lines than fit, text trimmed and capped
export function deskShape(x) {
  const o = x && typeof x === "object" ? x : {};
  const focus = Array.from({ length: FOCUS_N }, (_, i) => clip(list(o.focus)[i]));
  const given = list(o.sections).slice(0, MAX_SECTIONS);
  const gen = given.find((s) => s?.id === GENERAL);
  const general = linesOf(gen ? gen.lines : o.general);
  // an older day's three Tasks become its first General lines, keeping ids k0-k2 so the sweep's marks still match
  const tasks = list(o.key).slice(0, KEY_N).map((k, i) => ({ ...k, id: `k${i}` })).filter((k) => clip(k.text) && !general.some((l) => l.id === k.id));
  const sections = [{ id: GENERAL, name: "General", col: 0, work: Boolean(gen?.work), lines: [...linesOf(tasks), ...general].slice(0, MAX_LINES) }];
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
  const settledAt = Object.fromEntries(Object.entries(o.settledAt && typeof o.settledAt === "object" ? o.settledAt : {}).filter(([k, v]) => settled[k] && when(v)));
  // meetings and events jotted for the day: a time, how long, what, and whether it's work
  const meetings = list(o.meetings).slice(0, MAX_MEETINGS).map((m, i) => ({ id: idOf(m?.id, i, "m"), time: timeOr(m?.time, ""), mins: mins(m?.mins), title: clip(m?.title), work: Boolean(m?.work) }));
  while (meetings.length && !meetings.at(-1).title && !meetings.at(-1).time) meetings.pop();
  const day = { start: timeOr(o.day?.start, WORKDAY.start), end: timeOr(o.day?.end, WORKDAY.end) };
  // the time-blocked plan, worked out by planDay when Mel presses Save & plan (never typed)
  const blocks = blocksOf(o.blocks);
  const overflow = refsOf(o.overflow);
  // every Save & plan / Re-plan kept (newest last, at most PLANS_KEPT), so plan vs. what happened can be compared later
  const plans = list(o.plans).filter((p) => when(p?.at)).slice(-PLANS_KEPT).map((p) => ({ at: p.at, blocks: blocksOf(p.blocks), overflow: refsOf(p.overflow) }));
  return { focus, sections, meetings, day, blocks, overflow, plans, settled, settledAt, started: Boolean(o.started) };
}

// Which column a new section goes in: the shorter one (General always heads the left)
const height = (s) => 1 + Math.max(SECTION_ROWS, s.lines.length + 1);
export function shorterCol(sections) {
  const h = [0, 0];
  for (const s of sections) h[s.col] += height(s);
  return h[1] < h[0] ? 1 : 0;
}

// The sections that are always there (config/areas.json planner.fixedSections; Mel, 6 Oct 2026: Spark NZ and Jump
// issues, both Work), after General. One already there with the same name is adopted (it keeps its id and lines).
// Changes and returns the day.
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const isFixed = (sec, fixed = []) => sec.id === GENERAL || fixed.some((f) => sameName(f.name, sec.name || ""));
export function withFixed(d, fixed = []) {
  const rest = d.sections.slice(1);
  const pinned = [];
  for (const f of fixed) {
    if (!f?.name) continue;
    const at = rest.findIndex((s) => sameName(s.name || "", f.name));
    if (at >= 0) pinned.push(rest.splice(at, 1)[0]);
    else pinned.push({ id: `f-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "x"}`, name: clip(f.name, MAX_NAME), col: shorterCol([d.sections[0], ...pinned]), work: Boolean(f.work), lines: [] });
  }
  d.sections = [d.sections[0], ...pinned, ...rest];
  return d;
}

// A new day starts with the last day's section headers (empty), so "House" or "Admin" is waiting each morning:
// the fixed ones, and Mel's own only if something was written in them (an empty one isn't carried, 6 Oct 2026).
// Only once: after that the day is Mel's to change (a section she removes doesn't come back).
export function startDay(day, earlier, today, fixed = []) {
  const d = deskShape(day);
  if (d.started) return withFixed(d, fixed);
  const last = Object.keys(earlier || {}).filter((k) => dayKey(k) && k < today).sort().reverse()
    .map((k) => deskShape(earlier[k])).find((x) => x.sections.length > 1);
  for (const s of last?.sections.slice(1) || []) {
    const used = s.lines.some((l) => l.text) || isFixed(s, fixed);
    if (used && s.name && !d.sections.some((x) => sameName(x.name || "", s.name))) d.sections.push({ id: s.id, name: s.name, col: s.col, work: s.work, lines: [] });
  }
  d.started = true;
  return withFixed(d, fixed);
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
    for (const s of d.sections) for (const l of s.lines) if (l.text && !l.done) out.push({ key: `${day}:${l.id}`, day, from: l.from || day, added: l.added, section: s.name || "General", text: l.text, pri: l.pri, mins: l.mins });
  }
  return out.filter((x) => !settled[x.key]);
}

// How many days a carried item has been waiting, counting the day it was written as day 1 ("day 3" in the sweep)
export const carriedDays = (item, today) => Math.max(1, Math.round((Date.parse(today) - Date.parse(item.from || item.day)) / 86_400_000) + 1);

// The sweep's decision about an item, and when it was made. how: "today" | "done" | "gone"
export function settle(d, item, how, newId, now = new Date()) {
  if (how === "today") return bringForward(d, item, newId, now);
  d.settled[item.key] = how;
  d.settledAt[item.key] = now.toISOString();
  return d;
}

// Bring an unfinished item into today, back under its own header (made again if today hasn't got it), remembering
// the day it was first written (from) and when it was. Changes and returns today's shape.
export function bringForward(d, item, newId, now = new Date()) {
  d.settled[item.key] = "today";
  d.settledAt ??= {};
  d.settledAt[item.key] = now.toISOString();
  const name = item.section || "General";
  let sec = d.sections.find((s) => sameName(s.name || "", name));
  if (!sec) { sec = { id: `s${newId}`, name, col: shorterCol(d.sections), lines: [] }; d.sections.push(sec); }
  const blank = sec.lines.find((l) => !l.text);
  const line = { text: item.text, done: false, pri: item.pri || "", mins: item.mins || 0, from: item.from || item.day, ...(item.added ? { added: item.added } : {}) };
  if (blank) Object.assign(blank, line); else sec.lines.push({ id: newId, ...line });
  return d;
}

// What happened to a line, stamped as it happens (on the page): first written, ticked, unticked, cleared
export function stampLine(line, now = new Date()) {
  if (!line.text) { delete line.added; delete line.doneAt; delete line.from; return line; }
  line.added ??= now.toISOString();
  if (line.done) line.doneAt ??= now.toISOString(); else delete line.doneAt;
  return line;
}

// Keep a plan when it's made (Save & plan / Re-plan), and make it the current one
export function keepPlan(d, { blocks, overflow }, now = new Date()) {
  d.blocks = blocks; d.overflow = overflow;
  d.plans = [...(d.plans || []), { at: now.toISOString(), blocks, overflow }].slice(-PLANS_KEPT);
  return d;
}

// ---- time-blocking ----
export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
export const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const up5 = (n) => Math.ceil(n / 5) * 5;
const RANK = { h: 0, m: 1, "": 1, l: 2 };

// Everything open today that could be planned: each section's lines; ref is the line's id.
// atWork: only Work items (Mel, 6 Oct 2026).
export function openItems(d, atWork = false) {
  const out = [];
  for (const s of d.sections) if (!atWork || s.work) for (const l of s.lines) if (l.text && !l.done) out.push({ ref: l.id, title: l.text, pri: l.pri, mins: l.mins, first: false, work: s.work, section: s.name });
  return out;
}

// Fill the free time between fixed things (meetings, calendar events) with the tasks: High, Medium, Low (in the order written). Each, in that order, takes the earliest gap it fits, so a short task can
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
