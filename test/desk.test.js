import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, stepDay, deskShape, lastFocus, deskSections, planDate, startDay, leftovers, bringForward, shorterCol, MAX_LINES, MAX_TEXT } from "../public/shared/desk.js";

test("desk: day keys are real days only", () => {
  assert.equal(dayKey("2026-10-05"), "2026-10-05");
  assert.equal(dayKey("2028-02-29"), "2028-02-29");
  for (const bad of ["2026-02-29", "2026-13-01", "2026-10-5", "../etc", "", null, 20261005]) assert.equal(dayKey(bad), null);
});

test("desk: stepping days across month and year ends, 29 Feb and both NZ daylight-saving changes", () => {
  assert.equal(stepDay("2026-10-31", 1), "2026-11-01");
  assert.equal(stepDay("2026-12-31", 1), "2027-01-01");
  assert.equal(stepDay("2027-01-01", -1), "2026-12-31");
  assert.equal(stepDay("2028-02-28", 1), "2028-02-29");
  assert.equal(stepDay("2028-03-01", -1), "2028-02-29");
  assert.equal(stepDay("2026-09-26", 1), "2026-09-27"); // clocks go forward on 27 Sep 2026
  assert.equal(stepDay("2026-09-27", 1), "2026-09-28");
  assert.equal(stepDay("2027-04-04", -1), "2027-04-03"); // and back on 4 Apr 2027
  assert.equal(stepDay("2026-10-05", 7), "2026-10-12");
});

test("desk: shape keeps three focus areas, three key tasks and caps the lists", () => {
  const s = deskShape({ focus: ["  Calm  ", "Sydney", "Health", "extra"], key: [{ text: "Call", done: 1 }], general: Array.from({ length: 60 }, (_, i) => ({ id: `g${i}`, text: "x".repeat(400) })), settled: { "2026-10-04:g1": "gone", "bad": "today", "2026-10-04:g2": "maybe" } });
  assert.deepEqual(s.focus, ["Calm", "Sydney", "Health"]);
  assert.equal(s.key.length, 3);
  assert.deepEqual(s.key[0], { text: "Call", done: true });
  assert.deepEqual(s.key[2], { text: "", done: false });
  // an older file's plain list opens as the General section
  assert.equal(s.sections[0].id, "general");
  assert.equal(s.sections[0].lines.length, MAX_LINES);
  assert.equal(s.sections[0].lines[0].text.length, MAX_TEXT);
  assert.deepEqual(s.settled, { "2026-10-04:g1": "gone" });
  assert.deepEqual(deskShape(null), deskShape({}));
});

test("desk: sections keep General first, keep blanks in the middle and drop trailing ones", () => {
  const s = deskShape({ sections: [{ id: "s1", name: "House", col: 1, lines: [{ id: "a", text: "" }, { id: "b", text: "Bins", done: true }, { id: "c", text: "" }] }, { id: "general", lines: [{ id: "g", text: "Ring Nana" }] }, { id: "s1", name: "Dup" }] });
  assert.deepEqual(s.sections.map((x) => x.name), ["General", "House"]);
  assert.deepEqual(s.sections[1].lines.map((l) => l.id), ["a", "b"]);
  assert.equal(s.sections[1].col, 1);
  assert.equal(s.sections[0].lines[0].text, "Ring Nana");
  // a blank line can't be ticked
  assert.equal(deskShape({ key: [{ text: "", done: true }] }).key[0].done, false);
});

test("desk: a new day starts with the last day's section headers, empty, only once", () => {
  const earlier = { "2026-10-04": { sections: [{ id: "s1", name: "Admin", col: 1, lines: [{ id: "a", text: "Tax" }] }] }, "2026-10-05": { sections: [{ id: "s2", name: "House", col: 1, lines: [{ id: "b", text: "Bins" }] }] } };
  const d = startDay({}, earlier, "2026-10-06");
  assert.deepEqual(d.sections.map((x) => [x.name, x.lines.length]), [["General", 0], ["House", 0]]);
  assert.equal(d.started, true);
  // removed today: it doesn't come back
  assert.deepEqual(startDay({ started: true }, earlier, "2026-10-06").sections.map((x) => x.name), ["General"]);
});

test("desk: the morning sweep lists last week's unfinished, not what's dealt with, done or too old", () => {
  const days = {
    "2026-09-20": { key: [{ text: "Too old" }] },
    "2026-10-04": { key: [{ text: "Call bank" }, { text: "Done one", done: true }], sections: [{ id: "general", lines: [{ id: "a", text: "Post parcel" }, { id: "b", text: "" }] }, { id: "s1", name: "House", lines: [{ id: "c", text: "Bins" }] }] },
    "2026-10-05": { settled: { "2026-10-04:a": "gone" } },
    "2026-10-06": { settled: { "2026-10-04:c": "done" }, key: [{ text: "Today's own" }] },
  };
  const l = leftovers(days, "2026-10-06");
  assert.deepEqual(l.map((x) => [x.key, x.section, x.text]), [["2026-10-04:k0", null, "Call bank"]]);
});

test("desk: bringing forward puts a task in an empty slot and a line under its own header", () => {
  const d = deskShape({ key: [{ text: "Full" }], sections: [] });
  bringForward(d, { key: "2026-10-05:k1", section: null, text: "Call bank" }, "n1");
  assert.equal(d.key[1].text, "Call bank");
  bringForward(d, { key: "2026-10-05:c", section: "House", text: "Bins" }, "n2");
  const house = d.sections.find((s) => s.name === "House");
  assert.deepEqual(house.lines.map((l) => l.text), ["Bins"]);
  assert.deepEqual(d.settled, { "2026-10-05:k1": "today", "2026-10-05:c": "today" });
  // all task slots full: a task goes to General
  const full = deskShape({ key: [{ text: "a" }, { text: "b" }, { text: "c" }] });
  bringForward(full, { key: "2026-10-05:k0", section: null, text: "d" }, "n3");
  assert.equal(full.sections[0].lines[0].text, "d");
});

test("desk: a new section goes to the shorter column", () => {
  assert.equal(shorterCol(deskShape({}).sections), 1);
  assert.equal(shorterCol(deskShape({ sections: [{ id: "s1", name: "A", col: 1, lines: Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, text: "t" })) }] }).sections), 0);
});

test("desk: yesterday's focus areas show as a hint, today's never do", () => {
  const days = { "2026-10-02": { focus: ["Old"] }, "2026-10-04": { focus: ["", "", ""] }, "2026-10-03": { focus: ["Calm", "Sydney"] }, "2026-10-05": { focus: ["Today"] } };
  assert.deepEqual(lastFocus(days, "2026-10-05"), ["Calm", "Sydney", ""]);
  assert.equal(lastFocus({ "2026-10-05": { focus: ["x"] } }, "2026-10-05"), null);
});

test("desk: at work the whole page is put away (it has no Work/personal split)", () => {
  assert.deepEqual(deskSections(true), []);
  assert.deepEqual(deskSections(false), ["focus", "key", "todo"]);
});

test("desk: the page's date reads like Tue 06-Oct-2026", () => {
  assert.equal(planDate("2026-10-06"), "Tue 06-Oct-2026");
  assert.equal(planDate("2026-01-01"), "Thu 01-Jan-2026");
  assert.equal(planDate("2028-02-29"), "Tue 29-Feb-2028");
  assert.equal(planDate("2026-02-30"), "");
});

test("desk: sticky notes are tidied, taken-down ones are kept but not shown, and the wall holds twelve", async () => {
  const { stickyShape, stickiesUp, STICKY_MAX } = await import("../public/shared/desk.js");
  const s = stickyShape([{ id: "a", text: "x".repeat(500), colour: "purple", added: "2026-10-05" }, { id: "../b", text: "Hi", down: "2026-10-06" }, null]);
  assert.equal(s[0].text.length, 160);
  assert.equal(s[0].colour, "yellow");
  assert.equal(s[1].id, "l1");
  assert.equal(s[1].down, "2026-10-06");
  assert.equal(s[2].text, "");
  assert.deepEqual(stickiesUp(s).map((n) => n.id), ["a", "l2"]);
  assert.equal(stickiesUp(Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, text: "t" }))).length, STICKY_MAX);
  assert.deepEqual(stickyShape("nope"), []);
});
