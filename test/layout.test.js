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

test("layout: a new file goes to the first free grid spot from the top right", async () => {
  const { freeSpot, overlaps, FILE_GRID, EDGE, TOP } = await import("../public/shared/layout.js");
  const a = { w: 1200, h: 800 }, b = { w: 96, h: 100 };
  const x0 = a.w - EDGE - b.w;
  assert.deepEqual(freeSpot(b, [], a), { x: x0, y: TOP });
  assert.deepEqual(freeSpot(b, [{ x: x0, y: TOP, w: 96, h: 100 }], a), { x: x0, y: TOP + FILE_GRID.h });
  // a wide widget across the first column pushes it to the next column
  assert.deepEqual(freeSpot(b, [{ x: x0 - 300, y: 0, w: 500, h: 800 }], a).x < x0 - 300, true);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test("layout: a drop onto something goes to the nearest free spot; nothing else moves", async () => {
  const { nearestFree, overlaps, GRID } = await import("../public/shared/layout.js");
  const a = { w: 1200, h: 800 }, box = { w: 100, h: 100 };
  const other = { x: 400, y: 300, w: 100, h: 100 };
  assert.deepEqual(nearestFree({ x: 600, y: 300 }, box, [other], a), { x: 600, y: 300 }); // clear already
  const p = nearestFree({ x: 420, y: 300 }, box, [other], a);
  assert.equal(overlaps({ ...p, ...box }, other), false);
  assert.ok(Math.hypot(p.x - 420, p.y - 300) <= 120 + GRID); // close by, not across the desk
});
