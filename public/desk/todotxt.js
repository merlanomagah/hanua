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
import { addLineTo, isFixed, kidsOf, planDate, sameName, setLines, shorterCol, stampLine, timeLabel, tidyGroups, MAX_NAME, MAX_SECTIONS, TIME_PICKS, MAX_LINES } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { changeDay, desk, deskDay, fixed, newId, refInfo, save } from "./state.js";
import { check, dayName, delButton, foldSubtasks, openDay, PRI_LABEL, renderPlanWidget, renderTodo, subtasksFolded } from "./page.js";
import { closeDayPicker, openDayPicker } from "./daypick.js";
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
const hide = () => { txt.hidden = true; adding = null; under = null; addWhen = null; naming = null; closeDayPicker(); noteClosed("todo-txt"); };
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
  setLines(desk, [ref], { done: !info.obj.done }); // a task ticks its subtasks; the last subtask ticks its task
  save(); renderTodo(); renderAgenda(); renderPlanWidget();
  // ticked: it slides into Completed, so say where it went and offer it back
  if (info.obj.done) toast(`Done: ${info.obj.text}`, false, { label: "Undo", run: () => { if (refInfo(ref)?.obj.done) toggleRef(ref); } });
}

let adding = null; // the section (id) a task is being added to, or null
let addWhen = null; // the day the add row adds to (null: today); kept while the row is open (8 Oct 2026)
let under = null; // the task a subtask is being added to (with adding = its section), or null
let naming = null; // a section being named or renamed here: { id } (null: none), "new" for + New section
export function renderTxt() {
  if (txt.hidden) return;
  freshFolds();
  // the day's tasks as families (8 Oct 2026): a task and its subtasks, in the page's order (at work: only Work
  // sections). An open task shows its subtasks under it (ticked ones struck through); a ticked task goes to Completed
  // with its subtasks. "n to go" counts what's really left: a task's open subtasks, or the task itself.
  const secs = desk.sections.filter((x) => !focus.on || x.work);
  const fams = secs.flatMap((sec) => sec.lines.filter((l) => l.text && !l.parent).map((l) => ({ top: l, kids: kidsOf(sec.lines, l.id), sec })));
  const openF = fams.filter((f) => !f.top.done), doneF = fams.filter((f) => f.top.done);
  const left = (f) => (f.kids.length ? f.kids.filter((k) => !k.done).length : 1);
  const toGo = openF.reduce((n, f) => n + left(f), 0);
  const row = (l, sec, { sub = false, kids = [], folded = false, canAdd = false } = {}) => {
    const done = l.done;
    const tick = check(done, `Mark ${l.text} ${done ? "not done" : "done"}`);
    tick.addEventListener("click", () => toggleRef(l.id));
    const chip = kids.length ? h("button", { type: "button", className: `pl-chip txt-chip${kids.every((k) => k.done) ? " all" : ""}`, ariaExpanded: String(!folded),
      textContent: `${kids.filter((k) => k.done).length} of ${kids.length} ${kids.every((k) => k.done) ? "✓" : folded ? "▸" : "▾"}`, title: folded ? "Show its subtasks" : "Fold its subtasks away" }) : null;
    chip?.addEventListener("click", () => { foldSubtasks(l.id, deskDay); renderTxt(); });
    const plus = canAdd ? h("button", { type: "button", className: "txt-plus txt-subplus", textContent: "+", ariaLabel: `Add a subtask to ${l.text}`, title: "Add a subtask" }) : null;
    plus?.addEventListener("click", () => { adding = sec.id; under = l.id; addWhen = null; renderTxt(); txt.querySelector(".txt-add .shop-add")?.focus(); });
    return h("li", { className: `txt-line${done ? " done" : ""}${sub ? " sub" : ""}` }, delButton(desk, l), tick,
      h("i", { className: `txt-pri p-${l.pri || "none"}`, title: PRI_LABEL[l.pri || ""] }), h("span", { className: "txt-text", textContent: l.text }), chip, plus);
  };
  const famEl = (f, { canAdd = true } = {}) => {
    const folded = f.kids.length > 0 && subtasksFolded(f.top.id, deskDay) && under !== f.top.id;
    return [row(f.top, f.sec, { kids: f.kids, folded, canAdd: canAdd && !f.top.done }),
      ...(folded ? [] : f.kids.map((k) => row(k, f.sec, { sub: true }))),
      under === f.top.id && adding === f.sec.id ? h("li", { className: "txt-subadd" }, addTaskEl(f.sec, f.top)) : null];
  };
  // a header that folds what's under it: the name on the left, the count and ▸ on the right
  const foldHead = (label, count, folded, onFold, cls = "") => {
    const b = h("button", { type: "button", className: `txt-fold${cls}`, ariaExpanded: String(!folded) },
      h("span", { className: "tf-name", textContent: label }), h("span", { className: "tf-count", textContent: count }), h("i", { className: "tf-tri", ariaHidden: "true" }));
    b.addEventListener("click", onFold);
    return b;
  };
  // every section of the day (at work: the Work ones), so a task can be added even to one that's empty so far
  const sections = secs.map((sec) => {
    const name = sec.name || "General";
    const mine = openF.filter((f) => f.sec === sec), had = fams.some((f) => f.sec === sec);
    const n = mine.reduce((k, f) => k + left(f), 0);
    const folded = isFolded(name) && adding !== sec.id;
    const count = !mine.length ? (had ? "all done ✓" : "") : folded ? `${n} left` : String(n);
    const plus = h("button", { type: "button", className: `txt-plus${adding === sec.id && !under ? " on" : ""}`, textContent: "+", ariaLabel: `Add a task to ${name}`, title: `Add a task to ${name}`, ariaExpanded: String(adding === sec.id && !under) });
    plus.addEventListener("click", () => { adding = adding === sec.id && !under ? null : sec.id; under = null; addWhen = null; renderTxt(); (adding ? txt.querySelector(".txt-add .shop-add") : txt.querySelector(`.txt-group[data-sec="${sec.id}"] .txt-plus`))?.focus(); });
    // its own sections (not General or a fixed one) can be renamed here (double-click the name), and taken away when
    // nothing's in them (8 Oct 2026); fixed ones are Desk Settings' to change
    const own = !isFixed(sec, fixed), empty = !sec.lines.some((l) => l.text);
    const del = own && empty ? h("button", { type: "button", className: "txt-plus txt-del", textContent: "×", ariaLabel: `Take away ${name}`, title: `Take away ${name} (it's empty)` }) : null;
    del?.addEventListener("click", () => removeSection(sec));
    const head = naming?.id === sec.id ? nameEl(sec) : foldHead(name, count, folded, () => fold(name));
    if (own && naming?.id !== sec.id) head.addEventListener("dblclick", (e) => { e.preventDefault(); naming = { id: sec.id }; renderTxt(); });
    if (own && naming?.id !== sec.id) head.title = "Double-click to rename";
    const group = h("section", { className: `txt-group${folded ? " folded" : ""}${mine.length ? "" : " empty"}${had ? "" : " blank"}` },
      h("div", { className: "txt-ghead" }, head, del, plus),
      folded || !mine.length ? null : h("ul", { className: "txt-list" }, mine.flatMap((f) => famEl(f))),
      adding === sec.id && !under ? addTaskEl(sec) : null);
    group.dataset.sec = sec.id;
    return group;
  });
  const completed = doneF.length ? h("section", { className: `txt-group txt-completed${folds.completed ? "" : " folded"}` },
    foldHead("Completed", String(doneF.length), !folds.completed, () => { folds.completed = !folds.completed; keepFolds(); renderTxt(); }, " tf-done"),
    folds.completed ? h("ul", { className: "txt-list" }, doneF.flatMap((f) => famEl(f, { canAdd: false }))) : null) : null;

  const bar = windowBar(txt, "To-do.txt", [], () => { hide(); $("open-txt").focus({ preventScroll: true }); });
  // the header: never scrolls with the list
  const head = h("header", { className: "txt-head" },
    h("span", { className: "th-day", textContent: planDate(deskDay) }),
    h("time", { className: "th-time", textContent: clockNow() }),
    h("span", { className: "th-left", textContent: fams.length ? (toGo ? `${toGo} to go` : "All done today ✓") : "" }));
  // + New section, at the foot of the list (before Completed): name it, Enter, then its first task (8 Oct 2026)
  const newSec = naming === "new" ? h("div", { className: "txt-group" }, h("div", { className: "txt-ghead" }, nameEl(null)))
    : desk.sections.length < MAX_SECTIONS ? (() => { const b = h("button", { type: "button", className: "txt-newsec", textContent: "+ New section" }); b.addEventListener("click", () => { naming = "new"; adding = null; renderTxt(); }); return b; })() : null;
  const body = h("div", { className: "txt-body", tabIndex: -1 },
    ...sections, newSec, completed,
    !fams.length ? h("p", { className: "txt-empty", textContent: focus.on && !secs.length ? "No Work sections today." : "Nothing on the list yet: hover a section's name and press +, or open Plan my day." } ) : null);
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

// Naming a section here: a new one (sec null) or renaming one of Mel's own. Enter keeps it, Esc (or clicking away while
// empty) lets go. A new one opens its add row straight away.
function nameEl(sec) {
  const field = h("input", { type: "text", className: "shop-add txt-name", value: sec?.name || "", placeholder: "Section name, then Enter", ariaLabel: sec ? `Rename ${sec.name}` : "New section's name", maxLength: MAX_NAME, autocomplete: "off" });
  const done = () => {
    const v = field.value.trim();
    if (!v) { naming = null; renderTxt(); return; }
    if (desk.sections.some((x) => x !== sec && sameName(x.name || "General", v))) { toast(`There's already a ${v} section`); field.select(); return; }
    if (sec) {
      const was = sec.name;
      if (was === v) { naming = null; renderTxt(); return; }
      sec.name = v; naming = null; save(); renderTodo(); renderTxt();
      toast(`Renamed to ${v}`, false, { label: "Undo", run: () => { sec.name = was; save(); renderTodo(); renderTxt(); } });
      return;
    }
    const made = { id: `s${newId()}`, name: v, col: shorterCol(desk.sections), work: focus.on, lines: [] }; // at work: a Work section
    desk.sections.push(made); naming = null; adding = made.id; addWhen = null;
    save(); renderTodo(); renderTxt();
    txt.querySelector(".txt-add .shop-add")?.focus();
    toast(`${v} added`, false, { label: "Undo", run: () => { desk.sections = desk.sections.filter((x) => x !== made || x.lines.some((l) => l.text)); if (adding === made.id) adding = null; save(); renderTodo(); renderTxt(); } });
  };
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); done(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); naming = null; renderTxt(); }
  });
  field.addEventListener("blur", () => setTimeout(() => { if (naming && !txt.contains(document.activeElement)) { if (field.value.trim() && field.value.trim() !== (sec?.name || "")) done(); else { naming = null; renderTxt(); } } }, 0));
  setTimeout(() => { field.focus(); field.select(); });
  return field;
}
// An empty section of Mel's own, taken away (Undo puts it back where it was)
function removeSection(sec) {
  const at = desk.sections.indexOf(sec);
  if (at < 0 || sec.lines.some((l) => l.text)) return;
  desk.sections.splice(at, 1);
  if (adding === sec.id) adding = null;
  save(); renderTodo(); renderTxt();
  toast(`${sec.name || "Section"} taken away`, false, { label: "Undo", run: () => { desk.sections.splice(Math.min(at, desk.sections.length), 0, sec); save(); renderTodo(); renderTxt(); } });
}

// Add a task to a section (Mel, 6 Oct 2026, evening): what, priority and time, under the section's last line; Enter
// adds it and the row waits for the next one; Esc (or the + again) puts it away. On a locked-in day it isn't in Up next
// until it's placed: the toast offers the draft day with it picked out.
// top: the task a subtask goes under (8 Oct 2026); it goes after that task's last subtask, and only today
function addTaskEl(sec, top = null) {
  const text = h("input", { type: "text", className: "shop-add", placeholder: top ? `Add a subtask to ${top.text}…` : `Add to ${sec.name || "General"}…`, ariaLabel: top ? `New subtask of ${top.text}` : `New task in ${sec.name || "General"}`, maxLength: 200, autocomplete: "off" });
  const pri = h("select", { className: "at-pick", ariaLabel: "Priority" }, ["h", "m", "l"].map((v) => h("option", { value: v, textContent: PRI_LABEL[v], selected: v === "m" })));
  const mins = h("select", { className: "at-pick", ariaLabel: "Roughly how long" }, TIME_PICKS.map((m) => h("option", { value: String(m), textContent: timeLabel(m), selected: m === 30 })));
  const go = h("button", { type: "button", className: "pl-go", textContent: "Add" });
  // When (8 Oct 2026): today unless another day is picked; that day's page gets it, this list stays as it is
  const whenText = () => (addWhen && addWhen !== deskDay ? dayName(addWhen).replace(/^./, (c) => c.toUpperCase()) : "Today");
  const when = h("button", { type: "button", className: `at-pick at-when${addWhen && addWhen !== deskDay ? " on" : ""}`, textContent: whenText(), ariaLabel: `Add it to: ${whenText()}`, title: "Which day" });
  when.addEventListener("click", () => openDayPicker(when, { current: addWhen || deskDay, title: "Add it to", onPick: (day) => { addWhen = day === deskDay ? null : day; renderTxt(); txt.querySelector(".txt-add .shop-add")?.focus(); } }));
  when.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  const add = () => {
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    if (!top && addWhen && addWhen !== deskDay) return addAhead(t);
    const target = desk.sections.find((x) => x.id === sec.id);
    if (!target) { adding = null; renderTxt(); return; }
    while (target.lines.length && !target.lines.at(-1).text) target.lines.pop();
    if (target.lines.length >= MAX_LINES) { toast(`${target.name || "General"} is full`); return; }
    const line = stampLine({ id: newId(), text: t, done: false, pri: pri.value, mins: Number(mins.value) });
    if (top && target.lines.some((l) => l.id === top.id)) { // after the task's last subtask
      const at = target.lines.reduce((k, l, j) => (l.id === top.id || l.parent === top.id ? j : k), -1) + 1;
      target.lines.splice(at, 0, { ...line, parent: top.id }); line.parent = top.id;
      tidyGroups(target.lines);
    } else target.lines.push(line); // at the bottom of the section
    text.value = ""; // first: the redraws below copy whatever's still in the field into the new row (7 Oct 2026)
    save(); renderTodo(); renderAgenda();
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
  // on another day: written onto that day's page (under a section of the same name), with Undo and Open that day
  const addAhead = async (t) => {
    const day = addWhen, secName = sec.name || "General";
    const line = stampLine({ id: newId(), text: t, done: false, pri: pri.value, mins: Number(mins.value), from: deskDay });
    text.value = "";
    let placed = null;
    const ok = await changeDay(day, (d) => { addLineTo(d, secName, sec.work, line, newId); placed = line.id; });
    if (!ok) { text.value = t; toast(`Couldn't add it to ${dayName(day)} just now: nothing was added.`, true); return; }
    renderTxt(); txt.querySelector(".txt-add .shop-add")?.focus();
    toast(`Added to ${dayName(day)} · ${secName}`, false, [
      { label: "Open that day", run: () => openDay(day) },
      { label: "Undo", run: () => changeDay(day, (d) => { for (const x of d.sections) x.lines = x.lines.filter((l) => l.id !== placed); }) },
    ]);
  };
  const panel = h("div", { className: "txt-add" }, text, h("div", { className: "at-row" }, pri, mins, top ? null : when, go));
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    adding = null; under = null; addWhen = null; closeDayPicker(); renderTxt(); txt.querySelector(`.txt-group[data-sec="${sec.id}"] .txt-plus`)?.focus();
  });
  return panel;
}
// a click anywhere else (the desktop, another window, a line) puts an empty add row away; one with words in it stays,
// so nothing typed is lost (Esc or the + still close it)
document.addEventListener("pointerdown", (e) => {
  if (!adding || txt.hidden) return;
  const row = txt.querySelector(".txt-add");
  if (!row || row.contains(e.target) || e.target.closest?.(".txt-plus, .dp")) return;
  if (row.querySelector(".shop-add")?.value.trim()) return;
  adding = null; under = null; addWhen = null; renderTxt();
}, true);
