// The quick close and what Hanua learns from the days (15 Oct 2026; brief
// docs/plans/2026-10-planner-keys-and-close-insights.md). Made-up text only (the repo is public).
import { test } from "node:test";
import assert from "node:assert/strict";
import { closeDayRecord, closeItems, closeSuggest, dayFacts, deskShape, reopenDay, weekFacts, LET_GO_AFTER } from "../public/shared/desk.js";

const L = (id, text, extra = {}) => ({ id, text, done: false, pri: "", mins: 0, ...extra });
const day = (lines, more = {}) => deskShape({ sections: [{ id: "general", lines }], ...more });

test("the quick close keeps a mood, chips and one line; unknown ones are dropped; old closes stay as they were", () => {
  const d = closeDayRecord(day([]), { mood: "hard", blockers: ["meetings", "meetings", "made-up"], line: "  Long day  " }, new Date("2026-10-15T07:00:00Z"));
  assert.deepEqual(d.closed, { at: "2026-10-15T07:00:00.000Z", well: "", hard: "", mood: "hard", blockers: ["meetings"], line: "Long day" });
  assert.deepEqual(deskShape({ closed: { mood: "grumpy" } }).closed, undefined);
  assert.deepEqual(deskShape({ closed: { at: "2026-10-09T06:12:00.000Z", well: "a", hard: "b" } }).closed, { at: "2026-10-09T06:12:00.000Z", well: "a", hard: "b" });
  reopenDay(d);
  assert.equal(d.closed.at, undefined);
  assert.equal(d.closed.mood, "hard"); // kept for the next close
});

test("the close suggests Tomorrow, or Let go for a task carried often that isn't High", () => {
  const days = {};
  for (let i = 0; i < LET_GO_AFTER; i++) days[`2026-10-0${i + 1}`] = day([L(`o${i}`, "Sort the drawer", { origin: "x" })]);
  const today = day([L("a", "Sort the drawer", { origin: "x" }), L("b", "Fresh task"), L("c", "Old but urgent", { origin: "y", pri: "h" })]);
  for (let i = 0; i < LET_GO_AFTER; i++) days[`2026-10-0${i + 1}`].sections[0].lines.push(L(`u${i}`, "Old but urgent", { origin: "y" }));
  days["2026-10-04"] = today;
  const s = closeSuggest(closeItems(today, "2026-10-04"), days);
  assert.equal(s.get("a").how, "let");
  assert.equal(s.get("b").how, "tomorrow");
  assert.equal(s.get("c").how, "tomorrow"); // High stays
});

test("day facts: ticked on the day, planned, and closed in the evening, the next morning, or not at all", () => {
  const d = { sections: [{ id: "general", lines: [L("a", "One", { done: true, doneAt: new Date(2026, 9, 12, 11).toISOString() }), L("b", "Two")] }],
    blocks: [{ kind: "task", ref: "a", start: "09:00", end: "10:00" }], locked: true };
  const f = dayFacts(d, "2026-10-12");
  assert.equal(f.tasks, 2); assert.equal(f.done, 1); assert.equal(f.tickedOnDay, 1); assert.equal(f.planned, true); assert.equal(f.plannedMins, 60);
  assert.equal(f.closed, "no");
  assert.equal(dayFacts(d, "2026-10-12", { "2026-10-13": { settled: { "2026-10-12:b": "gone" } } }).closed, "morning");
  assert.equal(dayFacts({ ...d, closed: { at: "2026-10-12T07:00:00Z" } }, "2026-10-12").closed, "evening");
});

test("week facts: counts, the top blocker, and at most three suggestions (carried, routine, too big)", () => {
  const days = {};
  const keys = ["2026-09-28", "2026-10-01", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-13", "2026-10-14"];
  for (const k of keys) days[k] = { sections: [{ id: "general", lines: [L(`w${k}`, "Weekly report!", { origin: `w${k}` }), L(`s${k}`, "Sort the drawer", { origin: "x" })] }],
    blocks: [{ kind: "task", ref: `w${k}`, start: "09:00", end: "13:00" }], locked: true, overflow: [`s${k}`],
    closed: { at: `${k}T07:00:00Z`, mood: "ok", blockers: ["meetings"] } };
  const w = weekFacts(days, "2026-09-28", "2026-10-14");
  assert.equal(w.days, 7);
  assert.equal(w.closed.evening, 7);
  assert.equal(w.topBlocker, "meetings");
  assert.deepEqual(w.suggestions.map((s) => s.kind), ["carried", "routine", "toobig"]);
  assert.match(w.suggestions[2].text, /about 4 h/);
  assert.ok(w.suggestions.length <= 3);
  assert.deepEqual(weekFacts({}, "2026-10-01", "2026-10-14").suggestions, []);
});
