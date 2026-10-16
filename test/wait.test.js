// Waiting on Claude (16 Oct 2026): a second press while a request is out sends nothing; the counter's words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWaits, isLong, secsText } from "../public/shared/wait.js";

test("wait: pressing twice sends one request; another can go once the first is back", () => {
  let t = 0;
  const w = createWaits(() => t);
  assert.equal(w.start("fold:a", "Folding it in…"), true);
  assert.equal(w.start("fold:a"), false); // the second press: nothing sent
  assert.equal(w.start("fold:b"), true); // another member is its own request
  t = 12_400;
  assert.equal(w.secs("fold:a"), 12);
  w.end("fold:a");
  assert.equal(w.has("fold:a"), false);
  assert.equal(w.start("fold:a"), true);
});

test("wait: seconds in words, and when it's taking long", () => {
  assert.deepEqual([0, 12, 59, 60, 75].map(secsText), ["0 s", "12 s", "59 s", "1 min 0 s", "1 min 15 s"]);
  assert.equal(isLong(59), false);
  assert.equal(isLong(60), true);
});
