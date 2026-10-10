// The Jump Dashboard's rules (public/shared/jump.js). Every row here is invented: the repo is public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowOf, personOf, shapeJump, jumpFilters, notionLink, boardColumns, timelineSpan, checkWrite, undoOf, applyTo, ageFill, DEFAULT_OPTIONS } from "../public/shared/jump.js";

const TODAY = "2026-10-15"; // a Thursday; that week's Monday is the 12th
const esc = (id, status, extra = {}) => ({ id, url: `https://example.invalid/${id}`, title: `Escalation ${id}`, status, date: null, closed: null, tier: "T2", waitingOn: null, ...extra });
const opts = { escalations: DEFAULT_OPTIONS.escalations, projects: DEFAULT_OPTIONS.projects, questions: DEFAULT_OPTIONS.questions };

test("rowOf keeps only the configured columns; Issue, Outcome and Resolution only as filled-in or not", () => {
  const rec = { id: "x1", url: "u", title: "A title", fields: { Escalation: "A title", Status: "Open", Tier: "T1", Issue: "a customer's details", Outcome: "", Other: "secret" } };
  const r = rowOf(rec, { title: "Escalation", status: "Status", tier: "Tier", waitingOn: "Waiting on", issue: "Issue", outcome: "Outcome" });
  assert.deepEqual(r, { id: "x1", url: "u", title: "A title", status: "Open", tier: "T1", waitingOn: null, issueSet: true, outcomeSet: false });
  assert.equal(JSON.stringify(r).includes("customer"), false);
  assert.equal(rowOf({}, {}).title, "Untitled");
});

test("personOf takes the name before the first comma, colon, dash or bracket", () => {
  assert.equal(personOf("Person A, T2 team: can we confirm"), "Person A");
  assert.equal(personOf("Person B - the app question"), "Person B");
  assert.equal(personOf("Person C (partner)"), "Person C");
  assert.equal(personOf("Person-D"), "Person-D");
  assert.equal(personOf(""), null);
});

test("the board: a column per status (Notion's order kept, extras before Closed), oldest first, this week's closed", () => {
  assert.deepEqual(boardColumns(["Closed", "Awaiting confirmation", "Open", "Escalated"]), ["Open", "Awaiting confirmation", "Escalated", "Closed"]);
  assert.deepEqual(boardColumns(null), [...DEFAULT_OPTIONS.escalations.status]);
  const rows = [
    esc("a", "Open", { date: "2026-10-13" }), esc("b", "Open", { date: "2026-10-01" }),
    esc("c", "Awaiting confirmation", { date: "2026-10-09" }), esc("d", "Something old", { date: "2026-10-14" }),
    esc("e", "Closed", { date: "2026-10-01", closed: "2026-10-12" }), esc("f", "Closed", { date: "2026-10-01", closed: "2026-10-11" }),
  ];
  const e = shapeJump({ escalations: { rows } }, TODAY, { options: opts }).escalations;
  const col = (s) => e.columns.find((c) => c.status === s);
  assert.deepEqual(col("Open").items.map((r) => [r.id, r.age]), [["b", 14], ["a", 2]]);
  assert.equal(col("Open").items[0].fill, 1);
  assert.deepEqual(col("Closed").items.map((r) => r.id), ["e"]); // Sunday's is last week's
  assert.deepEqual(col("Other").items.map((r) => r.id), ["d"]); // a status Notion no longer has still shows
  assert.equal(e.columns.at(-1).status, "Closed");
  assert.deepEqual([e.open, e.closedThisWeek], [4, 1]);
  assert.equal(ageFill(null), 0);
  assert.equal(ageFill(7), 0.5);
  assert.equal(ageFill(40), 1);
});

test("waiting on: grouped by person from escalations and questions, longest wait first", () => {
  const rows = [
    esc("a", "Open", { date: "2026-10-10", waitingOn: "Person A, about the form" }),
    esc("b", "Open", { date: "2026-10-01", waitingOn: "Person B - an app fix" }),
    esc("c", "Closed", { date: "2026-09-01", waitingOn: "Person C" }),
    esc("d", "Open", { date: "2026-10-13", waitingOn: "person a" }),
  ];
  const questions = { rows: [{ id: "q1", title: "A question", status: "Open", priority: "Worth resolving", date: "2026-10-05", waitingOn: "Person A" },
    { id: "q2", title: "Answered one", status: "Answered", priority: "Blocking", date: "2026-09-01", waitingOn: "Person E" }] };
  const { waiting } = shapeJump({ escalations: { rows }, questions }, TODAY);
  assert.deepEqual(waiting.map((w) => [w.who, w.items.length, w.oldest]), [["Person B", 1, 14], ["Person A", 3, 10]]);
  assert.deepEqual(waiting[1].items.map((i) => i.area), ["questions", "escalations", "escalations"]);
});

test("projects: Blocked first, soonest first; a timeline in shares of the width, overdue ending before today", () => {
  const projects = { rows: [
    { id: "p1", title: "Later", status: "Active", date: "2026-12-01" }, { id: "p2", title: "Sooner", status: "Active", date: "2026-11-01" },
    { id: "p3", title: "Stuck", status: "Blocked", date: null }, { id: "p4", title: "Done one", status: "Done", date: null },
    { id: "p5", title: "Late", status: "Active", date: "2026-10-05" },
  ] };
  const p = shapeJump({ projects }, TODAY).projects;
  assert.deepEqual(p.items.map((r) => r.id), ["p3", "p5", "p2", "p1"]);
  const s = p.span;
  assert.equal(s.from, "2026-10-05");
  assert.equal(s.to, "2026-12-08");
  assert.ok(s.today > 0 && s.today < 1);
  assert.equal(s.bars.p3, undefined); // no date: listed, no bar
  assert.ok(s.bars.p5.overdue && s.bars.p5.end === s.today && s.bars.p5.start === 0);
  assert.ok(s.bars.p1.end === 1 - 7 / 64 && s.bars.p1.start === s.today);
  assert.deepEqual(s.months.map((m) => m.day), ["2026-11-01", "2026-12-01"]);
  assert.deepEqual(timelineSpan([], TODAY).bars, {});
});

test("questions: the open ones, Blocking first; one source failing doesn't hide the others", () => {
  const q = (n, extra = {}) => ({ id: `q${n}`, title: `Q${n}`, status: "Open", priority: "Blocking", date: `2026-10-0${n}`, ...extra });
  const out = shapeJump({ questions: { rows: [q(3), q(1, { priority: "Nice to know" }), q(2), q(4, { status: "Parked" })] } }, TODAY);
  assert.deepEqual([out.questions.open, out.questions.blocking], [3, 2]);
  assert.deepEqual(out.questions.items.map((r) => r.id), ["q2", "q3", "q1"]);
  const broken = shapeJump({ escalations: { error: "Hanua can't see it" }, projects: { rows: [] } }, TODAY);
  assert.deepEqual(broken.escalations, { error: "Hanua can't see it" });
  assert.deepEqual(broken.waiting, []);
});

// ---- writing back (v2) ----
const w = (area, change, ctx = {}) => checkWrite(area, change, { options: opts[area], today: TODAY, ...ctx });

test("checkWrite: only the allowed fields, only Jump OS's own choices, nothing emptied but by Undo", () => {
  assert.deepEqual(w("escalations", { status: "Awaiting confirmation" }, { row: { status: "Open" } }), { ok: true, values: { status: "Awaiting confirmation" } });
  assert.equal(w("escalations", { status: "Awaitng" }).ok, false); // a typo would make a new option in Notion
  assert.equal(w("escalations", { tier: "T9" }).ok, false);
  assert.equal(w("escalations", { secret: "x" }).ok, false);
  assert.equal(w("projects", { title: "renamed" }).ok, false);
  assert.equal(w("nowhere", { status: "Open" }).ok, false);
  assert.equal(w("escalations", {}).ok, false);
  assert.equal(w("escalations", { waitingOn: "" }).ok, false);
  assert.deepEqual(w("escalations", { waitingOn: "" }, { undo: true }).values, { waitingOn: null });
  assert.equal(w("projects", { next: "x".repeat(500) }).values.next.length, 200);
  assert.equal(w("escalations", { date: "soon" }).ok, false);
});

test("checkWrite: Jump OS's rules: closing needs a Finding and an Outcome and sets the date; reopening clears it", () => {
  const open = { status: "Open", finding: null, outcomeSet: false };
  assert.match(w("escalations", { status: "Closed" }, { row: open }).error, /Finding/);
  assert.match(w("escalations", { status: "Closed", finding: "No guidance existed" }, { row: open }).error, /Outcome/);
  assert.deepEqual(w("escalations", { status: "Closed", finding: "No guidance existed", outcome: "Told Care to …" }, { row: open }).values,
    { status: "Closed", finding: "No guidance existed", outcome: "Told Care to …", closed: TODAY });
  // an Outcome already recorded is never overwritten, and doesn't need writing again
  assert.match(w("escalations", { outcome: "new words" }, { row: { outcomeSet: true } }).error, /already recorded/);
  assert.equal(w("escalations", { status: "Closed", finding: "Not a content issue" }, { row: { ...open, outcomeSet: true } }).ok, true);
  assert.deepEqual(w("escalations", { status: "Open" }, { row: { status: "Closed" } }).values, { status: "Open", closed: null });
});

test("checkWrite: answering a question needs its Resolution and sets Resolved; adding needs a title", () => {
  assert.match(w("questions", { status: "Answered" }, { row: { status: "Open" } }).error, /Resolution/);
  assert.match(w("questions", { status: "Wont resolve" }, { row: { status: "Open" } }).error, /reason/);
  assert.deepEqual(w("questions", { status: "Answered", resolution: "The answer" }, { row: { status: "Open" } }).values, { status: "Answered", resolution: "The answer", resolved: TODAY });
  assert.equal(w("questions", { status: "Being worked" }, { row: { status: "Open" } }).ok, true);
  assert.equal(w("escalations", { tier: "T1" }, { create: true }).ok, false);
  assert.deepEqual(w("escalations", { title: "A new one", tier: "T1", issue: "what was asked" }, { create: true }).values,
    { title: "A new one", tier: "T1", issue: "what was asked", status: "Open", date: TODAY });
  assert.equal(w("escalations", { title: "x", outcome: "y" }, { create: true }).ok, false); // only the add form's fields
});

test("undoOf puts the old values back (empty where Hanua wrote a private field); applyTo shows a change at once", () => {
  const row = { id: "a", status: "Open", finding: null, outcomeSet: false, closed: null, waitingOn: "Person A" };
  const values = { status: "Closed", finding: "No guidance existed", outcome: "words", closed: TODAY };
  assert.deepEqual(undoOf(row, values), { status: "Open", finding: null, outcome: null, closed: null });
  const shown = applyTo(row, values);
  assert.deepEqual([shown.status, shown.outcomeSet, shown.closed, "outcome" in shown], ["Closed", true, TODAY, false]);
  assert.equal(w("escalations", undoOf(row, values), { undo: true, row: shown }).ok, true);
});

test("jumpFilters ask Notion only for open rows (and the last week's closed escalations)", () => {
  const cfg = { escalations: { fields: { status: "Status", closed: "Closed" }, closedStatus: "Closed" },
    projects: { fields: { status: "Status" }, showStatuses: ["Blocked", "Active"] }, questions: { fields: { status: "Status" }, openStatuses: ["Open"] } };
  const f = jumpFilters(cfg, TODAY);
  assert.deepEqual(f.escalations.or[0], { property: "Status", select: { does_not_equal: "Closed" } });
  assert.deepEqual(f.escalations.or[1], { property: "Closed", date: { on_or_after: "2026-10-08" } });
  assert.equal(f.questions.or.length, 1);
});

test("notionLink turns a page id back into a link, and nothing else", () => {
  assert.equal(notionLink("12345678-1234-1234-1234-123456789abc"), "https://www.notion.so/12345678123412341234123456789abc");
  assert.equal(notionLink("sample-escalations-1"), null);
  assert.equal(notionLink("javascript:alert(1)"), null);
});
