// The menu whiteboard on the wall, above the desk: a week of meals drawn by hand. The days and dates fill in
// by themselves; pick up a marker (or the eraser) and draw on it. Each week is saved as a picture on this Mac
// after every stroke, and past weeks are kept (‹ and ›). At work it's covered: the menu is personal.
// A probe (5 Oct 2026): if no week gets drawn on in about three weeks, it goes on the cut list.
import { addDays, parseDay, todayStr, weekStart } from "./shared/dates.js";
import { $, focus, fmtDay, h, toast } from "./lib.js";

const W = 1400, H = 560; // the drawing's own size; it scales to fit the board on any screen
const MEALS = ["Breakfast", "Lunch", "Dinner"];
const TOOLS = { ink: { colour: "#232c45", width: 4 }, red: { colour: "#b84e1e", width: 4 }, erase: { width: 38 } };
let week = weekStart();
let tool = null; // the marker or eraser in hand, or null
let saveTimer = 0, dirty = false, loaded = "";
const undo = [];
const canvas = $("mb-canvas"), ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;

export async function loadWhiteboard() {
  renderWhiteboard();
}

// the days across the top, today's column marked, and the week's name
export function renderWhiteboard() {
  const covered = focus.on;
  $("mb-cover").hidden = !covered;
  $("menu-board").classList.toggle("covered", covered);
  if (covered) { putDown(); clearCanvas(); loaded = ""; }
  const today = todayStr();
  $("mb-week").textContent = week === weekStart() ? `This week · from ${fmtDay(week, { day: "numeric", month: "short" })}`
    : `Week of ${fmtDay(week, { day: "numeric", month: "short", year: parseDay(week).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}`;
  $("mb-this").hidden = week === weekStart();
  $("mb-grid").replaceChildren(h("span", { className: "mb-corner" }),
    ...Array.from({ length: 7 }, (_, i) => {
      const d = addDays(week, i);
      return h("span", { className: `mb-day${d === today ? " today" : ""}` },
        h("b", { textContent: fmtDay(d, { weekday: "short" }) }), ` ${parseDay(d).getDate()}`);
    }),
    ...MEALS.flatMap((m) => [h("span", { className: "mb-meal", textContent: m }), ...Array.from({ length: 7 }, (_, i) => h("span", { className: `mb-cell${addDays(week, i) === today ? " today" : ""}` }))]));
  if (!covered && loaded !== week) loadWeek(week);
}

async function loadWeek(w) {
  loaded = w;
  undo.length = 0;
  clearCanvas();
  try {
    const res = await fetch(`/api/board/${w}`);
    if (!res.ok || loaded !== w) return;
    const img = new Image();
    img.src = URL.createObjectURL(await res.blob());
    await img.decode();
    if (loaded === w) ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(img.src);
  } catch { /* nothing drawn that week yet */ }
}
const clearCanvas = () => ctx.clearRect(0, 0, W, H);

// ---- picking up a marker or the eraser ----
function pickUp(name) {
  if (focus.on) return;
  tool = tool === name ? null : name;
  document.querySelectorAll("#menu-board [data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === tool)));
  $("menu-board").dataset.tool = tool || "";
  canvas.style.touchAction = tool ? "none" : "";
}
function putDown() { if (tool) pickUp(tool); }
document.querySelectorAll("#menu-board [data-tool]").forEach((b) => b.addEventListener("click", () => pickUp(b.dataset.tool)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && tool && !document.querySelector("dialog[open]")) putDown(); });

// ---- drawing: smoothed strokes in the drawing's own coordinates ----
let stroke = null;
const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
canvas.addEventListener("pointerdown", (e) => {
  if (!tool || focus.on || e.button > 0) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  undo.push(ctx.getImageData(0, 0, W, H));
  if (undo.length > 12) undo.shift();
  const t = TOOLS[tool];
  ctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = t.colour || "#000";
  ctx.fillStyle = t.colour || "#000";
  ctx.lineWidth = t.width;
  ctx.lineCap = ctx.lineJoin = "round";
  const p = at(e);
  stroke = { last: p, mid: p };
  ctx.beginPath();
  ctx.arc(p.x, p.y, t.width / 2, 0, Math.PI * 2);
  ctx.fill();
});
canvas.addEventListener("pointermove", (e) => {
  if (!stroke) return;
  // the in-between points since the last move, for smooth lines (some browsers give none: then just this one)
  const points = e.getCoalescedEvents?.() || [];
  for (const ev of points.length ? points : [e]) {
    const p = at(ev), mid = { x: (stroke.last.x + p.x) / 2, y: (stroke.last.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(stroke.mid.x, stroke.mid.y);
    ctx.quadraticCurveTo(stroke.last.x, stroke.last.y, mid.x, mid.y);
    ctx.stroke();
    stroke.last = p;
    stroke.mid = mid;
  }
});
const endStroke = () => {
  if (!stroke) return;
  stroke = null;
  ctx.globalCompositeOperation = "source-over";
  scheduleSave();
};
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 700);
}
async function save() {
  if (!dirty || focus.on || loaded !== week) return;
  dirty = false;
  try {
    const res = await fetch(`/api/board/${week}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: canvas.toDataURL("image/png") }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "The menu couldn't be saved");
  } catch (err) { dirty = true; toast(err.message, true); }
}
// don't lose the last stroke when the page closes or the week changes
window.addEventListener("pagehide", () => { if (dirty) save(); });

$("mb-undo").addEventListener("click", () => {
  const last = undo.pop();
  if (!last) return toast("Nothing to undo on the board.");
  ctx.putImageData(last, 0, 0);
  scheduleSave();
});
$("mb-clear").addEventListener("click", () => {
  if (focus.on) return;
  undo.push(ctx.getImageData(0, 0, W, H));
  clearCanvas();
  scheduleSave();
  toast("Board wiped.", false, { label: "Undo", run: () => $("mb-undo").click() });
});

// ---- other weeks: last week's menu stays, next week can be planned ahead ----
async function goWeek(w) {
  if (dirty) { clearTimeout(saveTimer); await save(); }
  week = w;
  renderWhiteboard();
}
$("mb-prev").addEventListener("click", () => goWeek(addDays(week, -7)));
$("mb-next").addEventListener("click", () => goWeek(addDays(week, 7)));
$("mb-this").addEventListener("click", () => goWeek(weekStart()));

// a new week starts a clean board by itself (checked each minute while Hanua is open)
let shownWeek = weekStart();
setInterval(() => {
  const now = weekStart();
  if (now !== shownWeek) { const was = shownWeek; shownWeek = now; if (week === was) goWeek(now); else renderWhiteboard(); }
  else renderWhiteboard(); // today's column moves at midnight
}, 60_000);
