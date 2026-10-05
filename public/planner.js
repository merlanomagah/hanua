// ---------- the desk, seen front-on: the whole screen is a Mac desktop (a "Plan my day" file, widgets, a dock along the bottom) ----------
// The desk is its own pane, one slide down from the wall (or the kitchen), and one slide back up (Mel, 5 Oct 2026),
// except on phones, where the stacked room is taller than the screen and the page just scrolls.
// This file is the pane, the desktop's files and the dock. The rest lives in public/desk/: state.js (the day and
// saving), page.js (Plan my day and its widget), agenda.js (Up next), todotxt.js, timer.js, stickies.js.
// Rules: public/shared/desk.js (tested).
import { showBoard } from "./goals/board.js";
import { parseDay, todayStr } from "./shared/dates.js";
import { $, reducedMotion } from "./lib.js";
import { openInCalendar, openTurntable, renderNotes } from "./app.js";
import { fetchBackup, fetchDay, fetchPrompts } from "./desk/state.js";
import { openPlan, renderTodo, resetSweep } from "./desk/page.js";
import { renderAgenda } from "./desk/agenda.js";
import { openTxt } from "./desk/todotxt.js";
import "./desk/timer.js";

export { backup } from "./desk/state.js";
export { openArchive, openPlan, renderTodo } from "./desk/page.js";
export { renderAgenda } from "./desk/agenda.js";
export { loadStickies, renderStickies } from "./desk/stickies.js";

// ---- the desk as a pane ----
export let onDesk = false;
const stacked = () => matchMedia("(max-width: 900px)").matches;
let deskTimer = 0;
export function showDesk(on) {
  if (stacked()) {
    if (on) $("desk-pane").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    return;
  }
  if (on === onDesk) return;
  onDesk = on;
  const room = document.querySelector(".room");
  // one push, like the kitchen: first put each pane exactly where it shows now (no transitions), scroll to the top in
  // the same frame so nothing moves, then let both slide a screen's height together
  room.style.setProperty(on ? "--wall-y" : "--desk-y", `${-window.scrollY}px`);
  room.classList.add("desk-start");
  room.classList.toggle("desk-leave", !on);
  room.classList.toggle("on-desk", on);
  window.scrollTo(0, 0);
  void room.offsetHeight; // the start positions are laid out, so removing the class now slides from them
  room.classList.remove("desk-start");
  $("wall").inert = on;
  $("desk-pane").inert = !on;
  // keyboard focus follows the slide (only when it was in the pane that just went away)
  if (document.activeElement?.closest?.(on ? "#wall" : "#desk-pane")) (on ? $("desk-up") : $("to-desk")).focus({ preventScroll: true });
  // the canary leaves perches that just went away, once the slide has finished
  clearTimeout(deskTimer);
  deskTimer = setTimeout(() => {
    if (!onDesk) room.classList.remove("desk-leave"); // slid away: now it can hide (styles.css)
    window.dispatchEvent(new Event("resize"));
  }, reducedMotion ? 0 : 620);
  document.dispatchEvent(new CustomEvent("hanua:desk", { detail: on }));
}
function fitPanes() {
  // crossing the phone width: back to one scrolling page, or back to panes (starting on the wall)
  if (stacked()) { document.querySelector(".room").classList.remove("on-desk"); $("wall").inert = false; $("desk-pane").inert = false; onDesk = false; }
  else if (!onDesk) $("desk-pane").inert = true;
}
fitPanes();
addEventListener("resize", fitPanes);
// the goals board and the kitchen live up on the wall: going to either leaves the desk
document.addEventListener("hanua:board", (e) => { if (e.detail !== false) showDesk(false); });
document.addEventListener("hanua:kitchen", (e) => { if (e.detail) showDesk(false); });
$("to-desk").addEventListener("click", () => showDesk(true));
$("kitchen-to-desk").addEventListener("click", () => showDesk(true));
$("desk-up").addEventListener("click", () => showDesk(false));
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && onDesk && !document.querySelector("dialog[open]") && !e.target.closest?.("input, textarea")) showDesk(false);
});
// A flick down at the bottom of the wall slides to the desk; a flick up at the top of the desk slides back
let flick = 0, flickTimer = 0;
addEventListener("wheel", (e) => {
  if (stacked() || Math.abs(e.deltaX) > Math.abs(e.deltaY) || document.querySelector("dialog[open]")) { flick = 0; return; }
  const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  const inPage = e.target.closest?.(".pl-page");
  const down = !onDesk && e.deltaY > 0 && atBottom;
  const up = onDesk && e.deltaY < 0 && scrollY <= 0 && !(inPage && inPage.scrollTop > 0);
  if (!down && !up) { flick = 0; return; }
  flick += e.deltaY;
  clearTimeout(flickTimer);
  flickTimer = setTimeout(() => { flick = 0; }, 160);
  if (Math.abs(flick) > 240) { flick = 0; e.preventDefault(); showDesk(down); }
}, { passive: false });

// ---- the day: loaded at start and each new day (renderTodo notices the date change) ----
export async function loadDesk() {
  resetSweep();
  await fetchDay();
  renderTodo();
  renderAgenda(); // the day's plan shows in Up next
  if (await fetchPrompts()) renderTodo();
  loadBackup();
}
setInterval(() => loadBackup(), 3600_000); // a failure that happens while Hanua sits open still reaches the desk
export async function loadBackup() {
  await fetchBackup();
  renderNotes();
  document.dispatchEvent(new Event("hanua:backup"));
}

// ---- the desktop: double-click a file to open it (Enter or a tap work too), like a real desktop ----
let lastPointer = "mouse";
function desktopFile(el, open) {
  el.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; });
  el.addEventListener("click", (e) => {
    if (e.detail === 0 || lastPointer === "touch") { el.classList.remove("sel"); return open(); } // keyboard or touch: one press opens it
    document.querySelectorAll(".desk-file.sel").forEach((f) => f.classList.remove("sel"));
    el.classList.add("sel");
  });
  el.addEventListener("dblclick", () => { el.classList.remove("sel"); open(); });
}
document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".desk-file")) document.querySelectorAll(".desk-file.sel").forEach((f) => f.classList.remove("sel")); });
const file = $("open-plan");
desktopFile(file, () => openPlan());
desktopFile($("open-txt"), () => openTxt());
$("plan-day").addEventListener("close", () => { if (!$("todo-txt").contains(document.activeElement)) file.focus({ preventScroll: true }); });

// the dock, like a Mac's: Calendar opens the Calendar app on today, Notion the Hanua page, the record player the turntable
$("dock-records").addEventListener("click", openTurntable);
$("dock-goals").addEventListener("click", () => showBoard(true));
$("dock-calendar").addEventListener("click", () => openInCalendar({ date: todayStr() }));
function dockDate() { // the Calendar tile shows today, like the real one
  const d = parseDay(todayStr());
  $("dock-cal-day").textContent = d.toLocaleDateString("en-NZ", { weekday: "short" }).toUpperCase();
  $("dock-cal-date").textContent = String(d.getDate());
}
dockDate();
setInterval(dockDate, 60_000);
fetch("/api/desk/links").then((r) => r.json()).then(({ notion }) => { if (notion) $("dock-notion").href = notion; }).catch(() => { /* Notion's own home page is fine */ });

