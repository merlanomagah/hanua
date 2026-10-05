# Panel brief: the TV shows today's one money thing

**Request (as the problem):** the TV has four money channels. Mel wants everything on the landing wall to earn its place, now that the three frames above the TV show today's spend, the plant and the next savings goal. What should the TV show, how, and why?
**Lane:** Medium · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Backend engineer, Test lead, Privacy and safety, Guest: Money advisor
**Status:** approved by Mel 5 Oct 2026 (all four recommendations). Build after the first practice pay, Wed 7 Oct. Pūtea's side (fresh data, pending, `/api/akahu/freshness`, `/api/pending`) is built and installed. Rewritten 5 Oct 2026 after Mel's sense check ("is looking at them multiple times a day going to help me?"): no, so channels gave way to one screen that changes by day.
**Depends on:** Pūtea's brief `putea/docs/plans/2026-10-fresh-bank-data.md` (bank data refreshed four times a day, plus pending purchases). Without it the TV's figures only change when Pūtea is opened.

## Gate (Chair and Sceptic)

| # | Gate question | Answer |
|---|---|---|
| 1 | Serves the purpose? | Yes: "show information beautifully"; everything on the wall earns its keep |
| 2 | Building on something Assumed? | Pūtea's plan (safe to spend, groups) starts its practice run on Wed 7 Oct, and its bank data is only as fresh as the last time Pūtea was opened. So: build after Pūtea's fresh-data change and the first practice pay |
| 3 | Polish ahead of plumbing? | The plumbing (fresh data) goes first, in Pūtea |
| 4 | Cut list / parked? | No. The cut list says "the TV keeps money" (5 Oct) |
| 5 | Could something be removed instead? | **Yes:** CH 2 Expenses and CH 3 Income repeat the Finances book (income, kept, biggest spend, top places), and channel-flicking itself goes |
| 6 | Can anyone know in advance? | Whether it gets looked at: no. Judged at the 2 Nov probe review Pūtea already has for CH 4 |
| 7 | How does Mel do this today? | Opens Pūtea: the dashboard, Plan & Goals → This pay, the Tuesday check-in |

**Gate says: worth it, smaller.** One screen instead of four channels.

## Why one screen, not channels

| # | Reason | Evidence |
|---|---|---|
| 1 | The figures change about once a day, not all day | Pūtea pulls bank data only when opened (fix in Pūtea's brief: four times a day); card purchases take 1–3 days to settle |
| 2 | Each money question has its own natural pace: the pay daily, what's due a few times a pay, the long game monthly | Pūtea's plan runs by pay; debts and payday moves by date; debts clear over months |
| 3 | Numbers seen often that never change become wallpaper, and checking money all day is anxiety, not steering | Pūtea OS: "kind by design"; the Habits coach |
| 4 | Channels you have to click through on a small screen cost effort for numbers that rarely change | Four channels, one visible at a time |

## What the screen shows

**Always, at the top:** safe to spend until payday, in one sentence and one big number ("$34 a day until Wed 21 Oct"). Same place every day, so the eye knows where to look.

**Underneath (4 rows at most): the one thing that matters today**, picked in this order:

| # | When | Rows show | Last row says |
|---|---|---|---|
| 1 | Payday and the 3 days after, until every move has landed | Each payday move: landed / not yet | "All moved ✓", or "2 still to move" |
| 2 | A debt payment due today or tomorrow, or one not seen / bounced | That payment, its date and status | "Due tomorrow", or "Not seen yet: check in Pūtea" |
| 3 | Check-in day, not done yet | The pay so far: Flexible, Essentials, Debt against "by now" | "Check-in today → Pūtea" |
| 4 | Any other day | The four plan groups (Essentials, Debt, Flexible, Travel) as bars against a faint "by now" line, in words: on track / mindful / over | "Nothing due before payday ✓" |

**Footer:** "Pūtea · as of 12:30" (the last bank pull), replacing "live". Over 6 hours old: "as of yesterday 20:30 · open Pūtea".

**Goes elsewhere:**

| Was | Goes to | Why |
|---|---|---|
| CH 1 Overview (month by category) | Finances book (already has month by month) | Calendar months disagree with pay-based plan |
| CH 2 Expenses (payment list) | Finances book (biggest spend, top places) and Pūtea | Can't act on a list from across the room |
| CH 3 Income | Finances book (in, out, kept per month) | Fortnightly pay makes "kept so far" swing |
| The long game (debts clearing, pays under the line, fees) | Finances book's first page | A monthly pace belongs where you go to look properly |
| Remote's channel buttons | Removed; the remote keeps its power button (hide money) | Nothing left to change channel to |

### How it looks
1. One big number with one plain sentence, rows below, same layout every day.
2. Words over colours; no red, no scores; a missed payment says "not seen yet", never "missed".
3. Clicking the screen still opens the Finances book.
4. Blank at work and when the remote hides money (unchanged).

### Why this matters
- **A glance gives an answer**: the screen has already picked the one thing worth knowing today.
- **It agrees with Pūtea**, because both count by pay.
- **It's quiet most days** ("on track, nothing due"), so on the day it says something, it's noticed.

## Premortem (it's 3 weeks later and this failed: why?)

| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | The figures were stale, so Mel stopped trusting the TV | Data steward, Money advisor | Pūtea's fresh-data change goes first; the footer always says "as of" |
| 2 | Safe to spend was wrong in the first pay | Money advisor | Build after the practice run's first pay (Wed 7 Oct) |
| 3 | The "pick today's thing" rule chose the wrong thing | Test lead | The rule lives in `public/shared/` with tests for each case and their order |
| 4 | Money showed at work | Privacy and safety | Same screen code: blank At work and with the remote. Blocking condition 5 holds |
| 5 | Mel missed the long game | Daily-use coach | It's on the Finances book's first page, one click from the screen |

## What the seats said

| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go, smaller | One screen that chooses beats four that wait to be chosen |
| 2 | Sceptic | reshape | Fresh data first; a smarter screen over stale figures is polish ahead of plumbing |
| 3 | Daily-use coach | go | Every state ends in one action or a ✓ |
| 4 | Experience designer | go | The big number never moves; only the rows change |
| 5 | Room designer | go | Four rows at most so text never shrinks; check at 1440 / 1024 / 375; the remote without channel buttons still reads as a remote |
| 6 | Data steward | go | Read live, nothing stored (signpost rule). New shapers beside `shapeThisPay` in `server/money.js` |
| 7 | Frontend engineer | go | `renderMoneyScreen()` loses the channel branches; `CHANNELS`, `changeChannel` and `room-channel` go; the rule `tvToday()` in `public/shared/money.js` |
| 8 | Backend engineer | go | Reads `/api/this-pay` (already), `/api/planning/pace`, `/api/checkin`, `/api/akahu/last-sync`; older Pūtea → "not available", never made-up figures |
| 9 | Test lead | go | `test/money.test.js`: each of the four states, their order, a stale "as of", an older Pūtea |
| 10 | Privacy and safety | pass | Same At work and remote rules |
| 11 | Money advisor | reshape | Lead with progress and what's next, never the weight of the total owed |

## Questions for Mel

| # | Question | Recommendation |
|---|---|---|
| 1 | One screen that picks today's thing, replacing the four channels (and the remote's channel buttons)? | Yes |
| 2 | The long game (next debt to clear, pays under the Flexible line, fees) on the Finances book's first page? | Yes, with the next milestone first and the total owed small |
| 3 | Build after Pūtea's fresh-data change and the first practice pay (Wed 7 Oct)? | Yes |

## In and out

| In | Not now (and what would earn it) |
|---|---|
| One adaptive screen, the "as of" footer, the long game in the Finances book, tests | A second channel (if Mel finds herself opening Pūtea for the same thing every day); pending purchases on the TV itself (Today's spend frame gets them first, via Pūtea's brief) |

## Build plan (once approved, after Pūtea's change)

| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Shape pace, check-in and last sync | `server/money.js`, sample data | Tests pass; older Pūtea gives "not available" |
| 2 | The rule that picks today's thing | `public/shared/money.js` | Tested for all four states and their order |
| 3 | One screen; channels and the remote's channel buttons removed | `public/app.js`, `public/index.html`, `public/styles.css` | Right at 1440 / 1024 / 375; blank At work |
| 4 | The long game on the Finances book's first page | `public/app.js` (`moneyPages`) | Shows next milestone, pays under the line, fees |
| 5 | Today's spend frame adds "+ $X pending" (once Pūtea serves it) | `server/money.js`, `public/app.js` | Pending shown lighter, never added to the plan |
| 6 | Tests, push, Map and Diary; fix Context ("syncs at 8 am" is bills only) | `test/money.test.js`, CLAUDE.md, Notion | `npm test` passes; `main` updated |

No `npm install` and no new `.env` value.
