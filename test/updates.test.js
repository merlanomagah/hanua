import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRestart, QUIET_MS } from "../server/updates.js";

test("updates: restart only when main moved and nothing's been saved for a moment", () => {
  const at = 1_000_000;
  assert.equal(shouldRestart({ running: "a", now: "a", lastWrite: 0 }, at), false); // nothing new
  assert.equal(shouldRestart({ running: "a", now: "b", lastWrite: 0 }, at), true);
  assert.equal(shouldRestart({ running: "a", now: null, lastWrite: 0 }, at), false); // another branch checked out
  assert.equal(shouldRestart({ running: null, now: "b", lastWrite: 0 }, at), true); // started on another branch, main back
  assert.equal(shouldRestart({ running: "a", now: "b", lastWrite: at - 2000 }, at), false); // a save just now
  assert.equal(shouldRestart({ running: "a", now: "b", lastWrite: at - QUIET_MS }, at), true);
});
