// Up next: the agenda as a desktop widget, today's time-blocks among the calendar's events; swipe (or ‹ ›) through the days
import { fromMin, minsText, removeMeeting, stepDay, toMin, DEFAULT_MINS, MAX_MEETINGS, MEETING_PICKS } from "../shared/desk.js";
import { dayOf, parseDay, timeOf, todayStr } from "../shared/dates.js";
import { $, focus, h, longDate, reducedMotion, toast } from "../lib.js";
import { openGoal } from "../goals/form.js";
import { bookEl, calendarItems, ensureApple, openBook, openInCalendar, ROLE, sortByTime } from "../app.js";
import { desk, deskDay, newId, refInfo, save } from "./state.js";
import { renderTodo, undoable } from "./page.js";
import { openDraft } from "./draft.js";
import { openTxt } from "./todotxt.js";

// the plan as agenda entries for Up next (today only): blocks still to do, breaks, and the jotted meetings
export function planEntries(day) {
  if (day !== deskDay) return [];
  const busy = (work) => focus.on && !work;
  const out = [];
  for (const b of desk.blocks) {
    if (b.kind === "break") { out.push({ plan: "break", title: "Break", date: `${day}T${b.start}`, until: b.end }); continue; }
    const info = refInfo(b.ref);
    if (!info?.obj.text || info.obj.done) continue; // ticked off: out of the time-blocked agenda
    out.push({ plan: "task", title: busy(info.work) ? "Busy" : info.obj.text, busy: busy(info.work), date: `${day}T${b.start}`, until: b.end, pri: info.obj.pri });
  }
  for (const m of desk.meetings) if (m.time && m.title) out.push({ plan: "meet", meet: m.id, title: busy(m.work) ? "Busy" : m.title, busy: busy(m.work), date: `${day}T${m.time}`, until: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))) });
  return out;
}

// ---- meetings from Up next too (Mel, 6 Oct 2026, part G): + adds one today, clicking one changes or removes it.
// They're the same meetings as Plan my day's Meetings & events. A locked-in day offers to re-plan round the change.
let editing = null; // a meeting's id, "new", or null
function meetingForm(m) {
  const time = h("input", { type: "time", className: "pl-time", value: m?.time || "", ariaLabel: "Meeting time", step: 300, required: true });
  const title = h("input", { type: "text", className: "mt-title", value: m?.title || "", placeholder: "What", ariaLabel: "Meeting", maxLength: 200 });
  const len = h("select", { className: "pl-mins", ariaLabel: "How long" }, MEETING_PICKS.map((v) => h("option", { value: String(v), textContent: minsText(v), selected: (m?.mins || DEFAULT_MINS) === v })));
  const done = (changed) => {
    editing = null; save(); renderAgenda(); renderTodo();
    if (changed && desk.locked) toast("Your day's locked in: re-plan round this?", false, { label: "Re-plan", run: () => openDraft() });
  };
  const ok = h("button", { type: "button", className: "pl-go", textContent: m ? "Save" : "Add" });
  ok.addEventListener("click", () => {
    if (!time.value || !title.value.trim()) { (time.value ? title : time).focus(); return; }
    const x = m || { id: newId(), work: focus.on };
    Object.assign(x, { time: time.value, title: title.value.trim(), mins: Number(len.value) });
    if (!m) { if (desk.meetings.length >= MAX_MEETINGS) { toast("That's the most meetings a day can hold"); return; } desk.meetings.push(x); }
    done(true);
  });
  const del = m ? h("button", { type: "button", className: "mt-del", textContent: "Remove" }) : null;
  del?.addEventListener("click", () => { editing = null; undoable(`Removed: ${m.title}`, () => removeMeeting(desk, m.id)); if (desk.locked) toast("Meeting removed. Re-plan round it?", false, { label: "Re-plan", run: () => openDraft() }); });
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
export function renderAgenda() {
  const today = todayStr();
  const key = padDay;
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
      const open = x.busy || x.plan === "break" ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.plan === "meet" ? "Change or remove this meeting" : "Open To-do.txt" }, ...inner);
      if (open.tagName === "BUTTON") open.addEventListener("click", () => { if (x.plan === "meet") { editing = x.meet; renderAgenda(); } else openTxt(); });
      list.append(h("li", { className: `slot plan-${x.plan}${t < nowHM && x.until <= nowHM ? " past" : ""}` }, h("time", { textContent: t }), open));
      continue;
    }
    const inner = [h("span", { className: "t", textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }), h("span", { className: "k", textContent: x.goal ? x.kind : x.busy ? "" : x.kind })];
    const open = x.busy ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.goal ? "Open the goal" : x.apple ? "Open in Calendar" : "Open in your book" }, ...inner);
    if (!x.busy) open.addEventListener("click", () => (x.goal ? openGoal(x.goal) : x.apple ? openInCalendar(x) : openBook(x.kind === "Due" ? ROLE.tasks : ROLE.events, bookEl(x.kind === "Due" ? ROLE.tasks : ROLE.events), x.id)));
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
  const screen = h("div", { className: "ip-screen" },
    h("header", { className: "ip-head" }, nav("‹", -1),
      h("div", { className: "ip-title" }, h("h2", { textContent: word }), h("span", { className: "ip-date", textContent: longDate(parseDay(key), false) })),
      nav("›", 1)),
    rel ? h("div", { className: "ip-back" }, back) : null,
    h("div", { className: "ip-body" }, items.length || editing === "new" ? list : h("p", { className: "empty", textContent: key === today ? "No meetings today." : "Nothing on this day." })));
  $("agenda").replaceChildren(h("span", { className: "wg-label", textContent: "Up next" }), add, screen);
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
  if (e.target.closest("button, a") && e.target.closest(".ip-list")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); movePad(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); movePad(1); }
});

