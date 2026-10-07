// The shared goals rules (public/shared/goals.js), used by both the page and the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rollUp, treeOrder, lineageIn, goalSpan, dateConflicts, coinValue, donePoints, levelIndex, onCalendar } from "../public/shared/goals.js";
import { addDays, daysBetween, weekKey } from "../public/shared/dates.js";

const goal = (id, level, extra = {}) => ({ id, level, title: id, status: "New", parent: null, ...extra });
const tree = () => [
  goal("E", "Epic"),
  goal("F", "Feature", { parent: "E" }),
  goal("P", "PBI", { parent: "F" }),
  goal("T1", "Task", { parent: "P", status: "Done", effort: 2 }),
  goal("T2", "Task", { parent: "P", effort: 3 }),
];

test("progress and effort roll up from the children", () => {
  const goals = rollUp(tree());
  const byId = Object.fromEntries(goals.map((g) => [g.id, g]));
  assert.equal(byId.P.progress, 50);
  assert.equal(byId.P.childDone, 1);
  assert.deepEqual(byId.P.children, ["T1", "T2"]);
  assert.equal(byId.P.effortTotal, 5);
  assert.equal(byId.E.progress, 50);
  assert.equal(byId.T1.progress, 100);
});

test("a typed progress only counts for a goal with no children", () => {
  const [solo] = rollUp([goal("S", "Task", { progressSet: 40 })]);
  assert.equal(solo.progress, 40);
});

test("a loop of parents doesn't hang", () => {
  const goals = rollUp([goal("A", "Feature", { parent: "B" }), goal("B", "Feature", { parent: "A" })]);
  assert.equal(goals.length, 2);
});

test("tree order puts children right after their parents", () => {
  const goals = [goal("T2", "Task", { parent: "P" }), goal("P", "PBI", { parent: "E" }), goal("X", "Epic"), goal("E", "Epic", { priority: 1 })];
  const sorted = [...goals].sort(treeOrder(goals)).map((g) => g.id);
  assert.deepEqual(sorted, ["E", "P", "T2", "X"]);
});

test("lineage is the goal, its parents and its children", () => {
  assert.deepEqual([...lineageIn(tree(), "F")].sort(), ["E", "F", "P", "T1", "T2"]);
  assert.deepEqual([...lineageIn(tree(), "T1")].sort(), ["E", "F", "P", "T1"]);
});

test("a goal with only a due date gets an estimated start", () => {
  const s = goalSpan(goal("F", "Feature", { due: "2026-12-31" }));
  assert.equal(s.end, "2026-12-31");
  assert.equal(s.start, addDays("2026-12-31", -60));
  assert.ok(s.guessStart && !s.guessEnd);
  const real = goalSpan(goal("T", "Task", { start: "2026-10-01", due: "2026-10-03" }));
  assert.deepEqual(real, { start: "2026-10-01", end: "2026-10-03", guessStart: false, guessEnd: false });
});

test("date conflicts: due after the parent, or starting before it", () => {
  const goals = [goal("F", "Feature", { start: "2026-10-01", due: "2026-11-30" }),
    goal("P1", "PBI", { parent: "F", due: "2026-12-05" }), goal("P2", "PBI", { parent: "F", start: "2026-09-20", due: "2026-10-20" }),
    goal("P3", "PBI", { parent: "F", due: "2026-11-01" }), goal("P4", "PBI", { parent: "F", due: "2026-12-30", status: "Done" })];
  const c = dateConflicts(goals);
  assert.equal(c.get("P1")[0].kind, "late");
  assert.equal(c.get("P2")[0].kind, "early");
  assert.ok(!c.has("P3"));
  assert.ok(!c.has("P4"), "finished goals aren't flagged");
});

test("coins: a PBI's Tasks together earn at most the PBI's value", () => {
  const per = { Epic: 1000, Feature: 250, PBI: 50, Task: 10 };
  const tasks = Array.from({ length: 7 }, (_, i) => goal(`T${i}`, "Task", { parent: "P", status: i < 6 ? "Done" : "New", completed: `2026-10-0${i + 1}`, due: "2026-10-20" }));
  const goals = [goal("P", "PBI", { parent: "F" }), ...tasks, goal("S", "Task"), goal("U", "Task", { parent: "F" })];
  const pay = tasks.map((t) => coinValue(t, goals, per));
  assert.deepEqual(pay, [10, 10, 10, 10, 10, 0, 0], "the first five finished are paid, then the cap is reached");
  assert.equal(coinValue(goals.find((g) => g.id === "S"), goals, per), 10, "stand-alone Tasks pay as before");
  assert.equal(coinValue(goals.find((g) => g.id === "U"), goals, per), 10, "Tasks under a Feature aren't capped");
  assert.equal(coinValue(goals[0], goals, per), 50, "the PBI itself still pays");
});

test("coins: unfinished Tasks fill the cap in due-date order", () => {
  const per = { PBI: 50, Task: 10 };
  const goals = [goal("P", "PBI"), ...[5, 1, 4, 2, 3, 6].map((d) => goal(`T${d}`, "Task", { parent: "P", due: `2026-10-0${d}` }))];
  assert.equal(coinValue(goals.find((g) => g.id === "T6"), goals, per), 0);
  assert.equal(coinValue(goals.find((g) => g.id === "T1"), goals, per), 10);
});

test("done-when points lose their bullets", () => {
  assert.deepEqual(donePoints({ doneWhen: "- First\n•  Second\n\n* Third\nPlain" }), ["First", "Second", "Third", "Plain"]);
});

test("dates", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-10-01", "2026-11-01"), 31);
  assert.equal(levelIndex("PBI"), 2);
});

test("finished goals hide after two weeks unless Show done is on", async () => {
  const { visibleGoals } = await import("../public/shared/goals.js");
  const goals = [goal("A", "Task"), goal("B", "Task", { status: "Done", completed: "2026-10-01" }),
    goal("C", "Task", { status: "Done", completed: "2026-09-01" }), goal("D", "Task", { status: "Done" })];
  assert.deepEqual(visibleGoals(goals, { today: "2026-10-04" }).map((g) => g.id), ["A", "B"]);
  assert.equal(visibleGoals(goals, { today: "2026-10-04", showDone: true }).length, 4);
});

test("When? picks end on the period's last day, and never after the parent's due date", async () => {
  const { whenDue, whenPickOf } = await import("../public/shared/goals.js");
  // Monday 5 Oct 2026
  assert.deepEqual(whenDue("week", "2026-10-05"), { due: "2026-10-11", capped: false });
  assert.equal(whenDue("week", "2026-10-11").due, "2026-10-11"); // a Sunday is the end of its own week
  assert.equal(whenDue("next-week", "2026-10-05").due, "2026-10-18");
  assert.equal(whenDue("month", "2026-10-05").due, "2026-10-31");
  assert.equal(whenDue("next-month", "2026-12-05").due, "2027-01-31");
  assert.equal(whenDue("quarter", "2026-10-05").due, "2026-12-31");
  assert.equal(whenDue("next-quarter", "2026-11-20").due, "2027-03-31");
  assert.equal(whenDue("year", "2026-10-05").due, "2026-12-31");
  assert.deepEqual(whenDue("quarter", "2026-10-05", "2026-11-15"), { due: "2026-11-15", capped: true });
  assert.equal(whenDue("nonsense", "2026-10-05"), null);
  assert.equal(whenPickOf("PBI", "2026-10-31", "2026-10-05"), "month");
  assert.equal(whenPickOf("PBI", "2026-10-20", "2026-10-05"), "exact");
  assert.equal(whenPickOf("Task", "", "2026-10-05"), "");
});

test("the lights switch off at 9 pm and on at 4 am, each once", async () => {
  const { lastLightSwitch } = await import("../public/shared/dates.js");
  const at = (h, m = 0) => new Date(2026, 9, 5, h, m);
  assert.deepEqual(lastLightSwitch(at(20, 59)), { key: "2026-10-05 on", on: true });
  assert.deepEqual(lastLightSwitch(at(21)), { key: "2026-10-05 off", on: false });
  assert.deepEqual(lastLightSwitch(at(23, 30)), { key: "2026-10-05 off", on: false });
  assert.deepEqual(lastLightSwitch(at(2)), { key: "2026-10-04 off", on: false }); // still last night's switch
  assert.deepEqual(lastLightSwitch(at(4)), { key: "2026-10-05 on", on: true });
  // Mel's own hours (Hanua Settings → Room): off at 10 pm, on at 6 am
  assert.deepEqual(lastLightSwitch(at(21, 30), 22, 6), { key: "2026-10-05 on", on: true });
  assert.deepEqual(lastLightSwitch(at(22), 22, 6), { key: "2026-10-05 off", on: false });
  assert.deepEqual(lastLightSwitch(at(5), 22, 6), { key: "2026-10-04 off", on: false });
  // off after midnight (1 am), on at 6 am: the evening is still the day's "on"
  assert.deepEqual(lastLightSwitch(at(23), 1, 6), { key: "2026-10-05 on", on: true });
  assert.deepEqual(lastLightSwitch(at(2), 1, 6), { key: "2026-10-05 off", on: false });
  assert.deepEqual(lastLightSwitch(at(0, 30), 1, 6), { key: "2026-10-04 on", on: true });
});

test("the plant grows with each day watered and browns with days missed, kindly", async () => {
  const { plantState } = await import("../public/shared/plant.js");
  const today = "2026-10-10";
  assert.deepEqual(plantState([], today), { days: 0, last: null, since: null, wateredToday: false, health: "fresh", words: "happy", streak: 0 });
  const s = plantState(["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-09"], today);
  assert.equal(s.days, 3); // the same day twice counts once
  assert.equal(s.health, "fresh"); // watered yesterday
  assert.equal(plantState(["2026-10-08"], today).health, "thirsty");
  assert.equal(plantState(["2026-10-07"], today).health, "wilting");
  assert.equal(plantState(["2026-10-05"], today).health, "browning");
  assert.equal(plantState(["2026-09-01"], today).health, "dormant");
  // growth is kept however long the gap, and one watering brings it back
  const back = plantState(["2026-09-01", "2026-09-02", today], today);
  assert.equal(back.days, 3);
  assert.equal(back.health, "fresh");
  assert.equal(back.wateredToday, true);
});

test("only open, dated Tasks and PBIs go on the calendar", () => {
  assert.equal(onCalendar(goal("E", "Epic", { due: "2026-12-01" })), false);
  assert.equal(onCalendar(goal("F", "Feature", { due: "2026-12-01" })), false);
  assert.equal(onCalendar(goal("P", "PBI", { due: "2026-12-01" })), true);
  assert.equal(onCalendar(goal("T", "Task", { due: "2026-12-01" })), true);
  assert.equal(onCalendar(goal("T", "Task")), false);
  assert.equal(onCalendar(goal("T", "Task", { due: "2026-12-01", status: "Done" })), false);
});

test("a week is named by a real Monday", () => {
  assert.equal(weekKey("2026-10-05"), "2026-10-05");
  assert.equal(weekKey("2026-10-06"), null);
  assert.equal(weekKey("2026-13-40"), null);
  assert.equal(weekKey("../x"), null);
  assert.equal(weekKey("2026-1-5"), null);
});

test("goals show in the book of their Area and any book they're also in, with children under them", async () => {
  const { goalsInBook, goalBooks } = await import("../public/shared/goals.js");
  const goals = [
    goal("E", "Epic", { area: "Work" }),
    goal("F", "Feature", { parent: "E", area: "Work", alsoIn: ["Finances"] }),
    goal("P", "PBI", { parent: "F", area: "Work", alsoIn: ["Finances"] }),
    goal("S", "Epic", { area: "Money" }),
    goal("H", "Task", { area: "Health" }),
  ];
  assert.deepEqual(goalsInBook(goals, "Work").map((g) => g.id), ["E"]);
  assert.deepEqual(goalsInBook(goals, "Finances").map((g) => g.id), ["F", "S"]); // P sits under F; old "Money" counts as Finances
  assert.deepEqual(goalsInBook(goals, "Health").map((g) => g.id), ["H"]);
  assert.deepEqual(goalsInBook(goals, "People"), []);
  assert.deepEqual([...goalBooks({ area: "Work", alsoIn: ["Finances", "Work"] })], ["Work", "Finances"]);
});
