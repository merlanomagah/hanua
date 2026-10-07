// Subtasks (one level) and F4's record of where lines went (8 Oct 2026; brief docs/plans/2026-10-subtasks.md).
// Two checks run after every rule: no orphans (each subtask sits under its task, right after it or its siblings,
// and the task is a task) and same texts (nothing lost or doubled across the days involved).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bringForward, clearDay, deskShape, indentLine, kidsOf, leftovers, moveLines, openItems, outdentLine, putLines, removeLines, setLines, settle, takeLines, tidyGroups, timesCarried, withFamilies, daySummary, DESK_VERSION } from "../public/shared/desk.js";

let n = 0; const newId = () => `n${++n}`;
const L = (id, text, extra = {}) => ({ id, text, done: false, pri: "", mins: 0, ...extra });
const day = (lines, more = []) => deskShape({ sections: [{ id: "general", lines }, ...more] });
const ids = (d, sec = 0) => d.sections[sec].lines.filter((l) => l.text).map((l) => (l.parent ? `${l.parent}>${l.id}` : l.id));
function noOrphans(d) {
  for (const s of d.sections) {
    let top = null;
    for (const l of s.lines) {
      if (!l.text) { assert.equal(l.parent, undefined, "a blank row has no task"); continue; }
      if (l.parent) {
        assert.equal(l.parent, top, `${l.id} sits under the nearest task above`);
        const p = s.lines.find((x) => x.id === l.parent);
        assert.ok(p && !p.parent, "its task is a task, not a subtask");
      } else top = l.id;
    }
  }
}
const texts = (...days) => days.flatMap((d) => d.sections.flatMap((s) => s.lines.filter((l) => l.text).map((l) => l.text))).sort();

test("subtasks: a day file keeps them, and opening it again changes nothing", () => {
  const raw = { v: DESK_VERSION, sections: [{ id: "general", lines: [L("a", "Move house"), L("b", "Book van", { parent: "a" }), { id: "x", text: "" }, L("c", "Pack books", { parent: "a" }), L("d", "Call mum")] }] };
  const d = deskShape(raw);
  assert.deepEqual(ids(d), ["a", "a>b", "a>c", "d"]); // a blank row between a task and its subtask is fine
  assert.deepEqual(deskShape(d), d);
  noOrphans(d);
});

test("subtasks: bad links become ordinary tasks, never dropped", () => {
  const d = day([
    L("a", "First", { parent: "zz" }), // a task that isn't there
    L("b", "Second"), L("c", "Under b", { parent: "b" }), L("e", "Under c", { parent: "c" }), // two levels
    L("f", "Self", { parent: "f" }),
    L("g", "Late", { parent: "b" }), // b isn't the nearest task above any more (f is)
    { id: "h", text: "", parent: "b" }, // a blank row
  ]);
  assert.deepEqual(ids(d), ["a", "b", "b>c", "e", "f", "g"]); // e named a subtask (two levels): it becomes a task
  noOrphans(d);
  assert.equal(d.sections[0].lines.filter((l) => l.text).length, 6);
  // a v6 file read the old way (parents ignored) still has every line, in place
  const flat = deskShape({ sections: d.sections.map((s) => ({ ...s, lines: s.lines.map(({ parent, ...l }) => l) })) });
  assert.deepEqual(flat.sections[0].lines.map((l) => l.text), d.sections[0].lines.map((l) => l.text));
});

test("subtasks: Tab and Shift+Tab, one level only", () => {
  const d = day([L("a", "Trip"), L("b", "Passport"), L("c", "Insurance"), L("d", "Visa")]);
  assert.equal(indentLine(d, "a"), false); // nothing above
  assert.equal(indentLine(d, "b"), true);
  assert.equal(indentLine(d, "c"), true); // under the task above b, i.e. a
  assert.equal(indentLine(d, "c"), false); // already one in
  assert.deepEqual(ids(d), ["a", "a>b", "a>c", "d"]);
  assert.equal(indentLine(d, "a"), false);
  // a task with subtasks can't go in itself
  const e = day([L("x", "Top"), L("a", "Trip"), L("b", "Passport", { parent: "a" })]);
  assert.equal(indentLine(e, "a"), false);
  // Shift+Tab on the middle one: the ones after it become its own, nothing moves
  const f = day([L("a", "Trip"), L("b", "One", { parent: "a" }), L("c", "Two", { parent: "a" }), L("d", "Three", { parent: "a" })]);
  assert.equal(outdentLine(f, "c"), true);
  assert.deepEqual(ids(f), ["a", "a>b", "c", "c>d"]);
  assert.equal(outdentLine(f, "c"), false);
  noOrphans(f);
});

test("subtasks: ticking a task ticks its subtasks; all ticked ticks the task; one unticked opens it", () => {
  const at = new Date("2026-10-08T09:00:00Z");
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a" }), L("c", "Visa", { parent: "a" })]);
  setLines(d, ["a"], { done: true }, at);
  assert.deepEqual(d.sections[0].lines.map((l) => l.done), [true, true, true]);
  assert.equal(d.sections[0].lines[1].doneAt, at.toISOString());
  setLines(d, ["c"], { done: false }, at);
  assert.deepEqual(d.sections[0].lines.map((l) => l.done), [false, true, false]);
  assert.equal(d.sections[0].lines[0].doneAt, undefined);
  setLines(d, ["c"], { done: true }, at);
  assert.equal(d.sections[0].lines[0].done, true); // the last one ticks the task
  // the file says the same
  assert.equal(deskShape({ sections: [{ id: "general", lines: [L("a", "T", { done: true }), L("b", "S", { parent: "a" })] }] }).sections[0].lines[0].done, false);
  // priority and time are each line's own
  setLines(d, ["a"], { pri: "h" });
  assert.deepEqual(d.sections[0].lines.map((l) => l.pri), ["h", "", ""]);
});

test("subtasks: a task with open subtasks is planned through them; their blank priority is the task's", () => {
  const d = day([L("a", "Trip", { pri: "h", mins: 120 }), L("b", "Passport", { parent: "a", mins: 15 }), L("c", "Visa", { parent: "a", pri: "l", done: true }), L("d", "Milk")]);
  const items = openItems(d);
  assert.deepEqual(items.map((x) => [x.ref, x.pri, x.under || ""]), [["b", "h", "Trip"], ["d", "", ""]]);
  assert.deepEqual(daySummary(d), { ...daySummary(d), tasks: 2, done: 1 }); // the task isn't counted beside its subtasks
});

test("subtasks: moving a task takes its subtasks along; a subtask alone becomes a task", () => {
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a" }), L("c", "Visa", { parent: "a" }), L("d", "Milk")], [{ id: "s1", name: "Later", lines: [L("x", "Old"), { id: "bl", text: "" }, L("y", "Older")] }]);
  const before = texts(d);
  moveLines(d, ["a"], "s1");
  assert.deepEqual(ids(d, 0), ["d"]);
  assert.deepEqual(ids(d, 1), ["x", "y", "a", "a>b", "a>c"]);
  moveLines(d, ["c"], "general");
  assert.deepEqual(ids(d, 0), ["d", "c"]);
  assert.deepEqual(ids(d, 1), ["x", "y", "a", "a>b"]);
  assert.deepEqual(texts(d), before);
  noOrphans(d);
});

test("subtasks: sending a task to another day takes its open subtasks; ticked ones stay done here; ids clash safely", () => {
  const today = day([L("a", "Trip"), L("b", "Passport", { parent: "a", done: true }), L("c", "Visa", { parent: "a" }), L("d", "Milk", { done: true })]);
  const other = day([L("c", "Already here")]);
  const taken = takeLines(today, ["a", "d"], "2026-10-08", "2026-10-09", new Date("2026-10-08T10:00:00Z"));
  assert.deepEqual(taken.map((t) => [t.line.id, t.line.parent || "", t.line.done]), [["a", "", false], ["c", "a", false], ["d", "", false]]);
  assert.deepEqual(ids(today), ["b"]); // the done subtask stays, now on its own
  assert.equal(today.sections[0].lines[0].done, true);
  assert.deepEqual(today.gone.map((g) => [g.id, g.how, g.to]), [["a", "sent", "2026-10-09"], ["c", "sent", "2026-10-09"], ["d", "sent", "2026-10-09"]]);
  putLines(other, taken, newId);
  const c2 = taken[1].placed;
  assert.notEqual(c2, "c"); // c was taken there
  assert.deepEqual(ids(other), ["c", "a", `a>${c2}`, "d"]);
  assert.equal(other.sections[0].lines.find((l) => l.id === c2).origin, "c"); // remembers its first id
  noOrphans(today); noOrphans(other);
  assert.deepEqual(texts(today, other), ["Already here", "Milk", "Passport", "Trip", "Visa"]);
});

test("subtasks: a full section takes a task and its subtasks together or not at all", () => {
  const full = day(Array.from({ length: 39 }, (_, i) => L(`f${i}`, `Line ${i}`)));
  const taken = [{ section: "General", line: L("a", "Trip") }, { section: "General", line: L("b", "Passport", { parent: "a" }) }];
  putLines(full, taken, newId);
  assert.equal(full.sections[0].lines.length, 39);
  assert.equal(taken[0].placed, undefined);
});

test("subtasks: the morning sweep offers a task with its open subtasks, and brings them back together", () => {
  const days = { "2026-10-07": { sections: [{ id: "general", lines: [L("a", "Trip"), L("b", "Passport", { parent: "a" }), L("c", "Visa", { parent: "a", done: true }), L("d", "Milk")] }] }, "2026-10-08": {} };
  const items = leftovers(days, "2026-10-08");
  assert.deepEqual(items.map((x) => [x.text, x.kids.map((k) => k.text)]), [["Trip", ["Passport"]], ["Milk", []]]);
  const today = deskShape({ sections: [{ id: "general", lines: [L("z", "Today's"), { id: "bl", text: "" }] }] });
  settle(today, items[0], "today", "q1");
  assert.deepEqual(ids(today), ["z", "q1", "q1>q1k1"]);
  assert.equal(today.sections[0].lines[1].origin, "a");
  assert.deepEqual(leftovers({ ...days, "2026-10-08": today }, "2026-10-08").map((x) => x.text), ["Milk"]);
  settle(today, items[1], "gone", "q2");
  assert.deepEqual(leftovers({ ...days, "2026-10-08": today }, "2026-10-08"), []);
  noOrphans(today);
  // carried once (the 7th, then the 8th)
  assert.equal(timesCarried({ ...days, "2026-10-08": today }, "a"), 1);
});

test("subtasks: × and Clear take a task with its subtasks, and say so in the day's record", () => {
  const at = new Date("2026-10-08T11:00:00Z");
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a" }), L("c", "Milk")]);
  assert.equal(removeLines(d, ["a"], "removed", at), 2);
  assert.deepEqual(ids(d), ["c"]);
  assert.deepEqual(d.gone.map((g) => [g.text, g.how, g.at]), [["Trip", "removed", at.toISOString()], ["Passport", "removed", at.toISOString()]]);
  // a subtask on its own
  const e = day([L("a", "Trip"), L("b", "Passport", { parent: "a" }), L("c", "Visa", { parent: "a" })]);
  removeLines(e, ["b"]);
  assert.deepEqual(ids(e), ["a", "a>c"]);
  clearDay(e, at);
  assert.deepEqual(e.gone.map((g) => g.how), ["removed", "cleared", "cleared"]);
  assert.deepEqual(deskShape(e).gone.length, 3); // kept in the file
});

test("subtasks: picking a task picks its subtasks (only the open ones when sending)", () => {
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a", done: true }), L("c", "Visa", { parent: "a" }), L("d", "Milk")]);
  assert.deepEqual(withFamilies(d, ["a"]), ["a", "b", "c"]);
  assert.deepEqual(withFamilies(d, ["a"], { openKids: true }), ["a", "c"]);
  assert.deepEqual(withFamilies(d, ["c"]), ["c"]);
  assert.deepEqual(kidsOf(d.sections[0].lines, "a").map((l) => l.id), ["b", "c"]);
});

test("subtasks: random moves, sends, ticks, removes and indents never orphan or lose a line", () => {
  let seed = 7; const rnd = (k) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % k; };
  for (let run = 0; run < 60; run++) {
    const mk = (p) => Array.from({ length: 8 }, (_, i) => (rnd(5) === 0 ? { id: `${p}b${i}`, text: "" } : L(`${p}${i}`, `${p} task ${i}`)));
    let a = deskShape({ sections: [{ id: "general", lines: mk("g") }, { id: "s1", name: "House", lines: mk("h") }] });
    let b = deskShape({ sections: [{ id: "general", lines: mk("o") }] });
    for (const sec of a.sections) for (const l of sec.lines) if (l.text && rnd(3) === 0) indentLine(a, l.id);
    const all = () => a.sections.flatMap((s) => s.lines.filter((l) => l.text).map((l) => l.id));
    const startTexts = texts(a, b);
    let removed = [];
    for (let step = 0; step < 25; step++) {
      const refs = all(); if (!refs.length) break;
      const r = refs[rnd(refs.length)];
      switch (rnd(7)) {
        case 0: moveLines(a, [r], rnd(2) ? "s1" : "general"); break;
        case 1: putLines(b, takeLines(a, [r], "2026-10-08", "2026-10-09"), newId); break;
        case 2: setLines(a, [r], { done: rnd(2) === 0 }); break;
        case 3: { const before = texts(a); removeLines(a, [r]); removed.push(...before.filter((t) => !texts(a).includes(t))); break; }
        case 4: indentLine(a, r); break;
        case 5: outdentLine(a, r); break;
        default: a = deskShape(a); b = deskShape(b);
      }
      noOrphans(a); noOrphans(b);
      // nothing doubled; everything accounted for (on a day, or removed); done subtasks left behind are still there
      assert.deepEqual([...texts(a, b), ...removed].sort(), startTexts);
    }
  }
});
