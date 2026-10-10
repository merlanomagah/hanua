// ---------- the Jump Dashboard: beside the desk, to its right (Mel, 10 Oct 2026; briefs docs/plans/2026-10-jump-dashboard.md, -v2.md) ----------
// Swipe left on the desk (the way the kitchen comes from the wall), the JUMP tab, or J in the dock; Esc or DESK back.
// v2 (Mel: visual, and two-way with Jump OS): the escalations board with age bars (public/jump/board.js), who she's
// waiting on as bubbles (people.js), projects on a timeline (timeline.js) and Today; + Escalation, and with release B
// moving cards on, closing, edits and answering (form.js), every write through public/jump/store.js with Undo.
// A fixed layout: the desk's drag-and-arrange comes once this earns it.
import { dayOf, timeOf, todayStr } from "./shared/dates.js";
import { addLineTo, setLines, stampLine } from "./shared/desk.js";
import { inCalendars } from "./shared/events.js";
import { notionLink } from "./shared/jump.js";
import { $, ago, h, reducedMotion, store, toast } from "./lib.js";
import { calendarItems, workCalendars } from "./app.js";
import { onDesk, showDesk } from "./planner.js";
import { changeDay, desk, newId, save } from "./desk/state.js";
import { check, renderTodo } from "./desk/page.js";
import { renderTxt } from "./desk/todotxt.js";
import { EDITS, data, load, onChange } from "./jump/store.js";
import { renderBoard } from "./jump/board.js";
import { renderPeople } from "./jump/people.js";
import { renderTimeline } from "./jump/timeline.js";
import { answerQuestion } from "./jump/form.js";
import { closePop, openPop, popOpen } from "./jump/pop.js";

const pane = $("jump-pane"), deskEl = document.querySelector("#desk-pane > .desk");
const stacked = () => matchMedia("(max-width: 900px)").matches;
export let onJump = false;
let timer = 0;
onChange(() => render());

// ---- moving: the desk slides left, the dashboard comes in from the right ----
export function showJump(on) {
  if (stacked()) { if (on) { pane.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); load(); noteVisit(); } return; }
  if (on === onJump && (!on || onDesk)) return;
  // from the wall: the dashboard is put in place first, so there's one movement (the slide down), not two at once
  const fromWall = on && !onDesk;
  if (fromWall) $("desk-pane").classList.add("jump-now");
  onJump = on;
  closePop();
  $("desk-pane").classList.toggle("on-jump", on);
  if (fromWall) { void pane.offsetHeight; showDesk(true); setTimeout(() => $("desk-pane").classList.remove("jump-now"), 50); }
  pane.inert = !on;
  deskEl.inert = on;
  if (document.activeElement && (on ? deskEl : pane).contains(document.activeElement)) (on ? $("jump-to-desk") : $("to-jump")).focus({ preventScroll: true });
  if (on) { load(); noteVisit(); clearInterval(timer); timer = setInterval(() => load(true), 5 * 60_000); } else clearInterval(timer);
  document.dispatchEvent(new CustomEvent("hanua:jump", { detail: on }));
}
function fitJump() {
  if (stacked()) { $("desk-pane").classList.remove("on-jump"); pane.inert = false; deskEl.inert = false; onJump = false; load(); }
  else if (!onJump) pane.inert = true;
}
setTimeout(fitJump); // after the room's modules have all loaded (on a phone it reads straight away)
addEventListener("resize", fitJump);
// leaving the desk forgets the dashboard: the desk is where the next visit starts
document.addEventListener("hanua:desk", (e) => { if (!e.detail && onJump && !stacked()) { onJump = false; closePop(); $("desk-pane").classList.remove("on-jump"); pane.inert = true; deskEl.inert = false; clearInterval(timer); } });
document.addEventListener("hanua:jump", (e) => { $("dock-jump")?.setAttribute("aria-pressed", String(Boolean(e.detail))); });
$("to-jump").addEventListener("click", () => showJump(true));
$("jump-to-desk").addEventListener("click", () => showJump(false));
$("dock-jump").addEventListener("click", () => showJump(!onJump));
$("jump-refresh").addEventListener("click", () => load(true));
// Esc: an open menu first, then back to the desk (before the desk's own Esc takes it up to the wall). A window
// (<dialog>) closes itself first and every Esc handler waits while one is open
addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (popOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closePop(); return; }
  if (!onJump || e.target.closest?.("input, textarea")) return;
  e.preventDefault(); e.stopImmediatePropagation();
  showJump(false);
}, true);
// two fingers sideways: left shows the dashboard, right goes back to the desk. Up next keeps its own sideways swipe
// (it stops it spreading); open windows, the board (it scrolls sideways), drags and dialogs are left alone
const SKIP = ".txt-win, .pl-page, .wg-agenda, .dragging, .resizing, .jw-scroll, .jb-scroll, .jw-pop, [data-move]";
let swipeX = 0, swipeTimer = 0, swipeLock = 0;
$("desk-pane").addEventListener("wheel", (e) => {
  if (stacked() || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || document.querySelector("dialog[open]")) return;
  if (e.target.closest?.(SKIP)) return;
  e.preventDefault();
  if (Date.now() < swipeLock) return;
  swipeX += e.deltaX;
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => { swipeX = 0; }, 250);
  if (Math.abs(swipeX) < 70) return;
  const toJump = swipeX > 0; // fingers moving left: the pane on the right comes in
  swipeX = 0; swipeLock = Date.now() + 700;
  if (toJump !== onJump) showJump(toJump);
}, { passive: false });
let touch0 = null;
$("desk-pane").addEventListener("touchstart", (e) => { touch0 = e.touches.length === 1 && !e.target.closest(SKIP) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("desk-pane").addEventListener("touchend", (e) => {
  if (!touch0 || stacked()) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && (dx < 0) !== onJump) showJump(dx < 0);
});

// how often it's opened (this Mac, by week): the probe's evidence, shown in the weekly review
const VISITS = "jump-visits";
function noteVisit() {
  const week = weekOf(new Date());
  let v = {}; try { v = JSON.parse(store(VISITS) || "{}") || {}; } catch { /* a fresh count */ }
  v[week] = (v[week] || 0) + 1;
  for (const k of Object.keys(v).sort().slice(0, -8)) delete v[k]; // the last 8 weeks
  store(VISITS, JSON.stringify(v));
}
const weekOf = (d) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`; };
export function jumpVisits(weekStart) { try { return (JSON.parse(store(VISITS) || "{}") || {})[weekStart] || 0; } catch { return 0; } }

document.addEventListener("hanua:day-refreshed", () => renderToday());
document.addEventListener("hanua:day-saved", () => renderToday());
document.addEventListener("hanua:focus", () => renderToday());

// ---- drawing ----
const label = (text) => h("span", { className: "wg-label", textContent: text });
const openLink = (url, title) => (url ? h("a", { className: "jw-open", href: url, target: "_blank", rel: "noopener", textContent: "↗", title: `Open “${title}” in Jump OS`, ariaLabel: `Open “${title}” in Jump OS` }) : null);
const problem = (text) => h("p", { className: "jw-note bad", role: "status", textContent: text });
const empty = (text) => h("p", { className: "jw-note", textContent: text });
const parts = { openLink: (u, t) => openLink(u, t), toToday: (r) => toTodayButton(r) };

function render() {
  $("jump-date").textContent = new Date().toLocaleDateString("en-NZ", { weekday: "short", day: "2-digit", month: "short" }).replace(",", "");
  $("jump-src").textContent = data?.error ? "" : data?.sample ? "Sample rows: Notion isn't connected here" : data ? `As recorded in Jump OS · updated ${ago(data.fetchedAt)}` : "Reading Jump OS…";
  const files = $("jump-files");
  files.replaceChildren(...(data?.links || []).map((l) => h("a", { className: "desk-file jump-file", href: l.url, target: "_blank", rel: "noopener", title: `Open ${l.label} in Notion` },
    h("span", { className: "jf-ico", ariaHidden: "true", textContent: "N" }), h("span", { textContent: l.label }))));
  files.hidden = !files.childElementCount;
  if (data?.error) {
    for (const [id, name] of [["jw-board", "Escalations"], ["jw-people", "Waiting on"], ["jw-proj", "Projects"]]) $(id).replaceChildren(label(name), problem(data.error));
  } else if (data) {
    renderBoard($("jw-board"), parts);
    renderPeople($("jw-people"), parts);
    renderTimeline($("jw-proj"), parts);
  }
  renderToday();
}

// → Today: a line under today's Jump issues in Plan my day, with Undo (nothing from Jump OS but the title and page)
function toTodayButton(row) {
  const b = h("button", { type: "button", className: "jw-today-btn", textContent: "→ Today", title: `Add “${row.title}” to today's ${data?.section || "Jump issues"}` });
  b.addEventListener("click", () => sendToToday(row));
  return b;
}
async function sendToToday(row) {
  const section = data?.section || "Jump issues", ref = /^sample-/.test(row.id) ? null : row.id.replace(/[^\w-]/g, "").slice(0, 40);
  const already = desk.sections.some((s) => s.lines.some((l) => l.text && ((ref && l.ref === ref) || l.text === row.title)));
  if (already) return toast(`Already in today's ${section}`);
  const line = stampLine({ id: newId(), text: row.title.slice(0, 200), done: false, pri: "", mins: 0, ...(ref ? { ref } : {}) });
  const ok = await changeDay(todayStr(), (d) => addLineTo(d, section, true, line, newId));
  if (!ok) return toast(`Couldn't add it to today just now: nothing was added.`, true);
  redraw();
  toast(`Added to today's ${section}`, false, { label: "Undo", run: async () => { await changeDay(todayStr(), (d) => { for (const s of d.sections) s.lines = s.lines.filter((l) => l.id !== line.id); }); redraw(); } });
}
const redraw = () => { renderTodo(); renderTxt(); renderToday(); };

// Today: today's work events, the lines under Jump issues in Plan my day (tickable here as there), and the open
// questions (Blocking first; with edits on, Answer… closes one with its Resolution)
function renderToday() {
  const box = $("jw-today"), day = todayStr(), section = data?.section || "Jump issues";
  const work = workCalendars();
  const events = [
    ...calendarItems().filter((x) => x.apple && dayOf(x.date) === day && timeOf(x.date) && inCalendars(x.calendar, work)).map((x) => ({ time: timeOf(x.date), title: x.title })),
    ...desk.meetings.filter((m) => m.time && m.work && m.title).map((m) => ({ time: m.time, title: m.title })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const sec = desk.sections.find((s) => (s.name || "").toLowerCase() === section.toLowerCase());
  const lines = (sec?.lines || []).filter((l) => l.text);
  const fmt = (t) => { const [hh, mm] = t.split(":").map(Number); return `${hh % 12 || 12}:${String(mm).padStart(2, "0")}${hh < 12 ? "am" : "pm"}`; };
  const q = data && !data.error ? data.questions : null;
  const qBtn = q && !q.error && q.open ? h("button", { type: "button", className: `jw-qbtn${q.blocking ? " blocking" : ""}` }, h("b", { textContent: q.blocking || q.open }), ` ${q.blocking ? "blocking" : "open"} question${(q.blocking || q.open) === 1 ? "" : "s"}${q.blocking ? ` · ${q.open} open` : ""}`) : null;
  qBtn?.addEventListener("click", () => openPop(qBtn, "Open questions", q.items.map((r) => ({
    label: r.title, sub: [r.priority, r.age != null ? `${r.age} days` : null, r.waitingOn ? `settled by ${r.waitingOn}` : null].filter(Boolean).join(" · "),
    ...(EDITS ? { run: () => answerQuestion(r.id) } : { link: openLink(r.url, r.title) }),
  }))));
  box.replaceChildren(label("Today"),
    events.length ? h("ul", { className: "jw-list jw-events" }, events.map((x) => h("li", {}, h("time", { textContent: fmt(x.time) }), h("span", { className: "jw-title", textContent: x.title })))) : null,
    h("h4", { className: "jw-h", textContent: section }),
    lines.length ? h("ul", { className: "jw-list jw-lines jw-scroll" }, lines.map((l) => {
      const tick = check(l.done, `Mark “${l.text}” done`);
      tick.addEventListener("click", () => { setLines(desk, [l.id], { done: !l.done }); save(); redraw(); });
      return h("li", { className: `jw-line${l.done ? " done" : ""}${l.parent ? " sub" : ""}` }, tick, h("span", { className: "jw-title", textContent: l.text }), openLink(notionLink(l.ref), l.text));
    })) : empty(`Nothing under ${section} today. → Today on any card puts it here.`),
    q?.error ? problem(q.error) : qBtn);
}
