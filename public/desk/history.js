// ⌘Z / ⇧⌘Z in Plan my day (Mel, 15 Oct 2026; brief docs/plans/2026-10-planner-keys-and-close-insights.md). The page
// redraws after most changes, which wipes Safari's own undo, so Hanua keeps a history of the page's day: every change
// that reaches state.js is heard here, typing in one box without a pause is one step (rules historyStep,
// recordChange, historyMove in shared/desk.js, tested). Memory only, this window only: it starts again when another
// day is shown, and when the day is read again (the other Mac's change, Use theirs), so ⌘Z never undoes the other Mac.
import { historyMove, historyStep, recordChange } from "../shared/desk.js";
import { dayRead, onDayChange, onDayRead, page, pageDay, restoreDay } from "./state.js";

let H = null; // { key, undo, redo, base, last }
// the box being typed in, for the length of one input event (a change heard then is typing)
let typingEl = null;
document.addEventListener("input", (e) => { typingEl = e.target; queueMicrotask(() => { typingEl = null; }); }, true);
const isText = (el) => el?.matches?.("textarea, input[type=text], input:not([type])");

const start = (key, data) => { H = { key, undo: [], redo: [], base: JSON.stringify(data), last: null }; };
// Plan my day draws the page's day: the history follows it (a new one for another day)
// Only once the day has really been read: a history begun on the empty page before the day arrived would make the
// first ⌘Z restore an empty day (16 Oct 2026, the wiped morning)
export function follow(key = pageDay, data = page) { if (!dayRead(key)) { if (H?.key === key) H = null; return; } if (H?.key !== key) start(key, data); }
// the day read again: start again from what's on the page now
onDayRead((key, data) => { if (!H || H.key === key) start(key, data); });
document.addEventListener("hanua:day-refreshed", () => { if (H) start(pageDay, page); });

onDayChange((key, data) => {
  if (H?.key !== key || !dayRead(key)) return;
  const now = { field: isText(typingEl) ? typingEl : null, at: Date.now() };
  recordChange(H, JSON.stringify(data), historyStep(H.last, now));
  H.last = now;
});

// one step back (or forward): true when the page's day changed (the caller redraws)
export function step(redo = false) {
  if (!H || H.key !== pageDay) return false;
  const json = historyMove(H, redo);
  if (json == null) return false;
  H.last = null;
  return restoreDay(H.key, json);
}
// a step of its own from here (Backspace after a Tab undoes just the Tab)
export const canUndo = () => Boolean(H?.key === pageDay && H.undo.length);
