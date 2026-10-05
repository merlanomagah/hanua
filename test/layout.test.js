import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, layoutShape, place, sizeOf, snapFile, snapWidget, toShare, EDGE, FILE_GRID, TOP } from "../public/shared/layout.js";

const area = { w: 1200, h: 800 }, box = { w: 100, h: 100 };

test("layout: a saved place scales with the desk and always stays fully on screen", () => {
  assert.deepEqual(place({ x: 0.5, y: 0.5 }, box, area), { x: 600, y: 400 });
  assert.deepEqual(place({ x: 0.5, y: 0.5 }, box, { w: 600, h: 400 }), { x: 300, y: 200 });
  assert.deepEqual(place({ x: 0.99, y: 0.99 }, box, area), { x: area.w - box.w - EDGE, y: area.h - box.h - EDGE });
  assert.deepEqual(place({ x: -1, y: 0 }, box, area), { x: EDGE, y: TOP });
  assert.deepEqual(clamp({ x: NaN, y: undefined }, box, area), { x: EDGE, y: TOP });
  assert.equal(toShare(600, 1200), 0.5);
});

test("layout: files snap to a grid from the top right; widgets to 8px", () => {
  const first = { x: area.w - EDGE - box.w, y: TOP };
  assert.deepEqual(snapFile({ x: first.x - 30, y: TOP + 40 }, box, area), first);
  assert.deepEqual(snapFile({ x: first.x - FILE_GRID.w + 20, y: TOP + FILE_GRID.h + 30 }, box, area), { x: first.x - FILE_GRID.w, y: TOP + FILE_GRID.h });
  assert.deepEqual(snapWidget({ x: 203, y: 309 }, box, area), { x: 200, y: 312 });
});

test("layout: the saved arrangement is tidied; sizes default to Medium", () => {
  assert.deepEqual(layoutShape({ items: { agenda: { x: 2, y: -1, size: "l" }, "bad id!": { x: 0 }, w: { x: "a", y: 0.2, size: "huge" } } }),
    { items: { agenda: { x: 1, y: 0, size: "l" }, w: { x: 0, y: 0.2 } } });
  assert.deepEqual(layoutShape(null), { items: {} });
  assert.deepEqual(sizeOf("agenda", "huge"), sizeOf("agenda", "m"));
  assert.equal(sizeOf("nothing", "m"), null);
});
