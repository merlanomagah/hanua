import { test } from "node:test";
import assert from "node:assert/strict";
import { changeOf, conflictOf, fileTooNew, mergeStickies, mergeWatered, placeholderFor, revisionOk, syncWarning } from "../public/shared/sync.js";

test("sync: a save must start from what's there now", () => {
  assert.equal(revisionOk("abc", "abc"), true);
  assert.equal(revisionOk("abc", "def"), false); // the other Mac saved since
  assert.equal(revisionOk(null, null), true); // a new file, still new
  assert.equal(revisionOk(null, "abc"), false); // "new" here, but the other Mac made it first
  assert.equal(revisionOk("abc", null), false); // the file went away
  assert.equal(revisionOk(undefined, "abc"), true); // a page from before revisions
});

test("sync: iCloud placeholders are named for the file they stand for", () => {
  assert.equal(placeholderFor(".2026-10-06.json.icloud"), "2026-10-06.json");
  assert.equal(placeholderFor(".stickies.json.icloud"), "stickies.json");
  assert.equal(placeholderFor("2026-10-06.json"), null);
  assert.equal(placeholderFor(".DS_Store"), null);
});

test("sync: iCloud's clash copies are found, real files aren't", () => {
  assert.equal(conflictOf("2026-10-06 2.json"), "2026-10-06.json");
  assert.equal(conflictOf("stickies 3.json"), "stickies.json");
  assert.equal(conflictOf("2026-09-28 2.png"), "2026-09-28.png");
  assert.equal(conflictOf("2026-10-06.json"), null);
  assert.equal(conflictOf("settings.json"), null);
  assert.equal(conflictOf("my notes 1.json"), null); // 2 and up are iCloud's
});

test("sync: which changed files an open page cares about", () => {
  assert.deepEqual(changeOf("desk/2026-10-06.json"), { kind: "desk", key: "2026-10-06" });
  assert.deepEqual(changeOf("menu/2026-10-05.json"), { kind: "menu", key: "2026-10-05" });
  assert.deepEqual(changeOf("stickies.json"), { kind: "stickies", key: "" });
  assert.deepEqual(changeOf("settings.json"), { kind: "settings", key: "" });
  assert.deepEqual(changeOf("plant.json"), { kind: "plant", key: "" });
  assert.equal(changeOf("desk/.2026-10-06.json.123.tmp"), null);
  assert.equal(changeOf("desk/.2026-10-06.json.icloud"), null);
  assert.equal(changeOf("desk/2026-10-06 2.json"), null);
  assert.equal(changeOf("whiteboard/2026-09-28.png"), null);
  assert.equal(changeOf(".DS_Store"), null);
});

test("sync: stickies merge note by note, the later edit winning, none lost", () => {
  const theirs = [{ id: "a", text: "milk", edited: "2026-10-06T09:00:00Z" }, { id: "b", text: "call", down: "2026-10-06", edited: "2026-10-06T10:00:00Z" }];
  const mine = [{ id: "a", text: "milk + eggs", edited: "2026-10-06T09:05:00Z" }, { id: "b", text: "call", down: null, edited: "2026-10-06T09:30:00Z" }, { id: "c", text: "new" }];
  const out = mergeStickies(theirs, mine);
  assert.deepEqual(out.map((n) => n.id), ["a", "b", "c"]);
  assert.equal(out[0].text, "milk + eggs"); // mine is later
  assert.equal(out[1].down, "2026-10-06"); // theirs is later: the note stays down
  // an Undo here (later) puts it back up there
  const undo = mergeStickies(out, [{ ...out[1], down: null, edited: "2026-10-06T11:00:00Z" }]);
  assert.equal(undo.find((n) => n.id === "b").down, null);
  // nothing either side had is dropped
  assert.equal(mergeStickies([{ id: "x" }], []).length, 1);
});

test("sync: the plant's waterings add up", () => {
  assert.deepEqual(mergeWatered(["2026-10-04", "2026-10-06"], ["2026-10-05", "2026-10-06", "nonsense"]), ["2026-10-04", "2026-10-05", "2026-10-06"]);
  assert.deepEqual(mergeWatered(null, undefined), []);
});

test("sync: a file from a newer Hanua isn't saved over", () => {
  assert.equal(fileTooNew(6, 5), true);
  assert.equal(fileTooNew(5, 5), false);
  assert.equal(fileTooNew(undefined, 5), false); // older files carry none
});

test("sync: the desk says what's wrong with the shared folder, most serious first", () => {
  assert.equal(syncWarning({}), null);
  assert.match(syncWarning({ missing: true, conflicts: ["x"] }), /can't find/);
  assert.match(syncWarning({ conflicts: ["desk/2026-10-06 2.json"] }), /two versions of desk\/2026-10-06\.json:/);
  assert.match(syncWarning({ conflicts: ["a", "b"] }), /2 files/);
  assert.match(syncWarning({ pending: ["stickies.json"] }), /Keep Downloaded/);
});
