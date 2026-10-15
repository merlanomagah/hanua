// ⌘Z in Plan my day and the To-Do List keys (15 Oct 2026; brief docs/plans/2026-10-planner-keys-and-close-insights.md)
import { test } from "node:test";
import assert from "node:assert/strict";
import { historyMove, historyStep, lineKeyAction, recordChange, GROUP_MS, HISTORY_MAX } from "../public/shared/desk.js";

const fresh = (base) => ({ undo: [], redo: [], base });

test("typing in one box without a pause is one step; another box, a pause or a non-typing change is a new one", () => {
  assert.equal(historyStep({ field: "a", at: 0 }, { field: "a", at: GROUP_MS - 1 }), "merge");
  assert.equal(historyStep({ field: "a", at: 0 }, { field: "a", at: GROUP_MS + 1 }), "push");
  assert.equal(historyStep({ field: "a", at: 0 }, { field: "b", at: 10 }), "push");
  assert.equal(historyStep({ field: "a", at: 0 }, { field: null, at: 10 }), "push");
  assert.equal(historyStep({ field: null, at: 0 }, { field: null, at: 10 }), "push");
  assert.equal(historyStep(null, { field: "a", at: 0 }), "push");
});

test("undo walks back step by step, redo forward, and a new change drops the redo", () => {
  const h = fresh("0");
  recordChange(h, "1", "push");
  recordChange(h, "12", "merge"); // typing on: the same step
  recordChange(h, "12T", "push"); // a Tab
  assert.equal(historyMove(h), "12");
  assert.equal(historyMove(h), "0");
  assert.equal(historyMove(h), null); // nothing more
  assert.equal(historyMove(h, true), "12");
  recordChange(h, "12x", "push");
  assert.equal(historyMove(h, true), null);
  assert.equal(historyMove(h), "12");
});

test("an unchanged day isn't a step, and the history keeps at most HISTORY_MAX", () => {
  const h = fresh("s");
  recordChange(h, "s", "push");
  assert.equal(h.undo.length, 0);
  for (let i = 0; i < HISTORY_MAX + 20; i++) recordChange(h, `v${i}`, "push");
  assert.equal(h.undo.length, HISTORY_MAX);
});

test("Backspace straight after a Tab takes it back; Tab that can't indent goes on to Priority", () => {
  const k = { start: 5, end: 5, length: 5, written: true, sub: true };
  assert.equal(lineKeyAction({ ...k, key: "Backspace", tabbed: true }), "untab");
  assert.equal(lineKeyAction({ ...k, key: "Backspace", tabbed: false }), null); // caret not at the start: ordinary Backspace
  assert.equal(lineKeyAction({ ...k, key: "Backspace", start: 0, end: 0 }), "outdent");
  assert.equal(lineKeyAction({ ...k, key: "Tab", cantIndent: true }), "toPriority");
  assert.equal(lineKeyAction({ ...k, key: "Tab", cantIndent: true, shift: true }), null);
  assert.equal(lineKeyAction({ ...k, key: "Tab", cantIndent: false }), null);
  assert.equal(lineKeyAction({ ...k, key: "Tab", cantIndent: true, written: false }), null);
  assert.equal(lineKeyAction({ ...k, key: "Backspace", tabbed: true, meta: true }), null);
});
