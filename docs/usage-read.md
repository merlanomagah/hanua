# The Sunday read (Claude on the Mac mini)

Mel's ask (15 Oct 2026): Hanua should notice how the planner is used, or not used, and propose changes without Mel having to be introspective. Hanua's own rules already show up to three suggestions in the two-week view and the weekly review (`weekFacts`, `/api/desk/facts`). Once a week, Claude also reads the planner and writes a short note to Hanua OS → **Usage notes**. The next build session reads the newest notes first and brings proposals to Mel through the panel.

**Runs on the Mac mini only** (Two Macs rule 1: anything scheduled that writes data runs on the mini). Set it up once, from Claude on the mini, as a scheduled task: **Sundays at 7 pm**.

## The task's prompt

> Read how Mel's Hanua planner was used this week and write one row in the Notion database "Usage notes" (Hanua OS; data source `collection://cde1b6d5-bd8e-4c9f-a961-a44513c04393`).
>
> 1. Fetch `http://localhost:3000/api/desk/facts?days=7` from the Hanua running on this Mac. Fetch `?days=28` as well, to compare against.
> 2. If you need more detail, read the day files in iCloud Drive › Hanua › desk (`YYYY-MM-DD.json`, read-only; never write to them). Mel agreed on 6 Oct 2026 that Claude may read planner history, personal and work.
> 3. Write one row: Week ("D–D Mon YYYY"), From, Days used, Planned, Closed evening / morning / Not closed, Done of tasks, Top blocker, **What Hanua noticed** (2–4 plain sentences on patterns: what's rising or falling against the 28 days, what keeps getting carried or let go, when she plans and when she doesn't), **Proposals** (at most 3 ideas for Hanua, each one line: what to build, change or cut, and why from the evidence), Status = New.
> 4. **Counts and themes only: never copy a task's text, a person's name or a work detail into the note.** Say "a home admin task carried 5 times", not the task.
> 5. Don't change Hanua, the repo, or any other Notion page. If Hanua isn't running or the facts can't be read, write the row anyway, saying so in What Hanua noticed.

## For the next build session

Start-of-session reading includes Usage notes: open the rows with Status New, bring their Proposals to Mel (each through the panel), then mark them Proposed to Mel. Once a proposal is built, mark it Built; if Mel says not now, mark it Parked.
