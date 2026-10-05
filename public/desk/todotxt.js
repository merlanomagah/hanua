// To-do.txt: the day's list in plan order, a small window to tick off in any order (ticked → out of the agenda)
import { openItems, planDate, stampLine } from "../shared/desk.js";
import { $, focus, h } from "../lib.js";
import { desk, deskDay, refInfo, save } from "./state.js";
import { check, PRI_LABEL, renderPlanWidget, renderTodo } from "./page.js";
import { renderAgenda } from "./agenda.js";

// ---- To-do.txt: the day's list, in plan order, to tick off in any order (ticked → out of the time-blocked agenda) ----
const txt = $("todo-txt");
let txtPos = null;
try { txtPos = JSON.parse(localStorage.getItem("todo-txt-pos") || "null"); } catch { txtPos = null; }
export function openTxt() {
  txt.hidden = false;
  renderTxt();
  if (txtPos) { txt.style.left = `${txtPos.x}px`; txt.style.top = `${txtPos.y}px`; }
  txt.querySelector(".txt-body")?.focus({ preventScroll: true });
}
function toggleRef(ref) {
  const info = refInfo(ref);
  if (!info?.obj.text) return;
  info.obj.done = !info.obj.done;
  stampLine(info.obj);
  save(); renderTodo(); renderAgenda(); renderPlanWidget();
}
export function renderTxt() {
  if (txt.hidden) return;
  const all = openItems({ ...desk, sections: desk.sections.map((x) => ({ ...x, lines: x.lines.map((l) => ({ ...l, done: false })) })) }, focus.on);
  const byRef = new Map(all.map((x) => [x.ref, x]));
  const row = (ref, time, tag = true) => {
    const info = refInfo(ref);
    if (!info?.obj.text) return null;
    const done = info.obj.done;
    const tick = check(done, `Mark ${info.obj.text} ${done ? "not done" : "done"}`);
    tick.addEventListener("click", () => toggleRef(ref));
    return h("li", { className: `txt-line${done ? " done" : ""}` }, tick, h("span", { className: "txt-time", textContent: time || "" }),
      h("i", { className: `txt-pri p-${info.obj.pri || "none"}`, title: PRI_LABEL[info.obj.pri || ""] }), h("span", { className: "txt-text", textContent: info.obj.text }),
      tag ? h("span", { className: "txt-sec", textContent: info.where }) : null);
  };
  const planned = desk.blocks.filter((b) => b.kind === "task" && byRef.has(b.ref));
  const plannedRefs = new Set(planned.map((b) => b.ref));
  const over = desk.overflow.filter((r) => byRef.has(r) && !plannedRefs.has(r));
  const rest = all.filter((x) => !plannedRefs.has(x.ref) && !over.includes(x.ref));
  const group = (title, rows) => (rows.filter(Boolean).length ? [title ? h("h4", { textContent: title }) : null, h("ul", { className: "txt-list" }, rows)] : []);
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Close To-do.txt", title: "Close" });
  close.addEventListener("click", () => { txt.hidden = true; $("open-plan").focus({ preventScroll: true }); });
  const bar = h("div", { className: "pw-bar txt-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
    h("span", { className: "pw-title", textContent: "To-do.txt" }), h("span", { className: "pw-tools txt-date", textContent: planDate(deskDay) }));
  const body = h("div", { className: "txt-body", tabIndex: -1 },
    ...group(planned.length ? "The plan" : "", planned.map((b) => row(b.ref, b.start))),
    ...group("Didn't fit today", over.map((r) => row(r))),
    // what isn't time-blocked sits under its own section's header, as on the page (Mel, 6 Oct 2026)
    ...(rest.length && planned.length ? [h("h3", { className: "txt-part", textContent: "Not planned yet" })] : []),
    ...[...new Set(rest.map((x) => x.section || "General"))].flatMap((name) => group(name, rest.filter((x) => (x.section || "General") === name).map((x) => row(x.ref, "", false)))),
    !all.length ? h("p", { className: "txt-empty", textContent: focus.on ? "No Work tasks today." : "Nothing on the list yet: open Plan my day." } ) : null,
    all.length && !planned.length ? h("p", { className: "txt-empty", textContent: "Press Save & plan in Plan my day to time-block these." }) : null);
  txt.replaceChildren(bar, body);
  // drag it by the title bar, like a window
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const box = txt.getBoundingClientRect(), host = txt.offsetParent.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(host.width - box.width, ev.clientX - host.left - dx)), y = Math.max(0, Math.min(host.height - 60, ev.clientY - host.top - dy));
      txt.style.left = `${x}px`; txt.style.top = `${y}px`; txtPos = { x: Math.round(x), y: Math.round(y) };
    };
    const up = () => { bar.removeEventListener("pointermove", move); try { localStorage.setItem("todo-txt-pos", JSON.stringify(txtPos)); } catch { /* fine */ } };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up, { once: true });
  });
}

