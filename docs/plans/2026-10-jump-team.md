# Panel brief: the Jump team (a stand-up with eight AI members)

**Status:** approved by Mel 16 Oct 2026 ("yes all three"; plus: add context to each area by typing or voice, with the OS principle that nothing is just stored and left to go stale) and built the same day as a probe. Her real charters and anything about her work live in Notion, never here (the repo is public).

**Request (as the problem):** Mel holds seven stakeholder areas and the whole programme alone. She wants a team that holds each area, takes stand-up updates away, comes back with how to handle and prevent each issue, asks what it needs and flags what needs her sign-off, and doesn't go stale.
**Lane:** Large · **Seats:** all core seats + guest Jump; Data steward, Engineers and Test lead read the code independently.
**Gate:** worth it, reshaped: the team's memory lives in her work OS (charter pages, by role) so it works without Hanua and can be handed on; Hanua is only the stand-up room. A probe: whether it helps can only be learned by using it (look ~20 Nov).

## Built

| # | Part | Where |
|---|---|---|
| 1 | Charters: a "Jump team" page in her work OS with a page per member (Holds, What matters, Key risks, Affects, Standing questions, Context notes, Last confirmed), drafted by Claude by role | Notion (config `jump.team.pageUrl`) |
| 2 | Rules: charter ⇄ blocks, staleness (`charterState`: not confirmed or 30+ days; notes 90+ days to review), one change at a time (`applyEdit`), `scrub` (emails, phone, long numbers, account labels refused, never masked), `teamRows` (whitelisted fields: never Issue / Outcome / Resolution / who raised or waits), `grounded` (cites only what was shown) | `public/shared/team.js`, `test/team.test.js` |
| 3 | Routes: `GET /api/team`, `PUT /api/team/:id` (409 on base), `POST /api/team/standup`, `POST /api/team/:id/context`; replies checked before she sees them (sign-offs through `checkWrite`, charter edits through `applyEdit`, invalid ones say why) | `server/routes/team.js`, `jumpNow` = the dashboard's `snapshot` |
| 4 | Claude: `coachJumpTeam` (one call: PM routes, members answer, PM sums up; fixed reply shape), `foldTeamContext` | `server/claude.js`; check rule 8 lists both, sweep widened to `Team|Jump` |
| 5 | Window: Team button on the Jump Dashboard → focus window, Stand-up (update, Talk not at work, PM card, member cards with cites / "unconfirmed", questions and Answer and ask again, sign-offs Approve one at a time with Undo) and Team (eight cards with state; a member's page: Add context typed or spoken → Fold it in → Keep the note / Approve each change; Confirm charter) | `public/jump/team.js`, `index.html`, `styles.css` |
| 6 | Evidence: stand-ups a week on this Mac (`team-standups`) | `bumpWeek` |

Sign-offs reach only where Hanua already writes: an escalation / project / question change (the dashboard's `store.change`, Undo), a line in today's Jump issues, or a charter change. Decision Log and Signal Log writes are phase 2, if earned.

## Tested

`npm run check` (248). Preview at 1440 and 375: stand-up with the invented team, every sign-off approved and the escalation, today and charter changed, Undo putting the charter back, the Team grid with states, folding context, Keep the note, Confirm, Esc closing the window before leaving the dashboard, no sideways scroll. Route test: identifiers refused even with a key set, nothing written before approval, records carry no private fields, a made-up citation dropped, charter save / 409 / Undo. **Not proven:** the real charters (Mel connects "Jump team" to the Hanua integration), the team's advice with a real key, Safari.
