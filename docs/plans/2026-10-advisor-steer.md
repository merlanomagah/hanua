# An advisor seat on the Jump team: an early steer, not tasks

16 Oct 2026. Panel: Medium lane. Mel: yes to every recommendation (the advisor answers every stand-up; "to check" lines can go to today's list).

## The problem

The Jump team had a Community Partners member that double-handled the DIAA Partnership member: both answered for the partner network. Mel wants one route to the partner network (the DIAA Partnership member), and the Community Partners member kept only as a voice: if this went to DIAA, what would they be concerned about, by their key areas, and does it touch the partner network or any process they're part of. An early steer, never their word, never tasks. The stand-up asked every member for Handle / Prevent / sign-offs, so a charter alone couldn't do it.

## What was built

| # | Change | Where |
|---|---|---|
| 1 | A charter heading **Seat**: "Advisor" makes a member an advisor; blank = owns work as before | `SECTIONS`, `isAdvisor` in `public/shared/team.js`; hint in ⚙ Settings |
| 2 | The stand-up asks an advisor for a **steer** instead: touches (Yes / Likely / Unlikely / No) + why, concerns (≤ 4), where it lands (≤ 3), what to check with them for real (≤ 3); it answers every stand-up | `TEAM_SYSTEM`, `Steer` in `server/claude.js` |
| 3 | Whatever comes back, an advisor reaches the page with no next steps, questions or sign-offs; owners carry no steer; every advisor is routed; check lines are scrubbed | `check` in `server/routes/team.js`; `shapeSteer` |
| 4 | The advisor's card: the Yes/No first, then concerns, where it lands, "to check" with **→ Today** each (same path as an approved "today" sign-off, Undo in the toast), and a line saying it's a steer, not their position | `steerEl` in `public/jump/team.js`; `.tm-steer` in `styles.css` |
| 5 | The sample team's counter member is an advisor, with an invented steer (and an invented sign-off that must be dropped) | `data/sample.json`; tests in `test/team.test.js`, `test/routes.test.js` |

The charter itself (in Mel's work OS, not here) carries the partner's lens, built from Jump OS and a read of the partner's public blog (2022 to Oct 2026). Hanua sends only the charter to Claude, so what the advisor knows is what its charter says: refresh the charter when the partner's guidance moves.

## Lifecycle

| Verb | Answer |
|---|---|
| Add | Write "Advisor" under Seat in any charter (Notion or ⚙ Settings) |
| See | The stand-up card; the charter |
| Change | Edit the charter; the steer follows next stand-up |
| Remove | Clear the Seat line: the member owns work again |
| Bulk | Not needed |
| Close out | Kept with the stand-up until Start fresh, like the rest |
| Record | In the week's stand-up record (`team-standups`) |
| Day 30 | Look ~20 Nov with the rest of the team: did the steer change what went to the partner, or was it a "No" every time? |

## Not proven

A real stand-up with a key (the sample never calls Claude); Safari.
