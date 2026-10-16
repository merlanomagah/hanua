// The Jump team (Mel, 16 Oct 2026; brief docs/plans/2026-10-jump-team.md): eight standing AI members, one per core
// stakeholder area plus a Product Manager over the whole programme. Each member's charter is a Notion page under
// "Jump team" in her work OS (written by role, never by name: the pages can be handed on), with a heading per part.
// These rules read and write a charter, say when it's gone stale, fold new context in one approved change at a time,
// keep identifiers out of anything sent to Claude, and check the team's answers cite only what they were shown.
// Shared by the page, the server and the tests.
import { daysBetween } from "./dates.js";

export const SECTIONS = ["Holds", "What matters", "Key risks", "Affects", "Standing questions", "Context notes", "Last confirmed"];
export const EDITABLE = SECTIONS.filter((s) => s !== "Last confirmed");
export const NOTES = "Context notes", CONFIRMED = "Last confirmed";
export const STALE_DAYS = 30; // a charter not confirmed for a month: the PM flags it
export const NOTE_REVIEW_DAYS = 90; // a context note this old comes up for review: fold it in, or let it go
const LINE = 600; // a charter line stays a line

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const sectionOf = (h) => SECTIONS.find((s) => norm(s) === norm(h)) || null;
const clean = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, LINE);

// ---- a charter page: blocks ⇄ { sections: { name: [lines] }, extra: [{ heading, lines }] } ----
const textOf = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
export function charterFrom(blocks = []) {
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  const extra = [];
  let at = null;
  for (const b of blocks) {
    if (/^heading_/.test(b.type)) {
      const s = sectionOf(textOf(b));
      if (s) at = { known: s };
      else { at = { heading: clean(textOf(b)), lines: [] }; extra.push(at); }
      continue;
    }
    if (!at || !["paragraph", "bulleted_list_item", "numbered_list_item", "to_do"].includes(b.type)) continue;
    const t = clean(textOf(b));
    if (!t) continue;
    if (at.known) sections[at.known].push(t); else at.lines.push(t);
  }
  return { sections, extra };
}
const rich = (t) => [{ type: "text", text: { content: t } }];
export function charterBlocks({ sections = {}, extra = [] } = {}) {
  const out = [];
  const add = (heading, lines) => {
    out.push({ object: "block", type: "heading_2", heading_2: { rich_text: rich(heading) } });
    for (const l of lines || []) if (clean(l)) out.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: rich(clean(l)) } });
  };
  for (const s of SECTIONS) add(s, sections[s]);
  for (const x of extra) add(x.heading, x.lines);
  return out;
}

// ---- staying current ----
const dateIn = (t) => /\b(\d{4}-\d{2}-\d{2})\b/.exec(String(t || ""))?.[1] || null;
export const confirmedOf = (sections) => (sections?.[CONFIRMED] || []).map(dateIn).find(Boolean) || null;
// a context note: "2026-10-16 · what was said"
export const noteLine = (day, text) => `${day} · ${clean(text)}`;
export function charterState(sections, today) {
  const confirmed = confirmedOf(sections);
  const days = confirmed ? daysBetween(confirmed, today) : null;
  const oldNotes = (sections?.[NOTES] || []).filter((n) => { const d = dateIn(n); return d && daysBetween(d, today) > NOTE_REVIEW_DAYS; }).length;
  return { confirmed, days, stale: !confirmed || days > STALE_DAYS, oldNotes,
    label: !confirmed ? "Not confirmed yet" : days > STALE_DAYS ? `Stale: confirmed ${days} days ago` : days === 0 ? "Confirmed today" : `Confirmed ${days} day${days === 1 ? "" : "s"} ago` };
}
export const confirmCharter = (sections, today) => ({ ...sections, [CONFIRMED]: [today] });

// ---- one change at a time: { section, op: "add" | "replace" | "remove", line, with? } ----
// Returns { ok, sections } or { ok: false, error } in plain words (the line to replace or remove must be there)
export function applyEdit(sections, edit) {
  const s = sectionOf(edit?.section);
  if (!s || !EDITABLE.includes(s)) return { ok: false, error: `“${edit?.section}” isn't a part of the charter that can change.` };
  const list = [...(sections?.[s] || [])], line = clean(edit.line), next = clean(edit.with);
  const i = list.findIndex((l) => norm(l) === norm(line));
  if (edit.op === "add") { if (!line) return { ok: false, error: "Nothing to add." }; if (i >= 0) return { ok: false, error: "That's already there." }; list.push(line); }
  else if (edit.op === "replace") { if (i < 0) return { ok: false, error: "The line to change isn't there any more." }; if (!next) return { ok: false, error: "Nothing to change it to." }; list[i] = next; }
  else if (edit.op === "remove") { if (i < 0) return { ok: false, error: "The line to remove isn't there any more." }; list.splice(i, 1); }
  else return { ok: false, error: "Add, change or remove only." };
  return { ok: true, sections: { ...sections, [s]: list } };
}

// ---- nothing that identifies a customer goes to Claude: Hanua refuses, it never quietly masks ----
const FINDERS = [
  ["an email address", /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ["a phone number", /(?:\+64|\b0)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}\b/],
  ["a long number (an account or broadband number?)", /\d(?:[\s-]?\d){5,}/],
  ["an account label", /\b(?:acct|account\s*(?:no|number|#)|BAN|ONT\s*(?:id|serial)?)\b/i],
];
export function scrub(text) {
  const t = String(text || "");
  const scan = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " "); // dates are fine
  const hits = FINDERS.filter(([, re]) => re.test(scan)).map(([what]) => what);
  return { ok: !hits.length, hits };
}
export const scrubMessage = (hits) => `Hanua didn't send this: it looks like it has ${hits.join(" and ")}. Take it out (say "the customer" or the role instead) and send again.`;

// ---- what the team is shown: whitelisted fields only (never an escalation's Issue, Outcome or Resolution, never
// who raised it or who it waits on); a title with an identifier in it is withheld ----
export function teamRows(jump = {}) {
  const out = [];
  const title = (t) => (scrub(t).ok ? String(t || "").slice(0, 160) : "(title withheld: it holds an identifier)");
  for (const c of jump.escalations?.columns || []) for (const r of c.items || [])
    out.push({ id: r.id, area: "escalations", title: title(r.title), status: r.status, tier: r.tier || null, age: r.age ?? null });
  for (const r of jump.projects?.items || []) out.push({ id: r.id, area: "projects", title: title(r.title), status: r.status, target: r.date || null });
  for (const r of jump.questions?.items || []) out.push({ id: r.id, area: "questions", title: title(r.title), status: r.status, priority: r.priority || null, age: r.age ?? null });
  return out;
}

// ---- the team's answer may only cite what it was shown: anything else is marked unconfirmed, never trusted ----
export function grounded(items = [], knownIds = []) {
  const known = new Set(knownIds);
  return items.map((it) => {
    const cites = (it.cites || []).filter((c) => known.has(c));
    const dropped = (it.cites || []).length - cites.length;
    return { ...it, cites, unconfirmed: Boolean(it.unconfirmed) || !cites.length, ...(dropped ? { droppedCites: dropped } : {}) };
  });
}

// stand-ups per week (this Mac): the probe's evidence
export function bumpWeek(counts = {}, week) {
  const out = { ...counts, [week]: (counts[week] || 0) + 1 };
  for (const k of Object.keys(out).sort().slice(0, -8)) delete out[k];
  return out;
}
