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

// ---- adding, changing and deleting (7 Oct 2026, brief docs/plans/2026-10-apple-calendar-events.md) ----
import { addMinutes, defaultCalendar, eventShape, moveStart, newEventTimes, occurrences, repeatText, setAllDay, writableCalendars } from "../public/shared/events.js";

test("events: a new event starts at the next half hour today, at 9 on other days, and lasts an hour", () => {
  assert.deepEqual(newEventTimes("2026-10-07", new Date(2026, 9, 7, 14, 10)), { start: "2026-10-07T14:30", end: "2026-10-07T15:30" });
  assert.deepEqual(newEventTimes("2026-10-07", new Date(2026, 9, 7, 14, 40)), { start: "2026-10-07T15:00", end: "2026-10-07T16:00" });
  assert.deepEqual(newEventTimes("2026-10-09", new Date(2026, 9, 7, 14, 10)), { start: "2026-10-09T09:00", end: "2026-10-09T10:00" });
  assert.deepEqual(newEventTimes("2026-10-07", new Date(2026, 9, 7, 23, 40)), { start: "2026-10-07T09:00", end: "2026-10-07T10:00" }); // too late: 9 am
});

test("events: moving the start takes the end with it; all day swaps times for days", () => {
  const f = { allDay: false, start: "2026-10-07T09:00", end: "2026-10-07T10:30" };
  assert.equal(moveStart(f, "2026-10-08T13:00").end, "2026-10-08T14:30");
  assert.equal(moveStart({ allDay: true, start: "2026-10-07", end: "2026-10-09" }, "2026-10-20").end, "2026-10-22");
  const d = setAllDay({ ...f, alert: 15 }, true);
  assert.deepEqual([d.start, d.end, d.alert], ["2026-10-07", "2026-10-07", null]);
  assert.deepEqual([setAllDay(d, false).start, setAllDay(d, false).end], ["2026-10-07T09:00", "2026-10-07T10:00"]);
  assert.equal(addMinutes("2026-10-07T23:30", 60), "2026-10-08T00:30");
});

test("events: whatever is sent is tidied before it reaches Calendar", () => {
  const { event } = eventShape({ title: "  Dentist \n ", start: "2026-10-07T09:00", end: "2026-10-07T08:00", alert: "15", url: "javascript:alert(1)", repeat: "weekly", count: 4 });
  assert.equal(event.title, "Dentist");
  assert.equal(event.end, "2026-10-07T10:00"); // an end before the start: an hour
  assert.equal(event.alert, 15);
  assert.equal(event.url, ""); // only web links
  assert.equal(event.count, 4);
  assert.equal(eventShape({ start: "tomorrow" }).error, "Pick when it starts");
  assert.equal(eventShape({ allDay: true, start: "2026-10-07", end: "2026-10-01" }).event.end, "2026-10-07");
  assert.equal(eventShape({ start: "2026-10-07T09:00", repeat: "hourly" }).event.repeat, "none");
  assert.equal(eventShape({ start: "2026-10-07T09:00", repeat: "daily", until: "2026-10-01" }).event.until, ""); // ends before it starts: ignored
  assert.equal(eventShape({ start: "2026-10-07T09:00", alert: "" }).event.alert, null);
});

test("events: only calendars Hanua can write to are offered; at work, only the Work ones", () => {
  const cals = [{ title: "Personal", writable: true }, { title: "👔 Spark NZ", writable: true }, { title: "NZ Holidays", writable: false }];
  assert.deepEqual(writableCalendars(cals).map((c) => c.title), ["Personal", "👔 Spark NZ"]);
  assert.deepEqual(writableCalendars(cals, { atWork: true, work: ["Spark NZ"] }).map((c) => c.title), ["👔 Spark NZ"]);
  const ok = writableCalendars(cals);
  assert.equal(defaultCalendar(ok, { chosen: "Spark NZ", macDefault: "Personal" }), "👔 Spark NZ"); // Mel's pick in Settings
  assert.equal(defaultCalendar(ok, { chosen: "Gone", macDefault: "Personal" }), "Personal"); // else the Mac's default
  assert.equal(defaultCalendar(ok, { chosen: "NZ Holidays" }), "Personal"); // never one it can't write to
});

test("events: a repeating event falls on the right days (the sample server's stand-in for EventKit)", () => {
  const choir = { id: "c", title: "Choir", start: "2026-10-06T19:00", end: "2026-10-06T20:30", repeat: "weekly" };
  assert.deepEqual(occurrences(choir, "2026-10-10", "2026-10-31").map((o) => o.start), ["2026-10-13T19:00", "2026-10-20T19:00", "2026-10-27T19:00"]);
  assert.equal(occurrences(choir, "2026-10-10", "2026-10-14")[0].end, "2026-10-13T20:30");
  assert.equal(occurrences({ ...choir, count: 2 }, "2026-10-01", "2026-12-31").length, 2);
  assert.equal(occurrences({ ...choir, until: "2026-10-20" }, "2026-10-01", "2026-12-31").length, 3);
  assert.equal(occurrences({ ...choir, except: ["2026-10-13T19:00"] }, "2026-10-01", "2026-10-21").length, 2);
  const wk = occurrences({ id: "w", title: "Walk", start: "2026-10-09T07:00", end: "2026-10-09T07:30", repeat: "weekdays" }, "2026-10-09", "2026-10-14");
  assert.deepEqual(wk.map((o) => o.start.slice(0, 10)), ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"]); // Fri, then Mon–Wed
  assert.equal(occurrences({ id: "x", title: "Once", start: "2026-10-09T07:00", end: "2026-10-09T08:00" }, "2026-10-01", "2026-10-31").length, 1);
  assert.equal(repeatText({ repeat: "weekly", count: 3 }), "Every week, 3 times");
});

test("events: an Apple item carries what the window needs to change it", () => {
  const [it] = appleItems([ev({ occurrence: "2026-10-06T18:00", repeat: "weekly", alert: 15, writable: true, notes: "Mat" })]);
  assert.equal(it.eid, "E1");
  assert.equal(it.occurrence, "2026-10-06T18:00");
  assert.equal(it.event.repeat, "weekly");
  assert.equal(it.event.alert, 15);
  assert.equal(it.writable, true);
  assert.equal(appleAtWork(it, []).event, undefined); // "Busy" carries nothing to open
});
