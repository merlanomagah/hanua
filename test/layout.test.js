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
  assert.deepEqual(sizeOf("w-timer", "huge"), sizeOf("w-timer", "m"));
  assert.equal(sizeOf("nothing", "m"), null);
});

test("layout: Up next starts Large, and Large is a third of a wide desk, top to bottom", async () => {
  const { sizeName, THIRD_FROM } = await import("../public/shared/layout.js");
  assert.equal(sizeName("agenda", undefined), "l");
  assert.equal(sizeName("w-timer", undefined), "m");
  // unpicked on a small screen: Small (no room for Large); picked Large stays Large
  assert.equal(sizeName("agenda", undefined, { w: 744, h: 722, screen: 1024 }), "s");
  assert.equal(sizeName("agenda", "l", { w: 744, h: 722, screen: 1024 }), "l");
  assert.deepEqual(sizeOf("agenda", undefined, { w: 744, h: 722, screen: 1024 }), [260, 300]);
  const wide = { w: 1440, h: 860 };
  const [w, h] = sizeOf("agenda", "l", wide);
  assert.equal(w, Math.round(1440 / 3 - EDGE));
  assert.equal(h, 860 - TOP - EDGE);
  // the desk sits beside the bookcase: a third of the screen, not of the desk, but never past half the desk
  assert.equal(sizeOf("agenda", "l", { w: 1160, h: 854, screen: 1440 })[0], 480 - EDGE);
  assert.equal(sizeOf("agenda", "l", { w: 700, h: 854, screen: 1440 })[0], 350 - EDGE);
  // a smaller desk, or no desk given: the fixed Large; Small and Medium never change
  assert.deepEqual(sizeOf("agenda", "l", { w: THIRD_FROM - 1, h: 700 }), [400, 560]);
  assert.deepEqual(sizeOf("agenda", "l"), [400, 560]);
  assert.deepEqual(sizeOf("agenda", "m", wide), [360, 380]);
  // a short desk never makes it shorter than the fixed Large
  assert.equal(sizeOf("agenda", "l", { w: 1300, h: 400 })[1], 560);
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

import { boxSize, fitResize, sizeLimits, GRID } from "../public/shared/layout.js";

test("layout: Up next keeps a size dragged by hand, in limits; other widgets don't take one", () => {
  const a = { w: 1200, h: 800 };
  assert.deepEqual(layoutShape({ items: { agenda: { x: 0.5, y: 0, w: 0.3, h: 0.9 }, "w-timer": { x: 0, y: 0, w: 0.3, h: 0.5 } } }),
    { items: { agenda: { x: 0.5, y: 0, w: 0.3, h: 0.9 }, "w-timer": { x: 0, y: 0 } } });
  assert.deepEqual(boxSize("agenda", { w: 0.3, h: 0.5 }, a), [360, 400]);
  const { min, max } = sizeLimits("agenda", a);
  assert.deepEqual(boxSize("agenda", { w: 0.01, h: 0.01 }, a), min);
  assert.deepEqual(boxSize("agenda", { w: 1, h: 1 }, a), max);
  assert.equal(max[0], 600); // never wider than half the desk
  assert.deepEqual(boxSize("agenda", { size: "s" }, a), sizeOf("agenda", "s", a)); // a picked size, as before
});

test("layout: resizing from a corner snaps to the grid, stays on screen and stops at a neighbour", () => {
  const area = { w: 1200, h: 800 }, lim = sizeLimits("agenda", area);
  const start = { x: 800, y: 56, w: 380, h: 400 };
  // from the left corner: grows leftwards, the right edge stays
  const wide = fitResize(start, -101, 37, { fromLeft: true, ...lim, area });
  assert.equal(wide.x + wide.w, 1180);
  assert.equal(wide.w % GRID, 0);
  assert.equal(wide.h % GRID, 0);
  // a neighbour to the left: it stops short of it (with the gap), it doesn't cover it
  const n = { x: 500, y: 100, w: 150, h: 100 };
  const stopped = fitResize(start, -400, 0, { fromLeft: true, ...lim, area, taken: [n] });
  assert.ok(stopped.x >= n.x + n.w);
  // never below the minimum, never off the bottom
  const small = fitResize(start, 500, -900, { fromLeft: true, ...lim, area });
  assert.deepEqual([small.w, small.h], lim.min);
  assert.ok(fitResize(start, 0, 5000, { fromLeft: true, ...lim, area }).h <= area.h - 12 - start.y);
});

test("layout: a desk window kept on a wide screen comes back fully on a smaller one, shrunk only if it must be", async () => {
  const { fitWindow, WIN_MIN } = await import("../public/shared/layout.js");
  // the 6 Oct bug: kept at 1440, opened at 375
  assert.deepEqual(fitWindow({ x: 272, y: 200, w: 540, h: 500 }, { w: 375, h: 700 }), { x: 0, y: 200, w: 375, h: 500 });
  // fits already: untouched
  assert.deepEqual(fitWindow({ x: 100, y: 80, w: 540, h: 400 }, { w: 1440, h: 900 }), { x: 100, y: 80, w: 540, h: 400 });
  // off the right and bottom: pulled back, size kept
  assert.deepEqual(fitWindow({ x: 1200, y: 800, w: 540, h: 400 }, { w: 1024, h: 700 }), { x: 484, y: 300, w: 540, h: 400 });
  // never smaller than its smallest while the desk has room; nonsense is put at the top left
  assert.deepEqual(fitWindow({ x: -50, y: NaN, w: 10, h: 10 }, { w: 1024, h: 700 }), { x: 0, y: 0, w: WIN_MIN.w, h: WIN_MIN.h });
});
