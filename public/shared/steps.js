// One question at a time (Mel, 16 Oct 2026; brief docs/plans/2026-10-journal-tiles.md): the Journal's Brain dump and
// Work reflection show a tile per question, Next and Back between them, a dot per question along the top, and a last
// stop, Review, with every answer and Save. These are the rules for where you are; shared by the page and the tests.

// n questions make n + 1 stops: 0 … n-1 are the questions, n is Review
export const reviewAt = (n) => n;
export const clampStep = (i, n) => Math.max(0, Math.min(reviewAt(n), Number.isInteger(i) ? i : 0));
export const nextStep = (i, n) => clampStep(i + 1, n);
export const backStep = (i, n) => clampStep(i - 1, n);
export const stepLabel = (i, n) => (i >= reviewAt(n) ? "Review" : `${i + 1} of ${n}`);
// Where a page opens: where Mel left off (the draft remembers), else Review for one with saved words (she sees it
// all, then taps one to change it), else the first question
export function startStep({ n, kept = null, saved = false }) {
  if (Number.isInteger(kept)) return clampStep(kept, n);
  return saved ? reviewAt(n) : 0;
}
// the dots: done (something written), current, or still to come
export const dotsOf = (done, at) => done.map((d, i) => (i === at ? "current" : d ? "done" : "todo"));
// which way the tile slides: forward from the right, back from the left (none for the first one shown)
export const slideOf = (from, to) => (from === null || from === undefined || from === to ? "none" : to > from ? "next" : "back");
