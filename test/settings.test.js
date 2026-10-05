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
