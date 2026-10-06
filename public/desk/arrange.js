// Arranging the desk (Mel, 6 Oct 2026): everything on it moves (files, widgets, the focus and reminder post-its,
// stickies, Hanua's pinned notes, Today's menu), on one grid where nothing overlaps (like a Mac's desktop: a drop goes
// to the nearest free spot and nothing else moves). Widgets come in Small / Medium / Large. Places are shares of the
// desk (public/shared/layout.js, tested), kept in this browser (a view preference).
// "Save current layout as default": every time Hanua opens, the desk goes back to it (moves during the day are for
// that day's visit); Reset layout returns to it, and "Hanua's own layout" forgets it.
// Files and notes drag from anywhere on them (5px before a drag starts, so clicks still open; not from a sticky's
// text or a button), widgets by the grip at their top. Arrow keys move a selected file or a focused grip.
// Anything marked data-move is arranged; new ones (a sticky, a reminder) take the first free spot from the top right.
// Not on phones, where the desk is one scrolling page.
import { freeSpot, layoutShape, nearestFree, place, sizeName, sizeOf, snapFile, snapGrid, toShare, EDGE, FILE_GRID, GRID, SPACE, TOP, SIZES, SIZE_NAMES, WIDGET_SIZES } from "../shared/layout.js";
import { $, h, toast } from "../lib.js";

const KEY = "desk-layout", DEFAULT = "desk-layout-default";
const desk = document.querySelector(".desk");
const stacked = () => matchMedia("(max-width: 900px)").matches;
const WIDGETS = { agenda: "Up next", "desk-window": "Weather", "w-timer": "Focus timer", "w-records": "Record player" };
const items = () => [...desk.querySelectorAll("[data-move]")].filter((el) => !el.hidden && el.offsetParent !== null);
const kind = (el) => el.dataset.move; // file | widget | note
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* this visit only */ } };

// Once (6 Oct 2026, evening): Up next goes Large at the top right, a third of the screen (Mel), in the saved layout and
// the saved default. Anything that sat where it now goes moves to just left of it, at the same height, so the desk
// keeps its order (the no-overlap rule then settles anything that lands on something else).
const RIGHT = { x: 1, y: 0 }; // its size: Large, unless the screen is too small for it (layout.js sizeName)
function upNextRight(l) {
  if (!l?.items) return l;
  const a = area(), aw = sizeOf("agenda", null, a)[0], left = a.w - EDGE - aw - SPACE; // Up next's left edge
  const items = { ...l.items, agenda: RIGHT };
  for (const [id, it] of Object.entries(items)) {
    if (id === "agenda") continue;
    const w = $(id)?.offsetWidth || sizeOf(id, it.size, a)?.[0] || FILE_GRID.w;
    if (it.x * a.w + w > left) items[id] = { ...it, x: toShare(Math.max(EDGE, left - w - SPACE), a.w) };
  }
  return { ...l, items };
}
// Hanua's own layout, right side (6 Oct 2026): Up next at the right, the files in a column beside it, then the
// small widgets (weather, timer, record player; Small) in a column beside those, top down. The rest stays where the
// stylesheet puts it; anything that lands on something settles to the nearest free spot.
function ownRight(l) {
  const a = area(), aw = sizeOf("agenda", null, a)[0];
  const items = { ...l.items, agenda: RIGHT };
  const fx = a.w - EDGE - aw - 2 * SPACE - FILE_GRID.w;
  let y = TOP;
  for (const el of desk.querySelectorAll(".desk-file")) { items[el.id] = { x: toShare(fx + (FILE_GRID.w - el.offsetWidth) / 2, a.w), y: toShare(y, a.h) }; y += FILE_GRID.h; }
  const col = sizeOf("desk-window", "s")[0], wx = fx - 2 * SPACE - col;
  y = TOP;
  for (const [id, tall] of [["desk-window", 170], ["w-timer", 186], ["w-records", 0]]) {
    const w = sizeOf(id, "s")[0];
    items[id] = { x: toShare(wx + col - w, a.w), y: toShare(y, a.h), size: "s" };
    y += tall;
  }
  for (const [id, it] of Object.entries(items)) { // anything else in that right block finds a spot left of it
    if (id in RIGHT_IDS || $(id)?.classList.contains("desk-file")) continue;
    const w = $(id)?.offsetWidth || 100;
    if (it.x * a.w + w > wx - SPACE) items[id] = { ...it, x: toShare(Math.max(EDGE, wx - 2 * SPACE - w), a.w) };
  }
  return { ...l, items };
}
const RIGHT_IDS = { agenda: 1, "desk-window": 1, "w-timer": 1, "w-records": 1 };
const area = () => ({ w: desk.clientWidth, h: desk.clientHeight, screen: innerWidth });
if (!read("desk-layout-v2") && !stacked() && desk.clientWidth) {
  for (const k of [KEY, DEFAULT]) { const l = read(k); if (l) write(k, upNextRight(layoutShape(l))); }
  write("desk-layout-v2", true);
}
// a saved default wins each time Hanua opens
let layout = layoutShape(read(DEFAULT) || read(KEY));
const keep = () => write(KEY, layout);
keep();
const boxOf = (el) => ({ w: el.offsetWidth, h: el.offsetHeight });

for (const id of Object.keys(WIDGETS)) if ($(id)) $(id).dataset.move = "widget";
for (const el of desk.querySelectorAll(".desk-file")) el.dataset.move = "file";

// Put everything where the layout says, sizes first; then, in order (Up next, files, widgets, notes), anything that would
// overlap what's already placed goes to the nearest free spot; anything new takes the first free spot
let applying = false;
export function applyLayout() {
  if (applying) return;
  applying = true;
  try {
    const on = !stacked();
    desk.classList.toggle("arranged", on);
    if (!on) { for (const el of desk.querySelectorAll("[data-move]")) el.style.left = el.style.top = el.style.width = el.style.height = ""; return; }
    watch();
    if (!Object.keys(layout.items).length) snapshot();
    const a = area(), placed = [], fresh = [];
    // Up next first: it's the big one at the right (6 Oct 2026), and the rest find their places round it
    const order = { file: 0, widget: 1, note: 2 }, rank = (el) => (el.id === "agenda" ? -1 : order[kind(el)]);
    for (const el of items().sort((x, y) => rank(x) - rank(y))) {
      const it = layout.items[el.id];
      if (!it) { fresh.push(el); continue; }
      const size = kind(el) === "widget" && sizeOf(el.id, it.size, a);
      if (size) { el.style.width = `${size[0]}px`; el.style.height = size[1] ? `${size[1]}px` : ""; }
      const box = boxOf(el);
      const p = nearestFree(place(it, box, a), box, placed, a, kind(el) === "file" ? FILE_GRID.h / 2 : GRID);
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      placed.push({ ...p, ...box });
    }
    // where the stylesheet would put each new one (a post-it at the top right, a sticky on the left…), measured
    // with the arranging switched off for a moment; then the nearest free spot to that
    const home = new Map();
    if (fresh.length) {
      desk.classList.remove("arranged");
      const d = desk.getBoundingClientRect();
      for (const el of fresh) { el.style.left = el.style.top = ""; const r = el.getBoundingClientRect(); home.set(el, { x: r.left - d.left, y: r.top - d.top }); }
      desk.classList.add("arranged");
    }
    for (const el of fresh) {
      const size = kind(el) === "widget" && sizeOf(el.id, null, a);
      if (size) { el.style.width = `${size[0]}px`; el.style.height = size[1] ? `${size[1]}px` : ""; }
      const box = boxOf(el);
      const p = kind(el) === "file" ? freeSpot(box, placed, a) || nearestFree(home.get(el), box, placed, a) : nearestFree(home.get(el), box, placed, a);
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      placed.push({ ...p, ...box });
      layout.items[el.id] = { x: toShare(p.x, a.w), y: toShare(p.y, a.h) };
    }
    if (fresh.length) keep();
    // the dock centres itself in the room left of a tall Up next at the right (styles.css --dock-room)
    const up = $("agenda"), tall = up && !up.hidden && up.offsetHeight > a.h * 0.6 && up.offsetLeft + up.offsetWidth > a.w * 0.8;
    if (tall) desk.style.setProperty("--dock-room", `${a.w - up.offsetLeft}px`); else desk.style.removeProperty("--dock-room");
  } finally { applying = false; }
}
// things that draw themselves again (stickies, post-its, the pinned notes) are placed again once they have
let pending = 0;
const later = () => { clearTimeout(pending); pending = setTimeout(applyLayout, 0); }; // not an animation frame: those pause while Hanua isn't showing
// …and when anything on the desk changes size after it was placed (a focus card fitting its words, the record
// player drawing, the pinned notes filling in), so nothing grows into its neighbour
const sized = new ResizeObserver(() => later()), watched = new WeakSet();
const watch = () => { for (const el of desk.querySelectorAll("[data-move]")) if (!watched.has(el)) { watched.add(el); sized.observe(el); } };

// the size closest to a widget's width now, so a snapshot doesn't resize anything
const nearestSize = (id, w) => !WIDGET_SIZES[id] ? "m" : SIZES.reduce((best, sz) => (Math.abs(sizeOf(id, sz)[0] - w) < Math.abs(sizeOf(id, best)[0] - w) ? sz : best), "m");
// Hanua's own layout (the stylesheet's), read off the page once and kept
function snapshot() {
  desk.classList.remove("arranged");
  for (const el of desk.querySelectorAll("[data-move]")) el.style.left = el.style.top = el.style.width = el.style.height = "";
  const a = area(), d = desk.getBoundingClientRect();
  layout = { items: {} };
  for (const el of items()) {
    const r = el.getBoundingClientRect();
    layout.items[el.id] = { x: toShare(r.left - d.left, a.w), y: toShare(r.top - d.top, a.h), ...(kind(el) === "widget" ? { size: nearestSize(el.id, r.width) } : {}) };
  }
  layout = ownRight(layout);
  keep();
  desk.classList.add("arranged");
}

// Drop: snap to the grid, then the nearest free spot (nothing else moves), and keep it
function settle(el, x, y) {
  const a = area(), box = boxOf(el);
  const want = kind(el) === "file" ? snapFile({ x, y }, box, a) : snapGrid({ x, y }, box, a);
  const taken = items().filter((o) => o !== el).map((o) => ({ x: o.offsetLeft, y: o.offsetTop, w: o.offsetWidth, h: o.offsetHeight }));
  const p = nearestFree(want, box, taken, a, kind(el) === "file" ? FILE_GRID.h / 2 : GRID);
  el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  layout.items[el.id] = { ...layout.items[el.id], x: toShare(p.x, a.w), y: toShare(p.y, a.h) };
  keep();
}

// Dragging: only once the pointer has moved 5px, so clicks and double-clicks still open things
let justDragged = false;
function dragFrom(el, e) {
  if (stacked() || e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY;
  let start = null;
  const move = (ev) => {
    if (!start) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      start = { x: el.offsetLeft, y: el.offsetTop };
      el.classList.add("dragging");
    }
    const a = area(), box = boxOf(el);
    el.style.left = `${Math.min(Math.max(start.x + ev.clientX - sx, 0), a.w - box.w)}px`;
    el.style.top = `${Math.min(Math.max(start.y + ev.clientY - sy, 0), a.h - box.h)}px`;
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!start) return;
    el.classList.remove("dragging");
    settle(el, el.offsetLeft, el.offsetTop);
    justDragged = true; setTimeout(() => { justDragged = false; }, 0);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
// a drag that ends over something mustn't also count as a click on it
desk.addEventListener("click", (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
const nudge = (el, dx, dy) => settle(el, el.offsetLeft + dx, el.offsetTop + dy);

// Files and notes drag from anywhere on them (not a sticky's text, a button or a link)
desk.addEventListener("pointerdown", (e) => {
  const el = e.target.closest?.("[data-move]");
  if (!el || kind(el) === "widget" || e.target.closest("textarea, input, .st-x, a")) return;
  if (kind(el) === "note" && e.target.closest("button") && e.target.closest("button") !== el && !el.matches("#notes")) return;
  dragFrom(el, e);
});
desk.addEventListener("keydown", (e) => {
  const el = e.target.closest?.(".desk-file.sel");
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!el || !d) return;
  e.preventDefault();
  nudge(el, d[0] * FILE_GRID.w, d[1] * FILE_GRID.h);
});

// The menu: a widget's sizes (from its ⋯ or a right-click), then the layout choices (also on a right-click of a
// note, a file or the empty desk)
let menu = null;
const closeMenu = () => { menu?.remove(); menu = null; };
function openMenu(el, at) {
  closeMenu();
  const opt = (label, on, run, role = "menuitem") => { const b = h("button", { type: "button", role, ariaChecked: role === "menuitemradio" ? String(on) : null, className: on ? "on" : "", textContent: label }); b.addEventListener("click", () => { closeMenu(); run(); }); return b; };
  const sizes = el && kind(el) === "widget" ? [...SIZES.map((s) => opt(SIZE_NAMES[s], sizeName(el.id, layout.items[el.id]?.size, area()) === s, () => setSize(el, s), "menuitemradio")), h("hr")] : [];
  const hasDefault = Boolean(read(DEFAULT));
  menu = h("div", { className: "wg-menu", role: "menu", ariaLabel: "Desk layout" }, ...sizes,
    opt("Save current layout as default", false, saveDefault),
    opt(hasDefault ? "Reset to my default" : "Reset layout", false, resetLayout),
    hasDefault ? opt("Hanua's own layout", false, ownLayout) : null);
  desk.append(menu);
  const d = desk.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(at.x - d.left, desk.clientWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(at.y - d.top, desk.clientHeight - menu.offsetHeight - 8))}px`;
  menu.querySelector("button.on, button")?.focus();
}
addEventListener("pointerdown", (e) => { if (menu && !menu.contains(e.target)) closeMenu(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && menu) { e.stopPropagation(); closeMenu(); } }, true);
desk.addEventListener("contextmenu", (e) => {
  if (stacked() || e.target.closest("textarea, input, .txt-win, dialog")) return;
  const el = e.target.closest("[data-move]");
  if (!el && e.target !== desk && !e.target.closest(".desk-top")) return;
  e.preventDefault();
  openMenu(el, { x: e.clientX, y: e.clientY });
});

const redraw = () => { applyLayout(); window.dispatchEvent(new Event("resize")); }; // the weather window redraws for its width
function setSize(el, size) {
  layout.items[el.id] = { ...layout.items[el.id], size };
  keep(); redraw();
}
function withUndo(text, change) {
  const before = layout, beforeDefault = read(DEFAULT);
  change();
  toast(text, false, { label: "Undo", run: () => { write(DEFAULT, beforeDefault); layout = before; keep(); redraw(); } });
}
function saveDefault() {
  withUndo("Saved: the desk opens like this from now on", () => write(DEFAULT, layout));
}
function resetLayout() {
  withUndo(read(DEFAULT) ? "Back to your default layout" : "Back to Hanua's own layout", () => { const d = read(DEFAULT); layout = d ? layoutShape(d) : { items: {} }; keep(); redraw(); });
}
export function ownLayout() {
  withUndo("Back to Hanua's own layout (your default is forgotten)", () => { write(DEFAULT, null); layout = { items: {} }; keep(); redraw(); });
}

// Each widget gets a grip at its top (drag, or focus and use the arrow keys) and a ⋯ for its size
for (const [id, name] of Object.entries(WIDGETS)) {
  const el = $(id);
  if (!el) continue;
  const grip = h("span", { className: "wg-grip", role: "button", tabIndex: 0, ariaLabel: `Move ${name} (drag, or arrow keys)`, title: "Drag to move" });
  const more = h("span", { className: "wg-more", role: "button", tabIndex: 0, ariaLabel: `${name}: size and layout`, title: "Size and layout", textContent: "⋯" });
  const stop = (e) => e.stopPropagation(); // the grip and ⋯ mustn't also click the widget under them
  grip.addEventListener("pointerdown", (e) => { stop(e); e.preventDefault(); dragFrom(el, e); });
  grip.addEventListener("click", stop);
  grip.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    nudge(el, d[0] * GRID * (e.shiftKey ? 4 : 1), d[1] * GRID * (e.shiftKey ? 4 : 1));
  });
  const show = (e) => { stop(e); e.preventDefault(); const r = more.getBoundingClientRect(); openMenu(el, { x: r.left, y: r.bottom + 4 }); };
  more.addEventListener("pointerdown", stop);
  more.addEventListener("click", show);
  more.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") show(e); });
  el.append(grip, more);
  // Up next and the timer redraw themselves (replaceChildren): put the grip and ⋯ back each time
  new MutationObserver(() => { if (!grip.isConnected) el.append(grip, more); }).observe(el, { childList: true });
}
// notes and post-its come and go: place them again whenever their lists change
for (const id of ["stickies", "notes", "focus-notes", "meal-slip"]) {
  const box = $(id);
  if (box) new MutationObserver(later).observe(box, { childList: true, attributes: true, attributeFilter: ["hidden"] });
}

addEventListener("resize", later);
document.addEventListener("hanua:desk", (e) => { if (e.detail) later(); });
applyLayout();
