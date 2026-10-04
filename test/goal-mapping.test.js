// Goals <-> Notion rows (server/goals.js) and the coach's rules (public/coach.js). No Notion or network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toGoal, goalProperties, goalOptions } from "../server/goals.js";
import { suggestSize, coachChecks } from "../public/coach.js";

const fields = { title: "Goal", date: "Due", status: "Status", amount: "Progress", level: "Level", area: "Area", description: "Description",
  parent: "Parent", children: "Children", priority: "Priority", effort: "Effort", start: "Start", completed: "Completed", why: "Why", doneWhen: "Done when", felt: "Felt" };
const schema = { Goal: { type: "title" }, Due: { type: "date" }, Status: { type: "status", options: ["New", "Active", "At risk", "Done"] },
  Progress: { type: "number" }, Level: { type: "select", options: ["Epic", "Feature", "PBI", "Task"] }, Area: { type: "select", options: ["Work", "Health"] },
  Description: { type: "rich_text" }, Parent: { type: "relation" }, Priority: { type: "number" }, Effort: { type: "number" }, Start: { type: "date" },
  Completed: { type: "date" }, Why: { type: "rich_text" }, "Done when": { type: "rich_text" }, Felt: { type: "select" } };

test("a Notion row becomes a goal", () => {
  const g = toGoal({ id: "abc", url: "u", title: "Move to Sydney", date: "2027-03-01", status: "Active", amount: 0.4,
    fields: { Level: "Epic", Parent: ["p1"], Effort: 5, Why: "So that" } }, fields);
  assert.equal(g.level, "Epic");
  assert.equal(g.parent, "p1");
  assert.equal(g.progressSet, 40);
  assert.equal(g.effort, 5);
  assert.equal(g.description, "");
});

test("form values become Notion properties; blanks clear, missing keys are left alone", () => {
  const props = goalProperties(schema, { title: "Book flights", status: "Active", due: "2026-11-02", parent: "p1", progress: "40", why: "", effort: "3" }, fields);
  assert.deepEqual(props.Goal, { title: [{ text: { content: "Book flights" } }] });
  assert.deepEqual(props.Status, { status: { name: "Active" } });
  assert.deepEqual(props.Due, { date: { start: "2026-11-02" } });
  assert.deepEqual(props.Parent, { relation: [{ id: "p1" }] });
  assert.deepEqual(props.Progress, { number: 0.4 });
  assert.deepEqual(props.Why, { rich_text: [] }, "an emptied field is cleared");
  assert.deepEqual(props.Effort, { number: 3 });
  assert.ok(!("Start" in props), "a field not sent is left as it is");
});

test("a cleared title is never sent as empty", () => {
  assert.ok(!("Goal" in goalProperties(schema, { title: "" }, fields)));
});

test("status and area choices come from the Notion schema", () => {
  assert.deepEqual(goalOptions(schema, fields), { level: ["Epic", "Feature", "PBI", "Task"], status: ["New", "Active", "At risk", "Done"], area: ["Work", "Health"] });
});

test("sizing suggestion adds unknowns and waiting to the work", () => {
  assert.equal(suggestSize({ work: null }), null);
  assert.equal(suggestSize({ work: 1 }).pts, 2);
  assert.equal(suggestSize({ work: 2, unknown: 2, waiting: 1 }).pts, 13);
});

test("coach checks nudge a topic-style title and a missing parent", () => {
  const checks = coachChecks({ level: "Task", title: "Sydney flights" }, { parentLevel: "PBI" });
  assert.equal(checks[0].ok, false);
  assert.equal(checks[1].ok, false);
  assert.ok(coachChecks({ level: "Task", title: "Book flights", parent: "p1" }, {}).slice(0, 2).every((c) => c.ok));
});
