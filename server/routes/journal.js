// The Journal (Mel, 15 Oct 2026; brief docs/plans/2026-10-journal.md): one page a week in the Notion Journal database,
// a heading per area with the words under it (public/shared/journal.js shapes it both ways). Notion is the home: Hanua
// reads a week when it's opened and writes it only when Mel presses Save (the confirm step), replacing that page's
// body; a week is binned to Notion's trash (and brought back by Undo), never deleted. Never a book (config areas[]),
// so Ask Claude and the Feed can't reach it; Reflect sends a week to Claude only on Mel's press. A sample server keeps
// invented weeks in memory (and server/notion.js refuses any page or block write there anyway).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { archivePage, createPageWithBody, notionEnabled, pageBlocks, pageSections, queryArea, replaceBody, restorePage, updatePage } from "../notion.js";
import { claudeEnabled, reflectJournal } from "../claude.js";
import { addDays, todayStr, weekKey } from "../../public/shared/dates.js";
import { AREAS, areasWritten, fromBlocks, isEmpty, journalShape, toBlocks, weekOf, weekTitle, FREELY } from "../../public/shared/journal.js";

export async function register({ app, root, config }) {
  const cfg = config.journal;
  const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8")).journal || {};
  const live = () => notionEnabled() && Boolean(cfg?.notionDatabaseId);
  const area = () => ({ id: "journal", ...cfg });
  const f = cfg?.fields || { title: "Week", date: "Week of", areas: "Areas", writtenIn: "Written in" };
  const plain = (err) => (err.status === 404 ? "Hanua can't see the Journal yet: in Notion, open Journal (on the Hanua page), then ••• → Connections → add Hanua."
    : err.status === 403 ? "Hanua isn't allowed to write the Journal: in Notion, check the Hanua connection can insert and update content."
    : `Couldn't reach the Journal in Notion (${err.message}).`);

  // ---- sample weeks: invented, in memory while this server runs ----
  const mem = new Map();
  for (const w of sample.weeks || []) {
    const week = weekOf(addDays(todayStr(), -7 * (w.weeksAgo || 0)));
    mem.set(week, { id: `sample-journal-${week}`, url: null, edited: new Date().toISOString(), sections: journalShape(w).sections });
  }

  // the question pages: every bullet under each heading of "Hanua journal prompts" (5 minutes in memory)
  let promptsCache = null;
  app.get("/api/journal/prompts", async (_req, res) => {
    const id = /([0-9a-f]{32})(?:[?#]|$)/i.exec(cfg?.promptsUrl || "")?.[1];
    if (!notionEnabled() || !id) return res.json({ prompts: sample.prompts || {}, url: cfg?.promptsUrl || null, live: false });
    if (promptsCache && Date.now() - promptsCache.at < 300_000) return res.json(promptsCache.value);
    try {
      const value = { prompts: await pageSections(id), url: cfg.promptsUrl, live: true };
      promptsCache = { at: Date.now(), value };
      res.json(value);
    } catch (err) {
      res.json({ prompts: {}, url: cfg.promptsUrl, live: true, error: err.status === 404 || err.status === 403
        ? "Hanua can't see the journal prompts yet: in Notion, open “Hanua journal prompts”, then ••• → Connections → add Hanua."
        : `Couldn't read the journal prompts (${err.message}).` });
    }
  });

  // the weeks written, newest first (for the list and the fale): week, areas, link; never the words
  app.get("/api/journal", async (_req, res) => {
    if (!live()) return res.json({ live: false, weeks: [...mem.entries()].map(([week, p]) => ({ week, areas: areasWritten(p.sections), url: null })).sort((a, b) => b.week.localeCompare(a.week)) });
    try {
      const rows = await queryArea(area(), cfg.limit || 60);
      const weeks = rows.map((r) => ({ week: /^\d{4}-\d{2}-\d{2}/.test(String(r.fields?.[f.date] || "")) ? weekOf(String(r.fields[f.date]).slice(0, 10)) : null, areas: String(r.fields?.[f.areas] || "").split(/,\s*/).filter(Boolean), url: r.url }))
        .filter((w) => w.week).sort((a, b) => b.week.localeCompare(a.week));
      res.json({ live: true, weeks });
    } catch (err) { res.json({ live: true, weeks: [], error: plain(err) }); }
  });

  // the page for one week (made only when something is saved)
  async function pageFor(week) {
    const rows = await queryArea(area(), 5, { property: f.date, date: { equals: week } });
    return rows[0] || null;
  }
  app.get("/api/journal/:week", async (req, res) => {
    const week = weekKey(req.params.week);
    if (!week) return res.status(400).json({ error: "Which week?" });
    if (!live()) { const p = mem.get(week); return res.json({ live: false, week, id: p?.id || null, url: null, edited: p?.edited || null, sections: journalShape(p || {}).sections }); }
    try {
      const p = await pageFor(week);
      res.set("Cache-Control", "no-store").json({ live: true, week, id: p?.id || null, url: p?.url || null, edited: p?.edited || null, sections: p ? fromBlocks(await pageBlocks(p.id)) : journalShape({}).sections });
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // Save: the week's page made, or its body replaced. base: the edited time this page read (a change made since,
  // on the phone or the other Mac, is refused with 409 so nothing is written over unseen)
  app.put("/api/journal/:week", async (req, res) => {
    const week = weekKey(req.params.week);
    if (!week) return res.status(400).json({ error: "Which week?" });
    const { sections } = journalShape(req.body || {});
    const base = req.body?.base ?? null;
    if (!live()) {
      const p = mem.get(week);
      if (p && base && p.edited !== base) return res.status(409).json({ error: "This week was changed somewhere else since you opened it.", conflict: "changed", edited: p.edited });
      if (!p && isEmpty(sections)) return res.json({ live: false, week, id: null, edited: null });
      const next = { id: p?.id || `sample-journal-${week}`, url: null, edited: new Date().toISOString(), sections };
      mem.set(week, next);
      return res.json({ live: false, week, id: next.id, url: null, edited: next.edited });
    }
    try {
      const props = {
        [f.areas]: { multi_select: areasWritten(sections).filter((a) => [...AREAS, FREELY].includes(a)).map((name) => ({ name })) },
        [f.writtenIn]: { select: { name: "Hanua" } },
      };
      let p = await pageFor(week);
      if (p && base && p.edited !== base) return res.status(409).json({ error: "This week was changed somewhere else since you opened it.", conflict: "changed", edited: p.edited });
      if (!p) {
        if (isEmpty(sections)) return res.json({ live: true, week, id: null, edited: null });
        p = await createPageWithBody(area(), { ...props, [f.title]: { title: [{ text: { content: weekTitle(week) } }] }, [f.date]: { date: { start: week } } }, toBlocks(sections));
      } else {
        await replaceBody(p.id, toBlocks(sections));
        p = await updatePage(p.id, props, cfg.fields);
      }
      res.json({ live: true, week, id: p.id, url: p.url, edited: p.edited });
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // a week to Notion's trash (restorable there for 30 days), and back (Undo)
  app.post("/api/journal/:week/trash", async (req, res) => {
    const week = weekKey(req.params.week);
    if (!live()) { const p = mem.get(week); if (p) { mem.delete(week); trashed.set(week, p); } return res.json({ ok: Boolean(p) }); }
    try { const p = await pageFor(week); if (!p) return res.json({ ok: false }); await archivePage(p.id); trashed.set(week, { id: p.id }); res.json({ ok: true, id: p.id }); }
    catch (err) { res.status(502).json({ error: plain(err) }); }
  });
  const trashed = new Map();
  app.post("/api/journal/:week/restore", async (req, res) => {
    const week = weekKey(req.params.week), p = trashed.get(week);
    if (!p) return res.status(404).json({ error: "Nothing to bring back" });
    if (!live()) { mem.set(week, p); trashed.delete(week); return res.json({ ok: true }); }
    try { await restorePage(p.id); trashed.delete(week); res.json({ ok: true }); }
    catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // Reflect: this week's words (as on the page, saved or not) read back by Claude, on Mel's press only
  app.post("/api/journal/:week/reflect", async (req, res, next) => {
    const week = weekKey(req.params.week);
    const { sections } = journalShape(req.body || {});
    if (isEmpty(sections)) return res.status(400).json({ error: "Write something first: Claude reads what's on the page." });
    if (!claudeEnabled()) return res.status(503).json({ error: "Claude isn't set up on this Mac (ANTHROPIC_API_KEY in .env)." });
    try { res.json({ reflection: await reflectJournal(week, sections) }); } catch (err) { next(err); }
  });
}
