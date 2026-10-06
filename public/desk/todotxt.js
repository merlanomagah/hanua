// To-do.txt: the day's list to tick off in any order (ticked → out of Up next). Just the list, under each section's
// header, with its priority dot: the times live in Up next (Mel, 6 Oct 2026: the time column repeated the agenda).
// A window like the others (window.js): drag, resize, minimise, remembered; opened by its desktop file, Plan my day's
// title bar, Up next, and the first visit to the desk once the day is planned.
// Tidied the same evening (Mel): the day, date and time stay in a header that never scrolls; each section folds away
// (▸ on the right of its header, "3 left" when folded); a ticked line moves into Completed at the foot (folded unless
// opened), with Undo; unticking it there sends it back. What's folded is remembered for today only, so each morning
// starts with everything open. Later that evening (Mel): a + appears when you hover a section's header (the title
// bar's + went): type the task, pick its priority and time, Enter, and it's added at the bottom of that section; the
// row stays for the next one (Esc puts it away). Always today's list, whatever day Plan my day is showing.
import { openItems, planDate, stampLine, timeLabel, TIME_PICKS, MAX_LINES } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { desk, deskDay, newId, refInfo, save } from "./state.js";
import { check, PRI_LABEL, renderPlanWidget, renderTodo } from "./page.js";
import { renderAgenda } from "./agenda.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";
import { openDraft } from "./draft.js";

const txt = $("todo-txt");
const ready = resizable(txt);
const ICON = '<svg viewBox="0 0 48 60" aria-hidden="true" width="30"><path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M9 22l2 2 4-4M9 31l2 2 4-4M9 40l2 2 4-4" fill="none" stroke="#3f7a5a" stroke-width="2"/></svg>';
let placed = false;
function show() {
  txt.hidden = false;
  if (!placed) { restorePlace(txt); placed = true; ready(); }
  renderTxt();
  txt.querySelector(".txt-body")?.focus({ preventScroll: true });
}
const hide = () => { txt.hidden = true; adding = null; noteClosed("todo-txt"); };
registerWindow("todo-txt", { title: "To-do.txt", icon: ICON, show, hide, shown: () => !txt.hidden });
export function openTxt() { show(); noteOpen("todo-txt"); }

// ---- what's folded: today only (a view preference, kept in this browser) ----
const FOLDS = "todo-txt-folds";
let folds = { day: todayStr(), sections: [], completed: false };
try { const f = JSON.parse(localStorage.getItem(FOLDS) || "null"); if (f?.day === todayStr() && Array.isArray(f.sections)) folds = { ...folds, ...f }; } catch { /* a fresh day */ }
const keepFolds = () => { folds.day = todayStr(); try { localStorage.setItem(FOLDS, JSON.stringify(folds)); } catch { /* this visit only */ } };
const freshFolds = () => { if (folds.day !== todayStr()) folds = { day: todayStr(), sections: [], completed: false }; };
const isFolded = (name) => folds.sections.includes(name);
function fold(name) {
  folds.sections = isFolded(name) ? folds.sections.filter((x) => x !== name) : [...folds.sections, name];
  keepFolds(); renderTxt();
}

function toggleRef(ref) {
  const info = refInfo(ref);
  if (!info?.obj.text) return;
  info.obj.done = !info.obj.done;
  stampLine(info.obj);
  save(); renderTodo(); renderAgenda(); renderPlanWidget();
  // ticked: it slides into Completed, so say where it went and offer it back
  if (info.obj.done) toast(`Done: ${info.obj.text}`, false, { label: "Undo", run: () => { if (refInfo(ref)?.obj.done) toggleRef(ref); } });
}

let adding = null; // the section (id) a task is being added to, or null
export function renderTxt() {
  if (txt.hidden) return;
  freshFolds();
  // every written line, ticked or not, in the page's order (at work: only Work sections)
  const all = openItems({ ...desk, sections: desk.sections.map((x) => ({ ...x, lines: x.lines.map((l) => ({ ...l, done: false })) })) }, focus.on);
  const isDone = (x) => Boolean(refInfo(x.ref)?.obj.done);
  const row = (ref) => {
    const info = refInfo(ref);
    if (!info?.obj.text) return null;
    const done = info.obj.done;
    const tick = check(done, `Mark ${info.obj.text} ${done ? "not done" : "done"}`);
    tick.addEventListener("click", () => toggleRef(ref));
    return h("li", { className: `txt-line${done ? " done" : ""}` }, tick,
      h("i", { className: `txt-pri p-${info.obj.pri || "none"}`, title: PRI_LABEL[info.obj.pri || ""] }), h("span", { className: "txt-text", textContent: info.obj.text }));
  };
  // a header that folds what's under it: the name on the left, the count and ▸ on the right
  const foldHead = (label, count, folded, onFold, cls = "") => {
    const b = h("button", { type: "button", className: `txt-fold${cls}`, ariaExpanded: String(!folded) },
      h("span", { className: "tf-name", textContent: label }), h("span", { className: "tf-count", textContent: count }), h("i", { className: "tf-tri", ariaHidden: "true" }));
    b.addEventListener("click", onFold);
    return b;
  };
  // every section of the day (at work: the Work ones), so a task can be added even to one that's empty so far
  const secs = desk.sections.filter((x) => !focus.on || x.work);
  const open = all.filter((x) => !isDone(x)), done = all.filter(isDone);
  const sections = secs.map((sec) => {
    const name = sec.name || "General";
    const mine = open.filter((x) => (x.section || "General") === name), had = all.some((x) => (x.section || "General") === name);
    const folded = isFolded(name) && adding !== sec.id;
    const count = !mine.length ? (had ? "all done ✓" : "") : folded ? `${mine.length} left` : String(mine.length);
    const plus = h("button", { type: "button", className: `txt-plus${adding === sec.id ? " on" : ""}`, textContent: "+", ariaLabel: `Add a task to ${name}`, title: `Add a task to ${name}`, ariaExpanded: String(adding === sec.id) });
    plus.addEventListener("click", () => { adding = adding === sec.id ? null : sec.id; renderTxt(); (adding ? txt.querySelector(".txt-add .shop-add") : txt.querySelector(`.txt-group[data-sec="${sec.id}"] .txt-plus`))?.focus(); });
    const group = h("section", { className: `txt-group${folded ? " folded" : ""}${mine.length ? "" : " empty"}${had ? "" : " blank"}` },
      h("div", { className: "txt-ghead" }, foldHead(name, count, folded, () => fold(name)), plus),
      folded || !mine.length ? null : h("ul", { className: "txt-list" }, mine.map((x) => row(x.ref))),
      adding === sec.id ? addTaskEl(sec) : null);
    group.dataset.sec = sec.id;
    return group;
  });
  const completed = done.length ? h("section", { className: `txt-group txt-completed${folds.completed ? "" : " folded"}` },
    foldHead("Completed", String(done.length), !folds.completed, () => { folds.completed = !folds.completed; keepFolds(); renderTxt(); }, " tf-done"),
    folds.completed ? h("ul", { className: "txt-list" }, done.map((x) => row(x.ref))) : null) : null;

  const bar = windowBar(txt, "To-do.txt", [], () => { hide(); $("open-txt").focus({ preventScroll: true }); });
  // the header: never scrolls with the list
  const head = h("header", { className: "txt-head" },
    h("span", { className: "th-day", textContent: planDate(deskDay) }),
    h("time", { className: "th-time", textContent: clockNow() }),
    h("span", { className: "th-left", textContent: all.length ? (open.length ? `${open.length} to go` : "All done today ✓") : "" }));
  const body = h("div", { className: "txt-body", tabIndex: -1 },
    ...sections, completed,
    !all.length ? h("p", { className: "txt-empty", textContent: focus.on && !secs.length ? "No Work sections today." : "Nothing on the list yet: hover a section's name and press +, or open Plan my day." } ) : null);
  const scroll = txt.querySelector(".txt-body")?.scrollTop || 0;
  // keep what's being typed in the add row across a redraw (a tick, the other Mac)
  const typed = txt.querySelector(".txt-add .shop-add")?.value || "", typing = txt.querySelector(".txt-add")?.contains(document.activeElement);
  txt.replaceChildren(bar, head, body);
  body.scrollTop = scroll;
  const field = txt.querySelector(".txt-add .shop-add");
  if (field && typed) field.value = typed;
  if (field && typing) field.focus({ preventScroll: true });
}
const clockNow = () => new Date().toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
setInterval(() => { const t = txt.querySelector(".th-time"); if (t && !txt.hidden) t.textContent = clockNow(); }, 15_000);

// Add a task to a section (Mel, 6 Oct 2026, evening): what, priority and time, under the section's last line; Enter
// adds it and the row waits for the next one; Esc (or the + again) puts it away. On a locked-in day it isn't in Up next
// until it's placed: the toast offers the draft day with it picked out.
function addTaskEl(sec) {
  const text = h("input", { type: "text", className: "shop-add", placeholder: `Add to ${sec.name || "General"}…`, ariaLabel: `New task in ${sec.name || "General"}`, maxLength: 200, autocomplete: "off" });
  const pri = h("select", { className: "at-pick", ariaLabel: "Priority" }, ["h", "m", "l"].map((v) => h("option", { value: v, textContent: PRI_LABEL[v], selected: v === "m" })));
  const mins = h("select", { className: "at-pick", ariaLabel: "Roughly how long" }, TIME_PICKS.map((m) => h("option", { value: String(m), textContent: timeLabel(m), selected: m === 30 })));
  const go = h("button", { type: "button", className: "pl-go", textContent: "Add" });
  const add = () => {
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    const target = desk.sections.find((x) => x.id === sec.id);
    if (!target) { adding = null; renderTxt(); return; }
    while (target.lines.length && !target.lines.at(-1).text) target.lines.pop();
    if (target.lines.length >= MAX_LINES) { toast(`${target.name || "General"} is full`); return; }
    const line = stampLine({ id: newId(), text: t, done: false, pri: pri.value, mins: Number(mins.value) });
    target.lines.push(line); // at the bottom of the section
    save(); renderTodo(); renderAgenda();
    text.value = "";
    renderTxt();
    txt.querySelector(".txt-add .shop-add")?.focus();
    if (desk.locked) toast(`Added to ${target.name || "General"}. It's not in Up next yet.`, false, [
      { label: "Place it", run: () => openDraft(line.id, { today: true }) },
      { label: "Undo", run: () => { const s = desk.sections.find((x) => x.id === sec.id); if (s) s.lines = s.lines.filter((l) => l.id !== line.id); save(); renderTodo(); renderTxt(); } },
    ]);
    else toast(`Added to ${target.name || "General"}`, false, { label: "Undo", run: () => { const s = desk.sections.find((x) => x.id === sec.id); if (s) s.lines = s.lines.filter((l) => l.id !== line.id); save(); renderTodo(); renderTxt(); } });
  };
  go.addEventListener("click", add);
  text.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); add(); } });
  // Enter on the picks adds too, so text → Tab → priority → Tab → time → Enter works without the mouse
  for (const p of [pri, mins]) p.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  const panel = h("div", { className: "txt-add" }, text, h("div", { className: "at-row" }, pri, mins, go));
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    adding = null; renderTxt(); txt.querySelector(`.txt-group[data-sec="${sec.id}"] .txt-plus`)?.focus();
  });
  return panel;
}
