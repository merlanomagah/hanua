# Panel brief: goals up and down the chain, folding Plan my day's sections, Backspace and arrows on a line

**Request (as the problem):** (1) From any goal on the Board, get to its children or its parent in one move, without re-filtering by hand. (2) Hide a section of the To-Do List, and its tasks, while planning. (3) Undo a subtask with Backspace, and get from a line to Priority and then Time with the arrow keys.
**Lane:** Medium (three small changes in one release) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Frontend engineer (independent reader), Test lead (independent reader), Agile coach (guest), Release keeper
**Gate:** worth it. All three are friction in things Mel uses every day (Plan my day, the Board), not new rooms. Nothing on the cut list or parked.
**Today, outside Hanua:** in ADO a work item's Parent and Child links open in one click; in Notion and Apple Notes, Backspace at the start of an indented line brings it back out. Mel is reaching for habits those tools taught.

**Panel record:** first written 10 Oct from Claude's own pass; re-run the same day with every seat's checklist and two independent code readers (Frontend, Test lead). What that changed is marked **(full panel)** below.

## 1. Verdict
Go. **Goals:** each Board card gets a "↓ 4 Features" button (when it has children) and its "↑ parent" line becomes a button; ⌘↓ / ⌘↑ do the same from the keyboard (as in Finder: open, go to the enclosing folder), on Board cards and Backlog rows. Going down narrows the Board to that goal's children with a breadcrumb at the top (Move to Sydney › Land role in Sydney ✕). **Sections:** To-do.txt already folds its sections (the ▸ at the right of each header, since 6 Oct), so this is Plan my day: each To-Do List section header gets the same ▸ with "3 left". **Keys:** Backspace at the very start of a written subtask (or on an empty indented row) outdents it, like Shift+Tab; → at the end of a written line goes to Priority, → again to Time, ← comes back.

## 2. Premortem
| # | Why it failed | Seat | What this brief does about it |
|---|---|---|---|
| 1 | Going "↓ Features" left Mel on a narrowed board and she couldn't tell why the other Features had vanished | Experience designer | Breadcrumb in the toolbar with ✕; Esc clears the narrowing **before** it closes the board (full panel: today Esc closes the board straight away, `app.js:1188`); clicking a level tab clears it too |
| 2 | Backspace outdented a line when she only meant to delete a letter | Experience designer | Only with the caret at position 0 and nothing selected; no text is ever deleted by it; Tab puts it back |
| 3 | → jumped out of the text while she moved the caret along a wrapped line | Frontend | Only on a written line, caret at the very end, nothing selected, no Shift (full panel) |
| 4 | Folding a section in Plan my day also folded things in To-do.txt, or a folded section swallowed the cursor | Frontend, Test lead | (full panel) Section folds get their own store `desk-section-folds`: the existing `desk-folds` is read by To-do.txt and fires `hanua:folds`. Arrow / Enter moves skip a folded section; Enter on a folded section's name unfolds it first |
| 5 | Safari's page scroll or select menus swallowed the keys | Frontend | ⌘↑ / ⌘↓ call `preventDefault` (Safari scrolls the page with them); the picks are native selects, handled on keydown; H / M / L still work; Mel tries it in Safari |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Serves "keep Mel on top of goals"; builds on the Board and Plan my day (Being tested), not on anything Assumed. Evidence: the weekly review's view count, and whether Mel stops asking how to get to a Feature's PBIs |
| 2 | Sceptic | go | Don't add a fold to To-do.txt: it has one, so say so. The second answer to question 1 (light the family, dim the rest) **already exists**: click a card (full panel) |
| 3 | Daily-use coach | pass | Removes friction from habits already in use; nothing to nag |
| 4 | Experience designer | reshape | ⌘ keys, not plain arrows: the Board's menus and tabs already use arrows (`board.js:294, 381-387`). Esc order (above). Screen reader: the Time pick sits inside a span marked hidden from screen readers (`page.js:89`); focusing it with → would land on a hidden control, so that mark comes off (full panel) |
| 5 | Room designer | go | A small chip in the card's meta row, DM Mono like the level label; no new colours (the hard-coded colour limit, 622, has no room left: tokens only) |
| 6 | Frontend (reader) | go, with fixes | Backlog rows can't take focus (`backlog.js:110`): ⌘↓ / ⌘↑ are caught from the row's name button. The narrowing lives in memory, never in the saved level (`board.js:51`). The drill rule copes with children on more than one level |
| 7 | Test lead (reader) | go, with fixes | The goals tests live in `test/goals-core.test.js` (not `goals.test.js`). Turn the key decisions into a small tested rule so premortems 2 and 3 become checks. A test that a folded section is still planned |
| 8 | Agile coach | go | True to ADO's parent / children links; the level stays visible (symbol + name) so a Feature never reads as a Task. The Goals guide needs no change |
| 9 | Release keeper | go | One branch, `npm run check`, fast-forward `main` |

Passes: Data steward, Backend, Privacy (view-only; nothing written or sent anywhere).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | After ↓ into an Epic's Features, should the Board **show only that Epic's Features** until you clear it, or show **all Features with that Epic's lit**? (The second already happens when you click a card) | Only that Epic's: it's what "open" means in ADO and Finder, and the lit-up version is already there |
| 2 | Did you mean folding in **Plan my day**? (To-do.txt already folds: ▸ at the right of a section header) | Yes, Plan my day, the same look as To-do.txt |

## 4b. Lifecycle
| Verb | For the narrowed Board / a folded section |
|---|---|
| Add | ↓ button, ⌘↓, or a breadcrumb step / ▸ on the header |
| See | Breadcrumb shows where you are / "3 left" on a folded header |
| Change | Click any breadcrumb step / click ▸ again |
| Remove | ✕, Esc or a level tab clears the narrowing / ▸ unfolds |
| Bulk | Not needed |
| Close out | Narrowing forgotten when the board closes; folds forgotten after the day (like subtask folds) |
| Record | Nothing kept: a view choice, this Mac only |
| Day 30 | Nothing accumulates |

## 5. In and out
| In | Deliberately not |
|---|---|
| ↓ / ↑ on Board cards, ⌘↓ / ⌘↑ on cards and Backlog rows, breadcrumb | Timeline drilling (its goal picker already narrows it) |
| A fold per section in Plan my day, own store | Fold all; sharing folds with To-do.txt (planning and doing are different moments) |
| Backspace at position 0 on a subtask; → / ← between text, Priority, Time | Changing ⌥Tab (stays the Mac's "next item") |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | `drillTo` / `childrenOf` rules + tests (down and up through all four levels, no parent / no children, At work only Work goals) | `public/shared/goals.js`, `test/goals-core.test.js` | `npm test` |
| 2 | A key rule (`lineKeyAction`: caret, selection, written?, subtask? → outdent / to Priority / nothing) + tests | `public/shared/desk.js`, `test/subtasks.test.js` | `npm test` |
| 3 | Buttons, narrowing, breadcrumb, ⌘↑ / ⌘↓, Esc order | `public/goals/board.js`, `backlog.js`, `public/app.js`, `styles.css` (tokens only) | Epic → Features → PBIs → Tasks and back in the preview |
| 4 | Section fold (`desk-section-folds`), `focusLine` and focus restore skip folded sections | `public/desk/page.js`, `styles.css` | survives a reload today, gone tomorrow; Save & plan still plans a folded section (test) |
| 5 | Backspace / → / ←, `aria-hidden` off the Time pick | `public/desk/page.js` | every key path tried twice in a row |
| 6 | `npm run check`, fast-forward `main`, push | | Hanua restarts itself |

No `npm install`, no new `.env` value, no Notion change, no new page signal.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` and `npm run check` | rules above; colour limit (tokens only) |
| 2 | Board and Backlog drill both ways; Esc order; At work shows Work goals only | `sample` server (port 3001) |
| 3 | Fold, Tab, Backspace, arrows, Enter on a folded section's name, Save & plan with a folded section | `sample-planner` (port 3041), 1440 / 1024 / 375, light and dark |
| 4 | Mel in Safari: ⌘↑ / ⌘↓ and the arrows on Priority / Time | Ask Mel |

## 8. Close-out
Map rows: Goals board, Plan my day. Session Diary with "Panel: Medium; seats that caught something: Frontend, Test lead, Experience designer, Sceptic". Preferences: ⌘↑ / ⌘↓ and Plan my day's section folds.
