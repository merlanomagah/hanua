// The Jump Dashboard's rules (10 Oct 2026; briefs docs/plans/2026-10-jump-dashboard.md and -v2.md), shared by the page
// and the server and tested in test/jump.test.js. Jump OS (three Notion databases) owns every fact here: Hanua shows
// what's recorded there, and since v2 writes back to it, through these checks. Only safe columns come through to the
// page (title, status, tier, dates, who it's waiting on): an escalation's Issue and Outcome and a question's
// Resolution can hold customer details, so the page only ever learns whether they're filled in (issueSet, …).
import { addDays, dayOf, daysBetween, weekStart, parseDay } from "./dates.js";

// The statuses an escalation moves through before Closed, in the order the board shows them (Notion's own list wins
// where it has more: columns come from the database's options, in this order first)
export const ESC_STATUSES = ["Open", "Interim guidance given", "Awaiting confirmation", "With Content Design"];
export const ESC_SHORT = { "Open": "Open", "Interim guidance given": "Interim", "Awaiting confirmation": "Awaiting", "With Content Design": "With CD", "Closed": "Closed" };
export const AGE_FULL = 14; // an escalation's age bar is full at two weeks
// columns whose text never reaches the page: only whether they're filled in
export const PRIVATE = ["issue", "outcome", "resolution"];
// the options Hanua falls back on when Notion's schema can't be read (sample servers, or before it's read)
export const DEFAULT_OPTIONS = {
  escalations: { status: [...ESC_STATUSES, "Closed"], tier: ["T1", "T2", "Partner", "Ops", "Other"],
    finding: ["Guidance existed and was correct", "Guidance existed but was not findable", "Guidance was wrong or outdated", "No guidance existed", "Not a content issue"] },
  projects: { status: ["Active", "Blocked", "Parked", "Done"] },
  questions: { status: ["Open", "Being worked", "Answered", "Parked", "Wont resolve"] },
};

// A Notion record (server/notion.js normalisePage) as the dashboard needs it: only the columns named in config
// (fields: { key: "Notion column" }), never the rest of the row; private ones only as "filled in or not"
export function rowOf(rec, fields = {}) {
  const out = { id: String(rec?.id || ""), url: rec?.url || null, title: String(rec?.title || "Untitled").slice(0, 200) };
  for (const [key, col] of Object.entries(fields)) {
    if (key === "title") continue;
    const v = rec?.fields?.[col];
    const blank = v === undefined || v === null || v === "" || Array.isArray(v);
    if (PRIVATE.includes(key)) { out[`${key}Set`] = !blank; continue; }
    out[key] = blank ? null : String(v).slice(0, 200);
  }
  return out;
}

// "Person A, T2 team: can we…" → "Person A": the name before the first comma, colon, dash or bracket
export function personOf(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const name = t.split(/\s*(?:[,:;(]|\s[-–—]\s)\s*/)[0].trim();
  return (name || t).slice(0, 40);
}

const age = (from, today) => (from && /^\d{4}-\d{2}-\d{2}/.test(from) ? Math.max(0, daysBetween(dayOf(from), today)) : null);
const older = (a, b) => (b.age ?? -1) - (a.age ?? -1) || a.title.localeCompare(b.title);
// how full an age bar is (0–1)
export const ageFill = (n) => (n == null ? 0 : Math.max(0.04, Math.min(1, n / AGE_FULL)));

// the board's columns: the open statuses in the usual order (then any others Notion has), Closed last
export function boardColumns(options, closedStatus = "Closed") {
  const have = (options?.length ? options : DEFAULT_OPTIONS.escalations.status).filter((s) => s !== closedStatus);
  return [...ESC_STATUSES.filter((s) => have.includes(s)), ...have.filter((s) => !ESC_STATUSES.includes(s)), closedStatus];
}

// sources: { escalations, projects, questions }, each { rows } or { error } (one failing never hides the others).
// opts: { closedStatus, showStatuses, openStatuses, blocking, options }
export function shapeJump(sources = {}, today, opts = {}) {
  const { closedStatus = "Closed", showStatuses = ["Blocked", "Active"], openStatuses = ["Open", "Being worked"], blocking = "Blocking" } = opts;
  const monday = weekStart(parseDay(today));
  const out = {};

  // Escalations: every open one (oldest first, with its age) and the ones closed since Monday, by column
  const esc = sources.escalations || { rows: [] };
  if (esc.error) out.escalations = { error: esc.error };
  else {
    const withAge = (r) => ({ ...r, age: age(r.date, today), fill: ageFill(age(r.date, today)) });
    const open = esc.rows.filter((r) => r.status !== closedStatus).map(withAge).sort(older);
    const closed = esc.rows.filter((r) => r.status === closedStatus && r.closed && dayOf(r.closed) >= monday && dayOf(r.closed) <= today).map(withAge)
      .sort((a, b) => (b.closed || "").localeCompare(a.closed || ""));
    const cols = boardColumns(opts.options?.escalations?.status, closedStatus);
    const columns = cols.map((s) => ({ status: s, short: ESC_SHORT[s] || s, closed: s === closedStatus,
      items: s === closedStatus ? closed : open.filter((r) => r.status === s) }));
    // a status Notion no longer offers still shows, in a column of its own, so nothing goes missing
    const lost = open.filter((r) => !cols.includes(r.status));
    if (lost.length) columns.splice(columns.length - 1, 0, { status: "Other", short: "Other", closed: false, items: lost, other: true });
    out.escalations = { open: open.length, columns, closedThisWeek: closed.length };
  }

  // Projects: Blocked first, then Active; soonest target first within each
  const pro = sources.projects || { rows: [] };
  if (pro.error) out.projects = { error: pro.error };
  else {
    const rank = (r) => { const i = showStatuses.indexOf(r.status); return i < 0 ? showStatuses.length : i; };
    const items = pro.rows.filter((r) => showStatuses.includes(r.status))
      .sort((a, b) => rank(a) - rank(b) || (a.date || "9999").localeCompare(b.date || "9999") || a.title.localeCompare(b.title));
    out.projects = { items, blocked: items.filter((r) => r.status === showStatuses[0]).length, span: timelineSpan(items, today) };
  }

  // Questions: the open ones; those marked Blocking, oldest first
  const qs = sources.questions || { rows: [] };
  if (qs.error) out.questions = { error: qs.error };
  else {
    const open = qs.rows.filter((r) => openStatuses.includes(r.status)).map((r) => ({ ...r, age: age(r.date, today) })).sort(older);
    const block = open.filter((r) => r.priority === blocking);
    out.questions = { open: open.length, blocking: block.length, items: [...block, ...open.filter((r) => r.priority !== blocking)] };
  }

  // Waiting on: every open escalation and open question that names someone, grouped by that person; the person
  // waited on longest first (Project Tracker has no person column, so projects aren't here)
  const waits = [];
  if (!esc.error) for (const r of esc.rows) if (r.status !== closedStatus && personOf(r.waitingOn)) waits.push({ who: personOf(r.waitingOn), area: "escalations", id: r.id, url: r.url, title: r.title, waitingOn: r.waitingOn, age: age(r.date, today) });
  if (!qs.error) for (const r of qs.rows) if (openStatuses.includes(r.status) && personOf(r.waitingOn)) waits.push({ who: personOf(r.waitingOn), area: "questions", id: r.id, url: r.url, title: r.title, waitingOn: r.waitingOn, age: age(r.date, today) });
  const people = new Map();
  for (const w of waits) { const key = w.who.toLowerCase(); people.set(key, [...(people.get(key) || []), w]); }
  out.waiting = [...people.values()].map((items) => { items.sort(older); return { who: items[0].who, items, oldest: items[0].age }; })
    .sort((a, b) => (b.oldest ?? -1) - (a.oldest ?? -1) || a.who.localeCompare(b.who));
  return out;
}

// The projects' timeline: from a week before today (or the earliest date) to the latest target, in whole weeks.
// Each dated project gets where its bar starts and ends as shares of the width (0–1); the page draws with percentages,
// so nothing waits on measuring. Overdue ones end before today.
export function timelineSpan(items, today) {
  const dates = items.map((r) => r.date && dayOf(r.date)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""));
  const from = [addDays(today, -7), ...dates].sort()[0];
  const to = [addDays(today, 21), ...dates.map((d) => addDays(d, 7))].sort().at(-1);
  const days = Math.max(1, daysBetween(from, to));
  const at = (d) => daysBetween(from, d) / days;
  const months = [];
  for (let d = parseDay(from); ; ) {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (iso > to) break;
    months.push({ day: iso, at: at(iso) });
  }
  return { from, to, today: at(today), months,
    bars: Object.fromEntries(items.filter((r) => r.date).map((r) => { const end = at(dayOf(r.date)), now = at(today); return [r.id, { start: Math.min(now, end), end: Math.max(now, end), overdue: dayOf(r.date) < today }]; })) };
}

// ---- writing back (v2) ----
// What each area lets the dashboard change, and what kind of value it is. Issue, Outcome and Resolution can be
// written (once, when empty) but never read back or overwritten.
export const WRITABLE = {
  escalations: { title: "text", status: "select", tier: "select", date: "date", raisedBy: "text", waitingOn: "text", issue: "long", finding: "select", outcome: "long", closed: "date" },
  projects: { status: "select", next: "text" },
  questions: { status: "select", waitingOn: "text", resolution: "long", resolved: "date" },
};
const LIMIT = { text: 200, long: 1900 }; // Notion takes 2,000 characters a block of text
export const CREATABLE = { escalations: ["title", "status", "tier", "date", "raisedBy", "waitingOn", "issue"] };

// Checks a change before it's sent to Notion. change: { key: value }; ctx: { options: { key: [names] }, row (the
// current row, for an update), today, create, undo, cfg: { closedStatus, answered, wontResolve } }.
// Returns { ok: true, values } (the keys to write, Closed/Resolved dates added) or { ok: false, error } in plain words.
export function checkWrite(area, change, ctx = {}) {
  const kinds = WRITABLE[area];
  if (!kinds) return { ok: false, error: "That can't be changed from Hanua." };
  if (!change || typeof change !== "object" || !Object.keys(change).length) return { ok: false, error: "Nothing to change." };
  const { options = {}, row = {}, today, create = false, undo = false } = ctx;
  const closedStatus = ctx.cfg?.closedStatus || "Closed", answered = ctx.cfg?.answered || "Answered", wont = ctx.cfg?.wontResolve || "Wont resolve";
  const values = {};
  for (const [key, raw] of Object.entries(change)) {
    const kind = kinds[key];
    if (!kind || (create && !CREATABLE[area]?.includes(key))) return { ok: false, error: `“${key}” can't be changed from Hanua.` };
    if (raw === null || raw === "") { // clearing: only an Undo puts a field back to empty
      if (!undo) return { ok: false, error: `“${key}” can't be emptied from Hanua.` };
      values[key] = null; continue;
    }
    const v = String(raw).trim();
    if (kind === "select" && !(options[key] || []).includes(v)) return { ok: false, error: `“${v}” isn't one of Jump OS's choices for ${key}.` };
    if (kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `${key} needs a date.` };
    if (PRIVATE.includes(key) && row[`${key}Set`] && !undo) return { ok: false, error: `The ${key} is already recorded in Jump OS: change it there, so the older entry isn't overwritten.` };
    values[key] = v.slice(0, LIMIT[kind] || 200);
  }
  if (create && !values.title) return { ok: false, error: "An escalation needs a title." };
  if (undo) return { ok: true, values };
  // Jump OS's own rules
  if (area === "escalations" && values.status) {
    if (values.status === closedStatus) {
      if (!(values.finding || row.finding)) return { ok: false, error: "Closing needs the Finding: why it happened." };
      if (!(values.outcome || row.outcomeSet)) return { ok: false, error: "Closing needs the Outcome: what was decided and what Care was told." };
      values.closed = today;
    } else if (row.status === closedStatus) values.closed = null; // reopened
  }
  if (area === "questions" && values.status) {
    if ((values.status === answered || values.status === wont) && !(values.resolution || row.resolutionSet))
      return { ok: false, error: values.status === wont ? "“Wont resolve” needs the reason in the Resolution." : "Answering needs the Resolution: the answer, and what was updated." };
    if (values.status === answered || values.status === wont) values.resolved = today;
  }
  if (create && !values.status) values.status = (options.status || DEFAULT_OPTIONS.escalations.status)[0];
  if (create && !values.date) values.date = today;
  return { ok: true, values };
}

// The change that puts a row back as it was before `values` were written (for Undo): the old value of each key,
// empty where it was empty (a private field written by Hanua was empty before, or the write was refused)
export function undoOf(row = {}, values = {}) {
  const back = {};
  for (const key of Object.keys(values)) back[key] = PRIVATE.includes(key) ? null : row[key] ?? null;
  return back;
}

// The same change applied to a row in the page (so it shows at once, before Notion answers)
export function applyTo(row, values) {
  const out = { ...row };
  for (const [k, v] of Object.entries(values)) {
    if (PRIVATE.includes(k)) out[`${k}Set`] = v != null;
    else out[k] = v;
  }
  return out;
}

// The Notion filters that ask only for what the dashboard shows (open rows can't fall past the read limit)
export function jumpFilters(cfg, today) {
  const f = (area) => cfg?.[area]?.fields || {};
  const select = (col, name, how = "equals") => ({ property: col, select: { [how]: name } });
  const any = (col, names) => ({ or: names.map((n) => select(col, n)) });
  return {
    escalations: { or: [select(f("escalations").status, cfg?.escalations?.closedStatus || "Closed", "does_not_equal"),
      { property: f("escalations").closed, date: { on_or_after: addDays(today, -7) } }] },
    projects: any(f("projects").status, cfg?.projects?.showStatuses || ["Blocked", "Active"]),
    questions: any(f("questions").status, cfg?.questions?.openStatuses || ["Open", "Being worked"]),
  };
}

// a planner line's Notion pointer (the page id) back to a link
export const notionLink = (ref) => (/^[0-9a-f-]{32,36}$/i.test(String(ref || "")) ? `https://www.notion.so/${String(ref).replace(/-/g, "")}` : null);
