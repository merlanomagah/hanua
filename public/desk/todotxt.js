// To-do.txt: the day's list to tick off in any order (ticked → out of Up next). Just the list, under each section's
// header, with its priority dot: the times live in Up next (Mel, 6 Oct 2026: the time column repeated the agenda).
// A window like the others (window.js): drag, resize, minimise, remembered; opened by its desktop file, Plan my day's
// title bar, Up next, and the first visit to the desk once the day is planned.
import { openItems, planDate, stampLine } from "../shared/desk.js";
import { $, focus, h } from "../lib.js";
import { desk, deskDay, refInfo, save } from "./state.js";
import { check, PRI_LABEL, renderPlanWidget, renderTodo } from "./page.js";
import { renderAgenda } from "./agenda.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";

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
const hide = () => { txt.hidden = true; noteClosed("todo-txt"); };
registerWindow("todo-txt", { title: "To-do.txt", icon: ICON, show, hide, shown: () => !txt.hidden });
export function openTxt() { show(); noteOpen("todo-txt"); }

function toggleRef(ref) {
  const info = refInfo(ref);
  if (!info?.obj.text) return;
  info.obj.done = !info.obj.done;
  stampLine(info.obj);
  save(); renderTodo(); renderAgenda(); renderPlanWidget();
}
export function renderTxt() {
  if (txt.hidden) return;
  // every written line, ticked or not, in the page's order (at work: only Work sections)
  const all = openItems({ ...desk, sections: desk.sections.map((x) => ({ ...x, lines: x.lines.map((l) => ({ ...l, done: false })) })) }, focus.on);
  const row = (ref) => {
    const info = refInfo(ref);
    if (!info?.obj.text) return null;
    const done = info.obj.done;
    const tick = check(done, `Mark ${info.obj.text} ${done ? "not done" : "done"}`);
    tick.addEventListener("click", () => toggleRef(ref));
    return h("li", { className: `txt-line${done ? " done" : ""}` }, tick,
      h("i", { className: `txt-pri p-${info.obj.pri || "none"}`, title: PRI_LABEL[info.obj.pri || ""] }), h("span", { className: "txt-text", textContent: info.obj.text }));
  };
  const sections = [...new Set(all.map((x) => x.section || "General"))];
  const left = all.filter((x) => !refInfo(x.ref)?.obj.done).length;
  const bar = windowBar(txt, "To-do.txt", [h("span", { textContent: planDate(deskDay) })], () => { hide(); $("open-txt").focus({ preventScroll: true }); });
  const body = h("div", { className: "txt-body", tabIndex: -1 },
    all.length ? h("p", { className: "txt-count", textContent: left ? `${left} to go` : "All done today ✓" }) : null,
    ...sections.flatMap((name) => [h("h4", { textContent: name }), h("ul", { className: "txt-list" }, all.filter((x) => (x.section || "General") === name).map((x) => row(x.ref)))]),
    !all.length ? h("p", { className: "txt-empty", textContent: focus.on ? "No Work tasks today." : "Nothing on the list yet: open Plan my day." }) : null);
  txt.replaceChildren(bar, body);
}
