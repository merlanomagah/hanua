# Panel brief: dark mode

**Request (as the problem):** At night Hanua's cream paper and windows are the brightest thing on the screen. Mel's Mac runs in Dark Mode (checked 6 Oct 2026, 22:02: set to Dark, not automatic), so Hanua glares beside everything else.
**Lane:** Large (it touches the look of every part of the room), run in one pass: no data, Notion or server changes, so the code-reading seats had little to read beyond the stylesheet, which Claude audited directly · **Seats:** Chair, Sceptic, Room designer, Experience designer, Frontend engineer, Daily-use coach, Test lead, Release keeper
**Gate:** worth it, smaller first. Two flags. **(a) Something close already exists:** the lights (pull cords, off by themselves at 9 pm, on at 4 am) dim the wall, desk, bookcase and rail, but every window, book page, card and dialog stays cream. **(b) Polish ahead of plumbing:** Foundations is half done and Close the day waits behind it. So: a **probe on the desk** first (its windows, widgets and dock), then the rest of the room once Mel has used it for a few evenings.
**Today, outside Hanua:** her Mac stays in Dark Mode all day, so macOS's own apps are dark. Hanua is the odd one out. The habit is telling us she prefers dark screens, not only at night.

## 1. Verdict
**Reshaped.** We don't flip the whole room to black. Hanua is a room, and **things that are Mac things go dark the way macOS does**: Plan my day, To-do.txt, the widgets, the dock, Settings, dialogs, the top rail's glass, the goals board's cards. **Things that are real objects keep their real colours and dim with the lights**, as they already do: bricks, oak, walnut, books, sticky notes, post-its, the whiteboard, clocks and frames. (Paper doesn't turn black when you turn the lamp off.) "Dark" is Bula's own: deep walnut-brown surfaces, cream ink and the same terracotta and green, never cold grey. One setting decides when (question 1).

## 2. Premortem: it's three weeks later and Mel switched it off. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | It looked muddy: brown on brown, text hard to read | Room designer | A palette of dark tokens checked for contrast by a test (body text ≥ 4.5:1, labels ≥ 3:1) and screenshots at 1440 / 1024 / 375 before release |
| 2 | Half of it stayed cream: a cream dialog inside a dark window | Frontend | The stylesheet has 239 raw colour codes and 384 `rgb()` values outside `:root`. Those used by Mac things become tokens first, and a check stops new raw colours being added |
| 3 | Two switches fought: the lights came on at 4 am and the windows went bright | Experience designer | One rule, named in Settings (question 1). The lights keep dimming the room either way |
| 4 | The room stopped feeling like a room: sticky notes turned black, the whiteboard went grey | Room designer | Real objects never invert; they only dim with the lights, as now |
| 5 | It landed in the middle of Foundations' desk refactor and broke things | Release keeper | Stylesheet and tokens only (no desk JavaScript beyond setting one class), so it can't collide with F5/F6 |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go, as a probe | It serves "show information beautifully" and daily comfort, but it's polish: keep it small until it has earned the rest |
| 2 | Sceptic | reshape | Don't build a second light switch. Either ride on the lights, or follow the Mac. A separate "dark mode" toggle next to a lamp cord would be two switches for one idea |
| 3 | Room designer | reshape | Mac things dark, real objects dim. Dark surfaces are walnut-brown (around the bookcase's own tones), with cream ink and terracotta accents; the desktop's frosted glass becomes smoked glass (the music card already is). Shadows get softer, not blacker |
| 4 | Experience designer | go | It should simply be right when she opens Hanua, without a toggle hunt. Settings → Desk gets **Appearance**: Follow my Mac / Follow the lights / Always light / Always dark, applied at once, with Back to defaults + Undo like the other groups |
| 5 | Frontend engineer | go, careful | The colours already live mostly in `:root` (1,510 uses of tokens), which makes this feasible. The plan: one `.dark` class on `#app` that swaps the surface and ink tokens for the Mac-thing layer only (`--surface`, `--surface-2`, `--ink-ui`… new names so real objects keep `--cream` / `--page`). Then move the Mac things' raw colours onto tokens. Canvas drawings (weather window, plant, canary) need nothing: they draw the real world. The 45 colour codes in page JavaScript are mostly real objects (menu icons, calendar types); check each one |
| 6 | Daily-use coach | go | Default to **Follow my Mac**: she keeps it Dark, so Hanua would be dark from the first evening with no action, and she can say if that's too much |
| 7 | Test lead | go | Earned checks: a contrast test over the dark token pairs (`public/shared/` holds no CSS, so a small test reads `:root` and `.dark` from `styles.css`); a count of raw colours outside `:root` that must not grow. Screenshots light and dark at three widths, At work, and with the sleep screen (already dark: unchanged) |

Passes: Data steward (no data; the choice is kept per Mac in browser storage, like the lights), Privacy (nothing new is shown; At work unchanged), Backend.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | When should Hanua be dark: **follow your Mac** (dark whenever macOS is), **follow the lights** (dark from 9 pm, or when you pull a cord), or a fixed choice? All four go in Settings either way; this picks the default | **Follow my Mac.** Your Mac is set to Dark, so Hanua matches it at once; the lights keep dimming the room at night as now |
| 2 | Scope: only Mac things (windows, widgets, dock, dialogs, cards) go dark while the room's real objects keep their colours and dim with the lights? | **Yes.** The room stays a room |
| 3 | Order: a probe on the desk now (Plan my day, To-do.txt, Up next and the widgets, dock, Settings: about one session), the rest of the room after Foundations? | **Yes.** Try it for a few evenings; if it's right, the wall's books, the goals board and dialogs follow |

## 4b. Lifecycle (for the appearance setting)
| Verb | |
|---|---|
| Add | Settings → Desk → Appearance (four choices); the default follows the Mac |
| See | Settings shows the current choice; the room shows it |
| Change | One click, applied at once; following the Mac changes the moment macOS does |
| Remove (+ Undo) | Back to Hanua's defaults, with Undo (as every Settings group) |
| Bulk / Close out | Not needed |
| Record | Kept per Mac in browser storage (`room-appearance`), like the lights: the two Macs can differ (the mini may sit somewhere brighter) |
| Day 30 | Evidence for the probe: does she keep it on? If she switches to Always light within a week, dark windows aren't what she wanted; ask before building the rest |

## 5. In and out
| In this change (the probe) | Deliberately not (and what would earn it) |
|---|---|
| Dark tokens for Mac things; `.dark` on `#app` | Dark books, goals board, dialogs on the wall: after the probe and Foundations |
| Desk: Plan my day, the week view, To-do.txt, the draft day, Up next and the other widgets, the dock, Settings, Shopping list / Add reminder, toasts | Recolouring photos (bricks, oak, walnut): never; the lights already dim them |
| Settings → Desk → Appearance (4 choices), per Mac | A separate toggle in the top rail: one place is enough; add only if she reaches for it often |
| Contrast test; a "no new raw colours" check | Night-time auto for the Mac setting: macOS already does that if she wants it |

## 6. Build plan (the probe), in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | New tokens for the Mac-thing layer (light values = today's look, so nothing changes yet); the desk's raw colours moved onto them | `public/styles.css` | Light mode pixel-identical at 1440 / 1024 / 375 |
| 2 | `.dark` values; contrast test; raw-colour count check | `public/styles.css`, `test/` | `npm test` |
| 3 | Appearance in Settings → Desk; `prefers-color-scheme` listener for Follow my Mac; the lights' state for Follow the lights | `public/desk/settings.js`, `public/app.js` (one class) | Each choice switches at once; Undo works |
| 4 | Exit check: screenshots light / dark, 3 widths, At work, sleep screen | sample preview | Room designer and Experience designer look against this brief |

No `npm install`, no `.env` changes, no Notion changes.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` incl. the new contrast and raw-colour checks | |
| 2 | Light mode unchanged | Screenshots before / after at 1440 / 1024 / 375 |
| 3 | Dark mode on the desk at 3 widths, At work, minimised windows, the draft day, Reorder | `sample-work` preview (own folder, never real data) |
| 4 | What could break: the lights' dimming, the sleep screen, the weather window, phones | Walk through each |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Desk rows; Settings (desk) |
| 2 | Preferences | A row: "Mac things go dark with the Mac, real objects dim with the lights"; `styles.css :root` holds the values |
| 3 | Session Diary | "Panel: Large (inline); seats that caught something: …" |
