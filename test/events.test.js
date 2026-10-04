// Apple Calendar events as the room shows them (public/shared/events.js). The events below are shaped like
// the helper's output (scripts/calendar.swift); nothing here runs the helper or touches Calendar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appleItems, appleAtWork, calendarList, calendarName, inCalendars, sameEvent, withoutDuplicates } from "../public/shared/events.js";

const ev = (o) => ({ id: "E1", title: "Pilates", calendar: "Personal", color: "#1BADF8", allDay: false, start: "2026-10-06T18:00", end: "2026-10-06T19:00", location: "", ...o });

test("a timed event sits on the day it starts, at its time", () => {
  const [it] = appleItems([ev()]);
  assert.equal(it.date, "2026-10-06T18:00");
  assert.equal(it.kind, "Personal");
  assert.equal(it.apple, true);
  assert.equal(it.id, "apple:E1@2026-10-06T18:00");
});

test("an all-day event spread over a long weekend shows on each day", () => {
  const items = appleItems([ev({ id: "W", title: "Long weekend", allDay: true, start: "2026-10-24", end: "2026-10-26" })]);
  assert.deepEqual(items.map((i) => i.date), ["2026-10-24", "2026-10-25", "2026-10-26"]);
  assert.ok(items.every((i) => i.allDay && i.days.from === "2026-10-24" && i.days.to === "2026-10-26"));
  assert.equal(new Set(items.map((i) => i.id)).size, 3);
});

test("an all-day event across the change to daylight saving still covers each day once", () => {
  // NZ clocks go forward on 27 Sep 2026
  const items = appleItems([ev({ id: "D", allDay: true, start: "2026-09-26", end: "2026-09-28" })]);
  assert.deepEqual(items.map((i) => i.date), ["2026-09-26", "2026-09-27", "2026-09-28"]);
});

test("a weekly repeat, as EventKit gives it, is one item a week", () => {
  const items = appleItems([1, 8, 15].map((d) => ev({ id: "C", title: "Choir", start: `2026-10-${String(d).padStart(2, "0")}T19:00` })));
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map((i) => i.id)).size, 3);
});

test("broken or odd events are left out, titles with macrons and emoji kept", () => {
  const items = appleItems([null, { title: 3 }, ev({ start: "tomorrow" }), ev({ title: "Hui at Ōrākei 🌿", id: "M" }), ev({ title: "  ", id: "B" })]);
  assert.deepEqual(items.map((i) => i.title), ["Hui at Ōrākei 🌿", "(No title)"]);
  assert.equal(appleItems([ev({ color: "red" })])[0].color, "#3B6B5A");
});

test("the same event in Notion and Apple Calendar shows once", () => {
  const notion = [{ id: "n1", title: "Client  review", date: "2026-10-06T13:00:00.000+13:00" }];
  const apple = appleItems([ev({ title: "client review", start: "2026-10-06T13:00" }), ev({ id: "E2", title: "Client review", start: "2026-10-06T15:00" })]);
  assert.ok(sameEvent(apple[0], notion[0]));
  assert.deepEqual(withoutDuplicates(apple, notion).map((i) => i.date), ["2026-10-06T15:00"]);
});

test("at work, only Work calendars show in full; the rest keep their time and say Busy", () => {
  const [personal] = appleItems([ev()]);
  const [work] = appleItems([ev({ id: "S", title: "Stand-up", calendar: "Spark NZ" })]);
  assert.equal(appleAtWork(work, ["spark nz"]).title, "Stand-up");
  const busy = appleAtWork(personal, ["Spark NZ"]);
  assert.deepEqual([busy.title, busy.busy, busy.date, busy.location], ["Busy", true, "2026-10-06T18:00", undefined]);
  assert.equal(appleAtWork(personal, []).title, "Busy");
});

test("calendar names from .env", () => {
  assert.deepEqual(calendarList(" Bills, Income ,Spark NZ,,"), ["Bills", "Income", "Spark NZ"]);
  assert.deepEqual(calendarList(undefined), []);
});

test("calendar names match on their words, whatever emoji they start with", () => {
  assert.equal(calendarName("👔 Spark NZ"), "spark nz");
  assert.equal(calendarName("👩🏽‍🤝‍👨🏾 G + M"), "g m");
  assert.ok(inCalendars("🏡 Manueli Calendar", ["Bills", "Manueli Calendar"]));
  assert.ok(!inCalendars("🙋🏾‍♀️ Personal", ["Bills"]));
  const [work] = appleItems([ev({ id: "S", title: "Stand-up", calendar: "👔 Spark NZ" })]);
  assert.equal(appleAtWork(work, ["Spark NZ"]).title, "Stand-up");
});
