// One question at a time (16 Oct 2026): the stops, where a page opens, the dots and the slide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { backStep, clampStep, dotsOf, nextStep, reviewAt, slideOf, startStep, stepLabel } from "../public/shared/steps.js";

test("steps: seven questions make eight stops, the last is Review", () => {
  assert.equal(reviewAt(7), 7);
  assert.equal(nextStep(6, 7), 7);
  assert.equal(nextStep(7, 7), 7); // Review is the end
  assert.equal(backStep(0, 7), 0);
  assert.equal(clampStep(99, 7), 7);
  assert.equal(clampStep(-3, 7), 0);
  assert.equal(clampStep("2", 7), 0);
  assert.deepEqual([0, 6, 7].map((i) => stepLabel(i, 7)), ["1 of 7", "7 of 7", "Review"]);
});

test("steps: a page opens where Mel left off, else on Review when saved, else the first question", () => {
  assert.equal(startStep({ n: 7, kept: 3, saved: true }), 3);
  assert.equal(startStep({ n: 7, kept: 40 }), 7);
  assert.equal(startStep({ n: 7, saved: true }), 7);
  assert.equal(startStep({ n: 7 }), 0);
  assert.equal(startStep({ n: 7, kept: 0, saved: true }), 0);
});

test("steps: the dots, and which way a tile slides", () => {
  assert.deepEqual(dotsOf([true, false, true], 1), ["done", "current", "done"]);
  assert.deepEqual(dotsOf([true, false], 2), ["done", "todo"]); // on Review no dot is current
  assert.equal(slideOf(null, 0), "none");
  assert.equal(slideOf(2, 3), "next");
  assert.equal(slideOf(3, 1), "back");
  assert.equal(slideOf(2, 2), "none");
});
