import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, renameSections, renames, settingsShape } from "../public/shared/settings.js";
import { deskShape } from "../public/shared/desk.js";

const base = defaults([{ name: "Spark NZ", work: true }, { name: "Jump issues", work: true }]);

test("settings: anything missing or odd falls back to Hanua's defaults", () => {
  assert.deepEqual(settingsShape({}, base), base);
  const s = settingsShape({ day: { start: "09:00", end: "08:00" }, timer: { focus: 3, rest: 10 }, timeWords: { 10: "  Tiny ", 15: "" }, fixedSections: [{ name: "Spark NZ" }, { name: "spark nz" }, { name: "" }, { name: "Admin", work: 1 }] }, base);
  assert.deepEqual(s.day, base.day); // end before start: back to the default
  assert.deepEqual(s.timer, { focus: 25, rest: 10 });
  assert.equal(s.timeWords[10], "Tiny");
  assert.equal(s.timeWords[15], "Short");
  assert.deepEqual(s.fixedSections, [{ name: "Spark NZ", work: false }, { name: "Admin", work: true }]);
  assert.equal(settingsShape({ desk: { autoOpen: false } }, base).desk.autoOpen, false);
  assert.equal(settingsShape({ calendar: { default: "  Personal " } }, base).calendar.default, "Personal"); // where new events go (7 Oct 2026)
  assert.deepEqual(settingsShape(null, base).fixedSections, base.fixedSections);
});

test("settings: renaming a fixed section renames today's, lines and all", () => {
  const before = base.fixedSections, after = [{ name: "Spark", work: true }, { name: "Jump issues", work: true }];
  assert.deepEqual(renames(before, after), [["Spark NZ", "Spark"]]);
  const d = deskShape({ sections: [{ id: "general", lines: [] }, { id: "sw", name: "Spark NZ", lines: [{ id: "a", text: "Deck" }] }] });
  renameSections(d, renames(before, after));
  assert.equal(d.sections[1].name, "Spark");
  assert.equal(d.sections[1].lines[0].text, "Deck");
  // removing one isn't a rename; nor is reordering
  assert.deepEqual(renames(before, [before[0]]), []);
  assert.deepEqual(renames(before, [before[1], before[0]]), []);
});

test("settings: Hanua Settings' groups (8 Oct 2026) tidy to Hanua's own", () => {
  const s = settingsShape({
    room: { lightsOff: 22, lightsOn: 6, clocks: [{ city: " London ", zone: "Europe/London" }, { zone: "Not/AZone" }, { city: "", zone: "Asia/Tokyo" }], greetOff: ["fr", "fr", ""] },
    calendars: { shown: ["Home", " Home", "Work"], work: ["Work"] }, weather: { place: "  Wellington " }, sleep: { after: 30 },
  }, base);
  assert.deepEqual(s.room.clocks, [{ city: "London", zone: "Europe/London" }, base.room.clocks[1], { city: "Tokyo", zone: "Asia/Tokyo" }]);
  assert.deepEqual([s.room.lightsOff, s.room.lightsOn, s.room.greetOff], [22, 6, ["fr"]]);
  assert.deepEqual(s.calendars, { shown: ["Home", "Work"], work: ["Work"] });
  assert.equal(s.weather.place, "Wellington");
  assert.equal(s.sleep.after, 30);
  // odd values fall back: the same hour twice, an hour out of range, a sleep time not offered
  const t = settingsShape({ room: { lightsOff: 5, lightsOn: 5 }, sleep: { after: 7 } }, base);
  assert.deepEqual([t.room.lightsOff, t.room.lightsOn, t.sleep.after], [21, 4, 15]);
  assert.equal(settingsShape({ room: { lightsOff: 24 } }, base).room.lightsOff, 21);
});

test("settings: a group from a newer Hanua is kept, never dropped; saves name the groups that changed", async () => {
  const { changedGroups, SETTINGS_VERSION } = await import("../public/shared/settings.js");
  const s = settingsShape({ closeDay: { offer: "16:00" }, v: 9, base: "x", changed: ["timer"] }, base);
  assert.deepEqual(s.closeDay, { offer: "16:00" });
  assert.equal("v" in s || "base" in s || "changed" in s, false);
  assert.ok(Number.isInteger(SETTINGS_VERSION) && SETTINGS_VERSION >= 2);
  const next = structuredClone(base); next.timer.focus = 50; next.weather.place = "Suva";
  assert.deepEqual(changedGroups(base, next), ["timer", "weather"]);
  assert.deepEqual(changedGroups(base, structuredClone(base)), []);
});

test("settings: Close the day's times, in a group of their own (9 Oct 2026)", () => {
  assert.deepEqual(base.close, { from: "16:00", remind: "19:00" });
  assert.deepEqual(settingsShape({ close: { from: "17:30", remind: "" } }, base).close, { from: "17:30", remind: "" }); // no reminder
  assert.deepEqual(settingsShape({ close: { from: "5pm", remind: "late" } }, base).close, base.close); // junk: Hanua's own
  // an older Hanua (before this group) saving keeps the group it doesn't know
  const older = { ...base }; delete older.close;
  assert.deepEqual(settingsShape({ ...older, close: { from: "15:00", remind: "18:00" } }, base).close, { from: "15:00", remind: "18:00" });
});
