// The Jump Dashboard's rules (10 Oct 2026; brief docs/plans/2026-10-jump-dashboard.md), shared by the page and the
// server and tested in test/jump.test.js. Read-only: Jump OS (three Notion databases) owns every fact here; Hanua
// shows what's recorded there and points back to it. Only safe columns come through (title, status, tier, dates, who
// it's waiting on): an escalation's Issue and Outcome can hold customer details, so they stay behind the ↗ in Notion.
import { addDays, dayOf, daysBetween, weekStart, parseDay } from "./dates.js";

// The statuses an escalation moves through before Closed, in the order the dashboard counts them
export const ESC_STATUSES = ["Open", "Interim guidance given", "Awaiting confirmation", "With Content Design"];
export const ESC_SHORT = { "Open": "Open", "Interim guidance given": "Interim", "Awaiting confirmation": "Awaiting", "With Content Design": "With CD" };
export const CAP = 8; // escalations listed before "n more in Notion"

// A Notion record (server/notion.js normalisePage) as the dashboard needs it: only the columns named in config
// (fields: { key: "Notion column" }), never the rest of the row
export function rowOf(rec, fields = {}) {
  const out = { id: String(rec?.id || ""), url: rec?.url || null, title: String(rec?.title || "Untitled").slice(0, 200) };
  for (const [key, col] of Object.entries(fields)) {
    if (key === "title") continue;
    const v = rec?.fields?.[col];
    out[key] = v === undefined || v === null || v === "" ? null : Array.isArray(v) ? null : String(v).slice(0, 200);
  }
  return out;
}

// "Person A, T2 Care: can we…" → "Person A": the name before the first comma, colon, dash or bracket
export function personOf(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const name = t.split(/\s*(?:[,:;(]|\s[-–—]\s)\s*/)[0].trim();
  return (name || t).slice(0, 40);
}

const age = (from, today) => (from && /^\d{4}-\d{2}-\d{2}/.test(from) ? Math.max(0, daysBetween(dayOf(from), today)) : null);
const older = (a, b) => (b.age ?? -1) - (a.age ?? -1) || a.title.localeCompare(b.title);

// sources: { escalations, projects, questions }, each { rows } or { error } (one failing never hides the others).
// opts: { closedStatus, showStatuses, openStatuses, blocking, cap }
export function shapeJump(sources = {}, today, opts = {}) {
  const { closedStatus = "Closed", showStatuses = ["Blocked", "Active"], openStatuses = ["Open", "Being worked"], blocking = "Blocking", cap = CAP } = opts;
  const monday = weekStart(parseDay(today));
  const out = {};

  // Escalations: open ones grouped by status, oldest first; how many closed since Monday
  const esc = sources.escalations || { rows: [] };
  if (esc.error) out.escalations = { error: esc.error };
  else {
    const open = esc.rows.filter((r) => r.status !== closedStatus).map((r) => ({ ...r, age: age(r.date, today) })).sort(older);
    const groups = ESC_STATUSES.map((s) => ({ status: s, short: ESC_SHORT[s], count: open.filter((r) => r.status === s).length }));
    const other = open.filter((r) => !ESC_STATUSES.includes(r.status)).length;
    if (other) groups.push({ status: "Other", short: "Other", count: other });
    const closedThisWeek = esc.rows.filter((r) => r.status === closedStatus && r.closed && dayOf(r.closed) >= monday && dayOf(r.closed) <= today).length;
    out.escalations = { open: open.length, groups, items: open.slice(0, cap), more: Math.max(0, open.length - cap), closedThisWeek };
  }

  // Projects: Blocked first (they need a push), then Active; soonest target first within each
  const pro = sources.projects || { rows: [] };
  if (pro.error) out.projects = { error: pro.error };
  else {
    const rank = (r) => { const i = showStatuses.indexOf(r.status); return i < 0 ? showStatuses.length : i; };
    const items = pro.rows.filter((r) => showStatuses.includes(r.status))
      .sort((a, b) => rank(a) - rank(b) || (a.date || "9999").localeCompare(b.date || "9999") || a.title.localeCompare(b.title));
    out.projects = { items, blocked: items.filter((r) => r.status === showStatuses[0]).length };
  }

  // Questions: the open ones marked Blocking, oldest first; the top three shown
  const qs = sources.questions || { rows: [] };
  if (qs.error) out.questions = { error: qs.error };
  else {
    const open = qs.rows.filter((r) => openStatuses.includes(r.status));
    const block = open.filter((r) => r.priority === blocking).map((r) => ({ ...r, age: age(r.date, today) })).sort(older);
    out.questions = { open: open.length, blocking: block.length, top: block.slice(0, 3) };
  }

  // Waiting on: every open escalation and open question that names someone, grouped by that person; the person
  // waited on longest first (Project Tracker has no person column, so projects aren't here)
  const waits = [];
  if (!esc.error) for (const r of esc.rows) if (r.status !== closedStatus && personOf(r.waitingOn)) waits.push({ who: personOf(r.waitingOn), kind: "escalation", id: r.id, url: r.url, title: r.title, age: age(r.date, today) });
  if (!qs.error) for (const r of qs.rows) if (openStatuses.includes(r.status) && personOf(r.waitingOn)) waits.push({ who: personOf(r.waitingOn), kind: "question", id: r.id, url: r.url, title: r.title, age: age(r.date, today) });
  const people = new Map();
  for (const w of waits) { const key = w.who.toLowerCase(); people.set(key, [...(people.get(key) || []), w]); }
  out.waiting = [...people.values()].map((items) => { items.sort(older); return { who: items[0].who, items, oldest: items[0].age }; })
    .sort((a, b) => (b.oldest ?? -1) - (a.oldest ?? -1) || a.who.localeCompare(b.who));
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
