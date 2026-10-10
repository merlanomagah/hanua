// The Jump Dashboard (10 Oct 2026; briefs docs/plans/2026-10-jump-dashboard.md and -v2.md): three Jump OS databases in
// Notion, shaped by public/shared/jump.js. Read: a minute in memory, never written anywhere (Jump OS owns it). Write
// (v2): every change goes through checkWrite (only the allowed fields, only Jump OS's own choices, its rules for
// closing and answering), then to Notion, and the minute's copy takes the row Notion sends back. A sample server
// keeps invented rows in memory and changes those instead, before any call to Notion (and server/notion.js refuses
// page writes on a sample server anyway), so tests never touch the real Jump OS.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { archivePage, clearedProperties, createPage, getPage, getSchema, notionEnabled, queryArea, toNotionProperties, updatePage } from "../notion.js";
import { addDays, todayStr } from "../../public/shared/dates.js";
import { DEFAULT_OPTIONS, WRITABLE, applyTo, checkWrite, jumpFilters, rowOf, shapeJump, undoOf } from "../../public/shared/jump.js";

const AREAS = ["escalations", "projects", "questions"];
const CACHE_MS = 60_000;
const LABELS = { escalations: "Escalation log", projects: "Project tracker", questions: "Open questions" };

export async function register({ app, root, config }) {
  const cfg = config.jump;
  const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8")).jump || {};
  const cache = new Map();
  const live = () => notionEnabled() && Boolean(cfg);
  const linkOf = (id) => (id ? `https://www.notion.so/${id}` : null);
  const areaOf = (name) => (AREAS.includes(name) && cfg?.[name] ? { id: `jump-${name}`, ...cfg[name] } : null);
  const rules = { closedStatus: cfg?.escalations?.closedStatus, answered: cfg?.questions?.answered, wontResolve: cfg?.questions?.wontResolve };

  // ---- sample rows: invented, in memory for as long as this server runs (writes change them; nothing is saved) ----
  function sampleRows(area, today) {
    const fields = cfg?.[area]?.fields || {};
    const when = (n) => (typeof n === "number" ? addDays(today, -n) : null);
    return (sample[area] || []).map((r, i) => {
      const cols = { ...r, [fields.date]: area === "projects" ? (r.target == null ? null : when(-r.target)) : when(r.raised) };
      if (fields.closed) cols[fields.closed] = when(r.closed);
      return rowOf({ id: `sample-${area}-${i}`, url: null, title: r.title, fields: cols }, fields);
    });
  }
  const mem = Object.fromEntries(AREAS.map((a) => [a, sampleRows(a, todayStr())]));
  let made = 0;

  // ---- reading ----
  async function rowsFor(area, today, fresh) {
    const a = areaOf(area);
    if (!a?.notionDatabaseId) return { error: "Not set up in config/areas.json yet" };
    const hit = cache.get(area);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    try {
      const recs = await queryArea(a, a.limit || 50, jumpFilters(cfg, today)[area]);
      const value = { rows: recs.map((r) => rowOf(r, a.fields)) };
      cache.set(area, { at: Date.now(), value });
      return value;
    } catch (err) {
      return { error: plain(err) };
    }
  }
  const plain = (err) => (err.status === 404 ? "Hanua can't see this database yet: in Notion, open it, then ••• → Connections → add Hanua."
    : err.status === 403 ? "Hanua isn't allowed to change this database: in Notion, check the Hanua connection can insert and update content."
    : `Couldn't reach Jump OS (${err.message}).`);
  // the choices Jump OS offers for each select column (Notion's own list; the defaults on sample servers)
  async function optionsFor(area) {
    const fields = cfg?.[area]?.fields || {}, out = {};
    const selects = Object.entries(WRITABLE[area]).filter(([, kind]) => kind === "select").map(([k]) => k);
    if (!live()) { for (const k of selects) out[k] = DEFAULT_OPTIONS[area]?.[k] || []; return out; }
    const schema = await getSchema(areaOf(area));
    for (const k of selects) out[k] = schema[fields[k]]?.options || [];
    return out;
  }
  async function allOptions() {
    const out = {};
    for (const a of AREAS) { try { out[a] = await optionsFor(a); } catch { out[a] = {}; } }
    return out;
  }

  app.get("/api/jump", async (req, res, next) => {
    try {
      const today = todayStr(), fresh = req.query.fresh === "1";
      const isLive = live();
      const sources = Object.fromEntries(await Promise.all(AREAS.map(async (area) =>
        [area, isLive ? await rowsFor(area, today, fresh) : { rows: mem[area] }])));
      const options = await allOptions();
      res.json({
        live: isLive, sample: !isLive, fetchedAt: new Date().toISOString(), today, options,
        ...shapeJump(sources, today, { closedStatus: rules.closedStatus, showStatuses: cfg?.projects?.showStatuses,
          openStatuses: cfg?.questions?.openStatuses, blocking: cfg?.questions?.blocking, options }),
        section: cfg?.section || "Jump issues",
        links: isLive ? [{ label: "Jump OS", url: cfg.notionUrl || null }, ...AREAS.map((a) => ({ label: LABELS[a], url: linkOf(cfg[a]?.notionDatabaseId) }))].filter((l) => l.url) : [],
      });
    } catch (err) {
      next(err);
    }
  });

  // ---- writing (v2) ----
  // the Notion properties for checked values (empty ones cleared: only an Undo empties a field)
  function propsFor(area, schema, values) {
    const fields = cfg[area].fields;
    const set = [], clear = [];
    for (const [k, v] of Object.entries(values)) {
      const col = fields[k];
      if (!col || !schema[col]) throw Object.assign(new Error(`Jump OS has no “${col || k}” column (config/areas.json jump)`), { status: 400 });
      if (v == null) clear.push(col); else set.push({ name: col, value: v });
    }
    return { ...toNotionProperties(schema, set), ...clearedProperties(schema, clear) };
  }
  const putInCache = (area, row) => { const hit = cache.get(area); if (hit?.value?.rows) hit.value.rows = hit.value.rows.some((r) => r.id === row.id) ? hit.value.rows.map((r) => (r.id === row.id ? row : r)) : [row, ...hit.value.rows]; };
  const dropFromCache = (area, id) => { const hit = cache.get(area); if (hit?.value?.rows) hit.value.rows = hit.value.rows.filter((r) => r.id !== id); };
  const created = new Map(); // id → when: only what this Hanua added can be binned (Undo of an add)

  // add (escalations only): { change } → { ok, live, row }
  app.post("/api/jump/:area", async (req, res, next) => {
    const area = req.params.area;
    if (area !== "escalations" || !areaOf(area)) return res.status(400).json({ error: "Only escalations can be added from Hanua." });
    try {
      const today = todayStr(), options = await optionsFor(area);
      const check = checkWrite(area, req.body?.change, { options, today, create: true, cfg: rules });
      if (!check.ok) return res.status(400).json({ error: check.error });
      if (!live()) {
        const row = applyTo({ id: `sample-${area}-new-${++made}`, url: null, title: "", status: null, tier: null, date: null, closed: null, waitingOn: null, raisedBy: null, finding: null, issueSet: false, outcomeSet: false }, check.values);
        mem[area].unshift(row); created.set(row.id, Date.now());
        return res.json({ ok: true, live: false, row });
      }
      const a = areaOf(area), schema = await getSchema(a);
      const row = rowOf(await createPage(a, propsFor(area, schema, check.values)), a.fields);
      putInCache(area, row); created.set(row.id, Date.now());
      res.json({ ok: true, live: true, row });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      if (err.status) return res.status(502).json({ error: plain(err) });
      next(err);
    }
  });

  // change: { change, undo? } → { ok, live, row, undo } (undo = the change that puts it back)
  app.post("/api/jump/:area/:id", async (req, res, next) => {
    const { area, id } = req.params;
    if (!areaOf(area)) return res.status(404).json({ error: "Unknown part of Jump OS" });
    try {
      const today = todayStr(), options = await optionsFor(area), undo = req.body?.undo === true;
      const isLive = live();
      const a = areaOf(area);
      const before = isLive ? rowOf(await getPage(id, a.fields), a.fields) : mem[area].find((r) => r.id === id);
      if (!before) return res.status(404).json({ error: "That isn't in Jump OS any more." });
      const check = checkWrite(area, req.body?.change, { options, row: before, today, undo, cfg: rules });
      if (!check.ok) return res.status(400).json({ error: check.error });
      let row;
      if (!isLive) {
        row = applyTo(before, check.values);
        mem[area] = mem[area].map((r) => (r.id === id ? row : r));
      } else {
        const schema = await getSchema(a);
        row = rowOf(await updatePage(id, propsFor(area, schema, check.values), a.fields), a.fields);
        putInCache(area, row);
      }
      res.json({ ok: true, live: isLive, row, undo: undoOf(before, check.values) });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      if (err.status) return res.status(502).json({ error: plain(err) });
      next(err);
    }
  });

  // Undo of an add: to Notion's trash (restorable there for 30 days); only what this Hanua added in the last hour
  app.post("/api/jump/:area/:id/trash", async (req, res, next) => {
    const { area, id } = req.params;
    const at = created.get(id);
    if (!areaOf(area) || !at || Date.now() - at > 60 * 60_000) return res.status(400).json({ error: "Only something just added from Hanua can be taken back here: anything else, change in Jump OS." });
    try {
      if (!live()) mem[area] = mem[area].filter((r) => r.id !== id);
      else { await archivePage(id); dropFromCache(area, id); }
      created.delete(id);
      res.json({ ok: true, live: live() });
    } catch (err) {
      if (err.status) return res.status(502).json({ error: plain(err) });
      next(err);
    }
  });
}
