// Up next: the agenda as a desktop widget, today's time-blocks among the calendar's events; swipe (or ‹ ›) through the days.
// Days ahead show their plan faintly once it's locked in, or say what's waiting, with Plan this day (Mel, 6 Oct 2026,
// evening); today's blocks can be put in another order by hand (Reorder: drag, or ↑ ↓; the times follow).
import { daySummary, deskShape, fromMin, keepPlan, minsText, moveInOrder, removeMeeting, stepDay, toMin, DEFAULT_MINS, MAX_MEETINGS, MEETING_PICKS } from "../shared/desk.js";
import { dayOf, parseDay, timeOf, todayStr } from "../shared/dates.js";
import { $, focus, h, longDate, reducedMotion, toast } from "../lib.js";
import { openGoal } from "../goals/form.js";
import { bookEl, calendarItems, ensureApple, openAppleEvent, openBook, ROLE, sortByTime } from "../app.js";
import { desk, deskDay, newId, page, pageDay, refIn, save } from "./state.js";
import { goDay, openPlan, renderTodo, undoable } from "./page.js";
import { dragRows, openDraft, planFor } from "./draft.js";
import { timeField } from "./timefield.js";
import { openTxt } from "./todotxt.js";

// the plan as agenda entries for Up next: blocks still to do, breaks, and the jotted meetings (today's; a day ahead's
// once it's been read, marked `ahead` so it shows faintly: it's a plan, not yet the day)
export function planEntries(day, d = day === deskDay ? desk : ahead.get(day)) {
  if (!d) return [];
  const busy = (work) => focus.on && !work, later = day !== deskDay;
  const out = [];
  for (const b of d.locked ? d.blocks : []) {
    if (b.kind === "break") { out.push({ plan: "break", title: "Break", date: `${day}T${b.start}`, until: b.end, ahead: later }); continue; }
    const info = refIn(d, b.ref);
    if (!info?.obj.text || info.obj.done) continue; // ticked off: out of the time-blocked agenda
    out.push({ plan: "task", ref: b.ref, title: busy(info.work) ? "Busy" : info.obj.text, busy: busy(info.work), date: `${day}T${b.start}`, until: b.end, pri: info.obj.pri, ahead: later });
  }
  for (const m of d.meetings) if (m.time && m.title) out.push({ plan: "meet", meet: m.id, title: busy(m.work) ? "Busy" : m.title, busy: busy(m.work), date: `${day}T${m.time}`, until: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))), ahead: later });
  return out;
}

// ---- days ahead in Up next: read when swiped to (the page's own day ahead is used as it is) ----
const ahead = new Map(); // day → its page, as last read
async function readAhead(day) {
  if (day === pageDay) { ahead.set(day, page); return; }
  ahead.set(day, null); // asked for once at a time
  try {
    const res = await fetch(`/api/desk/${day}`);
    if (res.ok) ahead.set(day, deskShape((await res.json()).day)); else ahead.delete(day);
  } catch { ahead.delete(day); }
  if (padDay === day) renderAgenda();
}
// a day ahead changed (here or on the other Mac): read again when it's showing
const forget = (e) => { if (e.detail && e.detail <= todayStr()) return; if (e.detail) ahead.delete(e.detail); else ahead.clear(); if (padDay > todayStr()) renderAgenda(); };
document.addEventListener("hanua:day-saved", forget);
document.addEventListener("hanua:day-changed", forget);

// ---- meetings from Up next too (Mel, 6 Oct 2026, part G): + adds one today, clicking one changes or removes it.
// They're the same meetings as Plan my day's Meetings & events. A locked-in day offers to re-plan round the change.
let editing = null; // a meeting's id, "new", or null
function meetingForm(m) {
  const time = timeField(m?.time, { label: "Meeting time" }); // typed (8 Oct 2026), like Plan my day's
  const title = h("input", { type: "text", className: "mt-title", value: m?.title || "", placeholder: "What", ariaLabel: "Meeting", maxLength: 200 });
  const len = h("select", { className: "pl-mins", ariaLabel: "How long" }, MEETING_PICKS.map((v) => h("option", { value: String(v), textContent: minsText(v), selected: (m?.mins || DEFAULT_MINS) === v })));
  const done = (changed) => {
    editing = null; save(); renderAgenda(); renderTodo();
    if (changed && desk.locked) toast("Your day's locked in: re-plan round this?", false, { label: "Re-plan", run: () => openDraft(null, { today: true }) });
  };
  const ok = h("button", { type: "button", className: "pl-go", textContent: m ? "Save" : "Add" });
  ok.addEventListener("click", () => {
    const at = time.get();
    if (!at || !title.value.trim()) { (at ? title : time).focus(); return; }
    const x = m || { id: newId(), work: focus.on };
    Object.assign(x, { time: at, title: title.value.trim(), mins: Number(len.value) });
    if (!m) { if (desk.meetings.length >= MAX_MEETINGS) { toast("That's the most meetings a day can hold"); return; } desk.meetings.push(x); }
    done(true);
  });
  const del = m ? h("button", { type: "button", className: "mt-del", textContent: "Remove" }) : null;
  del?.addEventListener("click", () => { editing = null; undoable(`Removed: ${m.title}`, () => removeMeeting(desk, m.id), desk); if (desk.locked) toast("Meeting removed. Re-plan round it?", false, { label: "Re-plan", run: () => openDraft(null, { today: true }) }); });
  const cancel = h("button", { type: "button", className: "mt-cancel", textContent: "Cancel" });
  cancel.addEventListener("click", () => { editing = null; renderAgenda(); });
  const form = h("li", { className: "mt-form" }, h("div", { className: "mt-row" }, time, len), title, h("div", { className: "mt-row" }, del, cancel, ok));
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); editing = null; renderAgenda(); }
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); ok.click(); }
  });
  requestAnimationFrame(() => (m ? title : time).focus());
  return form;
}

// ---- the agenda, as the Up next widget: swipe (or ‹ ›) through the days ----
let padDay = todayStr();
let reordering = false; // Up next's Reorder: today's blocks as a list to drag
export function renderAgenda() {
  const today = todayStr();
  const key = padDay;
  if (key > today && !ahead.has(key) && !focus.on) readAhead(key);
  // Reorder ends when there's nothing left to put in order (another day, at work with only personal blocks, all done)
  if (reordering && (key !== today || !desk.locked || planEntries(today).filter((x) => x.plan === "task" && !x.busy).length < 2)) reordering = false;
  if (reordering) return renderReorder();
  const rel = Math.round((parseDay(key) - parseDay(today)) / 86_400_000);
  // today's tasks are in the notebook, so today shows events only; other days show what's due too
  const items = sortByTime([...calendarItems().filter((x) => dayOf(x.date) === key && (key !== today || (x.kind !== "Due" && !x.goal))), ...planEntries(key)]);
  const now = new Date(), nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const list = h("ol", { className: "ip-list" });
  let nowPlaced = key !== today;
  for (const x of items) {
    const t = timeOf(x.date);
    if (!nowPlaced && t && t > nowHM) { list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` }))); nowPlaced = true; }
    if (x.plan === "meet" && x.meet === editing) { list.append(meetingForm(desk.meetings.find((m) => m.id === x.meet))); continue; }
    if (x.plan) { // the day's time-blocks and jotted meetings (desk only; the wall's calendar stays high level)
      const word = x.plan === "break" ? "Break" : x.plan === "meet" ? "Meeting" : x.pri === "h" ? "Block · High" : "Block";
      const inner = [h("span", { className: "t", textContent: x.title }), h("span", { className: "k", textContent: x.busy ? "" : `${word} · until ${x.until}` })];
      const open = x.busy || x.plan === "break" ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.ahead ? "Open that day's plan" : x.plan === "meet" ? "Change or remove this meeting" : "Open To-do.txt" }, ...inner);
      if (open.tagName === "BUTTON") open.addEventListener("click", () => { if (x.ahead) goPlan(key); else if (x.plan === "meet") { editing = x.meet; renderAgenda(); } else openTxt(); });
      list.append(h("li", { className: `slot plan-${x.plan}${x.ahead ? " ahead" : ""}${key === today && t < nowHM && x.until <= nowHM ? " past" : ""}` }, h("time", { textContent: t }), open));
      continue;
    }
    const inner = [h("span", { className: "t", textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }), h("span", { className: "k", textContent: x.goal ? x.kind : x.busy ? "" : x.kind })];
    const open = x.busy ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.goal ? "Open the goal" : x.apple ? (x.writable && x.event ? "Change this event" : "Open in Calendar") : "Open in your book" }, ...inner);
    if (!x.busy) open.addEventListener("click", () => (x.goal ? openGoal(x.goal) : x.apple ? openAppleEvent(x) : openBook(x.kind === "Due" ? ROLE.tasks : ROLE.events, bookEl(x.kind === "Due" ? ROLE.tasks : ROLE.events), x.id)));
    list.append(h("li", { className: `slot${key === today && t && t < nowHM ? " past" : ""}`, style: `--dot:${x.color}` },
      h("time", { textContent: t || (x.kind === "Due" || x.goal ? "Due" : "All day") }), open,
      x.url ? h("a", { className: "slot-out", href: x.url, target: "_blank", rel: "noopener", title: "Open in Notion", ariaLabel: `Open ${x.title} in Notion`, textContent: "↗" }) : null));
  }
  if (items.length && !nowPlaced) list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` })));
  if (editing === "new" && key === today) list.prepend(meetingForm(null));
  const add = key === today && deskDay === today ? h("button", { type: "button", className: "ip-add", textContent: "+", ariaLabel: "Add a meeting today", title: "Add a meeting" }) : null;
  add?.addEventListener("click", () => { editing = "new"; renderAgenda(); });
  const nav = (label, step) => { const b = h("button", { type: "button", className: "ip-nav", textContent: label, ariaLabel: step < 0 ? "Previous day" : "Next day" }); b.addEventListener("click", () => movePad(step)); return b; };
  const back = h("button", { type: "button", className: "ip-today", textContent: "Today" });
  back.addEventListener("click", () => { padDay = todayStr(); renderAgenda(); });
  const word = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : parseDay(key).toLocaleDateString(undefined, { weekday: "long" });
  // a day ahead: what's waiting on it, and Plan this day (not at work: it opens the personal page)
  const later = key > today && !focus.on ? aheadNote(key) : null;
  // today, locked in: Reorder puts the blocks in another order by hand
  const tasks = key === today && desk.locked ? planEntries(today).filter((x) => x.plan === "task" && !x.busy) : [];
  const reorder = tasks.length > 1 ? h("button", { type: "button", className: "ip-reorder", textContent: "↕ Reorder", title: "Put today's blocks in another order: drag them, the times follow" }) : null;
  reorder?.addEventListener("click", () => { reordering = true; renderAgenda(); $("agenda").querySelector(".ro-row")?.focus(); });
  const screen = h("div", { className: "ip-screen" },
    h("header", { className: "ip-head" }, nav("‹", -1),
      h("div", { className: "ip-title" }, h("h2", { textContent: word }), h("span", { className: "ip-date", textContent: longDate(parseDay(key), false) })),
      nav("›", 1)),
    rel || reorder ? h("div", { className: "ip-back" }, rel ? back : null, reorder) : null,
    later,
    h("div", { className: "ip-body" }, items.length || editing === "new" ? list : h("p", { className: "empty", textContent: key === today ? "No meetings today." : "Nothing on this day." })));
  $("agenda").replaceChildren(h("span", { className: "wg-label", textContent: "Up next" }), add, screen);
}
// Plan my day on a day ahead (Up next's Plan this day, or a block of that day's plan)
async function goPlan(day) { openPlan(); await goDay(day); }
function aheadNote(day) {
  const d = ahead.get(day);
  const x = d ? daySummary(d) : null;
  const go = h("button", { type: "button", className: "ip-plan", textContent: x?.written ? "Open its plan" : "Plan this day" });
  go.addEventListener("click", () => goPlan(day));
  const n = (k, w, ws = `${w}s`) => `${k} ${k === 1 ? w : ws}`;
  const said = !x ? "" : !x.written ? "Nothing planned yet." : x.locked ? `Locked in${x.tasks ? `: ${n(x.tasks, "task")}` : ""}.` : `${x.tasks ? n(x.tasks, "task") : "Started"}${x.focus ? `, ${n(x.focus, "focus", "focuses")}` : ""}: not locked in yet.`;
  return h("div", { className: "ip-ahead" }, h("span", { textContent: said }), go);
}

// ---- Reorder (Mel, 6 Oct 2026, evening): today's blocks in her own order, by hand ----
// The blocks still to do, in time order; drag one (or ↑ ↓, or Alt+↑ / ↓) and they're planned again in that order over
// the same stretch of the day (from the first of them, not from now: in the evening "from now" would empty the day),
// round the meetings, with the usual buffers. Only the blocks being reordered move. Kept like any plan, with Undo.
function renderReorder() {
  const today = todayStr();
  const tasks = planEntries(today).filter((x) => x.plan === "task" && !x.busy).sort((a, b) => a.date.localeCompare(b.date));
  const refs = tasks.map((x) => x.ref);
  const apply = (next, focusRef) => {
    const from = timeOf(tasks[0].date);
    // what isn't being reordered (done, blocks of other work at work, breaks before) keeps its place
    const others = desk.blocks.filter((b) => !(b.kind === "task" && refs.includes(b.ref)) && !(b.kind === "break" && b.start >= from));
    const p = planFor(desk, today, next, from, others.filter((b) => b.kind === "task"));
    const blocks = [...others, ...p.blocks].sort((a, b) => a.start.localeCompare(b.start));
    const all = [...next, ...desk.order.filter((r) => !next.includes(r))];
    const lost = p.overflow.length;
    undoable(lost ? `Reordered: ${lost} no longer fit${lost === 1 ? "s" : ""} today` : "Reordered: the times follow", () => { keepPlan(desk, { blocks, overflow: [...new Set([...desk.overflow, ...p.overflow])] }); desk.order = all; }, desk);
    if (focusRef) $("agenda").querySelector(`.ro-row[data-ref="${focusRef}"]`)?.focus();
  };
  const rows = tasks.map((x, i) => {
    const mv = (label, to, aria) => { const b = h("button", { type: "button", className: "dr-mv", textContent: label, ariaLabel: aria, disabled: to < 0 || to >= refs.length }); b.addEventListener("click", () => apply(moveInOrder(refs, x.ref, to), x.ref)); return b; };
    const row = h("li", { className: `ro-row p-${x.pri || "none"}`, tabIndex: 0, title: "Drag to reorder (or Alt+↑ / ↓)", ariaLabel: `${i + 1}. ${x.title} at ${timeOf(x.date)}` },
      h("span", { className: "dr-grip", ariaHidden: "true" }), h("time", { textContent: timeOf(x.date) }), h("span", { className: "ro-text", textContent: x.title }),
      mv("↑", i - 1, `Move ${x.title} earlier`), mv("↓", i + 1, `Move ${x.title} later`));
    row.dataset.ref = x.ref;
    row.addEventListener("pointerdown", (e) => dragRows(e, row, ".ro-row", i, (to) => apply(moveInOrder(refs, x.ref, to), x.ref)));
    row.addEventListener("keydown", (e) => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); e.stopPropagation(); apply(moveInOrder(refs, x.ref, i + (e.key === "ArrowUp" ? -1 : 1)), x.ref); } });
    return row;
  });
  const done = h("button", { type: "button", className: "pl-go ro-done", textContent: "Done" });
  done.addEventListener("click", () => { reordering = false; renderAgenda(); });
  const more = h("button", { type: "button", className: "ip-today", textContent: "Draft day…", title: "The whole day, with what won't fit" });
  more.addEventListener("click", () => { reordering = false; renderAgenda(); openDraft(null, { today: true }); });
  const screen = h("div", { className: "ip-screen ro-screen" },
    h("header", { className: "ip-head ro-head" }, h("div", { className: "ip-title" }, h("h2", { textContent: "Reorder today" }), h("span", { className: "ip-date", textContent: "Drag a block: the times follow" }))),
    h("ol", { className: "ro-list" }, rows),
    h("div", { className: "ro-foot" }, more, done));
  screen.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); reordering = false; renderAgenda(); } });
  $("agenda").replaceChildren(h("span", { className: "wg-label", textContent: "Up next" }), screen);
}
function movePad(step) {
  padDay = stepDay(padDay, step);
  ensureApple(padDay);
  const screen = $("agenda").querySelector(".ip-screen");
  renderAgenda();
  if (!reducedMotion && screen) $("agenda").querySelector(".ip-screen").animate([{ transform: `translateX(${step * 24}px)`, opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "ease-out" });
}
// swipe: two fingers sideways on the trackpad, a finger on a touch screen, or the arrow keys when it has focus
let padX = 0, padTimer = 0, padLock = 0;
$("agenda").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault(); e.stopPropagation();
  if (Date.now() < padLock) return;
  padX += e.deltaX;
  clearTimeout(padTimer);
  padTimer = setTimeout(() => { padX = 0; }, 220);
  if (Math.abs(padX) < 60) return;
  movePad(padX > 0 ? 1 : -1);
  padX = 0; padLock = Date.now() + 450;
}, { passive: false });
let padTouch = null;
$("agenda").addEventListener("touchstart", (e) => { padTouch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("agenda").addEventListener("touchend", (e) => {
  if (!padTouch) return;
  const dx = e.changedTouches[0].clientX - padTouch.x, dy = e.changedTouches[0].clientY - padTouch.y;
  padTouch = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) movePad(dx < 0 ? 1 : -1);
});
$("agenda").addEventListener("keydown", (e) => {
  if (reordering || (e.target.closest("button, a") && e.target.closest(".ip-list"))) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); movePad(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); movePad(1); }
});

