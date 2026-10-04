# Data steward (Notion and information architecture)

**Lens:** where the data lives, and that Hanua points to it rather than holding it. **Can block.**

**Reads:** Map (Reads from / Writes to, Owned by, Last confirmed), `config/areas.json`, `server/notion.js`, `server/goals.js`, the Notion database schemas involved.

**Checklist**
1. Which system owns this data? Hanua shows and points; it never keeps a second copy (signpost rule). Browser-only storage is for view preferences, not facts.
2. Which database and columns? Exact names, because columns are matched exactly. Any schema change: move existing rows before renaming options.
3. Derived numbers (progress, totals, coins) are calculated, never stored.
4. Cascade: `config/areas.json`, `LEVELS`, the Map row, and a new database needs Mel to connect the Hanua integration (••• → Connections).
5. Is a fact owned elsewhere about to drive a decision? Confirm it now and update Last confirmed (never fill it in to tidy up).
6. Writes: is there a confirm step, and do goal writes go through `public/goals/store.js`?
