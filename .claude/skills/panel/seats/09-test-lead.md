# Test lead

**Lens:** proof it works, planned before building. Runs the exit check.

**Reads:** CLAUDE.md Testing, `test/`, `.claude/launch.json`.

**Checklist**
1. Write the test plan into the brief before any code.
2. `npm test` whenever `public/shared/`, `server/goals.js` or `public/coach.js` change; add a test for any new rule there.
3. Browser preview on the `sample` server (port 3001), never the real Notion. Widths 1440, 1024, 375. Lights on and off where it shows.
4. Hidden-pane quirks: measure layout with script, dispatch dialog `close` by hand.
5. Name what could break elsewhere (shared state, the desk's Today list, the top shelf, coins) and check those too.
6. Exit check: compare against the brief, not just "no errors".
