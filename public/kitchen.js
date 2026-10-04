// ---------- the kitchen: swipe left from the wall (the goals board is to the right) ----------
// Three panes side by side: goals board ← wall → kitchen. Two fingers on the trackpad (or a finger on a phone) move
// one pane at a time; the kitchen has the weather window and the week's menu, and looks down to the same desk.
// Today's meals also sit on the desk as a slip of paper, so the menu isn't forgotten now it's off the wall.
import { $, focus, h, reducedMotion } from "./lib.js";
import { onBoard, showBoard } from "./goals/board.js";
import { boardWeek } from "./whiteboard.js";
import { weekStart } from "./shared/dates.js";
import { DAYS, MEALS, menuShape } from "./shared/menu.js";

export let onKitchen = false;
export function showKitchen(on) {
  if (on === onKitchen) return;
  if (on && onBoard) showBoard(false);
  onKitchen = on;
  $("wall").classList.toggle("on-kitchen", on);
  $("kitchen-pane").inert = !on;
  $("wall-in").inert = on;
  // the panes sit right under the top shelf, so the top of the page shows the one you've moved to
  if (window.scrollY > 40) window.scrollTo({ top: 0, behavior: reducedMotion || window.scrollY > 1200 ? "auto" : "smooth" });
  (on ? $("kitchen-to-wall") : $("to-kitchen")).focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent("hanua:kitchen", { detail: on }));
}
// the goals board slides in from the other side: the kitchen steps out of the way first
document.addEventListener("hanua:board", () => showKitchen(false));

$("to-kitchen").addEventListener("click", () => showKitchen(true));
$("kitchen-to-wall").addEventListener("click", () => showKitchen(false));

// One pane at a time: fingers moving right go towards the goals board, left towards the kitchen.
function swipe(towardsBoard) {
  if (towardsBoard) onKitchen ? showKitchen(false) : showBoard(true);
  else onBoard ? showBoard(false) : showKitchen(true);
}

// Trackpad: two fingers sideways across the wall
let swipeX = 0, swipeTimer = 0, swipeLock = 0;
$("wall").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || document.querySelector("dialog[open]")) return;
  e.preventDefault();
  if (Date.now() < swipeLock) return;
  swipeX += e.deltaX;
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => { swipeX = 0; }, 250);
  if (Math.abs(swipeX) < 70) return;
  swipe(swipeX < 0);
  swipeX = 0;
  swipeLock = Date.now() + 700;
}, { passive: false });

// Touch: a finger dragged sideways
let touch0 = null;
$("wall").addEventListener("touchstart", (e) => { touch0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("wall").addEventListener("touchend", (e) => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest(".goal-card, .pin-list")) swipe(dx > 0);
});

// ---- today's meals on the desk ----
let thisWeek = null;
export function renderMealSlip() {
  const slip = $("meal-slip");
  if (!slip) return;
  const b = boardWeek();
  const day = DAYS[(new Date().getDay() + 6) % 7];
  // what's on the board when it shows this week (typing included), otherwise this week as saved
  const menu = b.week === weekStart() && MEALS.some((m) => b.menu[day][m]) ? b.menu : thisWeek;
  const meals = MEALS.map((m) => ({ m, text: menu?.[day]?.[m] || "" })).filter((x) => x.text);
  slip.hidden = focus.on || !meals.length;
  slip.replaceChildren(h("b", { textContent: "TODAY'S MENU" }), ...meals.map(({ m, text }) => h("span", {}, h("small", { textContent: m.toUpperCase() }), text)));
}
async function loadMealSlip() {
  try {
    const res = await fetch(`/api/menu/${weekStart()}`);
    if (res.ok) thisWeek = menuShape(await res.json());
  } catch { /* the server's away: no slip */ }
  renderMealSlip();
}
$("meal-slip").addEventListener("click", () => {
  showKitchen(true);
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
});
document.addEventListener("hanua:menu", () => renderMealSlip());
let slipTimer = 0;
$("menu-board").addEventListener("input", () => { clearTimeout(slipTimer); slipTimer = setTimeout(renderMealSlip, 400); });
loadMealSlip();
