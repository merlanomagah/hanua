// Windows on the desk (Mel, 6 Oct 2026, part D): Plan my day, To-do.txt, the Shopping list and Add reminder share one
// title bar (red closes, yellow minimises into the dock like a Mac's, green is just for looks), drag by the bar,
// resize from the corner, and are remembered: which are open or minimised today survives a reload or an update.
// Places and sizes are kept in this browser (a view preference).
import { $, h, reducedMotion } from "../lib.js";
import { todayStr } from "../shared/dates.js";

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
export function noteOpen(id) {
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
    if (e.target.closest("button, a, input")) return;
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
function keepPlace(win) {
  try { localStorage.setItem(placeKey(win), JSON.stringify({ x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight })); } catch { /* fine */ }
}
export function restorePlace(win) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(placeKey(win)) || "null"); } catch { p = null; }
  if (!p) return;
  win.style.left = `${p.x}px`; win.style.top = `${p.y}px`;
  if (p.w) { win.style.width = `${p.w}px`; win.style.height = `${p.h}px`; win.style.maxHeight = "none"; }
}
// keep Mel's own resizing (from the corner), not the window first appearing
export function resizable(win) {
  let ready = false;
  new ResizeObserver(() => { if (ready && !win.hidden) keepPlace(win); }).observe(win);
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
