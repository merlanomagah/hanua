// The draft day (Mel, 6 Oct 2026, part F; brief docs/plans/2026-10-desk-flow-and-notes.md). Save & plan no longer
// decides the day by itself: it opens this window with the day's tasks in a proposed order (High, Medium, Low, quick
// ones first within each: draftOrder in public/shared/desk.js) on the left, and the day as it would run on the right
// (planDay in that order, round meetings and calendar events, with the buffers and breaks). Mel drags the order (or
// Alt+↑/↓, or the arrows); the day updates as she drops. Lock it in saves the plan (kept in the day's plans), puts it
// in Up next and opens To-do.txt. Back to editing leaves everything as it was. The order is saved as she goes.
// A task added in To-do.txt on a locked-in day can open it too, with the new task picked out to drop where it fits.
// It plans the page's day (state.js `page`, here `desk`): today from now, or a day ahead from its start (Mel, 6 Oct
// 2026, evening). Up next's Reorder uses the same plan and the same dragging (planFor, dragRows).
import { draftOrder, keepPlan, moveInOrder, openItems, planDay, planDate, timeLabel, DEFAULT_MINS } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { page as desk, pageDay, savePage as save, showDay } from "./state.js";
import { dayName, fixedOn, nowHHMM, PRI_LABEL, renderTodo } from "./page.js";
import { renderAgenda } from "./agenda.js";
import { openTxt } from "./todotxt.js";

const dlg = $("draft-day");
let order = [], picked = null;
const items = () => openItems(desk, focus.on);
const byRef = () => new Map(items().map((x) => [x.ref, x]));
// a day's plan in a given order: today from now, a day ahead from its start (or from `from`, given as HH:MM)
// (`keep`: blocks that stay where they are, planned round like meetings)
export function planFor(d, day, refs, from = day === todayStr() ? nowHHMM() : "00:00", keep = []) {
  const m = new Map(openItems(d, focus.on).map((x) => [x.ref, x]));
  return planDay({ tasks: refs.map((r) => m.get(r)).filter(Boolean), fixed: [...fixedOn(day, d), ...keep], from, day: d.day, keepOrder: true });
}
const plan = () => planFor(desk, pageDay, order);
const startsAt = () => (pageDay === todayStr() && nowHHMM() > desk.day.start ? nowHHMM() : desk.day.start);
const fmt = (hhmm) => { const [hh, mm] = hhmm.split(":").map(Number); return `${hh % 12 || 12}:${String(mm).padStart(2, "0")}${hh < 12 ? "am" : "pm"}`; };

// today: true when it's today's plan being changed from elsewhere (Up next, To-do.txt) while a day ahead is open
export async function openDraft(highlight = null, { today = false } = {}) {
  if (today && pageDay !== todayStr()) { await showDay(todayStr()); renderTodo(); }
  order = draftOrder(items(), desk.order);
  picked = highlight;
  if (!order.length) { toast("Nothing to plan yet: add some tasks first."); return; }
  render();
  if (!dlg.open) dlg.showModal();
  (highlight ? dlg.querySelector(`[data-ref="${highlight}"]`) : dlg.querySelector(".dr-row"))?.focus({ preventScroll: false });
}

function setOrder(next, focusRef) {
  order = next;
  desk.order = order; save(); // kept as she goes, so a closed window doesn't lose her arranging
  render();
  if (focusRef) dlg.querySelector(`[data-ref="${focusRef}"]`)?.focus();
}

function render() {
  const m = byRef(), { blocks, overflow } = plan();
  const where = new Map(blocks.filter((b) => b.kind === "task").map((b) => [b.ref, b]));
  // the order, with a quiet line where the priority changes
  const rows = [];
  let lastPri = null;
  order.forEach((ref, i) => {
    const x = m.get(ref);
    if (!x) return;
    const pri = x.pri || "m";
    if (pri !== lastPri) { rows.push(h("li", { className: "dr-group", ariaHidden: "true", textContent: PRI_LABEL[pri] === "Med" ? "Medium" : PRI_LABEL[pri] })); lastPri = pri; }
    const b = where.get(ref);
    const up = h("button", { type: "button", className: "dr-mv", ariaLabel: `Move ${x.title} earlier`, textContent: "↑", disabled: i === 0 });
    const down = h("button", { type: "button", className: "dr-mv", ariaLabel: `Move ${x.title} later`, textContent: "↓", disabled: i === order.length - 1 });
    up.addEventListener("click", () => setOrder(moveInOrder(order, ref, i - 1), ref));
    down.addEventListener("click", () => setOrder(moveInOrder(order, ref, i + 1), ref));
    const row = h("li", { className: `dr-row p-${x.pri || "none"}${ref === picked ? " picked" : ""}${b ? "" : " unfit"}`, tabIndex: 0, ariaLabel: `${i + 1}. ${x.title}`, title: "Drag to reorder (or Alt+↑ / ↓)" },
      h("span", { className: "dr-grip", ariaHidden: "true" }),
      h("span", { className: "dr-text" }, h("b", { textContent: x.title }), h("small", { textContent: `${x.section || "General"}${x.under ? ` · under ${x.under}` : ""} · ${timeLabel(x.mins || DEFAULT_MINS)}` })),
      h("span", { className: "dr-when", textContent: b ? fmt(b.start) : "won't fit" }), up, down);
    row.dataset.ref = ref;
    row.addEventListener("keydown", (e) => {
      if (!e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      setOrder(moveInOrder(order, ref, i + (e.key === "ArrowUp" ? -1 : 1)), ref);
    });
    row.addEventListener("pointerdown", (e) => dragRow(e, row, ref));
    rows.push(row);
  });
  // the day as it would run: tasks, breaks, and the fixed things (meetings, events) between them
  const fixed = fixedOn(pageDay, desk).map((f) => ({ start: f.start, end: f.end, kind: "fixed", title: f.title || "Meeting" }));
  const timeline = [...blocks.map((b) => ({ ...b, title: b.kind === "break" ? "Break" : m.get(b.ref)?.title })), ...fixed].sort((a, b) => a.start.localeCompare(b.start));
  const day = h("ol", { className: "dr-day" }, timeline.map((t) => h("li", { className: `dr-slot k-${t.kind}${t.ref && t.ref === picked ? " picked" : ""}` },
    h("time", { textContent: `${fmt(t.start)}–${fmt(t.end)}` }), h("span", { textContent: t.title || "" }))));
  const left = overflow.map((r) => m.get(r)?.title).filter(Boolean);
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Back to editing", title: "Back to editing" });
  close.addEventListener("click", () => dlg.close());
  const back = h("button", { type: "button", className: "pw-btn", textContent: "Back to editing" });
  back.addEventListener("click", () => dlg.close());
  const lock = h("button", { type: "button", className: "pl-go", textContent: "Lock it in" });
  lock.addEventListener("click", lockIn);
  const resort = h("button", { type: "button", className: "pw-btn", textContent: "Sort again", title: "High to Low, quick first" });
  resort.addEventListener("click", () => setOrder(draftOrder(items())));
  dlg.replaceChildren(
    h("div", { className: "pw-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })), h("span", { className: "pw-title", textContent: pageDay === todayStr() ? "Draft day" : `Draft day: ${planDate(pageDay)}` }), h("span", { className: "pw-tools" }, resort)),
    h("div", { className: "dr-body" },
      h("section", { className: "dr-col" }, h("h3", { textContent: "The order" }), h("p", { className: "dr-hint", textContent: "High to Low, quick ones first. Drag to change it; Hanua fits them round your meetings in this order." }), h("ol", { className: "dr-list" }, rows)),
      h("section", { className: "dr-col" }, h("h3", { textContent: `${pageDay === todayStr() ? "The day" : planDate(pageDay)}, from ${fmt(startsAt())}` }), day,
        left.length ? h("div", { className: "dr-over" }, h("h4", { textContent: pageDay === todayStr() ? "Won't fit today" : "Won't fit that day" }), h("ul", {}, left.map((t) => h("li", { textContent: t })))) : null)),
    h("div", { className: "dr-foot" }, h("span", { className: "dr-sum", textContent: `${blocks.filter((b) => b.kind === "task").length} planned${left.length ? ` · ${left.length} won't fit` : ""}` }), back, lock));
}

// Drag a row up or down: a line shows where it'll go; dropping re-plans the day
const dragRow = (e, row, ref) => dragRows(e, row, ".dr-row", order.indexOf(ref), (to) => setOrder(moveInOrder(order, ref, to), ref));
// any list of rows (sel) dragged by pointer: a line shows where it'll go; onDrop(index among the others)
export function dragRows(e, row, sel, from, onDrop) {
  if (e.button !== 0 || e.target.closest("button")) return;
  const list = row.parentElement, sy = e.clientY;
  let moving = false, to = from;
  const rows = () => [...list.querySelectorAll(sel)];
  const move = (ev) => {
    if (!moving) { if (Math.abs(ev.clientY - sy) < 5) return; moving = true; row.classList.add("dragging"); }
    row.style.transform = `translateY(${ev.clientY - sy}px)`;
    const others = rows().filter((r) => r !== row);
    to = others.findIndex((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if (to < 0) to = others.length;
    others.forEach((r, i) => r.classList.toggle("drop-before", i === to));
    list.classList.toggle("drop-end", to === others.length);
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!moving) return;
    onDrop(to);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}

function lockIn() {
  const p = plan();
  keepPlan(desk, p); // each plan kept (step 3), and this one is the day's
  desk.order = order; desk.locked = true;
  save();
  dlg.close();
  const n = p.blocks.filter((b) => b.kind === "task").length, blocks = `${n} block${n === 1 ? "" : "s"}`;
  if (pageDay !== todayStr()) {
    // a day ahead: the page stays open on that day; Up next shows it when swiped to, and on the morning it's today's
    renderTodo(); renderAgenda();
    toast(`${planDate(pageDay)} locked in: ${blocks}${p.overflow.length ? ` · ${p.overflow.length} won't fit` : ""}. It'll be in Up next ${dayName(pageDay) === "tomorrow" ? "tomorrow" : "on the day"}.`);
    return;
  }
  if ($("plan-day").open) $("plan-day").close();
  renderTodo(); renderAgenda(); openTxt();
  toast(`Locked in: ${blocks} in Up next${p.overflow.length ? ` · ${p.overflow.length} won't fit today` : ""}.`);
}
