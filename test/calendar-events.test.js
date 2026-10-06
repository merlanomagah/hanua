// Adding, changing and deleting events on the sample calendar (server/calendar.js with APPLE_CAL=0): the same path the
// New event window takes, without ever touching Mel's real calendars (brief docs/plans/2026-10-apple-calendar-events.md)
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, todayStr } from "../public/shared/dates.js";

process.env.APPLE_CAL = "0";
const { addEvent, editEvent, getAppleEvents, getEventCalendars, removeEvent } = await import("../server/calendar.js");
const t = todayStr(), from = addDays(t, -40), to = addDays(t, 60);
const all = async () => (await getAppleEvents(from, to, { fresh: true })).items;
const named = async (title) => (await all()).filter((i) => i.title === title);

test("calendar events: the calendars offered say which can be written to", async () => {
  const c = await getEventCalendars();
  assert.ok(c.calendars.some((x) => x.title === "Personal" && x.writable));
  assert.ok(c.calendars.some((x) => x.title === "NZ Holidays" && !x.writable));
});

test("calendar events: add, change, delete, and Undo by adding it again", async () => {
  const r = await addEvent({ title: "Dentist", calendar: "Personal", start: `${addDays(t, 2)}T09:00`, end: `${addDays(t, 2)}T09:45`, alert: 30 });
  let [it] = await named("Dentist");
  assert.equal(it.event.alert, 30);
  assert.equal(it.writable, true);
  await editEvent(r.id, r.occurrence, "future", { ...it.event, title: "Dentist (Dr Lee)", start: `${addDays(t, 3)}T10:00`, end: `${addDays(t, 3)}T10:45` });
  [it] = await named("Dentist (Dr Lee)");
  assert.equal(it.date, `${addDays(t, 3)}T10:00`);
  assert.equal((await named("Dentist")).length, 0);
  await removeEvent(it.eid, it.occurrence, "future");
  assert.equal((await named("Dentist (Dr Lee)")).length, 0);
  await addEvent(it.event); // Undo
  assert.equal((await named("Dentist (Dr Lee)")).length, 1);
});

test("calendar events: one day of a repeating event, or this and the rest", async () => {
  const choir = await named("Choir");
  assert.ok(choir.length >= 10, "a weekly event in the sample");
  const next = choir.find((c) => c.date.slice(0, 10) > t);
  // only this one moves
  await editEvent(next.eid, next.occurrence, "this", { ...next.event, start: next.event.start.replace("19:00", "18:00"), end: next.event.end.replace("20:30", "19:30"), repeat: "weekly" });
  let now = await named("Choir");
  assert.equal(now.length, choir.length);
  assert.ok(now.some((c) => c.date === next.date.replace("19:00", "18:00") && c.event.repeat === "none"));
  assert.ok(now.filter((c) => c.date.slice(0, 10) > next.date.slice(0, 10)).every((c) => c.date.endsWith("19:00")));
  // delete this and the rest from the week after: the earlier ones stay
  const later = now.filter((c) => c.date.slice(0, 10) > next.date.slice(0, 10) && c.event.repeat === "weekly")[0];
  await removeEvent(later.eid, later.occurrence, "future");
  now = await named("Choir");
  assert.ok(now.every((c) => c.date.slice(0, 10) < later.date.slice(0, 10)));
  assert.ok(now.length > 3);
});

test("calendar events: read-only calendars and bad requests are refused", async () => {
  const [hol] = await named("Labour Day");
  await assert.rejects(editEvent(hol.eid, hol.occurrence, "future", { ...hol.event, title: "Mine" }), /read-only/);
  await assert.rejects(addEvent({ title: "X", calendar: "NZ Holidays", start: `${t}T09:00` }), /read-only/);
  await assert.rejects(addEvent({ title: "X", start: "soon" }), /Pick when it starts/);
  await assert.rejects(removeEvent("s2", "yesterday", "this"), /Which day/);
  await assert.rejects(removeEvent("s2", `${t}T18:00`, "all"), /This event, or this and future/);
});
