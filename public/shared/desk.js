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
// the words are Mel's to change (Settings, step 6): the page sets them once they're read
export const setTimeWords = (w) => { for (const m of TIME_PICKS) if (w?.[m]) TIME_WORDS[m] = w[m]; };
export const timeLabel = (m) => (TIME_WORDS[m] ? `${TIME_WORDS[m]} (${minsText(m)})` : minsText(m));
const KEPT_MINS = [...new Set([...TIME_PICKS, ...MEETING_PICKS])]; // an older 90m line keeps its time
export const DEFAULT_MINS = 30, GAP = 5, MEETING_PAD = 5, BREAK_AFTER = 90, BREAK_MINS = 10, MAX_MEETINGS = 12;
export const WORKDAY = { start: "08:30", end: "17:30" };
// How a day is saved. Raise it whenever deskShape learns a new field: the page and server must agree, or a save is
// refused (never quietly trimmed). On 6 Oct 2026 a page newer than the running server lost its meetings that way.
export const DESK_VERSION = 6; // 3: no Tasks, fixed sections, time words, when things happened; 4: the draft day (order, locked); 5: saves carry the revision they started from (two Macs); 6: origin and parent on lines, the gone list (F4 + subtasks, 8 Oct 2026)
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
// added = first written, doneAt = ticked, from = the day it was first written when it's been carried forward;
// origin = the id it had on the day it was first written, kept wherever it's carried or sent (F4, 8 Oct 2026; absent
// = its own id), so "carried 4 times" can be counted; parent = the task it's a subtask of (8 Oct 2026, one level)
const ID = /^[\w-]{1,40}$/;
const lineOf = (l, i) => {
  const text = clip(l?.text), done = Boolean(text && l?.done);
  const out = { id: idOf(l?.id, i), text, done, pri: pri(l?.pri), mins: mins(l?.mins) };
  if (text && when(l?.added)) out.added = l.added;
  if (done && when(l?.doneAt)) out.doneAt = l.doneAt;
  if (text && dayKey(l?.from)) out.from = l.from;
  if (text && typeof l?.origin === "string" && ID.test(l.origin) && l.origin !== out.id) out.origin = l.origin;
  if (text && typeof l?.parent === "string" && ID.test(l.parent)) out.parent = l.parent;
  return out;
};
const linesOf = (a) => {
  const out = list(a).slice(0, MAX_LINES).map(lineOf);
  while (out.length && !out.at(-1).text) out.pop(); // no trailing blanks kept; blanks in the middle stay (lines keep their place)
  return tidyGroups(out);
};
export const originOf = (l) => l.origin || l.id;

// ---- subtasks (Mel, 8 Oct 2026; brief docs/plans/2026-10-subtasks.md): one level, a subtask names its task ----
// A parent link is kept only when it names the nearest written task above (blank rows between are fine, and so are
// the task's other subtasks), and that task isn't a subtask itself. Anything else just becomes an ordinary task:
// grouping can be lost, never made up, and no line is ever dropped. A task with written subtasks is done exactly when
// all of them are (worked out, so it can't drift). Changes the lines in place and returns them.
export function tidyGroups(lines) {
  let top = null; // the nearest written task above that isn't a subtask
  for (const l of lines) {
    if (!l.text) { delete l.parent; continue; }
    if (l.parent && (l.parent !== top || l.parent === l.id)) delete l.parent;
    if (!l.parent) top = l.id;
  }
  for (const l of lines) {
    const kids = lines.filter((k) => k.parent === l.id);
    if (!kids.length) continue;
    const all = kids.every((k) => k.done);
    if (l.done !== all) l.done = all;
    if (!all) delete l.doneAt;
    else if (!l.doneAt) { const at = kids.map((k) => k.doneAt).filter(Boolean).sort().at(-1); if (at) l.doneAt = at; }
  }
  return lines;
}
export const tidyDay = (d) => { for (const s of d.sections) tidyGroups(s.lines); return d; };
// a task's subtasks (its written ones, in order); a subtask has none
export const kidsOf = (lines, id) => lines.filter((l) => l.parent === id && l.text);
// The lines a set of refs really means: a task brings its subtasks (all of them, or only the open ones), in order on
// the page; a subtask picked without its task comes on its own. Returns ids.
export function withFamilies(d, refs, { openKids = false } = {}) {
  const want = new Set(refs), out = [];
  for (const s of d.sections) for (const l of s.lines) {
    if (!l.text) continue;
    if (want.has(l.id) || (l.parent && want.has(l.parent) && (!openKids || !l.done))) out.push(l.id);
  }
  return out;
}
// Tab on a line: under the nearest written task above (the task itself when that's a subtask). Not on a section's
// first task, nor on a task that has subtasks of its own (one level). true when it moved.
export function indentLine(d, id) {
  for (const s of d.sections) {
    const i = s.lines.findIndex((l) => l.id === id);
    if (i < 0) continue;
    const l = s.lines[i];
    if (l.parent || kidsOf(s.lines, id).length) return false;
    const above = s.lines.slice(0, i).reverse().find((x) => x.text);
    if (!above) return false;
    l.parent = above.parent || above.id;
    tidyGroups(s.lines);
    return l.parent !== undefined;
  }
  return false;
}
// Shift+Tab: a subtask back out to a task; the subtasks after it (of the same task) become its own, so nothing on the
// page moves. true when it moved.
export function outdentLine(d, id) {
  for (const s of d.sections) {
    const i = s.lines.findIndex((l) => l.id === id);
    if (i < 0) continue;
    const l = s.lines[i], was = l.parent;
    if (!was) return false;
    delete l.parent;
    for (const k of s.lines.slice(i + 1)) if (k.parent === was) k.parent = l.id;
    tidyGroups(s.lines);
    return true;
  }
  return false;
}

// ---- what left a day (F4, 8 Oct 2026): sent to another day, removed (×, Clear) or cleared with the whole day. The
// line goes from its section as before; a note of it stays here, so the day's record is still true ----
export const GONE_MAX = 200;
const goneOf = (a) => list(a).filter((g) => typeof g?.id === "string" && ID.test(g.id) && ["sent", "removed", "cleared"].includes(g.how) && when(g.at)).slice(-GONE_MAX)
  .map((g) => ({ id: g.id, ...(typeof g.origin === "string" && ID.test(g.origin) && g.origin !== g.id ? { origin: g.origin } : {}), text: clip(g.text), section: clip(g.section, MAX_NAME), how: g.how, ...(dayKey(g.to) ? { to: g.to } : {}), at: g.at }));
const noteGone = (d, l, section, how, now, to) => {
  d.gone = [...(d.gone || []), { id: l.id, ...(l.origin ? { origin: l.origin } : {}), text: l.text, section, how, ...(to ? { to } : {}), at: now.toISOString() }].slice(-GONE_MAX);
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
  // the draft day (part F): Mel's order for the day's tasks while she arranges it, and whether it's locked in.
  // Days planned before the draft existed count as locked when they have blocks.
  const order = refsOf(o.order);
  const locked = typeof o.locked === "boolean" ? o.locked : blocks.length > 0;
  return { focus, sections, meetings, day, blocks, overflow, plans, order, locked, settled, settledAt, started: Boolean(o.started), gone: goneOf(o.gone) };
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
export const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
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
export function startDay(day, earlier, today, fixed = [], usualDay = null) {
  const d = deskShape(day);
  if (d.started) return withFixed(d, fixed);
  if (usualDay) d.day = { ...usualDay }; // a new day starts with Mel's usual hours (Settings)
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
    const item = (l, s) => ({ key: `${day}:${l.id}`, day, from: l.from || day, added: l.added, origin: originOf(l), section: s.name || "General", text: l.text, pri: l.pri, mins: l.mins });
    // a task comes with its open subtasks, as one item (kids); subtasks are never offered on their own
    for (const s of d.sections) for (const l of s.lines) if (l.text && !l.done && !l.parent) out.push({ ...item(l, s), kids: kidsOf(s.lines, l.id).filter((k) => !k.done).map((k) => item(k, s)) });
  }
  return out.filter((x) => !settled[x.key]).map((x) => ({ ...x, kids: x.kids.filter((k) => !settled[k.key]) }));
}

// How many days a carried item has been waiting, counting the day it was written as day 1 ("day 3" in the sweep)
export const carriedDays = (item, today) => Math.max(1, Math.round((Date.parse(today) - Date.parse(item.from || item.day)) / 86_400_000) + 1);

// The sweep's decision about an item, and when it was made. how: "today" | "done" | "gone"
export function settle(d, item, how, newId, now = new Date()) {
  if (how === "today") return bringForward(d, item, newId, now);
  for (const x of [item, ...(item.kids || [])]) { d.settled[x.key] = how; d.settledAt[x.key] = now.toISOString(); }
  return d;
}

// Bring an unfinished item into today, back under its own header (made again if today hasn't got it), remembering
// the day it was first written (from) and when it was. Changes and returns today's shape.
// A task comes with its open subtasks (item.kids), still under it. They go after the section's last written line
// (8 Oct 2026: filling the first blank row could split a task from its subtasks). newId: a fresh id, or a function
// giving them; each keeps the id it had first (origin).
export function bringForward(d, item, newId, now = new Date()) {
  const fresh = typeof newId === "function" ? newId : (() => { let n = 0; return () => (n++ ? `${newId}k${n - 1}` : String(newId)); })();
  d.settledAt ??= {};
  for (const x of [item, ...(item.kids || [])]) { d.settled[x.key] = "today"; d.settledAt[x.key] = now.toISOString(); }
  const name = item.section || "General";
  let sec = d.sections.find((s) => sameName(s.name || "", name));
  if (!sec) { sec = { id: `s${fresh()}`, name, col: shorterCol(d.sections), lines: [] }; d.sections.push(sec); }
  while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
  const lineOfItem = (x) => ({ text: x.text, done: false, pri: x.pri || "", mins: x.mins || 0, from: x.from || x.day, ...(x.added ? { added: x.added } : {}), ...(x.origin ? { origin: x.origin } : {}) });
  const top = { id: fresh(), ...lineOfItem(item) };
  sec.lines.push(top);
  for (const k of item.kids || []) if (sec.lines.length < MAX_LINES) sec.lines.push({ id: fresh(), ...lineOfItem(k), parent: top.id });
  for (const l of sec.lines) if (l.origin === l.id) delete l.origin;
  tidyGroups(sec.lines);
  return d;
}

// What happened to a line, stamped as it happens (on the page): first written, ticked, unticked, cleared
export function stampLine(line, now = new Date()) {
  if (!line.text) { delete line.added; delete line.doneAt; delete line.from; return line; }
  line.added ??= now.toISOString();
  if (line.done) line.doneAt ??= now.toISOString(); else delete line.doneAt;
  return line;
}

// The draft day's first order (Mel, 6 Oct 2026): High, Medium, Low, and within each the quick ones first, so the
// day builds momentum (blank time counts as Half hour); ties keep the order written. Refs already in Mel's own order
// (from earlier today) keep it, and anything new slots in where the rule would put it.
export function draftOrder(items, mine = []) {
  const rank = (x) => [RANK[x.pri || ""], x.mins || DEFAULT_MINS];
  const byRule = items.map((x, i) => ({ ...x, i })).sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1] || a.i - b.i);
  const known = new Set(items.map((x) => x.ref));
  const kept = mine.filter((r) => known.has(r));
  if (!kept.length) return byRule.map((x) => x.ref);
  const out = [...kept];
  for (const x of byRule) {
    if (out.includes(x.ref)) continue;
    // before the first kept item the rule would put after it
    const at = out.findIndex((r) => { const y = items.find((z) => z.ref === r); return rank(y)[0] > rank(x)[0] || (rank(y)[0] === rank(x)[0] && rank(y)[1] > rank(x)[1]); });
    out.splice(at < 0 ? out.length : at, 0, x.ref);
  }
  return out;
}
// Move one ref to a new place in the order
export function moveInOrder(order, ref, to) {
  const out = order.filter((r) => r !== ref);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, ref);
  return out;
}

// Several lines at once (part G): move them to another section (after its last written line, filling blanks), or
// set their priority, time or tick. Lines keep their ids, so the plan, the sweep and the record still find them.
// A task moves with its subtasks; a subtask moved without its task becomes a task there. They go after the section's
// last written line, together (8 Oct 2026: filling blank rows could scatter a task's subtasks).
export function moveLines(d, refs, toId) {
  const to = d.sections.find((x) => x.id === toId);
  if (!to) return d;
  const want = new Set(withFamilies(d, refs)), moving = [];
  for (const sec of d.sections) {
    if (sec === to) continue;
    sec.lines = sec.lines.filter((l) => { if (want.has(l.id) && l.text) { moving.push({ ...l }); return false; } return true; }); // out of its old section altogether: no empty copy with the same id left behind
    while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
    tidyGroups(sec.lines);
  }
  const ids = new Set(moving.map((l) => l.id));
  for (const l of moving) if (l.parent && !ids.has(l.parent)) delete l.parent;
  while (to.lines.length && !to.lines.at(-1).text) to.lines.pop();
  to.lines.push(...moving);
  tidyGroups(to.lines);
  return d;
}
// Several lines' priority, time or tick. Ticking (or unticking) a task does the same to its subtasks; a task whose
// subtasks are all ticked is ticked itself (tidyGroups). Priority and time are each line's own.
export function setLines(d, refs, patch, now = new Date()) {
  const want = new Set("done" in patch ? withFamilies(d, refs) : refs);
  for (const sec of d.sections) {
    const was = new Map(sec.lines.map((l) => [l, l.done]));
    for (const l of sec.lines) if (want.has(l.id) && l.text) Object.assign(l, patch);
    tidyGroups(sec.lines);
    for (const l of sec.lines) if (l.text && was.get(l) !== l.done) stampLine(l, now); // only lines whose tick changed
  }
  return d;
}
// Take lines off a day altogether (× and Clear, 8 Oct 2026): a task goes with its subtasks; each is noted in the day's
// gone list. how: "removed" | "cleared". Returns how many went.
export function removeLines(d, refs, how = "removed", now = new Date()) {
  const want = new Set(withFamilies(d, refs));
  let n = 0;
  for (const sec of d.sections) {
    sec.lines = sec.lines.filter((l) => { if (!want.has(l.id) || !l.text) return true; noteGone(d, l, sec.name || "General", how, now); n++; return false; });
    while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
    tidyGroups(sec.lines);
  }
  d.order = (d.order || []).filter((r) => !want.has(r));
  return n;
}
// How many times a task has been carried to another day: the days it's been on (by its first id), less the first.
// days: { "YYYY-MM-DD": shape }
export function timesCarried(days, origin) {
  const on = Object.values(days).filter((raw) => deskShape(raw).sections.some((s) => s.lines.some((l) => l.text && originOf(l) === origin)));
  return Math.max(0, on.length - 1);
}
// ---- planning another day (Mel, 6 Oct 2026, evening: "it's Tuesday evening and I want to plan tomorrow") ----
// Send lines to another day: they leave this day's page altogether (so its sweep never offers them again) and wait on
// the other day under a section of the same name (made there if it hasn't got one), remembering the day they were
// first written (from). takeLines changes `d` and returns what it took; putLines changes `to` and returns it.
// A task goes with its open subtasks; ticked ones stay, done, on the day they were done (8 Oct 2026: sending used to
// untick them). A line picked on its own (a task without subtasks, or a lone subtask) goes as picked. Each is noted in
// the day's gone list (sent, to). toDay: where they're going.
export function takeLines(d, refs, day, toDay = null, now = new Date()) {
  const want = new Set(withFamilies(d, refs, { openKids: true })), out = [];
  for (const sec of d.sections) {
    sec.lines = sec.lines.filter((l) => {
      if (!want.has(l.id) || !l.text) return true;
      out.push({ section: sec.name || "General", work: sec.work, line: { ...l, done: false, from: l.from || day, ...(l.origin ? {} : { origin: l.id }) } });
      noteGone(d, l, sec.name || "General", "sent", now, toDay);
      return false;
    });
    while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
    tidyGroups(sec.lines);
  }
  const ids = new Set(out.map((t) => t.line.id));
  for (const t of out) if (t.line.parent && !ids.has(t.line.parent)) delete t.line.parent;
  d.order = (d.order || []).filter((r) => !want.has(r));
  return out;
}
// Lines onto another day, under a section of the same name (made there if missing), after its last written line. A
// task and its subtasks go together or not at all (a full section takes none of them); a line whose id is already on
// that day gets a new one, and its subtasks follow it. t.placed: where each went (Undo takes them back off).
export function putLines(to, taken, newId) {
  const fams = [];
  for (const t of taken) { if (t.line.parent && fams.length && fams.at(-1)[0].line.id === t.line.parent) fams.at(-1).push(t); else { delete t.line.parent; fams.push([t]); } }
  for (const fam of fams) {
    const { section, work } = fam[0];
    let sec = to.sections.find((s) => sameName(s.name || "General", section));
    if (!sec) { sec = { id: `s${newId()}`, name: section, col: shorterCol(to.sections), work: Boolean(work), lines: [] }; to.sections.push(sec); }
    while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
    if (sec.lines.length + fam.length > MAX_LINES) continue; // a full section keeps what it has (the page says how many went)
    const map = {};
    for (const t of fam) {
      const line = { ...t.line };
      const id = to.sections.some((s) => s.lines.some((l) => l.id === line.id)) ? newId() : line.id;
      map[line.id] = id;
      if (line.parent) line.parent = map[line.parent];
      delete line.doneAt;
      if (line.origin === id) delete line.origin;
      sec.lines.push({ ...line, id });
      t.placed = id;
    }
    tidyGroups(sec.lines);
  }
  return to;
}
// What putLines couldn't place (a full section) goes back to the day it came from, and its "sent" note comes off
// (9 Oct 2026: they were lost from both days). Returns how many came back.
export function returnUnplaced(from, taken, newId) {
  const back = taken.filter((t) => !t.placed).map((t) => ({ ...t, line: { ...t.line } }));
  if (!back.length) return 0;
  const ids = new Set(back.map((t) => t.line.id));
  from.gone = (from.gone || []).filter((g) => !(g.how === "sent" && ids.has(g.id)));
  for (const t of back) delete t.placed;
  putLines(from, back, newId);
  for (const t of back) delete t.placed;
  return back.length;
}
// Take a day's page back to empty (Clear this day): its hours and sections' names stay, nothing written does
export function clearDay(d, now = new Date()) {
  d.focus = d.focus.map(() => "");
  for (const s of d.sections) { for (const l of s.lines) if (l.text) noteGone(d, l, s.name || "General", "cleared", now); s.lines = []; }
  Object.assign(d, { meetings: [], blocks: [], overflow: [], order: [], locked: false });
  return d;
}
// What a day holds, in a line (the week view, Up next's days ahead)
export function daySummary(x) {
  const d = deskShape(x);
  // a task with subtasks is a heading: its subtasks are what's counted (8 Oct 2026)
  const lines = d.sections.flatMap((s) => s.lines.filter((l) => l.text && !kidsOf(s.lines, l.id).length));
  const tasks = lines.filter((l) => !l.done).length, done = lines.length - tasks;
  const focus = d.focus.filter(Boolean).length, meetings = d.meetings.filter((m) => m.title || m.time).length;
  // titles: the first few open tasks, for the week view's cards (8 Oct 2026)
  const titles = lines.filter((l) => !l.done).slice(0, 3).map((l) => l.text.slice(0, 60));
  return { focus, tasks, done, meetings, titles, locked: d.locked && d.blocks.length > 0, written: Boolean(focus || lines.length || meetings) };
}
// Monday to Sunday of the week `day` is in (shift: weeks either side)
export function weekDays(day, shift = 0) {
  const [y, m, dd] = day.split("-").map(Number);
  const back = (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7;
  const monday = stepDay(day, shift * 7 - back);
  return Array.from({ length: 7 }, (_, i) => stepDay(monday, i));
}
// A time typed in a plain box (Mel, 8 Oct 2026: the browser's own time box was hard to read in Safari): "930",
// "9.30", "9:30am", "2pm", "14", "1430" → "HH:MM", or null when it can't be read. Without am / pm, lean says which
// half of the day a bare 1–11 is: "auto" (meetings): 1 to 6 the afternoon (a meeting at "3" is 3 pm), 7 to 11 the
// morning; "am" (a day's start): the morning; "pm" (a day's end): the afternoon. 0, 12 and 13–23 are as they are.
export function parseTime(s, lean = "auto") {
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(a|am|p|pm)?$/.exec(String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").replace(/(\d) (?=[ap])/, "$1"));
  if (!m) return null;
  let hr = Number(m[1]); const min = m[2] ? Number(m[2]) : 0, ap = m[3]?.[0];
  if (min > 59) return null;
  if (ap) { if (hr < 1 || hr > 12) return null; hr = (hr % 12) + (ap === "p" ? 12 : 0); }
  else { if (hr > 23) return null; if (hr >= 1 && hr <= 11 && (lean === "pm" || (lean === "auto" && hr <= 6))) hr += 12; }
  return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
// "14:30" → "2:30 pm"; "" stays ""
export const timeText = (t) => { if (!t) return ""; const [hh, mm] = t.split(":").map(Number); return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`; };
// The day picker (Mel, 8 Oct 2026: add a task to next week without opening that day): this week and next, Monday
// first, each { day, past, today }
export const pickerDays = (today) => [...weekDays(today), ...weekDays(today, 1)].map((day) => ({ day, past: day < today, today: day === today }));
// A new task straight onto another day's page, under the section of the same name (made there if missing)
export const addLineTo = (d, section, work, line, newId) => putLines(d, [{ section: section || "General", work: Boolean(work), line }], newId);
// A plan made ahead, on the morning: the blocks that now run into a fixed thing (a meeting moved in the calendar
// since). The plan stays as Mel made it; the page offers Re-plan.
export function clashes(blocks, fixed) {
  const busy = fixed.filter((f) => HHMM.test(f.start) && HHMM.test(f.end)).map((f) => [toMin(f.start), toMin(f.end), f.title]);
  return blocks.filter((b) => b.kind === "task").filter((b) => busy.some(([s, e]) => toMin(b.start) < e && s < toMin(b.end)));
}

export function removeMeeting(d, id) {
  d.meetings = d.meetings.filter((m) => m.id !== id);
  return d;
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
// A task with open subtasks is a heading: its subtasks are planned instead, each with its own time, and a subtask with
// no priority takes its task's (worked out here, never written). under: the task's words, for showing.
export function openItems(d, atWork = false) {
  const out = [];
  for (const s of d.sections) if (!atWork || s.work) for (const l of s.lines) {
    if (!l.text || l.done || kidsOf(s.lines, l.id).some((k) => !k.done)) continue;
    const up = l.parent ? s.lines.find((x) => x.id === l.parent) : null;
    out.push({ ref: l.id, title: l.text, pri: l.pri || up?.pri || "", mins: l.mins, first: false, work: s.work, section: s.name, ...(up ? { under: up.text } : {}) });
  }
  return out;
}

// Fill the free time between fixed things (meetings, calendar events) with the tasks: High, Medium, Low (in the order written). Each, in that order, takes the earliest gap it fits, so a short task can
// still use a gap a long one couldn't. Time is a rough pick (blank = 30 min); a 5-minute gap round every block and
// meeting is the buffer, and after at least 45 minutes of unbroken work, anything that would go past about 90 gets a
// 10-minute break first. A task never splits; what doesn't fit before the end of the day is overflow.
// Times are "HH:MM"; fixed: [{ start, end }]; from: plan from now if that's later than the day's start.
export function planDay({ tasks, fixed = [], from = "00:00", day = WORKDAY, keepOrder = false }) {
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
  // keepOrder: Mel's own order from the draft day, as given; otherwise High, Medium, Low
  const order = keepOrder ? tasks.map((t, i) => ({ ...t, i })) : tasks.map((t, i) => ({ ...t, first: Boolean(t.first), i })).sort((a, b) => Number(b.first) - Number(a.first) || (a.first ? a.i - b.i : RANK[a.pri || ""] - RANK[b.pri || ""] || a.i - b.i));
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
    // when it was last changed (an ISO time): on two Macs, the later edit of a note wins (shared/sync.js mergeStickies)
    edited: typeof n?.edited === "string" && !Number.isNaN(Date.parse(n.edited)) ? new Date(n.edited).toISOString() : null,
  }));
}
// the notes still up, oldest first, never more than fit on the wall
export const stickiesUp = (list) => stickyShape(list).filter((n) => !n.down).slice(0, STICKY_MAX);
