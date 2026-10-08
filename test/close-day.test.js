// Close the day (roadmap step 7, 9 Oct 2026; brief docs/plans/2026-10-close-the-day.md). Made-up text only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canClose, closeDayRecord, closeItems, closeMoment, daySummary, deskShape, leftovers, letGo, letGoIds, putLines, reopenDay, returnUnplaced, setLines, takeLines, timesCarried, DESK_VERSION } from "../public/shared/desk.js";

const L = (id, text, extra = {}) => ({ id, text, done: false, pri: "", mins: 0, ...extra });
const day = (lines) => deskShape({ sections: [{ id: "general", lines }] });
const at = (h, m = 0) => new Date(2026, 9, 9, h, m); // local time on Fri 9 Oct, whatever the Mac's zone
let n = 0; const newId = () => `n${++n}`;

test("close: the button from 4 pm, the reminder from 7 pm, nothing once closed (clock passed in)", () => {
  const times = { from: "16:00", remind: "19:00" };
  assert.deepEqual(closeMoment(at(15, 59), times), { offer: false, remind: false });
  assert.deepEqual(closeMoment(at(16, 0), times), { offer: true, remind: false });
  assert.deepEqual(closeMoment(at(18, 59), times), { offer: true, remind: false });
  assert.deepEqual(closeMoment(at(19, 0), times), { offer: true, remind: true });
  assert.deepEqual(closeMoment(at(23, 59), times), { offer: true, remind: true });
  assert.deepEqual(closeMoment(at(0, 1), times), { offer: false, remind: false }); // after midnight the sweep takes over
  assert.deepEqual(closeMoment(at(20), times, "2026-10-09T06:00:00.000Z"), { offer: false, remind: false });
  assert.deepEqual(closeMoment(at(20), { from: "17:30", remind: "" }), { offer: true, remind: false }); // reminder off
  assert.deepEqual(closeMoment(at(15), { from: "17:00", remind: "15:00" }), { offer: true, remind: true }); // a reminder before the offer still offers
  assert.deepEqual(closeMoment(at(16, 30), {}), { offer: true, remind: false }); // bad times: 4 pm, no reminder
});

test("close: today, or yesterday just after midnight; never a day ahead", () => {
  assert.equal(canClose("2026-10-09", "2026-10-09"), true);
  assert.equal(canClose("2026-10-08", "2026-10-09"), true);
  assert.equal(canClose("2026-10-07", "2026-10-09"), false);
  assert.equal(canClose("2026-10-10", "2026-10-09"), false);
});

test("close: the window lists open tasks with their open subtasks; at work only Work sections", () => {
  const d = deskShape({ sections: [
    { id: "general", lines: [L("a", "Trip"), L("b", "Passport", { parent: "a", done: true }), L("c", "Visa", { parent: "a" }), L("d", "Done thing", { done: true }), L("e", "Milk")] },
    { id: "s1", name: "Spark NZ", work: true, lines: [L("w", "Deck")] }] });
  assert.deepEqual(closeItems(d, "2026-10-09").map((x) => [x.ref, x.kids.map((k) => `${k.ref}${k.done ? "✓" : ""}`)]), [["a", ["b✓", "c"]], ["e", []], ["w", []]]);
  assert.deepEqual(closeItems(d, "2026-10-09", true).map((x) => x.ref), ["w"]);
});

test("close: let go marks a task and its open subtasks on its own day; ticked ones keep their ticks; the sweep skips them", () => {
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a", done: true }), L("c", "Visa", { parent: "a" }), L("e", "Milk")]);
  letGo(d, "2026-10-08", ["a"], new Date("2026-10-08T07:00:00Z"));
  assert.deepEqual([...letGoIds(d, "2026-10-08")].sort(), ["a", "c"]);
  assert.equal(d.sections[0].lines[1].done, true);
  assert.equal(d.settledAt["2026-10-08:a"], "2026-10-08T07:00:00.000Z");
  assert.deepEqual(closeItems(d, "2026-10-08").map((x) => x.ref), ["e"]); // still in the record, out of the list
  // next morning: only Milk is offered
  assert.deepEqual(leftovers({ "2026-10-08": d, "2026-10-09": {} }, "2026-10-09").map((x) => x.text), ["Milk"]);
  // let go isn't counted as left to do
  assert.equal(daySummary(d, "2026-10-08").tasks, 1);
});

test("close: the day's record; Open again keeps the two lines; a task added after closing is still offered next morning", () => {
  const d = day([L("e", "Milk")]);
  closeDayRecord(d, { well: "  Got the deck done ", hard: "Too many meetings" }, new Date("2026-10-09T06:12:00Z"));
  assert.deepEqual(deskShape(d).closed, { at: "2026-10-09T06:12:00.000Z", well: "Got the deck done", hard: "Too many meetings" });
  assert.equal(daySummary(d).closed, "2026-10-09T06:12:00.000Z");
  assert.deepEqual(deskShape(deskShape(d)), deskShape(d)); // round trip
  reopenDay(d);
  assert.deepEqual(deskShape(d).closed, { well: "Got the deck done", hard: "Too many meetings" });
  assert.equal(daySummary(d).closed, undefined);
  const blank = reopenDay(closeDayRecord(day([]), {}, new Date()));
  assert.equal(deskShape(blank).closed, undefined);
  // closed, then something added: it's still offered by the morning sweep
  const e = closeDayRecord(day([L("x", "Added at 9 pm")]), {}, new Date("2026-10-09T08:00:00Z"));
  assert.deepEqual(leftovers({ "2026-10-09": e, "2026-10-10": {} }, "2026-10-10").map((x) => x.text), ["Added at 9 pm"]);
  assert.equal(DESK_VERSION, 7);
  // junk is tidied away
  assert.equal(deskShape({ closed: { at: "yesterday", well: 5 } }).closed?.at, undefined);
});

test("close: sending to tomorrow never doubles a task (an Undo then again, or both Macs)", () => {
  const today = day([L("a", "Trip"), L("b", "Passport", { parent: "a" })]);
  const tomorrow = day([]);
  const t1 = takeLines(today, ["a"], "2026-10-09", "2026-10-10");
  putLines(tomorrow, t1, newId);
  // the other Mac closes too, from the same day before it heard
  const other = day([L("a", "Trip"), L("b", "Passport", { parent: "a" })]);
  const t2 = takeLines(other, ["a"], "2026-10-09", "2026-10-10");
  putLines(tomorrow, t2, newId);
  assert.equal(tomorrow.sections[0].lines.filter((l) => l.text).length, 2);
  assert.equal(returnUnplaced(other, t2, newId), 0); // already there: nothing comes back either
});

test("close: carried counts tasks sent on, as well as those still on a day", () => {
  const d8 = day([L("a", "Trip")]), d9 = day([]);
  putLines(d9, takeLines(d8, ["a"], "2026-10-08", "2026-10-09"), newId);
  assert.equal(timesCarried({ "2026-10-08": d8, "2026-10-09": d9 }, "a"), 1);
  const d10 = day([]);
  putLines(d10, takeLines(d9, ["a"], "2026-10-09", "2026-10-10"), newId);
  assert.equal(timesCarried({ "2026-10-08": d8, "2026-10-09": d9, "2026-10-10": d10 }, "a"), 2);
});

test("close: ticking from the close window ticks a task's subtasks too", () => {
  const d = day([L("a", "Trip"), L("b", "Passport", { parent: "a" })]);
  setLines(d, ["a"], { done: true }, at(17));
  assert.deepEqual(closeItems(d, "2026-10-09"), []);
});
