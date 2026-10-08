// Close the day (roadmap step 7, Mel, 9 Oct 2026; brief docs/plans/2026-10-close-the-day.md). A desk window like
// To-do.txt, never opened by itself: from the time in Desk Settings (4 pm) a Close the day button shows in To-do.txt's
// header and Plan my day's day bar; from the reminder time (7 pm), if the day isn't closed, a note on the desk and one
// message. In the window: each open task with its open subtasks, to tick now, or to choose Tomorrow / A day… / Let go
// (or leave for the morning sweep); two optional lines; then Close the day: everything happens at once, with one Undo,
// and Plan tomorrow →. Rules (tested): closeItems, closeMoment, letGo, closeDayRecord, reopenDay in shared/desk.js.
import { closeDayRecord, closeItems, closeMoment, letGo, planDate, putLines, reopenDay, returnUnplaced, setLines, stepDay, takeLines } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { changeDay, desk, deskDay, newId, saveNow, save } from "./state.js";
import { settings } from "../settings/store.js";
import { check, dayName, openDay, renderPlanWidget, renderTodo } from "./page.js";
import { renderTxt } from "./todotxt.js";
import { renderAgenda } from "./agenda.js";
import { openDayPicker, closeDayPicker } from "./daypick.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";
import { asleep } from "../lock.js";
import { typingIn } from "../sync.js";

const win = $("close-day");
const ready = resizable(win);
const ICON = '<svg viewBox="0 0 48 60" aria-hidden="true" width="30"><path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M14 36a10 10 0 0 0 20 0" fill="none" stroke="#c76a3a" stroke-width="2"/><path d="M10 42h28" stroke="#b9b2a5" stroke-width="2"/></svg>';
let placed = false, day = null; // the day being closed: today when the window opened (midnight can pass while it's open)
const choices = new Map(); // ref → { how: "send" | "let", to? }
let well = "", hard = "";

export const closeTimes = () => settings?.close || { from: "16:00", remind: "19:00" };
// what the clock says now about closing today (shared/desk.js closeMoment)
export const closeNow = (now = new Date()) => closeMoment(now, closeTimes(), desk.closed?.at || null);
const clock = (iso) => new Date(iso).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });

// ---- the button To-do.txt and Plan my day show (null when there's nothing to offer) ----
export function closeButton(cls = "") {
  if (desk.closed?.at) {
    const b = h("button", { type: "button", className: `close-btn closed ${cls}`, textContent: `Closed ${clock(desk.closed.at)} ✓`, title: "The day is closed: open it to see, or open it again" });
    b.addEventListener("click", () => openClose());
    return b;
  }
  if (!closeNow().offer) return null;
  const b = h("button", { type: "button", className: `close-btn ${cls}`, textContent: focus.on ? "Close the work day" : "Close the day" });
  b.addEventListener("click", () => openClose());
  return b;
}
// the desk note from the reminder time until the day is closed (app.js renderNotes)
export function closeNote() {
  const m = closeNow();
  if (!m.remind) return null;
  const n = closeItems(desk, deskDay, focus.on).length;
  return { text: "Close the day", meta: n ? `${n} still open · a minute` : "Everything's decided · a minute", run: () => openClose() };
}

function render() {
  if (win.hidden) return;
  const items = closeItems(desk, day, focus.on);
  for (const r of [...choices.keys()]) if (!items.some((x) => x.ref === r)) choices.delete(r); // ticked or gone since
  const bar = windowBar(win, focus.on ? "Close the work day" : "Close the day", [], hide);
  const closed = desk.closed?.at && day === deskDay;
  const head = h("header", { className: "txt-head" },
    h("span", { className: "th-day", textContent: planDate(day) }),
    h("span", { className: "th-left", textContent: closed ? `Closed ${clock(desk.closed.at)} ✓` : items.length ? `${items.length} still open` : "Nothing left open ✓" }));
  const body = h("div", { className: "txt-body cd-body", tabIndex: -1 }, closed ? closedEl() : openEl(items));
  const scroll = win.querySelector(".txt-body")?.scrollTop || 0;
  win.replaceChildren(bar, head, body);
  body.scrollTop = scroll;
}

function openEl(items) {
  const tick = (ref, text, done) => {
    const b = check(done, `Mark ${text} ${done ? "not done" : "done"}`);
    b.addEventListener("click", () => { setLines(desk, [ref], { done: !done }); save(); renderPlanWidget(); renderTodo(); renderTxt(); renderAgenda(); render(); });
    return b;
  };
  const choice = (it) => {
    const c = choices.get(it.ref);
    const seg = (how, label, run) => {
      const on = c?.how === how;
      const b = h("button", { type: "button", className: `cd-seg${on ? " on" : ""}`, ariaPressed: String(on), textContent: how === "day" && on && c.to ? dayName(c.to).replace(/^./, (x) => x.toUpperCase()) : label });
      b.addEventListener("click", () => run(b, on));
      return b;
    };
    const tomorrow = stepDay(day, 1);
    return h("div", { className: "cd-choices", role: "group", ariaLabel: `What happens to ${it.text}` },
      seg("tomorrow", "Tomorrow", (_b, on) => { if (on) choices.delete(it.ref); else choices.set(it.ref, { how: "tomorrow", to: tomorrow }); render(); }),
      seg("day", "A day…", (b, on) => { if (on) { choices.delete(it.ref); render(); return; } openDayPicker(b, { not: day, title: "Send it to", onPick: (to) => { choices.set(it.ref, { how: "day", to }); render(); } }); }),
      seg("let", "Let go", (_b, on) => { if (on) choices.delete(it.ref); else choices.set(it.ref, { how: "let" }); render(); }));
  };
  const rows = items.map((it) => h("li", { className: `cd-item${choices.get(it.ref)?.how === "let" ? " letting" : ""}` },
    h("div", { className: "cd-line" }, tick(it.ref, it.text, it.done), h("span", { className: "cd-text", textContent: it.text }), h("span", { className: "cd-sec", textContent: it.section })),
    it.kids.length ? h("ul", { className: "cd-kids" }, it.kids.map((k) => h("li", { className: `cd-line${k.done ? " done" : ""}` }, tick(k.ref, k.text, k.done), h("span", { className: "cd-text", textContent: k.text })))) : null,
    choice(it)));
  const all = (how) => { for (const it of items) choices.set(it.ref, how === "let" ? { how: "let" } : { how: "tomorrow", to: stepDay(day, 1) }); render(); };
  const btn = (label, run, cls = "") => { const b = h("button", { type: "button", className: `set-reset ${cls}`, textContent: label }); b.addEventListener("click", run); return b; };
  const line = (label, value, set) => {
    const i = h("input", { type: "text", className: "set-in cd-in", value, maxLength: 200, placeholder: label, ariaLabel: label, enterKeyHint: "next" });
    i.addEventListener("input", () => set(i.value));
    return h("label", { className: "cd-say" }, h("span", { textContent: label }), i);
  };
  const decided = [...choices.values()];
  const tally = ["tomorrow", "day", "let"].map((k) => decided.filter((c) => c.how === k).length);
  const left = items.length - decided.length;
  const go = h("button", { type: "button", className: "pl-go cd-go", textContent: focus.on ? "Close the work day" : "Close the day" });
  go.addEventListener("click", () => commit(go));
  return [
    items.length ? h("ul", { className: "cd-list" }, rows) : h("p", { className: "txt-empty", textContent: "Nothing open: everything's ticked or decided." }),
    items.length > 1 ? h("div", { className: "cd-all" }, btn("All to tomorrow", () => all("tomorrow")), btn("Let all go", () => all("let")), decided.length ? btn("Clear choices", () => { choices.clear(); render(); }) : null) : null,
    // the two lines are personal: not at work
    focus.on ? null : h("div", { className: "cd-lines" }, line("What went well", well, (v) => { well = v; }), line("What got in the way", hard, (v) => { hard = v; })),
    h("div", { className: "cd-foot" },
      h("span", { className: "cd-tally", textContent: [tally[0] && `${tally[0]} to tomorrow`, tally[1] && `${tally[1]} to another day`, tally[2] && `${tally[2]} let go`, left > 0 && `${left} left for the morning`].filter(Boolean).join(" · ") || "Choose for each, or leave them for the morning" }),
      go),
  ];
}

function closedEl() {
  const c = desk.closed || {};
  const again = h("button", { type: "button", className: "set-reset", textContent: "Open again" });
  again.addEventListener("click", () => { reopenDay(desk); save(); well = c.well || ""; hard = c.hard || ""; refreshAll(); });
  const next = h("button", { type: "button", className: "pl-go", textContent: "Plan tomorrow →" });
  next.addEventListener("click", () => { hide(); openDay(stepDay(day, 1)); });
  return [
    focus.on ? null : h("dl", { className: "cd-said" }, c.well ? [h("dt", { textContent: "Went well" }), h("dd", { textContent: c.well })] : null, c.hard ? [h("dt", { textContent: "Got in the way" }), h("dd", { textContent: c.hard })] : null),
    h("div", { className: "cd-foot" }, again, next),
  ];
}

// Everything at once: sends (destination first, then this day), let go, the record; one Undo for all of it
async function commit(go) {
  go.disabled = true;
  const now = new Date(), before = structuredClone(desk);
  const restore = () => { for (const k of Object.keys(desk)) delete desk[k]; Object.assign(desk, structuredClone(before)); };
  const byDay = new Map();
  for (const [ref, c] of choices) if (c.how !== "let") byDay.set(c.to, [...(byDay.get(c.to) || []), ref]);
  const placedOn = [];
  for (const [to, refs] of byDay) {
    const taken = takeLines(desk, refs, day, to, now);
    if (!taken.length) continue;
    const ok = await changeDay(to, (d) => putLines(d, taken, newId));
    if (!ok) { // nothing half-done: what already went is taken back off, and this day is as it was
      for (const p of placedOn) await changeDay(p.to, (d) => { for (const s of d.sections) s.lines = s.lines.filter((l) => !p.ids.has(l.id)); });
      restore(); go.disabled = false; render();
      toast(`Couldn't send them to ${dayName(to)}: the day isn't closed, nothing was moved.`, true);
      return;
    }
    returnUnplaced(desk, taken, newId); // a full section: those stay here
    placedOn.push({ to, ids: new Set(taken.filter((t) => t.placed).map((t) => t.placed)) });
  }
  letGo(desk, day, [...choices].filter(([, c]) => c.how === "let").map(([r]) => r), now);
  closeDayRecord(desk, focus.on ? { well: desk.closed?.well || "", hard: desk.closed?.hard || "" } : { well, hard }, now);
  const saved = await saveNow(desk);
  if (!saved) { go.disabled = false; render(); return; } // the reason was said (the other Mac, iCloud)
  const sent = placedOn.reduce((n, p) => n + p.ids.size, 0), let_ = [...choices.values()].filter((c) => c.how === "let").length;
  choices.clear(); well = ""; hard = "";
  refreshAll();
  toast(`Day closed${sent ? `: ${sent} sent on` : ""}${let_ ? `${sent ? "," : ":"} ${let_} let go` : ""}`, false, [
    { label: "Plan tomorrow", run: () => { hide(); openDay(stepDay(day, 1)); } },
    { label: "Undo", run: async () => {
      for (const p of placedOn) await changeDay(p.to, (d) => { for (const s of d.sections) s.lines = s.lines.filter((l) => !p.ids.has(l.id)); });
      restore(); await saveNow(desk); refreshAll();
    } },
  ]);
}

function refreshAll() { render(); renderTodo(); renderTxt(); renderAgenda(); renderPlanWidget(); document.dispatchEvent(new Event("hanua:close")); }

function show() {
  if (!day || day !== deskDay || desk.closed?.at) day = deskDay;
  win.hidden = false;
  if (!placed) { restorePlace(win); placed = true; ready(); }
  render();
  win.querySelector(".txt-body")?.focus({ preventScroll: true });
}
function hide() { win.hidden = true; closeDayPicker(); noteClosed("close-day"); }
registerWindow("close-day", { title: "Close the day", icon: ICON, show, hide, shown: () => !win.hidden });
export function openClose() { show(); noteOpen("close-day"); }

// ---- the clock: a look every minute (and when things change); the 4 pm button and 7 pm note follow it ----
const NUDGED = "close-day-nudged"; // the day the one message was shown (a view thing, this Mac)
let last = "";
export function tick(now = new Date()) {
  const m = closeNow(now), key = `${deskDay}:${m.offer}:${m.remind}:${Boolean(desk.closed?.at)}`;
  if (key !== last) { last = key; renderTxt(); renderTodo(); document.dispatchEvent(new Event("hanua:close")); }
  if (m.remind && !asleep && document.visibilityState === "visible") {
    let shown = null; try { shown = localStorage.getItem(NUDGED); } catch { /* fine */ }
    if (shown !== deskDay) {
      try { localStorage.setItem(NUDGED, deskDay); } catch { /* fine */ }
      toast("Time to close the day? A minute to decide what's left.", false, { label: "Close the day", run: () => openClose() });
    }
  }
  if (!win.hidden && day === todayStr() && !typingIn(win)) render(); // never mid-typing
}
setInterval(() => tick(), 60_000);
for (const ev of ["hanua:day-refreshed", "hanua:settings", "hanua:focus"]) document.addEventListener(ev, () => { last = ""; tick(); });
