import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, stepDay, deskShape, lastFocus, deskSections, planDate, startDay, leftovers, bringForward, settle, carriedDays, shorterCol, withFixed, isFixed, stampLine, keepPlan, timeLabel, TIME_PICKS, PLANS_KEPT, MAX_LINES, MAX_TEXT } from "../public/shared/desk.js";

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

test("desk: shape keeps three focus areas, turns an older day's Tasks into General lines, and caps the lists", () => {
  const s = deskShape({ focus: ["  Calm  ", "Sydney", "Health", "extra"], key: [{ text: "Call", done: 1, pri: "h", mins: 15 }, { text: "" }, { text: "Ring" }], general: Array.from({ length: 60 }, (_, i) => ({ id: `g${i}`, text: "x".repeat(400) })), settled: { "2026-10-04:g1": "gone", "bad": "today", "2026-10-04:g2": "maybe" } });
  assert.deepEqual(s.focus, ["Calm", "Sydney", "Health"]);
  assert.equal(s.key, undefined);
  // an older file's plain list opens as the General section, its Tasks first (ids k0-k2 kept, blanks dropped)
  assert.equal(s.sections[0].id, "general");
  assert.deepEqual(s.sections[0].lines.slice(0, 2).map((l) => [l.id, l.text, l.done, l.pri, l.mins]), [["k0", "Call", true, "h", 15], ["k2", "Ring", false, "", 0]]);
  assert.equal(s.sections[0].lines.length, MAX_LINES);
  assert.equal(s.sections[0].lines[2].text.length, MAX_TEXT);
  assert.deepEqual(s.settled, { "2026-10-04:g1": "gone" });
  assert.deepEqual(deskShape(null), deskShape({}));
  // converting again changes nothing (the Tasks aren't added twice)
  assert.deepEqual(deskShape({ ...s, key: [{ text: "Call" }] }).sections[0].lines.filter((l) => l.id === "k0").length, 1);
});

test("desk: sections keep General first, keep blanks in the middle and drop trailing ones", () => {
  const s = deskShape({ sections: [{ id: "s1", name: "House", col: 1, lines: [{ id: "a", text: "" }, { id: "b", text: "Bins", done: true }, { id: "c", text: "" }] }, { id: "general", lines: [{ id: "g", text: "Ring Nana" }] }, { id: "s1", name: "Dup" }] });
  assert.deepEqual(s.sections.map((x) => x.name), ["General", "House"]);
  assert.deepEqual(s.sections[1].lines.map((l) => l.id), ["a", "b"]);
  assert.equal(s.sections[1].col, 1);
  assert.equal(s.sections[0].lines[0].text, "Ring Nana");
  // a blank line can't be ticked
  assert.equal(deskShape({ general: [{ id: "x", text: "", done: true }, { id: "y", text: "y" }] }).sections[0].lines[0].done, false);
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
    "2026-10-04": { key: [{ text: "Call bank" }, { text: "Done one", done: true }], sections: [{ id: "general", lines: [{ id: "a", text: "Post parcel" }, { id: "b", text: "" }] }, { id: "s1", name: "House", lines: [{ id: "c", text: "Bins", from: "2026-10-02" }] }] },
    "2026-10-05": { settled: { "2026-10-04:a": "gone" } },
    "2026-10-06": { settled: { "2026-10-04:c": "today" } },
  };
  // an older day's Task keeps its sweep key (k0), now under General
  assert.deepEqual(leftovers(days, "2026-10-06").map((x) => [x.key, x.section, x.text, x.from]), [["2026-10-04:k0", "General", "Call bank", "2026-10-04"]]);
  // a Task already dealt with before the change stays dealt with
  assert.deepEqual(leftovers({ ...days, "2026-10-05": { settled: { "2026-10-04:a": "gone", "2026-10-04:k0": "done" } } }, "2026-10-06"), []);
  // a carried line remembers its first day
  const back = { ...days, "2026-10-06": {} };
  assert.equal(leftovers(back, "2026-10-06").find((x) => x.text === "Bins").from, "2026-10-02");
  assert.equal(carriedDays({ day: "2026-10-04", from: "2026-10-02" }, "2026-10-06"), 5);
  assert.equal(carriedDays({ day: "2026-10-05" }, "2026-10-06"), 2);
});

test("desk: bringing forward puts a line under its own header (General if it had none), remembering where it began", () => {
  const now = new Date("2026-10-06T08:00:00Z");
  const d = deskShape({ sections: [] });
  bringForward(d, { key: "2026-10-05:k1", day: "2026-10-05", section: "General", text: "Call bank", added: "2026-10-05T01:00:00.000Z" }, "n1", now);
  bringForward(d, { key: "2026-10-05:c", day: "2026-10-05", from: "2026-10-03", section: "House", text: "Bins" }, "n2", now);
  assert.deepEqual(d.sections[0].lines.map((l) => [l.text, l.from, l.added]), [["Call bank", "2026-10-05", "2026-10-05T01:00:00.000Z"]]);
  const house = d.sections.find((s) => s.name === "House");
  assert.deepEqual(house.lines.map((l) => [l.text, l.from]), [["Bins", "2026-10-03"]]);
  assert.deepEqual(d.settled, { "2026-10-05:k1": "today", "2026-10-05:c": "today" });
  assert.equal(d.settledAt["2026-10-05:c"], now.toISOString());
  // done / let go are recorded with when
  settle(d, { key: "2026-10-04:z" }, "gone", "n3", now);
  assert.deepEqual([d.settled["2026-10-04:z"], d.settledAt["2026-10-04:z"]], ["gone", now.toISOString()]);
  // and survive a save
  assert.deepEqual(deskShape(d).settledAt, d.settledAt);
  assert.equal(deskShape(d).sections[1].lines[0].from, "2026-10-03");
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
  assert.deepEqual(deskSections(false), ["focus", "todo"]);
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

test("plan: Tasks first, then High, Medium, Low; blank time is 30 min; a 5-minute buffer round blocks and meetings", async () => {
  const { planDay } = await import("../public/shared/desk.js");
  const { blocks, overflow } = planDay({
    tasks: [{ ref: "low", pri: "l", mins: 15 }, { ref: "hi", pri: "h" }, { ref: "k0", first: true, mins: 45 }, { ref: "mid", pri: "m", mins: 30 }],
    fixed: [{ start: "10:00", end: "11:00" }], from: "08:00",
  });
  assert.deepEqual(blocks.map((b) => [b.ref, b.start, b.end]), [["k0", "08:30", "09:15"], ["hi", "09:20", "09:50"], ["mid", "11:05", "11:35"], ["low", "11:40", "11:55"]]);
  assert.deepEqual(overflow, []);
});

test("plan: from now, a break after about 90 minutes, and what doesn't fit is overflow", async () => {
  const { planDay } = await import("../public/shared/desk.js");
  const { blocks, overflow } = planDay({ tasks: [{ ref: "a", mins: 60 }, { ref: "b", mins: 60 }, { ref: "c", mins: 120 }], from: "13:02", day: { start: "08:30", end: "17:30" } });
  // c (2 h) would end at 17:35, past the day's end, so it's overflow (and the break before it goes too)
  assert.deepEqual(blocks.map((b) => [b.kind, b.start, b.end]), [["task", "13:05", "14:05"], ["break", "14:10", "14:20"], ["task", "14:25", "15:25"]]);
  assert.deepEqual(overflow, ["c"]);
});

test("plan: a short task uses an earlier gap a long one couldn't; no break after only a little work", async () => {
  const { planDay } = await import("../public/shared/desk.js");
  const { blocks, overflow } = planDay({ tasks: [{ ref: "warm", first: true, mins: 15 }, { ref: "long", pri: "h", mins: 90 }, { ref: "short", pri: "l", mins: 30 }], fixed: [{ start: "10:30", end: "11:00" }], from: "08:30" });
  // 15 min of work isn't enough for a break, so the 90-minute task follows straight on and fits before 10:30
  assert.deepEqual(blocks.map((b) => [b.ref, b.start, b.end]), [["warm", "08:30", "08:45"], ["long", "08:50", "10:20"], ["short", "11:05", "11:35"]]);
  assert.deepEqual(overflow, []);
  const gap = planDay({ tasks: [{ ref: "long", pri: "h", mins: 120 }, { ref: "short", pri: "l", mins: 30 }], fixed: [{ start: "09:30", end: "10:00" }], from: "08:30" });
  assert.deepEqual(gap.blocks.map((b) => [b.ref, b.start]), [["short", "08:30"], ["long", "10:05"]]);
});

test("plan: only open items are planned, and at work only Work ones", async () => {
  const { openItems, deskShape } = await import("../public/shared/desk.js");
  const d = deskShape({ key: [{ text: "Call", pri: "h", mins: 15 }, { text: "Done", done: true }], sections: [{ id: "general", lines: [{ id: "a", text: "Milk" }] }, { id: "s1", name: "Sprint", work: true, lines: [{ id: "b", text: "Review PR", mins: 45 }] }] });
  assert.deepEqual(openItems(d).map((x) => x.ref), ["k0", "a", "b"]);
  assert.deepEqual(openItems(d, true).map((x) => x.ref), ["b"]);
  assert.equal(openItems(d)[0].mins, 15);
  assert.equal(deskShape({ general: [{ id: "x", text: "x", mins: 37, pri: "urgent" }] }).sections[0].lines[0].mins, 0);
});

const FIXED = [{ name: "Spark NZ", work: true }, { name: "Jump issues", work: true }];
test("desk: fixed sections are always there after General; one with the same name is adopted", () => {
  const d = withFixed(deskShape({ sections: [{ id: "s9", name: "House", lines: [{ id: "h", text: "Bins" }] }, { id: "sw", name: "spark nz", col: 1, work: false, lines: [{ id: "x", text: "Deck" }] }] }), FIXED);
  assert.deepEqual(d.sections.map((s) => [s.id, s.name]), [["general", "General"], ["sw", "spark nz"], ["f-jump-issues", "Jump issues"], ["s9", "House"]]);
  assert.equal(d.sections[1].lines[0].text, "Deck"); // kept its lines
  assert.equal(d.sections[2].work, true);
  assert.equal(isFixed(d.sections[1], FIXED), true);
  assert.equal(isFixed(d.sections[3], FIXED), false);
  // again: nothing doubles
  assert.equal(withFixed(d, FIXED).sections.length, 4);
});

test("desk: a new day carries fixed sections and only Mel's own that had something written", () => {
  const earlier = { "2026-10-06": { sections: [{ id: "general", lines: [] }, { id: "a", name: "Walkthrough", lines: [{ id: "1", text: "Mop" }] }, { id: "b", name: "", lines: [] }, { id: "c", name: "Empty one", lines: [] }] } };
  const d = startDay({}, earlier, "2026-10-07", FIXED);
  assert.deepEqual(d.sections.map((s) => s.name), ["General", "Spark NZ", "Jump issues", "Walkthrough"]);
  assert.equal(d.sections[3].lines.length, 0);
  assert.equal(d.started, true);
});

test("desk: lines remember when they were written and ticked; a cleared line forgets", () => {
  const t1 = new Date("2026-10-06T08:00:00Z"), t2 = new Date("2026-10-06T09:30:00Z");
  const l = { id: "a", text: "Mop", done: false };
  stampLine(l, t1);
  assert.equal(l.added, t1.toISOString());
  l.done = true; stampLine(l, t2);
  assert.deepEqual([l.added, l.doneAt], [t1.toISOString(), t2.toISOString()]);
  l.done = false; stampLine(l, t2);
  assert.equal(l.doneAt, undefined);
  assert.equal(deskShape({ general: [{ id: "a", text: "Mop", added: "nonsense", done: true, doneAt: t2.toISOString() }] }).sections[0].lines[0].added, undefined);
  l.text = ""; stampLine(l, t2);
  assert.equal(l.added, undefined);
});

test("desk: every plan is kept (the newest ten), the last is the current one", () => {
  const d = deskShape({});
  for (let i = 0; i < 12; i++) keepPlan(d, { blocks: [{ ref: `r${i}`, start: "09:00", end: "09:30", kind: "task" }], overflow: [] }, new Date(Date.UTC(2026, 9, 6, 8, i)));
  const saved = deskShape(d);
  assert.equal(saved.plans.length, PLANS_KEPT);
  assert.equal(saved.plans.at(-1).blocks[0].ref, "r11");
  assert.equal(saved.blocks[0].ref, "r11");
});

test("desk: times read as words with the minutes", () => {
  assert.deepEqual(TIME_PICKS.map(timeLabel), ["Quick (10m)", "Short (15m)", "Half hour (30m)", "Solid (45m)", "Hour (1h)", "Big (2h)"]);
  assert.equal(timeLabel(90), "1h30"); // an older line or a meeting
  assert.equal(deskShape({ general: [{ id: "a", text: "x", mins: 90 }] }).sections[0].lines[0].mins, 90);
});

test("draft day: High to Low, quick first within each, blank time as Half hour", async () => {
  const { draftOrder } = await import("../public/shared/desk.js");
  const items = [
    { ref: "a", pri: "l", mins: 10 }, { ref: "b", pri: "h", mins: 60 }, { ref: "c", pri: "h", mins: 15 },
    { ref: "d", pri: "", mins: 0 }, { ref: "e", pri: "m", mins: 10 }, { ref: "f", pri: "h", mins: 15 },
  ];
  assert.deepEqual(draftOrder(items), ["c", "f", "b", "e", "d", "a"]);
  // Mel's own order is kept; something new slots in where the rule would put it; gone ones drop out
  const kept = draftOrder(items, ["a", "b", "zz", "c"]);
  assert.deepEqual(kept.filter((r) => ["a", "b", "c"].includes(r)), ["a", "b", "c"]);
  assert.equal(kept.length, 6);
  assert.ok(!kept.includes("zz"));
});

test("draft day: planDay keeps Mel's order when asked; moving one in the order", async () => {
  const { planDay, moveInOrder } = await import("../public/shared/desk.js");
  const tasks = [{ ref: "low", pri: "l", mins: 30 }, { ref: "high", pri: "h", mins: 30 }];
  const day = { start: "09:00", end: "17:00" };
  assert.equal(planDay({ tasks, day }).blocks[0].ref, "high");
  assert.equal(planDay({ tasks, day, keepOrder: true }).blocks[0].ref, "low");
  assert.deepEqual(moveInOrder(["a", "b", "c"], "c", 0), ["c", "a", "b"]);
  assert.deepEqual(moveInOrder(["a", "b", "c"], "a", 9), ["b", "c", "a"]);
});

test("draft day: a day planned before the draft counts as locked; the order is kept", async () => {
  const { deskShape } = await import("../public/shared/desk.js");
  assert.equal(deskShape({ blocks: [{ ref: "a", start: "09:00", end: "09:30", kind: "task" }] }).locked, true);
  assert.equal(deskShape({}).locked, false);
  assert.equal(deskShape({ locked: false, blocks: [{ ref: "a", start: "09:00", end: "09:30", kind: "task" }] }).locked, false);
  assert.deepEqual(deskShape({ order: ["a", "bad id!", "b"] }).order, ["a", "b"]);
});

test("bulk: lines move to another section keeping their ids; several get a priority, time or tick at once", async () => {
  const { deskShape, moveLines, setLines, removeMeeting } = await import("../public/shared/desk.js");
  const d = deskShape({ sections: [
    { id: "general", lines: [{ id: "a", text: "Milk", pri: "h" }, { id: "b", text: "Bread" }, { id: "c", text: "Post" }] },
    { id: "s1", name: "House", lines: [{ id: "x", text: "Bins" }, { id: "blank", text: "" }, { id: "y", text: "Mop" }] },
  ], meetings: [{ id: "m1", time: "09:00", title: "Stand-up" }, { id: "m2", time: "10:00", title: "1:1" }] });
  moveLines(d, ["a", "c"], "s1");
  assert.deepEqual(d.sections[0].lines.filter((l) => l.text).map((l) => l.id), ["b"]);
  assert.deepEqual(d.sections[1].lines.filter((l) => l.text).map((l) => l.id), ["x", "a", "y", "c"]); // a filled the blank
  assert.equal(d.sections[1].lines.find((l) => l.id === "a").pri, "h");
  setLines(d, ["a", "b", "nope"], { pri: "l", mins: 10 });
  assert.deepEqual(["a", "b"].map((r) => d.sections.flatMap((x) => x.lines).find((l) => l.id === r)).map((l) => [l.pri, l.mins]), [["l", 10], ["l", 10]]);
  setLines(d, ["x"], { done: true }, new Date("2026-10-06T09:00:00Z"));
  assert.equal(d.sections[1].lines[0].doneAt, "2026-10-06T09:00:00.000Z");
  assert.deepEqual(removeMeeting(d, "m1").meetings.map((m) => m.id), ["m2"]);
  // and it all survives a save
  assert.deepEqual(deskShape(d).sections[1].lines.filter((l) => l.text).map((l) => l.id), ["x", "a", "y", "c"]);
});
