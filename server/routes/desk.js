// Plan my day's files: one per day (with the week before it), their summaries for the week view, the archive's
// list, and the planner's prompts and links. Split out of server/index.js (F6, 9 Oct 2026).
import { readdir } from "node:fs/promises";
import path from "node:path";
import { notionEnabled, pageSections } from "../notion.js";
import { dayKey, daySummary, deskShape, stepDay, versionClash, CARRY_DAYS, CLASH_TEXT, DESK_VERSION } from "../../public/shared/desk.js";
import { fileTooNew } from "../../public/shared/sync.js";

export function register({ app, config, room, roomDir, roomRoute, baseOf, readJson, settings }) {
  // Plan my day: one small JSON file per day (Today's focuses and the To-Do List lines). A day comes back with the week
  // before it, so the page can show the last focuses faintly as a hint (lastFocus in public/shared/desk.js).
  const deskDir = path.join(roomDir, "desk");
  // The quiet prompt under each heading, from the Notion page "Hanua planner prompts" (Bula copy stays out of the
  // public repo). Cached 5 min; with Notion off, or the page not connected, the headings show on their own.
  let promptsCache = null;
  app.get("/api/desk/prompts", async (_req, res) => {
    const url = config.planner?.promptsUrl;
    const id = /([0-9a-f]{32})(?:[?#]|$)/i.exec(url || "")?.[1];
    if (!notionEnabled() || !id) return res.json({ prompts: {}, url: url || null });
    if (promptsCache && Date.now() - promptsCache.at < 300_000) return res.json(promptsCache.value);
    try {
      const sections = await pageSections(id);
      const value = { prompts: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k.toLowerCase(), v[0] || ""])), url };
      promptsCache = { at: Date.now(), value };
      res.json(value);
    } catch (err) {
      res.json({ prompts: {}, url, error: err.status === 404 || err.status === 403
        ? "Hanua can't see the planner prompts yet: in Notion, open “Hanua planner prompts”, then ••• → Connections → add Hanua."
        : `Couldn't read the planner prompts (${err.message}).` });
    }
  });
  // Where the desk's dock points: Notion opens the Hanua page (the books, Goals, Weekly reviews, Treat shop)
  app.get("/api/desk/links", (_req, res) => res.json({ notion: config.planner?.notionUrl || null }));

  // The archive: every day that has a page, newest first (each one read with /api/desk/:day)
  app.get("/api/desk/days", async (_req, res) => {
    const files = await readdir(deskDir).catch(() => []);
    res.set("Cache-Control", "no-store").json(files.map((f) => dayKey(f.replace(/\.json$/, ""))).filter(Boolean).sort().reverse());
  });
  // What each of several days holds, in a line (the week view, days ahead): ?days=YYYY-MM-DD,… (at most 31). A day
  // with no file is { written: false }; one still coming from iCloud is null (the page says so, never "nothing")
  app.get("/api/desk/summary", async (req, res) => {
    const days = String(req.query.days || "").split(",").map(dayKey).filter(Boolean).slice(0, 31);
    const out = {};
    for (const d of days) {
      const r = await room.read(path.join(deskDir, `${d}.json`));
      out[d] = r.state === "ok" ? daySummary(r.data) : r.state === "missing" ? daySummary({}) : null;
    }
    res.set("Cache-Control", "no-store").json(out);
  });
  app.get("/api/desk/:day", roomRoute(async (req, res) => {
    const day = dayKey(req.params.day);
    if (!day) return res.status(400).json({ error: "Which day?" });
    // the day itself must really be read (a page that got "empty" for a day still in iCloud would save over it): 503
    // until it's here. The week before is only hints and the sweep (never written back), so a missing one is empty.
    const { data, rev } = await room.load(path.join(deskDir, `${day}.json`), {});
    const earlier = {};
    for (let i = 1; i <= CARRY_DAYS; i++) { const d = stepDay(day, -i); earlier[d] = deskShape(await readJson(path.join(deskDir, `${d}.json`), {})); }
    // fixed: the sections every day has (config/areas.json planner.fixedSections; Settings will edit them, step 6)
    res.set("Cache-Control", "no-store").json({ day: deskShape(data), rev, earlier, v: DESK_VERSION, fixed: settings().fixedSections, usual: settings().day });
  }));
  app.put("/api/desk/:day", roomRoute(async (req, res) => {
    const day = dayKey(req.params.day);
    if (!day) return res.status(400).json({ error: "That day's notes couldn't be saved" });
    // page and server must save a day the same way, or fields would be dropped without a word: refuse instead
    const clash = versionClash(req.body?.v);
    if (clash) return res.status(409).json({ error: CLASH_TEXT[clash], stale: clash });
    // the file is kept with the version that wrote it, so an older Hanua (the other Mac, not yet updated) refuses to
    // save over a newer one instead of dropping its fields
    const guard = (cur) => { if (fileTooNew(cur?.v, DESK_VERSION)) throw Object.assign(new Error(CLASH_TEXT.server), { status: 409, stale: "server" }); };
    const { data, rev } = await room.write(path.join(deskDir, `${day}.json`), { ...deskShape(req.body), v: DESK_VERSION }, { base: baseOf(req.body), guard });
    res.json({ ...deskShape(data), rev });
  }));
}
