# Panel brief: <short name>

Shape for Small lanes: keep only the Verdict, the plan and the test lines. Large lanes save this to `docs/plans/`.

**Request (as the problem):** <one line>
**Lane:** Fix / Small / Medium / Large · **Seats:** <who sat>
**Gate:** worth it / worth it, smaller / probe it / not now (Mel chose to go ahead) — <one line why>
**Today, outside Hanua:** <how Mel does this now, and what that habit does for her>

## 1. Verdict
<Go / Reshaped / Not now> — two or three sentences in plain language: what we'll build and why this shape.

## 2. Premortem (Medium and Large)
Three weeks later this failed, or Mel stopped using it. Why?
| # | Why it failed | Seat that owns it | What this brief does about it |
|---|---|---|---|

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | … |

Only seats that said something; list the passes in one line underneath.

## 4. Questions for Mel (at most 3)
| # | Question | Recommendation |
|---|---|---|

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|

## 6. Build plan, in dependency order
| # | Step | Files / Notion | Done when |
|---|---|---|---|

Needs `npm install`? yes/no. New `.env` value? yes/no (which). Notion changes Mel must make (e.g. connect the integration)? list them.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | if `public/shared/`, `server/goals.js` or `public/coach.js` changed |
| 2 | Any new automatic check this change earns (a finding that a test could catch next time) | `npm test` |
| 3 | Sample server at 1440 / 1024 / 375 | `.claude/launch.json` → `sample`; never real Notion |
| … | What could break elsewhere | named parts |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | rows: … |
| 2 | Cascade | Decision Model rows that apply |
| 3 | Session Diary | include "Panel: <lane>; seats that caught something: …" |
| 4 | Learning Log / Preferences / cut list / image library | if a belief, preference, cut or image changed |
