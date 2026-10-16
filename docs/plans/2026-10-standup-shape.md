# The stand-up says what it's about and what she wants

16 Oct 2026. Panel: Medium lane. Mel: yes to every recommendation (the seven types, Copy for Claude chat, one shared set of outcome chips).

## The problem

The stand-up started as a blank box: the team guessed what kind of thing it was and what she wanted back, and she re-explained it all in a Claude chat afterwards.

## Where the types came from

Her work OS: the escalation log's tiers (T1, T2, Partner, Ops), the signal log (delinking, sign-up and account linking, the tooling migration, Care capacity), its session diary's session types (escalation or issue, operational change design, planning, soundboarding) and what she brought on the day (quarterly planning notes).

| Type | Chips |
|---|---|
| Escalation via DIAA | From: a partner, a customer, DIAA itself |
| Issue raised by Care | From: T1, T2, Virtual Care Specialist |
| Ops or system issue | Where: sign-up, provisioning, the app, shared sheets |
| New project or change | |
| Meeting notes to work through | |
| Planning or priorities | |
| Something I've noticed | |

Outcome chips (one shared set): Understand what's going on · A next step for today · A fix and how to stop it recurring · Something to take to someone.

## What was built

| # | Change | Where |
|---|---|---|
| 1 | What's this about? (optional, "Not sure yet"), its chips, What I want (a line with one-tap chips), above the box | `framingEl`, `chipRow` in `public/jump/team.js` |
| 2 | The three go to the team as their own lines, checked for identifiers; the PM opens by answering what she wants; the type and source guide routing | `framing` (`public/shared/team.js`), `routes/team.js`, `TEAM_SYSTEM` / `coachJumpTeam` |
| 3 | Copy for Claude chat: what it is, what she wants, what she said, the PM's summary, each member's points, the advisor's steer, open questions | `briefText`; `copyBrief` |
| 4 | Edit types… (last in the list): rename, chip label and chips, reorder, remove, add, outcome chips, Hanua's starting types; one save with Undo; a picked type that's renamed stays picked | `typesEditorEl`; Hanua Settings group `standup` (`STANDUP`, `standupShape`, `SETTINGS_VERSION` 4) |
| 5 | Each type's use counted a week on this Mac, shown in the editor ("used n× in 4 weeks") | `bumpKind`, `kindUses`; browser storage `team-standup-kinds` |

Kept with the stand-up until Start fresh, like the rest. Tests in `test/team.test.js`, `test/routes.test.js` (257).

## Lifecycle

| Verb | Answer |
|---|---|
| Add | Edit types… → + Add a type |
| See | The list, every stand-up |
| Change | Rename, chips, order; Hanua's starting types puts the seven back |
| Remove | × then Save; Undo in the toast; past stand-ups keep what they said |
| Bulk | Not needed |
| Close out | Start fresh clears type, source and outcome |
| Record | Uses per type a week (this Mac, eight weeks) |
| Day 30 | Look ~20 Nov with the team: cut types never used |

## Not proven

A real stand-up with a key (does the PM answer the outcome first), Safari's clipboard.
