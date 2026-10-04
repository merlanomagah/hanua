// Quick edit: change a goal's state or due date where it sits (a card, a Tree node, a Timeline row) without the
// full form. It's also the keyboard way to move a card between the Board's columns.
import { dayOf } from "../shared/dates.js";
import { LEVELS, levelIndex } from "../shared/goals.js";
import { h } from "../lib.js";
import { statusOptions } from "./store.js";
import { GOAL_STATUS, conflictNote, moveGoal } from "./board.js";
import { openGoal } from "./form.js";
import { openPlan } from "./plan.js";
import { setGoalDates } from "./timeline.js";
let quickFor = null, quickFrom = null;
const box = h("div", { className: "quick", role: "dialog", ariaLabel: "Quick edit", hidden: true });
document.body.append(box);

export function closeQuick(refocus = true) {
  if (box.hidden) return;
  box.hidden = true;
  if (refocus && quickFrom?.isConnected) quickFrom.focus({ preventScroll: true });
  quickFor = quickFrom = null;
}

export function openQuick(g, anchor) {
  if (quickFor === g.id && !box.hidden) return closeQuick();
  quickFor = g.id;
  quickFrom = anchor;
  const st = g.status || "New";
  const below = LEVELS[levelIndex(g.level) + 1];
  const due = h("input", { type: "date", value: dayOf(g.due || ""), ariaLabel: "Due date" });
  due.addEventListener("change", () => { closeQuick(); setGoalDates(g, { due: due.value }); });
  const act = (label, run) => { const b = h("button", { type: "button", className: "g-act", textContent: label }); b.addEventListener("click", () => { closeQuick(false); run(); }); return b; };
  const warn = conflictNote(g);
  box.replaceChildren(
    h("span", { className: "eyebrow", textContent: g.level || "Task" }),
    h("b", { className: "quick-title", textContent: g.title }),
    h("span", { className: "cp-label", textContent: "State" }),
    h("div", { className: "seg quick-states", role: "group", ariaLabel: "State" }, statusOptions(GOAL_STATUS).map((s) => {
      const b = h("button", { type: "button", textContent: s });
      b.setAttribute("aria-pressed", String(s === st));
      b.addEventListener("click", () => { closeQuick(); if (s !== st) moveGoal(g, s); });
      return b;
    })),
    h("span", { className: "cp-label", textContent: "Due" }),
    h("div", { className: "quick-due" }, due, g.due ? act("No date", () => setGoalDates(g, { due: "" })) : null),
    warn ? h("p", { className: "quick-warn", textContent: `⚠ ${warn}` }) : null,
    h("div", { className: "quick-acts" },
      act("Full edit", () => openGoal(g)),
      below ? act(`Plan ${below.plural}`, () => openPlan(g)) : null,
      g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null));
  box.hidden = false;
  // under the thing that opened it, kept on screen
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left), innerWidth - box.offsetWidth - 8);
  let top = r.bottom + 6;
  if (top + box.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - box.offsetHeight - 6);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  (box.querySelector('[aria-pressed="true"]') || box.querySelector("button")).focus({ preventScroll: true });
}

document.addEventListener("pointerdown", (e) => {
  if (!box.hidden && !box.contains(e.target) && e.target.closest?.("[data-act='quick']") !== quickFrom) closeQuick(false);
}, true);
box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeQuick(); } });
// it's placed on the screen, so a scroll would leave it behind
window.addEventListener("scroll", () => closeQuick(false), { passive: true });
document.addEventListener("scroll", (e) => { if (!box.contains(e.target)) closeQuick(false); }, { passive: true, capture: true });
