// The Journal's entry types and the Work reflection (Mel, 16 Oct 2026; brief docs/plans/2026-10-work-reflection.md).
// Double-clicking the Journal offers its types: Brain dump (the weekly page) and Work reflection. A work reflection
// asks layered questions in two parts, Where I'm at and Where I'm heading, from Mel's own Notion page "Hanua work
// reflection: my role" (her role, the context the panels need, who sits on each panel, and the questions; written by
// role, never by name). Each reflection is a page in the Notion Work reflections database, the questions and answers
// in its body. On her press only, two coach panels (High Performance and Professional) read it back; their reply is
// kept in the page only when she presses Keep. These rules shape it both ways; shared by the page and the server.
import { parseDay } from "./dates.js";

// The menu on the Journal file. A new type is one more row here (and its window).
export const TYPES = [
  { id: "dump", label: "Brain dump", sub: "This week's page" },
  { id: "work", label: "Work reflection", sub: "Where I'm at, where I'm heading" },
];

export const PARTS = ["Where I'm at", "Where I'm heading"];
export const LAYERS = [
  { part: PARTS[0], name: "The work" },
  { part: PARTS[0], name: "The people" },
  { part: PARTS[0], name: "The landscape" },
  { part: PARTS[0], name: "Me" },
  { part: PARTS[1], name: "Direction" },
  { part: PARTS[1], name: "Growth" },
  { part: PARTS[1], name: "Next step" },
].map((l) => ({ ...l, key: `${l.part} · ${l.name}` }));
export const KEYS = LAYERS.map((l) => l.key);
export const PANELS_HEAD = "What the panels said";
export const PANEL_HEADS = ["HP Panel", "Professional Panel", "Together"];
export const MAX_ANSWER = 20000;
const NOTION_TEXT = 2000;

// headings matched loosely: capitals, and "·", ":" or a dash between part and layer, are all the same
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[·:–—-]/g, " ").replace(/\s+/g, " ").trim();
const keyOf = (heading) => KEYS.find((k) => norm(k) === norm(heading)) || null;
const clip = (t, n = MAX_ANSWER) => (typeof t === "string" ? t.replace(/\r\n/g, "\n").slice(0, n) : "");
const written = (t) => Boolean(t && String(t).trim());

// ---- the role page: { heading: [lines] } (pageSections) → what the window and the panels need ----
const seatOf = (line) => { const i = line.indexOf(":"); return i > 0 ? { seat: line.slice(0, i).trim(), lens: line.slice(i + 1).trim() } : { seat: line.trim(), lens: "" }; };
export function roleFrom(sections = {}) {
  const get = (name) => { const k = Object.keys(sections).find((h) => norm(h) === norm(name)); return k ? (sections[k] || []).filter(written) : []; };
  const questions = {};
  for (const [h, lines] of Object.entries(sections)) { const k = keyOf(h); if (k) questions[k] = (lines || []).filter(written); }
  const confirmed = /\d{4}-\d{2}-\d{2}/.exec(get("Last confirmed").join(" "))?.[0] || null;
  return {
    role: get("Role")[0] || "",
    confirmed,
    context: get("Context"),
    panels: { hp: get("HP Panel").map(seatOf), professional: get("Professional Panel").map(seatOf) },
    questions,
  };
}

// The question for a layer: the first is the way in; "Deeper ↓" steps on through the list (surface, deeper, mirror)
export function questionFor(questions, key, depth = 0) {
  const list = (questions?.[key] || []).filter(written);
  return list.length ? list[((depth % list.length) + list.length) % list.length] : "";
}

// ---- a reflection: { date, answers: { key: { q, a } }, panels: "text", extra: "text" } ----
export function reflectionShape(o = {}) {
  const answers = {};
  for (const k of KEYS) {
    const v = o?.answers?.[k];
    answers[k] = { q: clip(v?.q, 500), a: clip(v?.a) };
  }
  const date = typeof o?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : null;
  return { date, answers, panels: clip(o?.panels), extra: clip(o?.extra) };
}
export const isEmpty = (r) => !KEYS.some((k) => written(r?.answers?.[k]?.a)) && !written(r?.extra);
export const reflectionTitle = (date) => `Work reflection, ${parseDay(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`;
// the answered layers only, as Claude and the page body see them
export const answered = (r) => LAYERS.filter((l) => written(r?.answers?.[l.key]?.a)).map((l) => ({ ...l, q: r.answers[l.key].q, a: r.answers[l.key].a.trim() }));

// ---- to and from Notion: a heading per answered layer, its question as a quote, the answer as paragraphs ----
const rich = (t) => (t ? [{ type: "text", text: { content: t } }] : []);
const block = (type, t) => ({ object: "block", type, [type]: { rich_text: rich(t) } });
function paragraphs(text) {
  const out = [];
  for (const line of String(text).replace(/\s+$/, "").split("\n")) {
    if (line.length <= NOTION_TEXT) { out.push(block("paragraph", line)); continue; }
    for (let i = 0; i < line.length; i += NOTION_TEXT) out.push(block("paragraph", line.slice(i, i + NOTION_TEXT)));
  }
  return out;
}
export function toBlocks(r) {
  const out = [];
  for (const l of answered(r)) {
    out.push(block("heading_2", l.key));
    if (l.q) out.push(block("quote", l.q.slice(0, NOTION_TEXT)));
    out.push(...paragraphs(l.a));
  }
  if (written(r?.extra)) out.push(block("heading_2", "Also written"), ...paragraphs(r.extra));
  if (written(r?.panels)) {
    out.push(block("heading_2", PANELS_HEAD));
    for (const line of r.panels.replace(/\s+$/, "").split("\n")) out.push(PANEL_HEADS.includes(line.trim()) ? block("heading_3", line.trim()) : paragraphs(line)[0] || block("paragraph", ""));
  }
  return out;
}
const textOf = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
// What a reflection's page says. Written or edited in Notion too: anything under a heading Hanua doesn't know (or
// before the first one) goes to "Also written" with the heading kept, so nothing is lost.
export function fromBlocks(blocks = []) {
  const answers = Object.fromEntries(KEYS.map((k) => [k, { q: "", a: [] }]));
  const extra = [], panels = [];
  let at = "extra";
  for (const b of blocks) {
    const t = textOf(b);
    if (/^heading_/.test(b.type)) {
      const k = keyOf(t);
      if (k) { at = k; continue; }
      if (norm(t) === norm(PANELS_HEAD)) { at = "panels"; continue; }
      if (at === "panels") { panels.push(t); continue; }
      if (norm(t) === norm("Also written")) { at = "extra"; continue; }
      at = "extra"; extra.push(t); continue;
    }
    if (b.type === "quote" && KEYS.includes(at) && !answers[at].q && !answers[at].a.length) { answers[at].q = t; continue; }
    if (!["paragraph", "bulleted_list_item", "numbered_list_item", "quote", "to_do", "callout"].includes(b.type)) continue;
    if (at === "panels") panels.push(t);
    else if (at === "extra") extra.push(t);
    else answers[at].a.push(t);
  }
  const trim = (lines) => lines.join("\n").replace(/^\n+|\n+$/g, "");
  return reflectionShape({
    answers: Object.fromEntries(KEYS.map((k) => [k, { q: answers[k].q, a: trim(answers[k].a) }])),
    panels: trim(panels), extra: trim(extra),
  });
}

// ---- the panels' reply: { hp: [{ seat, says }], professional: [...], together: { push, hold, breather } } ----
export function panelsText(reply) {
  if (!reply) return "";
  const seats = (list) => (list || []).filter((s) => written(s?.says)).map((s) => `${s.seat}: ${s.says.trim()}`);
  const t = reply.together || {};
  return [
    "HP Panel", ...seats(reply.hp), "",
    "Professional Panel", ...seats(reply.professional), "",
    "Together", written(t.push) ? `Push: ${t.push.trim()}` : null, written(t.hold) ? `Hold: ${t.hold.trim()}` : null, written(t.breather) ? `Breather: ${t.breather.trim()}` : null,
  ].filter((x) => x !== null).join("\n").trim();
}
