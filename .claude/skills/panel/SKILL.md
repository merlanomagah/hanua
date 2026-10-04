---
name: panel
description: The Hanua Panel. Run this FIRST, before touching anything, whenever Mel asks for a change to Hanua of any kind (front end, server, Notion structure, design, images, config, docs routine). A quick "worth it?" gate, then a panel of expert seats assesses the request and produces one brief for Mel to approve. Skip only when Mel says "skip panel", or the request is a question, Mel's own data entry, or session close-out.
---

# The Hanua Panel

Every change request to Hanua passes through this panel before any file, Notion schema or image is touched. The point: bigger picture, function and experience all get considered **once, up front**, so nothing is built just because it was asked for, and nothing is built twice.

Mel chose this on 4 Oct 2026: option C (hybrid), the full roster for now (revise on evidence), automatic on every request, with a "worth it?" check first.

## What counts as a change request

| Runs the panel | Does not |
|---|---|
| Anything that changes code, `config/`, Notion database structure, images, the room's look or behaviour, or the routine in `CLAUDE.md` | Questions and explanations; Mel's own data (filling books, adding goals); close-out records; "skip panel" |

If unsure, run the Gate: it costs two lines.

## Step 0. Read first (once per session)

Hanua OS Context, Decision Model and Preferences (CLAUDE.md says how). The seats lean on them; don't run the panel from memory. Also read `docs/panel/parked.md` so a parked idea isn't re-argued from scratch.

## Step 1. Intake

Restate the request in one line as **the problem Mel wants solved**, not the solution she named. If the request is ambiguous in a way that changes the answer, ask before the Gate (one question).

## Step 2. The Gate: is it worth doing at all?

Chair and Sceptic only, a few lines, shown to Mel. Ask:

1. Does it serve the purpose sentence or a current priority on Context?
2. Is it building on a part that's still *Assumed* (Decision Model tiers)?
3. Is it polish ahead of plumbing (Learning Log "Patterns worth watching")?
4. Is it already on the cut list (Preferences) or in `docs/panel/parked.md`?
5. Could something that exists already do it, or could something be removed instead?

Outcomes:

| Gate says | Then |
|---|---|
| **Worth it** | Go to Triage |
| **Worth it, smaller** | Say the smaller version, then Triage that (Mel can overrule) |
| **Not now** | Say why in two lines and what would earn it. Ask Mel: park it, or go ahead anyway? Parked → a row in `docs/panel/parked.md`. Mel always has the final word |
| **Already exists** | Show her where it is. No build |

The **Fix** lane skips the Gate: broken things get fixed.

## Step 3. Triage: pick the lane and the seats

| Lane | Looks like | Seats | Output |
|---|---|---|---|
| **Fix** | Something that worked is broken | Test lead, the relevant engineer, Release keeper | 3-line note, then fix (no approval wait unless the fix changes behaviour) |
| **Small** | Wording, colour, a label, a spacing tweak | Chair + the 2 most relevant seats + Test lead | 5-line brief |
| **Medium** | A new control, a changed view, a new interaction | Chair + 4–6 seats chosen for the change | One-page brief |
| **Large** | A new room or panel, a new data source, a Notion schema change, anything touching 3+ areas | All core seats + any guests that apply | Full brief, saved to `docs/plans/<yyyy-mm>-<slug>.md` |

Seats are in `seats/` (one file each: lens, checklist, what to read). Read the file of every seat that sits. Guests sit only when the change touches their area (each guest file says when).

## Step 4. Assessment

Each seat that sits gives:

- **Verdict:** go / reshape / not now / pass ("pass" = nothing to add; encouraged, don't pad)
- **Up to 5 points**, specific to this change and to Hanua (file names, Notion columns, preferences). No generic advice.
- **Must-haves**, if any (things the build cannot skip).

**Fix, Small, Medium:** run the seats yourself in one pass. Keep the voices distinct: answer each seat's own checklist, don't blend.

**Large (the hybrid part):** the Data steward, the engineer most affected (Frontend or Backend) and the Test lead each run as a separate read-only agent, in parallel, so their views come from reading the code independently rather than from your assumptions. Use the Agent tool with `subagent_type: "Plan"`, and give each one: the one-line problem, the Gate result, the path to its seat file (`.claude/skills/panel/seats/…`), and "Return your verdict, up to 5 points with file references, and must-haves. Do not change any files." Run the other seats yourself while they work, then fold their answers in. **Check any claim of an existing bug or risk in the code before it goes into the brief** (first run, 4 Oct 2026: an agent flagged a time-zone bug that the code already avoids).

## Step 5. Settle conflicts

The Chair settles disagreements in this order: the purpose sentence → confidence tiers → Preferences (Settled beats Living) → the cheaper, more reversible option. **Privacy and safety** and the **Data steward** can block (keys, real-Notion tests, writes without Mel's confirm, holding data Hanua should point to); a block is resolved by reshaping, not by overruling. Taste and real trade-offs go to Mel as a question, never settled silently.

## Step 6. The brief

Use `brief-template.md`. Plain language, numbered tables, no jargon without a gloss (Mel isn't a developer). At most **3 questions** for Mel, each with a recommendation. Say explicitly if the build will need `npm install` or a new `.env` value.

Then **stop and wait for Mel's yes.** Nothing gets touched before it, except a Fix.

## Step 7. Build, then exit check

Build to the brief, in its dependency order, on a working branch. If the plan has to change mid-build, say what and why in one line.

Exit check before pushing: the **Test lead** runs the test plan from the brief; the **Room designer** and **Experience designer** look at the result (screenshots at 1440 / 1024 / 375) against the brief, not just "it works". Report anything that differs from the brief.

## Step 8. Close-out

The **Release keeper's** list from the brief: push the branch and fast-forward `main` (CLAUDE.md), tell Mel to use Restart Hanua, then the Hanua OS close-out. In the Session Diary row add one line: **"Panel: <lane>; seats that caught something: …"**. That line is how the panel itself gets judged.

## The panel is itself Being tested

After 2–3 weeks of use, look across the Diary's "Panel:" lines. A seat that only ever passes gets merged or cut; a gap that bit us after shipping gets a seat or a checklist line. Record the change in the Learning Log.
