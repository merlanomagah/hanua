// The Work reflection (Mel, 16 Oct 2026; brief docs/plans/2026-10-work-reflection.md): a reflection is a page in the
// Notion Work reflections database (config journal.work), its questions and answers in the body (public/shared/
// reflect.js shapes it both ways). Its own database, so nothing here can reach the Journal's weekly pages. Hanua
// reads Mel's role page ("Hanua work reflection: my role") for the questions and the panels, never stores it, and
// writes a reflection only when she presses Save; Bin moves it to Notion's trash (Undo brings it back). The coach
// panels send her answers and the role page to Claude only on her press, and only from here (npm run check, rule 8).
// A sample server keeps invented reflections in memory and answers the panels with invented text.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { archivePage, createPageWithBody, getPage, notionEnabled, pageBlocks, pageSections, queryArea, replaceBody, restorePage, updatePage } from "../notion.js";
import { claudeEnabled, coachWorkReflection } from "../claude.js";
import { todayStr, addDays } from "../../public/shared/dates.js";
import { answered, fromBlocks, isEmpty, panelsText, reflectionShape, reflectionTitle, roleFrom, toBlocks } from "../../public/shared/reflect.js";

export async function register({ app, root, config }) {
  const cfg = config.journal?.work;
  const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8")).journal?.work || {};
  const live = () => notionEnabled() && Boolean(cfg?.notionDatabaseId);
  const area = () => ({ id: "work-reflections", ...cfg });
  const f = cfg?.fields || { title: "Reflection", date: "Date", role: "Role", panels: "Panels kept", writtenIn: "Written in" };
  const plain = (err) => (err.status === 404 ? "Hanua can't see Work reflections yet: in Notion, open Work reflections (on the Hanua page), then ••• → Connections → add Hanua."
    : err.status === 403 ? "Hanua isn't allowed to write Work reflections: in Notion, check the Hanua connection can insert and update content."
    : `Couldn't reach Work reflections in Notion (${err.message}).`);
  const idOk = (id) => /^[0-9a-f-]{32,36}$/i.test(id) || /^sample-work-\d+$/.test(id);

  // ---- sample reflections: invented, in memory while this server runs ----
  const mem = new Map();
  let made = 0;
  for (const r of sample.reflections || []) {
    const id = `sample-work-${++made}`;
    mem.set(id, { id, url: null, edited: new Date().toISOString(), role: sample.role?.Role?.[0] || "", ...reflectionShape({ ...r, date: addDays(todayStr(), -(r.daysAgo || 0)) }) });
  }
  const listOf = (p) => ({ id: p.id, date: p.date, title: reflectionTitle(p.date), url: p.url || null, panelsKept: Boolean(p.panels) });

  // the role page: role, last confirmed, questions and who sits on each panel (5 minutes in memory)
  let roleCache = null;
  async function readRole() {
    const id = /([0-9a-f]{32})(?:[?#]|$)/i.exec(cfg?.roleUrl || "")?.[1];
    if (!notionEnabled() || !id) return { live: false, url: cfg?.roleUrl || null, ...roleFrom(sample.role || {}) };
    if (roleCache && Date.now() - roleCache.at < 300_000) return roleCache.value;
    const value = { live: true, url: cfg.roleUrl, ...roleFrom(await pageSections(id)) };
    roleCache = { at: Date.now(), value };
    return value;
  }
  app.get("/api/work/role", async (_req, res) => {
    try {
      const r = await readRole();
      // the page needs the questions and the seats' names; the context stays on the server (it's for the panels)
      res.json({ live: r.live, url: r.url, role: r.role, confirmed: r.confirmed, questions: r.questions, panels: { hp: r.panels.hp.map((s) => s.seat), professional: r.panels.professional.map((s) => s.seat) } });
    } catch (err) {
      res.json({ live: true, url: cfg?.roleUrl || null, role: "", confirmed: null, questions: {}, panels: { hp: [], professional: [] }, error: err.status === 404 || err.status === 403
        ? "Hanua can't see your role page yet: in Notion, open “Hanua work reflection: my role”, then ••• → Connections → add Hanua."
        : `Couldn't read your role page (${err.message}).` });
    }
  });

  // the reflections, newest first: date, title, link; never the words
  async function list() {
    if (!live()) return [...mem.values()].map(listOf).sort((a, b) => b.date.localeCompare(a.date));
    const rows = await queryArea(area(), cfg.limit || 60);
    return rows.map((r) => ({ id: r.id, date: String(r.fields?.[f.date] || "").slice(0, 10), title: r.fields?.[f.title] || "", url: r.url, panelsKept: r.fields?.[f.panels] === true }))
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a, b) => b.date.localeCompare(a.date));
  }
  app.get("/api/work", async (_req, res) => {
    try { res.json({ live: live(), items: await list() }); } catch (err) { res.json({ live: true, items: [], error: plain(err) }); }
  });

  async function read(id) {
    if (!live()) { const p = mem.get(id); return p ? { live: false, ...p } : null; }
    let row;
    try { row = await getPage(id, cfg.fields); } catch (err) { if (err.status === 404) return null; throw err; }
    // only a page of Work reflections (it has the Panels kept column): an id from anywhere else, the Journal's weeks
    // included, is never read or written here
    if (!row || !(f.panels in (row.fields || {}))) return null;
    return { live: true, id: row.id, url: row.url, edited: row.edited, role: row.fields?.[f.role] || "", ...fromBlocks(await pageBlocks(row.id)), date: String(row.fields?.[f.date] || "").slice(0, 10) };
  }

  // The panels (registered before /:id): this reflection as it is on screen, saved or not, read by the two panels.
  app.post("/api/work/panels", async (req, res, next) => {
    const r = reflectionShape(req.body?.reflection || {});
    if (isEmpty(r)) return res.status(400).json({ error: "Answer a question or two first: the panels read what you wrote." });
    if (!claudeEnabled()) {
      if (live()) return res.status(503).json({ error: "Claude isn't set up on this Mac (ANTHROPIC_API_KEY in .env)." });
      return res.json({ live: false, reply: sample.panels, text: panelsText(sample.panels) }); // a sample server: invented
    }
    try {
      const role = await readRole();
      let last = [];
      const prev = (await list()).find((x) => x.id !== req.body?.id);
      if (prev) last = answered((await read(prev.id)) || {});
      const reply = await coachWorkReflection({ role: role.role, context: role.context, panels: role.panels, answers: answered(r), last });
      res.json({ live: true, reply, text: panelsText(reply) });
    } catch (err) { next(err); }
  });

  app.get("/api/work/:id", async (req, res) => {
    if (!idOk(req.params.id)) return res.status(400).json({ error: "Which reflection?" });
    try {
      const p = await read(req.params.id);
      if (!p) return res.status(404).json({ error: "That reflection isn't there any more (binned in Notion?)." });
      res.set("Cache-Control", "no-store").json(p);
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  const props = (r, role) => ({
    [f.role]: { rich_text: role ? [{ text: { content: String(role).slice(0, 200) } }] : [] },
    [f.panels]: { checkbox: Boolean(r.panels && r.panels.trim()) },
    [f.writtenIn]: { select: { name: "Hanua" } },
  });
  // A new reflection (made only when something is written)
  app.post("/api/work", async (req, res) => {
    const r = reflectionShape(req.body?.reflection || {});
    const date = r.date || todayStr();
    if (isEmpty(r)) return res.status(400).json({ error: "Nothing written yet." });
    let role = "";
    try { role = (await readRole()).role; } catch { /* saved without the role: the page still says it */ }
    if (!live()) {
      const id = `sample-work-${++made}`;
      const p = { id, url: null, edited: new Date().toISOString(), role, ...r, date };
      mem.set(id, p);
      return res.json({ live: false, ...listOf(p), edited: p.edited });
    }
    try {
      const p = await createPageWithBody(area(), { ...props(r, role), [f.title]: { title: [{ text: { content: reflectionTitle(date) } }] }, [f.date]: { date: { start: date } } }, toBlocks(r));
      res.json({ live: true, id: p.id, date, title: reflectionTitle(date), url: p.url, edited: p.edited });
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // Save over one: its body replaced. base: the edited time this page read (changed since → 409, nothing written)
  app.put("/api/work/:id", async (req, res) => {
    const id = req.params.id;
    if (!idOk(id)) return res.status(400).json({ error: "Which reflection?" });
    const r = reflectionShape(req.body?.reflection || {});
    const base = req.body?.base ?? null;
    if (!live()) {
      const p = mem.get(id);
      if (!p) return res.status(404).json({ error: "That reflection isn't there any more." });
      if (base && p.edited !== base) return res.status(409).json({ error: "This reflection was changed somewhere else since you opened it.", conflict: "changed", edited: p.edited });
      const next = { ...p, ...r, date: p.date, edited: new Date().toISOString() };
      mem.set(id, next);
      return res.json({ live: false, ...listOf(next), edited: next.edited });
    }
    try {
      const p = await read(id);
      if (!p) return res.status(404).json({ error: "That reflection isn't there any more (binned in Notion?)." });
      if (base && p.edited !== base) return res.status(409).json({ error: "This reflection was changed somewhere else since you opened it.", conflict: "changed", edited: p.edited });
      await replaceBody(p.id, toBlocks(r));
      const saved = await updatePage(p.id, props(r, p.role), cfg.fields);
      res.json({ live: true, id: p.id, date: p.date, title: reflectionTitle(p.date), url: saved.url, edited: saved.edited });
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // to Notion's trash (restorable there for 30 days), and back (Undo)
  const trashed = new Map();
  app.post("/api/work/:id/trash", async (req, res) => {
    const id = req.params.id;
    if (!idOk(id)) return res.status(400).json({ error: "Which reflection?" });
    if (!live()) { const p = mem.get(id); if (p) { mem.delete(id); trashed.set(id, p); } return res.json({ ok: Boolean(p) }); }
    try { const p = await read(id); if (!p) return res.json({ ok: false }); await archivePage(p.id); trashed.set(id, { id: p.id }); res.json({ ok: true }); } catch (err) { res.status(502).json({ error: plain(err) }); }
  });
  app.post("/api/work/:id/restore", async (req, res) => {
    const id = req.params.id, p = trashed.get(id);
    if (!p) return res.status(404).json({ error: "Nothing to bring back" });
    if (!live()) { mem.set(id, p); trashed.delete(id); return res.json({ ok: true }); }
    try { await restorePage(p.id); trashed.delete(id); res.json({ ok: true }); } catch (err) { res.status(502).json({ error: plain(err) }); }
  });
}
