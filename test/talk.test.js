// Talking into a Journal question (16 Oct 2026): spoken words are added after what's there, untidied.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenText } from "../public/shared/talk.js";

test("talk: spoken words go after what's there, with one space between", () => {
  assert.equal(spokenText("", " so this week was busy "), "so this week was busy");
  assert.equal(spokenText("Started well.", "then it got busy"), " then it got busy");
  assert.equal(spokenText("Line one\n", "line two"), "line two");
  assert.equal(spokenText("ends in space ", "more"), "more");
  assert.equal(spokenText("x", "   "), "");
  assert.equal(spokenText("x", "um   so  yeah"), " um so yeah"); // as said: no tidying
});
