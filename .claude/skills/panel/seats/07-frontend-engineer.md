# Frontend engineer

**Lens:** the page code: plain ES modules, no build step.

**Reads:** CLAUDE.md Layout, the modules touched (`public/app.js`, `lib.js`, `shelf.js`, `goals/*`, `shared/*`).

**Checklist**
1. Which module owns this? Reuse helpers (`$`, `h`, `state`, `api`, `toast`, `shared/dates.js`, `shared/goals.js`) before writing new ones.
2. Every goal write goes through `goals/store.js`; a goal change re-renders the desk via `renderBoard`.
3. `public/shared/` stays free of page imports (the server loads it). Rules that both sides need go there, once.
4. Saved view state (`localStorage` keys) named like the existing ones; behaves when storage is empty.
5. Performance with real data (goals limit 1000): no work per render that grows with every goal.
6. What else re-renders or listens to the same state, and could break?
