# Panel brief: "This pay" on the TV

**Request (as the problem):** Pūtea now plans each pay (safe to spend, debts due, payday moves). Mel wants that in view from Hanua without opening Pūtea.
**Lane:** Medium · **Seats:** Chair, Sceptic, Experience designer, Room designer, Frontend engineer, Backend engineer, Test lead, Privacy and safety, Guest: Money advisor
**Gate:** worth it, reshaped. Asked for "on the desk", but the 5 Oct cut list keeps the desk for daily planning ("the TV keeps money"). Mel chose the TV channel (5 Oct 2026). A probe from Pūtea's Phase 3 (`putea/docs/plans/2026-10-planning-phase-3-probes.md`): cut it if it isn't watched.
**Today, outside Hanua:** opening Pūtea → Plan & Goals → This pay.

## Verdict
Go: **CH 4 "This pay"** on the TV. Safe to spend this pay (big number), per day and the next payday, flexible spending's bar, the next debt payments due with their status, and the payday moves with landed / not yet.

## Premortem
| # | Why it failed | Seat | What this does |
|---|---|---|---|
| 1 | Nobody flicked to CH 4 | Chair | A probe: look at it from ~2 Nov 2026; cut if unused |
| 2 | Stale or invented numbers when Pūtea was closed | Money advisor, Data steward | Read live each refresh, nothing kept; sample figures labelled "Sample · Pūtea isn't running"; an older Pūtea shows "Update Pūtea to see this pay" |
| 3 | Money showed at work | Privacy and safety | The same screen code as CH 1–3: blank At work and when the remote hides money (blocking condition 5 holds) |
| 4 | A long line pushed the layout around | Room designer | One line per row at 1440 / 1024 / 375 (measured); per-day moved up beside the payday |

## Built
`server/money.js` `shapeThisPay()` reads Pūtea's read-only `GET /api/this-pay`; `getMoney()` adds `thisPay` (sample when Pūtea is closed). `public/app.js` `CHANNELS` gains "This pay" and `renderMoneyScreen()` draws it. Tests: `test/money.test.js` (shaping, and no made-up figures from an older Pūtea). `npm test`: 62 pass. Needs no `npm install` or `.env` change.
