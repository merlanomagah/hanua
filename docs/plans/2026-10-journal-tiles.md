# Panel brief: one question at a time, for both Journal types

**Status:** approved by Mel 16 Oct 2026 ("yes to the brief, and yes to both recommendations") and built the same day.

**Request (as the problem):** a long page of questions is hard to settle into; Mel wants to focus on one, finish it, move on, and see how far she is.
**Lane:** Medium · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Frontend engineer, Test lead
**Gate:** worth it: neither type had been used yet, so this is the shape she meets first; a change of view, not of what's stored.
**Today, outside Hanua:** paper, one thing at a time; the page shows how far you've got.

## What was built

Both Journal types open in one **focus window** (`public/desk/stepper.js`): wide and centred over the blurred room (`.focus-layer` in `index.html`, z 27, **not a modal dialog**, so the toast's Undo, z 30, can still be clicked; a modal's top layer would cover it), one at a time (`takeFocus`). A **tile per question** slides in on **Next / Back** (⌘↵ / ⌘⇧↵, a sideways swipe on a phone; no slide with reduced motion); an empty tile can be skipped. **Dots** along the top, one per question (filled when written, the current one larger, click to jump), the Work reflection's under *Where I'm at* / *Where I'm heading*, then **✓ Review**: every answer on one page (tap one to change it), with Save, Bin and Reflect ✦ / Send to the panels ✦ (and the fale for Brain dump). The draft remembers the tile (`step`). Rules in `public/shared/steps.js` (`startStep`: where she left off, else **Review for a saved page** (Mel's answer 1), else the first question), tests `test/steps.test.js`. Save stays explicit (Review or ⌘S; Mel's answer 2).

## Premortem, and what answered it

| # | Failure | Answer |
|---|---|---|
| 1 | Next ×7 slower than scrolling | ⌘↵, dots jump anywhere, swipe |
| 2 | Undo unclickable behind a modal | a non-modal layer under the toast (checked: the Undo button is the topmost element over the blur) |
| 3 | Lost her place on sleep's reload | the draft keeps the tile |
| 4 | Jumpy slide | 0.25 s, none with reduced motion |
| 5 | Saved words wiped | saving unchanged; all save and draft tests still pass |

## Tested

Sample preview at 1440, 1024 and 375, light and dark: the menu, a tile per question, ⌘↵, dots filling as she types, Review, Save with Undo clickable, a saved week reopening on Review, the other window closing when one opens, Back and Next on one row on a phone, no sideways scroll. `npm run check`: 239 tests. Not proven: Safari, a real Notion save.
