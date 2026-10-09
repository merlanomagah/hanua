// ---------- the Jump Dashboard: beside the desk, to its left (Mel, 10 Oct 2026; brief docs/plans/2026-10-jump-dashboard.md) ----------
// Swipe right on the desk (the way the goals board comes from the wall), the JUMP tab, or the dock. A probe, read
// only: five widgets over three Jump OS databases (shaped by public/shared/jump.js), each row opening its page in
// Notion. → Today puts a row into today's "Jump issues" in Plan my day (its title and its Notion page, nothing else).
// A fixed layout for now: the desk's drag-and-arrange comes once this earns it (Mel: yes, 10 Oct 2026).
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

const pane = $("jump-pane"), deskEl = document.querySelector("#desk-pane > .desk");
const stacked = () => matchMedia("(max-width: 900px)").matches;
export let onJump = false;
let data = null, loading = null, timer = 0;

// ---- moving: the desk slides right, the dashboard comes in from the left ----
export function showJump(on) {
  if (stacked()) { if (on) { pane.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); load(); noteVisit(); } return; }
  if (on === onJump && (!on || onDesk)) return;
  // from the wall: the dashboard is put in place first, so there's one movement (the slide down), not two at once
  const fromWall = on && !onDesk;
  if (fromWall) $("desk-pane").classList.add("jump-now");
  onJump = on;
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
document.addEventListener("hanua:desk", (e) => { if (!e.detail && onJump && !stacked()) { onJump = false; $("desk-pane").classList.remove("on-jump"); pane.inert = true; deskEl.inert = false; clearInterval(timer); } });
document.addEventListener("hanua:jump", (e) => { $("dock-jump")?.setAttribute("aria-pressed", String(Boolean(e.detail))); });
$("to-jump").addEventListener("click", () => showJump(true));
$("jump-to-desk").addEventListener("click", () => showJump(false));
$("dock-jump").addEventListener("click", () => showJump(!onJump));
$("jump-refresh").addEventListener("click", () => load(true));
// Esc on the dashboard goes back to the desk first (before the desk's own Esc takes it up to the wall)
addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !onJump || document.querySelector("dialog[open]") || e.target.closest?.("input, textarea, select")) return;
  e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
  showJump(false);
}, true);
// two fingers sideways on the desk or the dashboard: right shows the dashboard, left goes back to the desk. Up next
// keeps its own sideways swipe (it stops it spreading); open windows, dialogs and drags are left alone
let swipeX = 0, swipeTimer = 0, swipeLock = 0;
$("desk-pane").addEventListener("wheel", (e) => {
  if (stacked() || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || document.querySelector("dialog[open]")) return;
  if (e.target.closest?.(".txt-win, .pl-page, .wg-agenda, .dragging, .resizing, .jw-scroll")) return;
  e.preventDefault();
  if (Date.now() < swipeLock) return;
  swipeX += e.deltaX;
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => { swipeX = 0; }, 250);
  if (Math.abs(swipeX) < 70) return;
  const toJump = swipeX < 0; // fingers moving right
  swipeX = 0; swipeLock = Date.now() + 700;
  if (toJump !== onJump) showJump(toJump);
}, { passive: false });
let touch0 = null;
$("desk-pane").addEventListener("touchstart", (e) => { touch0 = e.touches.length === 1 && !e.target.closest("[data-move], .txt-win, .wg-agenda") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("desk-pane").addEventListener("touchend", (e) => {
  if (!touch0 || stacked()) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && (dx > 0) !== onJump) showJump(dx > 0);
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

// ---- reading: /api/jump (a minute's cache on the server; fresh=1 when asked) ----
async function load(fresh = false) {
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(`/api/jump${fresh ? "?fresh=1" : ""}`);
      if (!res.ok) throw new Error(`Hanua couldn't read Jump OS (${res.status})`);
      data = await res.json();
    } catch (err) {
      data = { error: err.message };
    }
    render();
  })().finally(() => { loading = null; });
  return loading;
}
document.addEventListener("hanua:day-refreshed", () => renderToday());
document.addEventListener("hanua:day-saved", () => renderToday());
document.addEventListener("hanua:focus", () => renderToday());

// ---- drawing ----
const daysText = (n) => (n == null ? "" : n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`);
const label = (text) => h("span", { className: "wg-label", textContent: text });
const openLink = (url, title) => (url ? h("a", { className: "jw-open", href: url, target: "_blank", rel: "noopener", textContent: "↗", title: `Open “${title}” in Jump OS`, ariaLabel: `Open “${title}” in Jump OS` }) : null);
const problem = (text) => h("p", { className: "jw-note bad", role: "status", textContent: text });
const empty = (text) => h("p", { className: "jw-note", textContent: text });

function render() {
  $("jump-date").textContent = new Date().toLocaleDateString("en-NZ", { weekday: "short", day: "2-digit", month: "short" }).replace(",", "");
  $("jump-src").textContent = data?.error ? "" : data?.sample ? "Sample rows: Notion isn't connected here" : data ? `As recorded in Jump OS · updated ${ago(data.fetchedAt)}` : "Reading Jump OS…";
  const files = $("jump-files");
  files.replaceChildren(...(data?.links || []).map((l) => h("a", { className: "desk-file jump-file", href: l.url, target: "_blank", rel: "noopener", title: `Open ${l.label} in Notion` },
    h("span", { className: "jf-ico", ariaHidden: "true", textContent: "N" }), h("span", { textContent: l.label }))));
  files.hidden = !files.childElementCount;
  if (data?.error) {
    for (const id of ["jw-esc", "jw-wait", "jw-proj", "jw-q"]) $(id).replaceChildren(label({ "jw-esc": "Escalations", "jw-wait": "Waiting on", "jw-proj": "Projects", "jw-q": "Blocking questions" }[id]), problem(data.error));
  } else if (data) {
    renderEscalations(); renderWaiting(); renderProjects(); renderQuestions();
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

function renderEscalations() {
  const box = $("jw-esc"), e = data.escalations;
  if (e.error) return box.replaceChildren(label("Escalations"), problem(e.error));
  const counts = h("p", { className: "jw-counts" }, e.groups.filter((g) => g.count || g.status === "Open").map((g) => h("span", { className: `jw-count${g.count ? "" : " none"}` }, h("b", { textContent: g.count }), ` ${g.short}`)));
  const list = h("ul", { className: "jw-list jw-scroll" }, e.items.map((r) => h("li", { className: "jw-row" },
    h("span", { className: `jw-tier t-${(r.tier || "other").toLowerCase()}`, textContent: r.tier || "–", title: r.tier ? `Tier: ${r.tier}` : "No tier recorded" }),
    h("span", { className: "jw-main" },
      h("span", { className: "jw-title", textContent: r.title }),
      h("span", { className: "jw-sub", textContent: [r.status, r.waitingOn ? `waiting on ${r.waitingOn.split(/[,:;(]| - /)[0].trim()}` : null].filter(Boolean).join(" · ") })),
    h("span", { className: "jw-age", textContent: daysText(r.age), title: r.age == null ? "No raised date" : `Raised ${daysText(r.age)} ago` }),
    toTodayButton(r), openLink(r.url, r.title))));
  box.replaceChildren(label("Escalations"), counts,
    e.items.length ? list : empty("No open escalations recorded in Jump OS."),
    h("p", { className: "jw-foot" },
      h("span", { textContent: `Closed this week: ${e.closedThisWeek}` }),
      e.more ? h("span", { textContent: `${e.more} more in Notion` }) : null));
}
function renderWaiting() {
  const box = $("jw-wait"), w = data.waiting || [];
  box.replaceChildren(label("Waiting on"), w.length ? h("ul", { className: "jw-list jw-scroll" }, w.map((p) => h("li", { className: "jw-person" },
    h("span", { className: "jw-who" }, h("b", { textContent: p.who }), h("span", { className: "jw-age", textContent: daysText(p.oldest) })),
    h("ul", { className: "jw-sublist" }, p.items.map((i) => h("li", {}, h("span", { className: "jw-title", textContent: i.title }), openLink(i.url, i.title))))))) : empty("No one named as holding things up."));
}
function renderProjects() {
  const box = $("jw-proj"), p = data.projects;
  if (p.error) return box.replaceChildren(label("Projects"), problem(p.error));
  box.replaceChildren(label("Projects"), p.items.length ? h("ul", { className: "jw-list jw-scroll" }, p.items.map((r) => h("li", { className: `jw-row${r.status === "Blocked" ? " blocked" : ""}` },
    h("span", { className: "jw-main" },
      h("span", { className: "jw-title", textContent: r.title }),
      h("span", { className: "jw-sub", textContent: [r.status, r.next ? `next: ${r.next}` : null, r.date ? `by ${new Date(r.date + "T00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ") })),
    toTodayButton(r), openLink(r.url, r.title)))) : empty("No active or blocked projects in the tracker."));
}
function renderQuestions() {
  const box = $("jw-q"), q = data.questions;
  if (q.error) return box.replaceChildren(label("Blocking questions"), problem(q.error));
  box.replaceChildren(label("Blocking questions"),
    h("p", { className: "jw-big" }, h("b", { textContent: q.blocking }), h("span", { textContent: ` blocking · ${q.open} open` })),
    q.top.length ? h("ul", { className: "jw-list" }, q.top.map((r) => h("li", { className: "jw-row" },
      h("span", { className: "jw-main" }, h("span", { className: "jw-title", textContent: r.title }), h("span", { className: "jw-sub", textContent: r.waitingOn ? `settled by ${r.waitingOn}` : "no one named yet" })),
      h("span", { className: "jw-age", textContent: daysText(r.age) }), toTodayButton(r), openLink(r.url, r.title)))) : empty("Nothing blocking."));
}

// Today: today's work events and the lines under Jump issues in Plan my day, tickable here as there
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
  box.replaceChildren(label("Today"),
    events.length ? h("ul", { className: "jw-list jw-events" }, events.map((x) => h("li", {}, h("time", { textContent: fmt(x.time) }), h("span", { className: "jw-title", textContent: x.title })))) : null,
    h("h4", { className: "jw-h", textContent: section }),
    lines.length ? h("ul", { className: "jw-list jw-lines" }, lines.map((l) => {
      const tick = check(l.done, `Mark “${l.text}” done`);
      tick.addEventListener("click", () => { setLines(desk, [l.id], { done: !l.done }); save(); redraw(); });
      return h("li", { className: `jw-line${l.done ? " done" : ""}${l.parent ? " sub" : ""}` }, tick, h("span", { className: "jw-title", textContent: l.text }), openLink(notionLink(l.ref), l.text));
    })) : empty(`Nothing under ${section} today. → Today on any row puts it here.`));
}
