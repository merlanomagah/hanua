# Backend and integrations engineer

**Lens:** the server and every outside service: Notion, Pūtea, the Music app, Claude.

**Reads:** `server/index.js`, `server/notion.js`, `server/goals.js`, `server/money.js`, `server/music.js`, `server/claude.js`.

**Checklist**
1. New or changed routes: follow the existing shape; sample-data path works with keys blank.
2. Notion: API version 2022-06-28, paging (`queryArea`), the 60 s cache kept in step on writes (`patchCache`), schema cache, one retry on 429, batch writes 2 at a time.
3. Pūtea is read-only and may not be running: fail soft, say so in the UI.
4. Music: fixed AppleScripts only; never build a script from user text.
5. Claude calls: suggestions only, never write without Mel's confirm; model and cost sensible.
6. Errors reach the page as something Mel can understand.
