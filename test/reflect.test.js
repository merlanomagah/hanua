// The Journal's entry types and the Work reflection (16 Oct 2026): the role page read, the questions, and a
// reflection to Notion blocks and back. Invented text only (the repo is public).
import { test } from "node:test";
import assert from "node:assert/strict";
import { KEYS, LAYERS, PARTS, TYPES, answered, fromBlocks, isEmpty, panelsText, questionFor, reflectionShape, reflectionTitle, roleFrom, toBlocks } from "../public/shared/reflect.js";

test("reflect: the Journal's types put Brain dump first, and the layers sit in two parts", () => {
  assert.deepEqual(TYPES.map((t) => t.id), ["dump", "work"]);
  assert.deepEqual([...new Set(LAYERS.map((l) => l.part))], PARTS);
  assert.equal(KEYS[0], "Where I'm at · The work");
});

test("reflect: the role page's headings are read loosely; seats split at the colon; a date is found", () => {
  const r = roleFrom({
    role: ["Ops lead (invented)"], "Last confirmed": ["2026-10-01 (invented)"], Context: ["A line (invented)", ""],
    "hp panel": ["Mindset coach: self-talk (invented)", "Plain seat"], "Professional Panel": [],
    "Where I'm at: The work": ["Q1 (invented)", "Q2 (invented)"], "where i’m heading – next step": ["Q3 (invented)"], "Something else": ["x"],
  });
  assert.equal(r.role, "Ops lead (invented)");
  assert.equal(r.confirmed, "2026-10-01");
  assert.deepEqual(r.context, ["A line (invented)"]);
  assert.deepEqual(r.panels.hp, [{ seat: "Mindset coach", lens: "self-talk (invented)" }, { seat: "Plain seat", lens: "" }]);
  assert.deepEqual(r.questions["Where I'm at · The work"], ["Q1 (invented)", "Q2 (invented)"]);
  assert.deepEqual(r.questions["Where I'm heading · Next step"], ["Q3 (invented)"]);
  assert.equal(Object.keys(r.questions).length, 2);
  assert.deepEqual(roleFrom({}).panels, { hp: [], professional: [] });
});

test("reflect: Deeper steps through a layer's questions and comes round again", () => {
  const q = { [KEYS[0]]: ["a", "b", "c"] };
  assert.deepEqual([0, 1, 2, 3].map((d) => questionFor(q, KEYS[0], d)), ["a", "b", "c", "a"]);
  assert.equal(questionFor(q, KEYS[1], 0), "");
});

test("reflect: a reflection goes to Notion and comes back the same, panels and all", () => {
  const r = reflectionShape({ date: "2026-10-16", answers: {
    [KEYS[0]]: { q: "What moved? (invented)", a: "Line one (invented)\nLine two (invented)" },
    [KEYS[6]]: { q: "", a: "Block Fridays (invented)" },
    [KEYS[2]]: { q: "Unanswered (invented)", a: "  " },
  }, panels: panelsText({ hp: [{ seat: "Mindset coach", says: "One (invented)" }], professional: [{ seat: "Career strategist", says: "Two (invented)" }], together: { push: "P (invented)", hold: "H (invented)", breather: "B (invented)" } }) });
  const blocks = toBlocks(r);
  assert.equal(blocks[0].type, "heading_2");
  assert.equal(blocks[1].type, "quote");
  assert.ok(!blocks.some((b) => b.heading_2?.rich_text?.[0]?.text?.content === KEYS[2])); // an empty answer isn't written
  const plain = blocks.map((b) => ({ type: b.type, [b.type]: { rich_text: b[b.type].rich_text.map((t) => ({ plain_text: t.text.content })) } }));
  const back = fromBlocks(plain);
  assert.equal(back.answers[KEYS[0]].a, "Line one (invented)\nLine two (invented)");
  assert.equal(back.answers[KEYS[0]].q, "What moved? (invented)");
  assert.equal(back.answers[KEYS[6]].a, "Block Fridays (invented)");
  assert.equal(back.panels, r.panels);
  assert.ok(back.panels.includes("Push: P (invented)"));
  assert.deepEqual(answered(back).map((l) => l.key), [KEYS[0], KEYS[6]]);
});

test("reflect: words written in Notion under an unknown heading are kept, not lost", () => {
  const b = (type, t) => ({ type, [type]: { rich_text: [{ plain_text: t }] } });
  const back = fromBlocks([b("paragraph", "Before any heading (invented)"), b("heading_2", "My own (invented)"), b("paragraph", "Under it (invented)"), b("heading_2", "Me"), b("paragraph", "nope")]);
  assert.equal(back.extra, "Before any heading (invented)\nMy own (invented)\nUnder it (invented)\nMe\nnope"); // "Me" alone is not one of the layers
  assert.equal(isEmpty(back), false);
});

test("reflect: empty, shape and title", () => {
  assert.equal(isEmpty(reflectionShape({})), true);
  assert.equal(reflectionShape({ date: "16 Oct" }).date, null);
  assert.equal(reflectionShape({ answers: { [KEYS[0]]: { a: "x".repeat(30000) } } }).answers[KEYS[0]].a.length, 20000);
  assert.equal(reflectionTitle("2026-10-16"), "Work reflection, 16 Oct 2026");
  assert.equal(panelsText(null), "");
});
