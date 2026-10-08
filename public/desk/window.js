// Windows on the desk (Mel, 6 Oct 2026, part D): Plan my day, To-do.txt, the Shopping list and Add reminder share one
// title bar (red closes, yellow minimises into the dock like a Mac's, green is just for looks), drag by the bar,
// resize from the corner, and are remembered: which are open or minimised today survives a reload or an update.
// Places and sizes are kept in this browser (a view preference).
import { $, h, reducedMotion } from "../lib.js";
import { todayStr } from "../shared/dates.js";
import { fitWindow } from "../shared/layout.js";

const KEY = "desk-windows";
const wins = new Map(); // id → { title, icon, show(), hide(), shown(), remember }
let state = { day: todayStr(), handled: false, open: {} }; // handled: the morning's auto-open has happened
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s?.day === todayStr() && s.open && typeof s.open === "object") state = s; } catch { /* a fresh day */ }
const keep = () => { state.day = todayStr(); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* this visit only */ } };
let minimising = false;

// id: the window element's id. show/hide open and close it without touching what's in it.
export function registerWindow(id, opts) {
  wins.set(id, { remember: true, ...opts });
}
export const windowState = (id) => state.open[id] || null;
// The window last opened or touched sits in front of the others (they all share one layer; before 9 Oct 2026 the
// later one in the page always won, so an open Desk Settings covered Close the day)
export function toFront(win) {
  if (!win || win.classList.contains("front")) return;
  for (const w of document.querySelectorAll(".txt-win.front")) w.classList.remove("front");
  win.classList.add("front");
}
document.addEventListener("pointerdown", (e) => toFront(e.target.closest?.(".txt-win")), true);
export function noteOpen(id) {
  toFront(document.getElementById(id));
  if (!wins.get(id)?.remember) return;
  state.open[id] = "open"; keep(); renderDockWindows();
}
export function noteClosed(id) {
  // a dialog's close event comes after minimise() has finished, so a minimised window is never "closed" by it
  if (minimising || !(id in state.open) || state.open[id] === "min") return;
  delete state.open[id]; keep(); renderDockWindows();
}

// The three dots: red closes, yellow minimises
export function dots(id, onClose) {
  const w = wins.get(id);
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: `Close ${w?.title || "window"}`, title: "Close" });
  close.addEventListener("click", onClose);
  const min = h("button", { type: "button", className: "pw-min", ariaLabel: `Minimise ${w?.title || "window"} to the dock`, title: "Minimise" });
  min.addEventListener("click", () => minimise(id));
  return h("span", { className: "pw-dots" }, close, min, h("i", { ariaHidden: "true" }));
}

// A title bar for a floating window (not Plan my day, which is a dialog): drag it by the bar
export function windowBar(win, title, tools, onClose) {
  const bar = h("div", { className: "pw-bar txt-bar" }, dots(win.id, onClose), h("span", { className: "pw-title", textContent: title }), h("span", { className: "pw-tools txt-date" }, ...tools));
  bar.addEventListener("pointerdown", (e) => {
    if (phone() || e.target.closest("button, a, input")) return; // on a phone the window sits along the bottom
    const box = win.getBoundingClientRect(), host = win.offsetParent.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(host.width - box.width, ev.clientX - host.left - dx)), y = Math.max(0, Math.min(host.height - 60, ev.clientY - host.top - dy));
      win.style.left = `${x}px`; win.style.top = `${y}px`;
    };
    const up = () => { bar.removeEventListener("pointermove", move); keepPlace(win); };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up, { once: true });
  });
  return bar;
}
const placeKey = (win) => `win-${win.id}`;
// Under 901 px the stylesheet lays the windows along the bottom, full width (like Plan my day): no kept place there
const PHONE = matchMedia("(max-width: 900px)");
const phone = () => PHONE.matches;
const placed = new Set(); // windows whose place has been set this visit (re-fitted when the screen changes)
const settling = new WeakMap(); // a window being placed by Hanua, not resized by Mel: don't keep that size
function settle(win) {
  const n = (settling.get(win) || 0) + 1;
  settling.set(win, n);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (settling.get(win) === n) settling.delete(win); }));
}
function keepPlace(win) {
  if (phone()) return; // a phone's full-width window would overwrite the desk's own place
  try { localStorage.setItem(placeKey(win), JSON.stringify({ x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight })); } catch { /* fine */ }
}
// The kept place, fitted fully on screen (a place kept on a wider screen is shrunk and pulled back, not changed)
export function restorePlace(win) {
  placed.add(win);
  settle(win);
  const s = win.style;
  if (phone()) { s.left = s.top = s.width = s.height = s.maxHeight = ""; return; }
  let p = null;
  try { p = JSON.parse(localStorage.getItem(placeKey(win)) || "null"); } catch { p = null; }
  const host = win.offsetParent || win.parentElement;
  if (host && !hosts.has(host)) { hosts.add(host); hostWatch.observe(host); }
  const area = host ? { w: host.clientWidth, h: host.clientHeight } : { w: 0, h: 0 };
  if (!p) {
    // never moved: the stylesheet's place, unless the screen is too small for it (then pulled back like a kept one)
    s.left = s.top = "";
    if (!area.w || win.hidden) return;
    p = { x: win.offsetLeft, y: win.offsetTop };
    if (p.x + win.offsetWidth <= area.w && p.y + win.offsetHeight <= area.h) return;
  }
  const keepSize = !!p.w;
  if (area.w && area.h) p = fitWindow({ ...p, w: p.w || win.offsetWidth, h: p.h || win.offsetHeight }, area);
  s.left = `${p.x}px`; s.top = `${p.y}px`;
  if (keepSize) { s.width = `${p.w}px`; s.height = `${p.h}px`; s.maxHeight = "none"; }
  else { s.width = s.height = s.maxHeight = ""; }
}
// the screen got smaller or bigger (or crossed the phone width): every open window is placed again
let refit = 0;
function refitAll() {
  for (const win of placed) settle(win);
  cancelAnimationFrame(refit);
  refit = requestAnimationFrame(() => { for (const win of placed) restorePlace(win); }); // hidden ones too: they open again where they fit
}
addEventListener("resize", refitAll);
PHONE.addEventListener?.("change", refitAll);
const hosts = new WeakSet(), hostWatch = new ResizeObserver(refitAll); // the desk itself changing size, too
// keep Mel's own resizing (from the corner), not the window appearing again, or being fitted to the screen: only a
// change of size while it shows, from the size it last had, is hers
export function resizable(win) {
  let ready = false, last = "";
  new ResizeObserver(() => {
    if (win.hidden || !win.offsetWidth) return;
    const size = `${win.offsetWidth}x${win.offsetHeight}`;
    if (size === last) return;
    const was = last;
    last = size;
    if (ready && was && !settling.has(win)) keepPlace(win);
  }).observe(win);
  return () => { ready = false; requestAnimationFrame(() => { ready = true; }); };
}

// Minimise: the window shrinks into the dock and waits there (beside Stickies) until clicked
export function minimise(id) {
  const w = wins.get(id), el = $(id);
  if (!w || !w.shown()) return;
  state.open[id] = "min"; keep();
  renderDockWindows();
  const tile = $("dock-min").querySelector(`[data-win="${id}"]`);
  let hidden = false;
  const done = () => { if (hidden) return; hidden = true; minimising = true; try { w.hide(); } finally { minimising = false; } };
  setTimeout(done, 450); // an animation can stall in a hidden tab: never leave the window half-minimised
  if (reducedMotion || !tile || !el) return done();
  const a = el.getBoundingClientRect(), b = tile.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  el.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0.4 }], { duration: 320, easing: "cubic-bezier(.4,0,.8,.4)" }).finished.then(done, done);
}
export function restore(id) {
  const w = wins.get(id);
  if (!w) return;
  state.open[id] = "open"; keep();
  renderDockWindows();
  w.show();
}

// The dock's right end: one tile per minimised window
export function renderDockWindows() {
  const box = $("dock-min");
  if (!box) return;
  const mins = [...wins.entries()].filter(([id]) => state.open[id] === "min");
  $("dock-min-sep").hidden = !mins.length;
  box.replaceChildren(...mins.map(([id, w]) => {
    const b = h("button", { type: "button", className: "dock-app dock-win", title: w.title, ariaLabel: `${w.title}: open again`, innerHTML: w.icon || "" });
    b.dataset.win = id;
    b.addEventListener("click", () => restore(id));
    return b;
  }));
}

// Once per page load, when the desk first shows: today's windows as they were left; or, the first time today,
// the one that fits the day (passed in by the planner: "todo-txt", "plan-day" or null)
let restored = false;
export function restoreWindows(firstToday) {
  if (restored) return;
  restored = true;
  if (state.day !== todayStr()) state = { day: todayStr(), handled: false, open: {} };
  if (!state.handled) {
    state.handled = true; keep();
    const id = firstToday();
    if (id && wins.has(id)) restore(id);
    return;
  }
  for (const [id, how] of Object.entries(state.open)) {
    const w = wins.get(id);
    if (!w) { delete state.open[id]; continue; }
    if (how === "open" && !w.shown()) w.show();
  }
  keep();
  renderDockWindows();
}
