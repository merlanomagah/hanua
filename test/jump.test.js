// The Jump Dashboard's rules (public/shared/jump.js). Every row here is invented: the repo is public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowOf, personOf, shapeJump, jumpFilters, notionLink, CAP } from "../public/shared/jump.js";

const TODAY = "2026-10-15"; // a Thursday; that week's Monday is the 12th
const esc = (id, status, extra = {}) => ({ id, url: `https://example.invalid/${id}`, title: `Escalation ${id}`, status, date: null, closed: null, tier: "T2", waitingOn: null, ...extra });

test("rowOf keeps only the columns named in config, never the rest of the row", () => {
  const rec = { id: "x1", url: "u", title: "A title", fields: { Escalation: "A title", Status: "Open", Tier: "T1", Issue: "a customer's details", Outcome: "secret" } };
  const r = rowOf(rec, { title: "Escalation", status: "Status", tier: "Tier", waitingOn: "Waiting on" });
  assert.deepEqual(r, { id: "x1", url: "u", title: "A title", status: "Open", tier: "T1", waitingOn: null });
  assert.equal(JSON.stringify(r).includes("customer"), false);
  assert.equal(rowOf({}, {}).title, "Untitled");
});

test("personOf takes the name before the first comma, colon, dash or bracket", () => {
  assert.equal(personOf("Person A, T2 team: can we confirm"), "Person A");
  assert.equal(personOf("Person B - the app question"), "Person B");
  assert.equal(personOf("Person C (partner)"), "Person C");
  assert.equal(personOf("Person-D"), "Person-D"); // a hyphenated name stays whole
  assert.equal(personOf(""), null);
  assert.equal(personOf(null), null);
});

test("escalations: grouped by status, oldest first, capped, closed this week counted from Monday", () => {
  const rows = [
    esc("a", "Open", { date: "2026-10-13" }),
    esc("b", "Open", { date: "2026-10-01" }),
    esc("c", "Awaiting confirmation", { date: "2026-10-09" }),
    esc("d", "Something new", { date: "2026-10-14" }),
    esc("e", "Closed", { date: "2026-10-01", closed: "2026-10-12" }), // Monday: this week
    esc("f", "Closed", { date: "2026-10-01", closed: "2026-10-11" }), // Sunday: last week
    esc("g", "Closed", { date: "2026-10-01", closed: null }),
  ];
  const { escalations: e } = shapeJump({ escalations: { rows } }, TODAY);
  assert.deepEqual(e.items.map((r) => r.id), ["b", "c", "a", "d"]);
  assert.deepEqual(e.items.map((r) => r.age), [14, 6, 2, 1]);
  assert.equal(e.open, 4);
  assert.deepEqual(e.groups.map((g) => [g.short, g.count]), [["Open", 2], ["Interim", 0], ["Awaiting", 1], ["With CD", 0], ["Other", 1]]);
  assert.equal(e.closedThisWeek, 1);
  assert.equal(e.more, 0);
  const many = Array.from({ length: CAP + 3 }, (_, i) => esc(`m${i}`, "Open", { date: `2026-10-${String(1 + i).padStart(2, "0")}` }));
  const big = shapeJump({ escalations: { rows: many } }, TODAY).escalations;
  assert.equal(big.items.length, CAP);
  assert.equal(big.more, 3);
  assert.equal(big.items[0].id, "m0"); // the oldest
  // no Raised date: still listed, after the dated ones
  assert.equal(shapeJump({ escalations: { rows: [esc("n", "Open"), esc("o", "Open", { date: "2026-10-14" })] } }, TODAY).escalations.items[1].id, "n");
});

test("waiting on: grouped by person from escalations and questions, longest wait first", () => {
  const rows = [
    esc("a", "Open", { date: "2026-10-10", waitingOn: "Person A, about the form" }),
    esc("b", "Open", { date: "2026-10-01", waitingOn: "Person B - an app fix" }),
    esc("c", "Closed", { date: "2026-09-01", waitingOn: "Person C" }), // closed: not waiting any more
    esc("d", "Open", { date: "2026-10-13", waitingOn: "person a" }), // the same person, other case
  ];
  const questions = { rows: [{ id: "q1", url: null, title: "A question", status: "Open", priority: "Worth resolving", date: "2026-10-05", waitingOn: "Person A" },
    { id: "q2", url: null, title: "Answered one", status: "Answered", priority: "Blocking", date: "2026-09-01", waitingOn: "Person E" }] };
  const { waiting } = shapeJump({ escalations: { rows }, questions }, TODAY);
  assert.deepEqual(waiting.map((w) => [w.who, w.items.length, w.oldest]), [["Person B", 1, 14], ["Person A", 3, 10]]);
  assert.deepEqual(waiting[1].items.map((i) => i.kind), ["question", "escalation", "escalation"]);
});

test("projects: Blocked first, then Active, soonest target first; questions: Blocking ones, top three", () => {
  const projects = { rows: [
    { id: "p1", title: "Later active", status: "Active", date: "2026-12-01" },
    { id: "p2", title: "Sooner active", status: "Active", date: "2026-11-01" },
    { id: "p3", title: "Stuck", status: "Blocked", date: null },
    { id: "p4", title: "Done one", status: "Done", date: null },
    { id: "p5", title: "No status", status: null, date: null },
  ] };
  const qs = (n, extra = {}) => ({ id: `q${n}`, title: `Q${n}`, status: "Open", priority: "Blocking", date: `2026-10-0${n}`, ...extra });
  const questions = { rows: [qs(1), qs(2), qs(3), qs(4), qs(5, { priority: "Nice to know" }), qs(6, { status: "Parked" })] };
  const out = shapeJump({ projects, questions }, TODAY);
  assert.deepEqual(out.projects.items.map((p) => p.id), ["p3", "p2", "p1"]);
  assert.equal(out.projects.blocked, 1);
  assert.deepEqual([out.questions.open, out.questions.blocking], [5, 4]);
  assert.deepEqual(out.questions.top.map((q) => q.id), ["q1", "q2", "q3"]);
});

test("one source failing doesn't hide the others", () => {
  const out = shapeJump({ escalations: { error: "Hanua can't see it" }, projects: { rows: [{ id: "p", title: "P", status: "Active" }] }, questions: { rows: [] } }, TODAY);
  assert.deepEqual(out.escalations, { error: "Hanua can't see it" });
  assert.equal(out.projects.items.length, 1);
  assert.deepEqual(out.waiting, []);
  const none = shapeJump({}, TODAY);
  assert.equal(none.escalations.open, 0);
});

test("jumpFilters ask Notion only for open rows (and the last week's closed escalations)", () => {
  const cfg = { escalations: { fields: { status: "Status", closed: "Closed" }, closedStatus: "Closed" },
    projects: { fields: { status: "Status" }, showStatuses: ["Blocked", "Active"] }, questions: { fields: { status: "Status" }, openStatuses: ["Open"] } };
  const f = jumpFilters(cfg, TODAY);
  assert.deepEqual(f.escalations.or[0], { property: "Status", select: { does_not_equal: "Closed" } });
  assert.deepEqual(f.escalations.or[1], { property: "Closed", date: { on_or_after: "2026-10-08" } });
  assert.deepEqual(f.projects, { or: [{ property: "Status", select: { equals: "Blocked" } }, { property: "Status", select: { equals: "Active" } }] });
  assert.equal(f.questions.or.length, 1);
});

test("notionLink turns a page id back into a link, and nothing else", () => {
  assert.equal(notionLink("12345678-1234-1234-1234-123456789abc"), "https://www.notion.so/12345678123412341234123456789abc");
  assert.equal(notionLink("k3"), null);
  assert.equal(notionLink("javascript:alert(1)"), null);
});
