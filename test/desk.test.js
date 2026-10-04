import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, stepDay, deskShape, carriedOver, lastFocus, workReady, deskSections, WORK_WAIT_MS, MAX_LINES, MAX_TEXT } from "../public/shared/desk.js";

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
  assert.equal(s.general.length, MAX_LINES);
  assert.equal(s.general[0].text.length, MAX_TEXT);
  assert.deepEqual(s.settled, { "2026-10-04:g1": "gone" });
  assert.deepEqual(deskShape(null), deskShape({}));
});

test("desk: unfinished jottings carry once, finished and settled ones don't, nothing from the future or over a week ago", () => {
  const days = {
    "2026-09-20": { general: [{ id: "a", text: "too old" }] },
    "2026-10-03": { general: [{ id: "a", text: "Post the parcel" }, { id: "b", text: "Done already", done: true }, { id: "c", text: "" }] },
    "2026-10-04": { general: [{ id: "a", text: "Ring Nana" }, { id: "b", text: "Let this go" }], settled: { "2026-10-03:x": "gone" } },
    "2026-10-05": { general: [{ id: "a", text: "Ring Nana" }], settled: { "2026-10-04:a": "today", "2026-10-04:b": "gone" } },
    "2026-10-06": { general: [{ id: "a", text: "Tomorrow's" }] },
  };
  const c = carriedOver(days, "2026-10-05");
  assert.deepEqual(c.map((x) => x.key), ["2026-10-03:a"]);
  assert.equal(c[0].text, "Post the parcel");
  // running it twice changes nothing
  assert.deepEqual(carriedOver(days, "2026-10-05"), c);
});

test("desk: yesterday's focus areas show as a hint, today's never do", () => {
  const days = { "2026-10-02": { focus: ["Old"] }, "2026-10-04": { focus: ["", "", ""] }, "2026-10-03": { focus: ["Calm", "Sydney"] }, "2026-10-05": { focus: ["Today"] } };
  assert.deepEqual(lastFocus(days, "2026-10-05"), ["Calm", "Sydney", ""]);
  assert.equal(lastFocus({ "2026-10-05": { focus: ["x"] } }, "2026-10-05"), null);
});

test("desk: a Work line goes to Notion only after five quiet minutes", () => {
  const now = 1_000_000_000;
  const work = [{ id: "a", text: "Send deck", edited: now - WORK_WAIT_MS }, { id: "b", text: "Still typing", edited: now - 60_000 }, { id: "c", text: "", edited: now - WORK_WAIT_MS * 2 }, { id: "d", text: "No time", edited: 0 }];
  assert.deepEqual(workReady(work, now).map((w) => w.id), ["a"]);
});

test("desk: at work only the Work list shows", () => {
  assert.deepEqual(deskSections(true), ["work"]);
  assert.ok(!deskSections(true).includes("general"));
  assert.deepEqual(deskSections(false), ["focus", "key", "general", "work"]);
});
