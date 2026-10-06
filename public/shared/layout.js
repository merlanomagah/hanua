// Arranging the desk (Mel, 6 Oct 2026: "move the positioning of the window/weather widget", files too, widgets in
// sizes). Positions are kept as a share of the desk (0–1), so a smaller or larger window keeps the arrangement, and
// are always pulled back fully on screen. Files snap to a grid like a Mac's; widgets to a fine one. No page imports.

export const FILE_GRID = { w: 104, h: 112 }, WIDGET_GRID = 8, EDGE = 12, TOP = 56; // TOP: clear of the rail and THE WALL
export const SIZES = ["s", "m", "l"];
export const SIZE_NAMES = { s: "Small", m: "Medium", l: "Large" };
// each widget's widths (and heights where the content doesn't set its own), like a Mac's small / medium / large
export const WIDGET_SIZES = {
  agenda: { s: [260, 300], m: [360, 380], l: [400, 560] },
  "desk-window": { s: [280, 0], m: [380, 0], l: [540, 0] },
  "w-timer": { s: [170, 170], m: [220, 220], l: [290, 290] },
  "w-records": { s: [190, 0], m: [240, 0], l: [300, 0] },
};
// a widget's size when none has been picked (Up next starts Large on a screen wide enough for its third: Mel, 6 Oct
// 2026; on a smaller one there isn't room for everything else, so Small, as before)
export const DEFAULT_SIZE = { agenda: "l" };
// Large Up next takes a third of the screen's width (area.screen; the desk itself is narrower, beside the bookcase)
// and the desk's whole height (Mel, 6 Oct 2026), once the screen is wide enough for a third to be roomier than the
// fixed Large; on a smaller screen it's the fixed Large. Never more than half the desk.
export const THIRD = { agenda: "l" }, THIRD_FROM = 1200;
const screenOf = (area) => area?.screen || area?.w || 0;
export function sizeName(id, size, area = null) {
  if (SIZES.includes(size)) return size;
  if (THIRD[id] && area && screenOf(area) < THIRD_FROM) return "s";
  return DEFAULT_SIZE[id] || "m";
}
export function sizeOf(id, size, area = null) {
  const name = sizeName(id, size, area);
  const s = WIDGET_SIZES[id]?.[name] || null;
  const screen = screenOf(area);
  if (s && THIRD[id] === name && screen >= THIRD_FROM) {
    return [Math.round(Math.min(screen / 3, area.w / 2) - EDGE), Math.max(s[1], Math.round(area.h - TOP - EDGE))];
  }
  return s;
}

const n = (v, d = 0) => (Number.isFinite(v) ? v : d);

// Up next can also be sized by hand from its corner (Mel, 6 Oct 2026, evening): any size between its Small and half
// the desk wide by the desk's full height, snapped to the grid. The other widgets keep their three sizes.
export const RESIZABLE = { agenda: true };
export function sizeLimits(id, area) {
  const min = WIDGET_SIZES[id]?.s || [160, 160];
  return { min, max: [Math.max(min[0], Math.round(area.w / 2)), Math.max(min[1], Math.round(area.h - TOP - EDGE))] };
}
const within = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// a widget's box in pixels: its hand-made size if it has one (kept in limits), else its named size
export function boxSize(id, it, area) {
  if (RESIZABLE[id] && it?.w > 0 && it?.h > 0) {
    const { min, max } = sizeLimits(id, area);
    return [Math.round(within(it.w * area.w, min[0], max[0])), Math.round(within(it.h * area.h, min[1], max[1]))];
  }
  return sizeOf(id, it?.size, area);
}
export const toShare = (px, span) => (span > 0 ? Math.round((n(px) / span) * 10000) / 10000 : 0);

// Where an item goes, in pixels, for a desk of area { w, h }: from its saved share, kept fully on screen
export function place(item, box, area) {
  const x = n(item.x) * area.w, y = n(item.y) * area.h;
  return clamp({ x, y }, box, area);
}
export function clamp({ x, y }, box, area) {
  const maxX = Math.max(EDGE, area.w - box.w - EDGE), maxY = Math.max(TOP, area.h - box.h - EDGE);
  return { x: Math.round(Math.min(Math.max(n(x), EDGE), maxX)), y: Math.round(Math.min(Math.max(n(y), TOP), maxY)) };
}
// files sit on a grid (measured from the top right, where they start, like a Mac); widgets on a fine one
export function snapFile({ x, y }, box, area) {
  const fromRight = area.w - EDGE - box.w - x;
  const col = Math.max(0, Math.round(fromRight / FILE_GRID.w)), row = Math.max(0, Math.round((y - TOP) / FILE_GRID.h));
  return clamp({ x: area.w - EDGE - box.w - col * FILE_GRID.w, y: TOP + row * FILE_GRID.h }, box, area);
}
export const snapWidget = ({ x, y }, box, area) => clamp({ x: Math.round(x / WIDGET_GRID) * WIDGET_GRID, y: Math.round(y / WIDGET_GRID) * WIDGET_GRID }, box, area);

// The saved arrangement, tidied: { items: { id: { x, y, size? } } }; anything odd is dropped
export function layoutShape(o) {
  const items = {};
  for (const [id, v] of Object.entries(o?.items && typeof o.items === "object" ? o.items : {})) {
    if (!/^[\w-]{1,40}$/.test(id) || !v || typeof v !== "object") continue;
    const it = { x: Math.min(1, Math.max(0, n(v.x))), y: Math.min(1, Math.max(0, n(v.y))) };
    if (SIZES.includes(v.size)) it.size = v.size;
    // a size dragged by hand (Up next, 6 Oct 2026), as shares of the desk like the place
    if (RESIZABLE[id] && n(v.w) > 0 && n(v.h) > 0) { it.w = Math.min(1, n(v.w)); it.h = Math.min(1, n(v.h)); }
    items[id] = it;
  }
  return { items };
}

// Overlap of two boxes { x, y, w, h } (touching edges don't count)
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// The first free file-grid spot, down each column from the top right (like a Mac placing a new file), clear of
// everything already on the desk; null if the desk is full
export function freeSpot(box, taken, area) {
  for (let col = 0; ; col++) {
    const x = area.w - EDGE - box.w - col * FILE_GRID.w;
    if (x < EDGE) return null;
    for (let y = TOP; y + box.h <= area.h - EDGE; y += FILE_GRID.h) {
      const spot = { x, y, w: box.w, h: box.h };
      if (!taken.some((t) => overlaps(spot, t))) return { x, y };
    }
  }
}

// One grid for the whole desk, and nothing overlaps (Mel, 6 Oct 2026: "grid style, like the Mac desktop"): a dropped
// item goes to the nearest free spot to where it was let go, and nothing else moves. SPACE keeps a little gap.
export const GRID = 16, SPACE = 8;
const grown = (b) => ({ x: b.x - SPACE / 2, y: b.y - SPACE / 2, w: b.w + SPACE, h: b.h + SPACE });
export const snapGrid = ({ x, y }, box, area) => clamp({ x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID }, box, area);
export function nearestFree(want, box, taken, area, step = GRID) {
  const free = (p) => !taken.some((t) => overlaps(grown({ ...p, ...box }), t));
  const start = clamp(want, box, area);
  if (free(start)) return start;
  for (let r = 1; r <= 80; r++) {
    const ring = [];
    for (let i = -r; i <= r; i++) ring.push([i, -r], [i, r], [-r, i], [r, i]);
    ring.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    for (const [dx, dy] of ring) {
      const p = clamp({ x: start.x + dx * step, y: start.y + dy * step }, box, area);
      if (free(p)) return p;
    }
  }
  return start; // the desk is full: let it overlap rather than vanish
}

// Resizing from a corner: the box as dragged (the opposite corner stays put), snapped to the grid, kept in limits and
// on screen, then made smaller until it touches nothing (nothing else moves, as with a drop). fromLeft: the handle is
// on the left (a widget at the right of the desk grows leftwards).
export function fitResize(start, dw, dh, { fromLeft = false, min, max, taken = [], area }) {
  const right = start.x + start.w;
  let w = within(Math.round((start.w + (fromLeft ? -dw : dw)) / GRID) * GRID, min[0], max[0]);
  let h = within(Math.round((start.h + dh) / GRID) * GRID, min[1], max[1]);
  w = Math.min(w, fromLeft ? right - EDGE : area.w - EDGE - start.x);
  h = Math.min(h, area.h - EDGE - start.y);
  const boxAt = (ww, hh) => ({ x: fromLeft ? right - ww : start.x, y: start.y, w: ww, h: hh });
  const hits = (b) => taken.some((t) => overlaps(grown(b), t));
  // shrink whichever way the drag grew until it's clear (never below where it started, or the minimum)
  const floorW = Math.min(start.w, w), floorH = Math.min(start.h, h);
  while (hits(boxAt(w, h)) && (w > floorW || h > floorH)) {
    if (w > floorW && hits(boxAt(w, floorH))) w = Math.max(floorW, w - GRID);
    else if (h > floorH) h = Math.max(floorH, h - GRID);
    else w = Math.max(floorW, w - GRID);
  }
  return boxAt(w, h);
}
