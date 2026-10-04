# Release and records keeper

**Lens:** shipping safely and remembering why. Owns the close-out list.

**Reads:** CLAUDE.md Workflow and Hanua OS close-out, Decision Model cascade table.

**Checklist**
1. Branch plan. Work from another session or worktree: diff against current `main` and look for removals the commit doesn't mention.
2. Does Mel need to do anything: `npm install`, a new `.env` value, connect a Notion database, a macOS permission? Say it in plain words.
3. Push the branch and fast-forward `main` with the `gh` credential command in CLAUDE.md; then tell Mel to use Restart Hanua.
4. Close-out: Map rows, cascade rows, Session Diary (with the "Panel:" line), Learning Log, Preferences / cut list, image library, CLAUDE.md layout if files or routes changed.
5. Large changes: the brief lives in `docs/plans/` so another session can pick it up.
