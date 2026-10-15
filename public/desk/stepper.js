// The Journal's focus window (Mel, 16 Oct 2026; brief docs/plans/2026-10-journal-tiles.md), shared by Brain dump and
// Work reflection: wide and centred over a blurred room (the .focus-layer in index.html, not a modal dialog, so a
// toast's Undo can still be clicked), a tile per question that slides in on Next / Back, a line of dots along the top
// (one per question; click one to go there), and Review last. ⌘↵ Next, ⌘⇧↵ Back; a sideways swipe on a phone.
// The rules for where you are live in public/shared/steps.js.
import { dotsOf, nextStep, backStep, reviewAt, slideOf, stepLabel } from "../shared/steps.js";
import { h, reducedMotion } from "../lib.js";
import { iconButton } from "./icons.js";

const last = new WeakMap(); // win → the stop shown last time (for the slide's direction)

// One focus window at a time: opening one closes the other (its draft kept by its own hide)
const focusWins = new Map(); // win → hide()
export function registerFocus(win, hide) { focusWins.set(win, hide); }
export function takeFocus(win) { for (const [w, hide] of focusWins) if (w !== win && !w.hidden) hide(); }

// The progress line: steps [{ label, group?, done }], at: the current stop
export function progressEl(steps, at, go) {
  const n = steps.length, states = dotsOf(steps.map((s) => s.done), at);
  const groups = [...new Set(steps.map((s) => s.group).filter(Boolean))];
  const dot = (s, i) => {
    const b = h("button", { type: "button", className: `jf-dot ${states[i]}`, title: s.label, ariaLabel: `${i + 1}: ${s.label}${s.done ? " (written)" : ""}` });
    if (i === at) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => go(i));
    return b;
  };
  const review = h("button", { type: "button", className: `jf-dot jf-review${at === reviewAt(n) ? " current" : ""}`, title: "Review", ariaLabel: "Review: every answer, and Save", textContent: "✓" });
  if (at === reviewAt(n)) review.setAttribute("aria-current", "step");
  review.addEventListener("click", () => go(reviewAt(n)));
  // with groups (Where I'm at / Where I'm heading) the dots sit under their group's name
  const line = groups.length
    ? h("div", { className: "jf-line" }, ...groups.map((g) => h("div", { className: "jf-group" }, h("span", { className: "jf-group-name", textContent: g }),
        h("div", { className: "jf-dots" }, ...steps.map((s, i) => (s.group === g ? dot(s, i) : null)).filter(Boolean)))), h("div", { className: "jf-group" }, h("span", { className: "jf-group-name", textContent: " " }), h("div", { className: "jf-dots" }, review)))
    : h("div", { className: "jf-line" }, h("div", { className: "jf-dots" }, ...steps.map(dot), review));
  return h("nav", { className: "jf-progress", ariaLabel: "Questions" }, line, h("span", { className: "jf-count", textContent: stepLabel(at, n) }));
}
// Mark a dot written (or not) as Mel types, without drawing the window again
export function markDot(win, i, done) {
  const d = win.querySelectorAll(".jf-dots .jf-dot:not(.jf-review)")[i];
  if (d && !d.classList.contains("current")) { d.classList.toggle("done", done); d.classList.toggle("todo", !done); }
}

// The stage: the current tile, sliding in from the side it came from
export function stageEl(win, at, tile) {
  const way = slideOf(last.get(win), at);
  last.set(win, at);
  const t = h("div", { className: `jf-tile${!reducedMotion && way !== "none" ? ` slide-${way}` : ""}` }, tile);
  return h("div", { className: "jf-stage" }, t);
}
export const forget = (win) => last.delete(win); // a fresh page opens without a slide

// Back and Next (Review on the last question); extra: buttons that sit between them (Save, Reflect…)
export function navEl(at, n, go, { status = null, extra = [] } = {}) {
  const back = iconButton(h, "back", "Back: the question before (⌘⇧↵)", { className: "set-reset jf-back", disabled: at === 0 });
  back.addEventListener("click", () => go(backStep(at, n)));
  const onReview = at === reviewAt(n);
  const next = onReview ? null : iconButton(h, at === n - 1 ? "check" : "next", at === n - 1 ? "Review: every answer, and Save (⌘↵)" : "Next question (⌘↵)", { className: "pl-go jf-next" });
  next?.addEventListener("click", () => go(nextStep(at, n)));
  return h("footer", { className: "jn-foot jf-foot" }, back, status, ...extra, next);
}

// keys and a swipe, once per window: ⌘↵ Next, ⌘⇧↵ Back (Enter alone is a new line in the box)
export function stepKeys(win, { at, n, go }) {
  win.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
    e.preventDefault(); e.stopPropagation();
    go(e.shiftKey ? backStep(at(), n()) : nextStep(at(), n()));
  });
  let start = null;
  win.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && e.target.closest(".jf-stage")) start = { x: e.clientX, y: e.clientY }; });
  win.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? nextStep(at(), n()) : backStep(at(), n()));
  });
}
