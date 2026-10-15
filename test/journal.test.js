// The Journal (15 Oct 2026; brief docs/plans/2026-10-journal.md). Made-up text only (invented): the repo is public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { areasWritten, faleOf, fromBlocks, isEmpty, journalShape, journalShown, promptFor, toBlocks, weekOf, weekTitle, AREAS, CARRY, FREELY, MAX_SECTION, SECTIONS } from "../public/shared/journal.js";

const notionify = (blocks) => blocks.map((b) => ({ ...b, [b.type]: { rich_text: b[b.type].rich_text.map((t) => ({ plain_text: t.text.content })) } }));

test("a week's page keeps every section, only known ones, and never cuts a thought short below the cap", () => {
  const s = journalShape({ sections: { family: "Called home (invented)", Made: "x", Work: "a".repeat(MAX_SECTION + 5) } }).sections;
  assert.deepEqual(Object.keys(s), SECTIONS);
  assert.equal(s.Family, "Called home (invented)");
  assert.equal(s.Work.length, MAX_SECTION);
  assert.equal(isEmpty(journalShape({}).sections), true);
  assert.deepEqual(areasWritten({ Family: "x", Self: " ", [FREELY]: "y", [CARRY]: "z" }), ["Family", FREELY]);
});

test("to Notion and back: the same words, line by line, long lines split and joined", () => {
  const sections = journalShape({ sections: { Family: "One (invented)\n\nTwo", Self: "b".repeat(4500), [CARRY]: "Put down the inbox (invented)" } }).sections;
  const blocks = toBlocks(sections);
  assert.equal(blocks[0].type, "heading_2");
  assert.ok(blocks.every((b) => (b[b.type].rich_text[0]?.text.content || "").length <= 2000));
  const back = fromBlocks(notionify(blocks));
  assert.equal(back.Family, "One (invented)\n\nTwo");
  assert.equal(back[CARRY], "Put down the inbox (invented)");
  assert.equal(back.Self.replace(/\n/g, "").length, 4500); // split across paragraphs, nothing lost
});

test("written in Notion: unknown headings and text before the first heading land in Write freely", () => {
  const p = (t) => ({ type: "paragraph", paragraph: { rich_text: [{ plain_text: t }] } });
  const h = (t) => ({ type: "heading_2", heading_2: { rich_text: [{ plain_text: t }] } });
  const back = fromBlocks([p("Before anything (invented)"), h("work"), p("Busy week (invented)"), h("Holiday ideas"), p("Beach (invented)")]);
  assert.equal(back.Work, "Busy week (invented)");
  assert.equal(back[FREELY], "Before anything (invented)\nHoliday ideas\nBeach (invented)");
});

test("one question a week per section, the same everywhere, ↻ moves on; none when the page has none", () => {
  const prompts = { family: ["A (invented)", "B (invented)", "C (invented)"] };
  const one = promptFor(prompts, "Family", "2026-10-12"), next = promptFor(prompts, "Family", "2026-10-19");
  assert.ok(prompts.family.includes(one));
  assert.notEqual(one, next);
  assert.equal(promptFor(prompts, "Family", "2026-10-12", 3), one); // round the list
  assert.notEqual(promptFor(prompts, "Family", "2026-10-12", 1), one);
  assert.equal(promptFor(prompts, "Work", "2026-10-12"), "");
});

test("weeks, titles, the fale, and never at work or asleep", () => {
  assert.equal(weekOf("2026-10-15"), "2026-10-12");
  assert.equal(weekTitle("2026-10-12"), "Week of 12 Oct 2026");
  const f = faleOf([{ week: "2026-10-12", areas: ["Family", "Work"] }, { week: "2026-10-05", areas: ["Family"] }, { week: "2026-09-01", areas: ["Self"] }], "2026-09-21", "2026-10-12");
  assert.equal(f.Family, 2); assert.equal(f.Work, 1); assert.equal(f.Self, 0);
  assert.deepEqual(Object.keys(f), [...AREAS, FREELY]);
  assert.equal(journalShown({}), true);
  assert.equal(journalShown({ atWork: true }), false);
  assert.equal(journalShown({ asleep: true }), false);
});
