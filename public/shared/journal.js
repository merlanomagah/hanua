// The Journal (Mel, 15 Oct 2026; brief docs/plans/2026-10-journal.md): one ruled page a week, a section per area of
// life with a question to start the thinking, then Write freely and Carry forward. The areas follow the Fonofale
// idea of a house in balance (family the floor, culture and spirit the roof, the posts between). The page lives in
// Notion (the Journal database, one page per week, the words in its body); these rules shape it both ways, choose the
// week's question, and count which areas were written for the fale. Shared by the page and the server.
import { addDays, parseDay, weekStart } from "./dates.js";

export const AREAS = ["Family", "Self", "Relationships", "Work", "Spirit & culture"];
export const FREELY = "Write freely", CARRY = "Carry forward";
export const SECTIONS = [...AREAS, FREELY, CARRY];
// where each area sits in the fale (the drawing at the top of the page)
export const FALE = { Family: "floor", Self: "post", Relationships: "post", Work: "post", "Spirit & culture": "roof" };
export const MAX_SECTION = 20000; // characters a section keeps (a long week, never a cut-off thought)
const NOTION_TEXT = 2000; // Notion's limit for one piece of text

const clip = (t) => (typeof t === "string" ? t.replace(/\r\n/g, "\n").slice(0, MAX_SECTION) : "");
const sectionOf = (name) => SECTIONS.find((s) => s.toLowerCase() === String(name || "").trim().toLowerCase()) || null;

// a week's page as the page and server hold it: { sections: { name: text } } (every section, "" when empty)
export function journalShape(o = {}) {
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, ""]));
  for (const [k, v] of Object.entries(o?.sections && typeof o.sections === "object" ? o.sections : {})) {
    const s = sectionOf(k);
    if (s) sections[s] = clip(v);
  }
  return { sections };
}
const written = (t) => Boolean(t && t.trim());
// the areas with something written (for the Areas column and the fale); Carry forward isn't an area
export const areasWritten = (sections) => [...AREAS, FREELY].filter((s) => written(sections?.[s]));
export const isEmpty = (sections) => !SECTIONS.some((s) => written(sections?.[s]));

// ---- to and from Notion: a heading per written section, a paragraph per line ----
const rich = (t) => (t ? [{ type: "text", text: { content: t } }] : []);
export function toBlocks(sections) {
  const out = [];
  for (const s of SECTIONS) {
    const text = sections?.[s];
    if (!written(text)) continue;
    out.push({ object: "block", type: "heading_2", heading_2: { rich_text: rich(s) } });
    for (const line of text.replace(/\s+$/, "").split("\n")) {
      if (line.length <= NOTION_TEXT) { out.push({ object: "block", type: "paragraph", paragraph: { rich_text: rich(line) } }); continue; }
      for (let i = 0; i < line.length; i += NOTION_TEXT) out.push({ object: "block", type: "paragraph", paragraph: { rich_text: rich(line.slice(i, i + NOTION_TEXT)) } });
    }
  }
  return out;
}
const textOf = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
// What a week's page in Notion says, section by section. Written on the phone or in Notion too: text under a heading
// Hanua doesn't know, or before the first heading, goes to Write freely (with the heading kept), so nothing is lost.
export function fromBlocks(blocks = []) {
  const lines = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  let at = FREELY;
  for (const b of blocks) {
    if (/^heading_/.test(b.type)) {
      const s = sectionOf(textOf(b));
      if (s) { at = s; continue; }
      at = FREELY;
      lines[FREELY].push(textOf(b));
      continue;
    }
    if (["paragraph", "bulleted_list_item", "numbered_list_item", "quote", "to_do", "callout"].includes(b.type)) lines[at].push(textOf(b));
  }
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, lines[s].join("\n").replace(/^\n+|\n+$/g, "")]));
  return journalShape({ sections }).sections;
}
// a page written in Notion with a section split across two of its paragraphs reads back the same after a save
export const weekTitle = (week) => `Week of ${parseDay(week).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`;
export const weekOf = (day) => weekStart(parseDay(day));

// ---- the question for each section: one a week, the same on both Macs; ↻ steps to the next ----
// prompts: { heading: [lines] } from the Notion page "Hanua journal prompts" (headings matched ignoring capitals)
export function promptFor(prompts, section, week, skips = 0) {
  const key = Object.keys(prompts || {}).find((k) => k.trim().toLowerCase() === section.toLowerCase());
  const list = (key ? prompts[key] : []).filter((x) => x && x.trim());
  if (!list.length) return "";
  const n = Math.round(parseDay(week).getTime() / (7 * 86_400_000)); // weeks since 1970: moves on each Monday
  return list[(((n + skips) % list.length) + list.length) % list.length];
}

// The Journal is personal: never shown, nor fetched, at work or while Hanua sleeps
export const journalShown = ({ atWork = false, asleep = false } = {}) => !atWork && !asleep;

// The fale: how many weeks of the month (or any run of weeks) each area was written in. weeks: [{ week, areas }]
export function faleOf(weeks = [], from = null, to = null) {
  const out = Object.fromEntries([...AREAS, FREELY].map((a) => [a, 0]));
  for (const w of weeks) {
    if ((from && w.week < from) || (to && w.week > to)) continue;
    for (const a of w.areas || []) if (a in out) out[a] += 1;
  }
  return out;
}
// the weeks that make up "this month" for the fale: the last four, this one included
export const faleSpan = (week) => ({ from: addDays(week, -21), to: week });
