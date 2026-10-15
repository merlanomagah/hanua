# Panel brief: the Journal's menu, and a Work reflection read by two coach panels

**Status:** approved by Mel 16 Oct 2026 ("yes to the brief, and yes to all three recommendations") and built the same day. This repo is public: Mel's role, its context, the questions and the panels' seats live in her Notion page "Hanua work reflection: my role", never here.

**Request (as the problem):** when Mel reflects on work, nothing gives her an honest outside view of where she's at and where she's heading, or says when to push harder, hold steady or take a breather. She wants Hanua to know her current role (which will change), ask good layered questions, and give her that mirror.
**Lane:** Large · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Data steward *(independent)*, Frontend engineer *(independent)*, Test lead *(independent)*, Privacy and safety, guest Jump, guest Bula
**Gate:** worth it, smaller (a probe): the Journal it hangs off was a day old and unused.
**Today, outside Hanua:** Claude sessions in her work and career OSes in Notion (which log wins, experience and capabilities) and a paper notebook now and then. They record what she did; nothing asks how she is.

## 1. Verdict

Go, reshaped. Double-clicking the Journal file opens a small menu of entry types: **Brain dump** (the weekly page, first, so double-click then Enter is unchanged) and **Work reflection**, with room for more. A work reflection has two parts, **Where I'm at** (the work, the people, the landscape, me) and **Where I'm heading** (direction, growth, the next step); each layer shows one question from Mel's role page, and **Deeper ↓** steps on to the next one down (surface, deeper, mirror). Every box is optional. **Send to the panels ✦** (her press only): a High Performance panel and a Professional panel read it back, seat by seat, then agree one **push**, one **hold**, one **breather**. **Keep** puts the reply in the reflection; Save writes it to Notion.

## 2. Premortem

| # | Three weeks later it failed. Why? | Seat | What the brief does |
|---|---|---|---|
| 1 | Homework: too many questions | Daily-use coach | One question per layer, all optional, no schedule, no nudges |
| 2 | The panels were generic or flattering | Guest Bula, Chair | Each seat must anchor in her words, take a position and name one thing she isn't seeing; uses her Good / Better / Best ladder; the accountability seat reads her previous reflection |
| 3 | The role page went stale | Data steward | Last confirmed date shown in the window; after three months it asks "Still right?" |
| 4 | Work data leaked (names into this public repo, or detail to Claude) | Privacy, guest Jump | The role page is written by role, never by name, without restructure detail; release check rule 8 covers the new Claude call; sample text must say "(invented)" |
| 5 | A reflection overwrote a weekly page (the 16 Oct lesson) | Test lead | Its own Notion database; the server reads or writes only pages that carry the Panels kept column |
| 6 | A third place for career thinking | Sceptic | Hanua reads the role page and copies nothing; sending a reflection on to her career log comes later if earned |

## 3. Decisions taken (Mel's yes to all three)

1. Pressing Send sends her answers and the role page's summary (by role, no names) to Claude through Hanua's own key. Nothing else from her work OS.
2. The role title is the one in her work OS (kept in Notion, not here).
3. Nine seats, editable in Notion: HP: mindset coach, high-performance coach, sports psychologist, accountability partner. Professional: operations and delivery leader, stakeholder and partnership strategist, organisational psychologist, community outcomes, career strategist.

Chair's call on a disagreement: the Data steward wanted the Journal database with a Type column; the Test lead a separate database (the weekly page's `pageFor` finds a page by date only). Separate, after the wiped-day fix. Plan change while building: the questions live in the role page rather than "Hanua journal prompts", so a role change carries its questions with it and there is one page to connect.

## 4. Lifecycle

| Verb | A work reflection |
|---|---|
| Add | Journal menu → Work reflection, any day, as often as she likes |
| See | Past ▾ in the window (newest first, "with the panels"); Notion on her phone |
| Change | Reopen from Past, edit, Save; changed elsewhere first → Show theirs / Keep mine |
| Remove | Bin → Notion's trash, Undo; kept panels: Take it out, Undo |
| Bulk | Not needed |
| Close out | None: they build up |
| Record | Date, role at the time, questions asked, answers, the panels' reply if kept |
| Day 30 | 2–6 reflections; the next panel reads the last one. Probe: look ~13 Nov |

## 5. Built

| # | Part | Where |
|---|---|---|
| 1 | Rules: types, parts and layers, the role page read, questions, to and from Notion, the panels' text | `public/shared/reflect.js`, `test/reflect.test.js` |
| 2 | Routes: role, list, read, new, save (409), bin / restore, panels (invented on a sample server) | `server/routes/work.js`, `test/routes.test.js` |
| 3 | The panels' Claude call; a sample server never calls Claude (`blockClaude`, set from `server/index.js`) | `server/claude.js` `coachWorkReflection` |
| 4 | The file's menu; the window (draft `work-drafts` on this Mac, ⌘S, Esc, personal) | `public/desk/filemenu.js`, `public/desk/work.js`, `index.html`, `styles.css` |
| 5 | Release check rule 8: each journal Claude call has one route file; any new one must be listed; sample role, reflections and panels say "(invented)" | `scripts/check.js` |
| 6 | Config | `config/areas.json` `journal.work` (database id, roleUrl, fields) |

No `npm install`, no new `.env` value. **Mel to do in Notion:** connect the Hanua integration to **Work reflections** (insert and update content) and to **Hanua work reflection: my role** (••• → Connections → Hanua); read and edit the role page.

## 6. Tested, and not

Proven in the sample preview (1440 and 375): the menu (focus on Brain dump, ↓ Enter opens Work reflection), the window, a draft surviving a reload, the panels (invented), Keep, Save, Past, Brain dump unchanged, put away At work, no sideways scroll at 375. `npm test` 236, `npm run check` passes. **Not proven:** a real Notion save, the panels with a real key (their quality), the 1024 layout (the hidden preview stalls the desk's slide), Safari.
