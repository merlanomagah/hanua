// Arranging the desk (Mel, 6 Oct 2026): files and widgets drag anywhere, widgets come in Small / Medium / Large like
// a Mac's, and Reset layout puts it all back. Until something is moved the desk keeps its own layout (files top
// right, widgets down the right); the first move takes a snapshot of where everything is, then each item keeps its
// place as a share of the desk (public/shared/layout.js, tested), in this browser only: it's a view preference.
// Files drag from anywhere on them (a click or double-click still opens), widgets by the grip at their top
// (so Up next's swipe and the timer's buttons still work). Arrow keys move a selected file or a focused grip.
// Not on phones, where the desk is one scrolling page.
import { clamp, freeSpot, layoutShape, place, sizeOf, snapFile, snapWidget, toShare, FILE_GRID, SIZES, SIZE_NAMES, WIDGET_GRID } from "../shared/layout.js";
import { $, h, toast } from "../lib.js";

const KEY = "desk-layout";
const desk = document.querySelector(".desk");
const stacked = () => matchMedia("(max-width: 900px)").matches;
const WIDGETS = { agenda: "Up next", "desk-window": "Weather", "w-timer": "Focus timer" };
const items = () => [...desk.querySelectorAll(".desk-file"), ...Object.keys(WIDGETS).map((id) => $(id)).filter(Boolean)];
const isFile = (el) => el.classList.contains("desk-file");

let layout = { items: {} };
try { layout = layoutShape(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { /* the desk's own layout */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* this visit only */ } };
const arranged = () => Object.keys(layout.items).length > 0;
const area = () => ({ w: desk.clientWidth, h: desk.clientHeight });

// Put every item where the layout says (sizes first, so each one's box is known)
export function applyLayout() {
  const on = arranged() && !stacked();
  desk.classList.toggle("arranged", on);
  const fresh = [];
  for (const el of items()) {
    el.dataset.arrange = "";
    if (!on) { el.style.left = el.style.top = el.style.width = el.style.height = ""; continue; }
    const it = layout.items[el.id];
    if (!it) { if (!el.hidden) fresh.push(el); continue; }
    const size = !isFile(el) && sizeOf(el.id, it.size);
    if (size) { el.style.width = `${size[0]}px`; el.style.height = size[1] ? `${size[1]}px` : ""; }
    const p = place(it, { w: el.offsetWidth, h: el.offsetHeight }, area());
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  }
  // something new on an arranged desk (a file added since): the first free spot from the top right, then kept
  for (const el of fresh) {
    const a = area(), d = desk.getBoundingClientRect();
    const taken = items().filter((x) => x !== el && !x.hidden && layout.items[x.id]).map((x) => { const r = x.getBoundingClientRect(); return { x: r.left - d.left, y: r.top - d.top, w: r.width, h: r.height }; });
    const p = freeSpot({ w: el.offsetWidth, h: el.offsetHeight }, taken, a) || { x: 12, y: 56 };
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    layout.items[el.id] = { x: toShare(p.x, a.w), y: toShare(p.y, a.h) };
  }
  if (fresh.length) keep();
}

// the size closest to a widget's width now, so the first move doesn't resize anything
const nearestSize = (id, w) => SIZES.reduce((best, sz) => (Math.abs(sizeOf(id, sz)[0] - w) < Math.abs(sizeOf(id, best)[0] - w) ? sz : best), "m");

// The first move: note where everything is now, so nothing jumps when the desk switches to its arranged layout
function snapshot() {
  if (arranged()) return;
  const a = area(), d = desk.getBoundingClientRect();
  for (const el of items()) {
    const r = el.getBoundingClientRect();
    layout.items[el.id] = { x: toShare(r.left - d.left, a.w), y: toShare(r.top - d.top, a.h), ...(isFile(el) ? {} : { size: nearestSize(el.id, r.width) }) };
  }
  keep();
  applyLayout();
}

function moveTo(el, x, y, settle = false) {
  const box = { w: el.offsetWidth, h: el.offsetHeight }, a = area();
  const p = settle ? (isFile(el) ? snapFile({ x, y }, box, a) : snapWidget({ x, y }, box, a)) : clamp({ x, y }, box, a);
  el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  if (settle) { layout.items[el.id] = { ...layout.items[el.id], x: toShare(p.x, a.w), y: toShare(p.y, a.h) }; keep(); }
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
      snapshot();
      start = { x: el.offsetLeft, y: el.offsetTop };
      el.classList.add("dragging");
    }
    moveTo(el, start.x + ev.clientX - sx, start.y + ev.clientY - sy);
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!start) return;
    el.classList.remove("dragging");
    moveTo(el, el.offsetLeft, el.offsetTop, true);
    justDragged = true; setTimeout(() => { justDragged = false; }, 0);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
// a drag that ends over a file or widget mustn't also count as a click on it
desk.addEventListener("click", (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);

function nudge(el, dx, dy) {
  snapshot();
  moveTo(el, el.offsetLeft + dx, el.offsetTop + dy, true);
}

// Small / Medium / Large, and Reset layout: from a widget's ⋯, or a right-click on it
let menu = null;
const closeMenu = () => { menu?.remove(); menu = null; };
function openMenu(el, at) {
  closeMenu();
  const cur = layout.items[el.id]?.size || "m";
  const opt = (label, on, run) => { const b = h("button", { type: "button", role: "menuitemradio", ariaChecked: String(on), className: on ? "on" : "", textContent: label }); b.addEventListener("click", () => { closeMenu(); run(); }); return b; };
  menu = h("div", { className: "wg-menu", role: "menu", ariaLabel: `${WIDGETS[el.id]} size` },
    ...SIZES.map((s) => opt(SIZE_NAMES[s], cur === s, () => setSize(el, s))),
    h("hr"),
    opt("Reset layout", false, resetLayout));
  desk.append(menu);
  const d = desk.getBoundingClientRect();
  menu.style.left = `${Math.min(at.x - d.left, desk.clientWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${Math.min(at.y - d.top, desk.clientHeight - menu.offsetHeight - 8)}px`;
  menu.querySelector("button.on, button")?.focus();
}
addEventListener("pointerdown", (e) => { if (menu && !menu.contains(e.target)) closeMenu(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && menu) { e.stopPropagation(); closeMenu(); } }, true);

function setSize(el, size) {
  snapshot();
  layout.items[el.id] = { ...layout.items[el.id], size };
  keep(); applyLayout();
  window.dispatchEvent(new Event("resize")); // the weather window redraws its sky for the new width
}
function resetLayout() {
  const before = layout;
  layout = { items: {} }; keep(); applyLayout();
  window.dispatchEvent(new Event("resize"));
  toast("The desk's back to its own layout", false, { label: "Undo", run: () => { layout = before; keep(); applyLayout(); window.dispatchEvent(new Event("resize")); } });
}

// Each widget gets a grip at its top (drag, or focus and use the arrow keys) and a ⋯ for its size
for (const [id, name] of Object.entries(WIDGETS)) {
  const el = $(id);
  if (!el) continue;
  const grip = h("span", { className: "wg-grip", role: "button", tabIndex: 0, ariaLabel: `Move ${name} (drag, or arrow keys)`, title: "Drag to move" });
  const more = h("span", { className: "wg-more", role: "button", tabIndex: 0, ariaLabel: `${name}: size and layout`, title: "Size", textContent: "⋯" });
  const stop = (e) => e.stopPropagation(); // the grip and ⋯ mustn't also click the widget under them
  grip.addEventListener("pointerdown", (e) => { stop(e); e.preventDefault(); dragFrom(el, e); });
  grip.addEventListener("click", stop);
  grip.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const step = e.shiftKey ? WIDGET_GRID * 5 : WIDGET_GRID;
    nudge(el, d[0] * step, d[1] * step);
  });
  const show = (e) => { stop(e); e.preventDefault(); const r = more.getBoundingClientRect(); openMenu(el, { x: r.left, y: r.bottom + 4 }); };
  more.addEventListener("pointerdown", stop);
  more.addEventListener("click", show);
  more.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") show(e); });
  el.addEventListener("contextmenu", (e) => { if (stacked()) return; e.preventDefault(); openMenu(el, { x: e.clientX, y: e.clientY }); });
  el.append(grip, more);
  // Up next and the timer redraw themselves (replaceChildren): put the grip and ⋯ back each time
  new MutationObserver(() => { if (!grip.isConnected) el.append(grip, more); }).observe(el, { childList: true });
}
// Files drag from anywhere on them; a selected one moves a grid square with the arrow keys
for (const el of desk.querySelectorAll(".desk-file")) {
  el.addEventListener("pointerdown", (e) => dragFrom(el, e));
  el.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !el.classList.contains("sel")) return;
    e.preventDefault();
    nudge(el, d[0] * FILE_GRID.w, d[1] * FILE_GRID.h);
  });
}
// A right-click on the empty desk offers Reset layout too (like a Mac's desktop menu)
desk.addEventListener("contextmenu", (e) => {
  if (stacked() || !arranged() || e.target !== desk && !e.target.classList.contains("desk-top")) return;
  e.preventDefault();
  closeMenu();
  const b = h("button", { type: "button", role: "menuitem", textContent: "Reset layout" });
  b.addEventListener("click", () => { closeMenu(); resetLayout(); });
  menu = h("div", { className: "wg-menu", role: "menu" }, b);
  desk.append(menu);
  const d = desk.getBoundingClientRect();
  menu.style.left = `${e.clientX - d.left}px`; menu.style.top = `${e.clientY - d.top}px`;
  b.focus();
});

addEventListener("resize", () => { if (arranged()) applyLayout(); else desk.classList.remove("arranged"); });
document.addEventListener("hanua:desk", () => requestAnimationFrame(applyLayout));
applyLayout();
