// The Jump Dashboard (10 Oct 2026; brief docs/plans/2026-10-jump-dashboard.md): three Jump OS databases in Notion,
// read only, shaped by public/shared/jump.js. Kept in memory for a minute and never written anywhere (Jump OS owns
// it: the signpost rule), so nothing of it reaches the room folder or the backups. Sample rows (invented) whenever
// Notion isn't connected, before any query, so sample servers and tests never reach the real Notion.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { notionEnabled, queryArea } from "../notion.js";
import { addDays, todayStr } from "../../public/shared/dates.js";
import { jumpFilters, rowOf, shapeJump } from "../../public/shared/jump.js";

const AREAS = ["escalations", "projects", "questions"];
const CACHE_MS = 60_000;

export async function register({ app, root, config }) {
  const cfg = config.jump;
  const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8")).jump || {};
  const cache = new Map();
  const live = () => notionEnabled() && Boolean(cfg);
  const linkOf = (id) => (id ? `https://www.notion.so/${id}` : null);

  // a sample row's "ago" days become dates around today, and its columns sit where Notion's would
  function sampleRows(area, today) {
    const fields = cfg?.[area]?.fields || {};
    const when = (n) => (typeof n === "number" ? addDays(today, -n) : null);
    return (sample[area] || []).map((r, i) => {
      const cols = { ...r, [fields.date]: area === "projects" ? (r.target == null ? null : when(-r.target)) : when(r.raised) };
      if (fields.closed) cols[fields.closed] = when(r.closed);
      return rowOf({ id: `sample-${area}-${i}`, url: null, title: r.title, fields: cols }, fields);
    });
  }

  async function rowsFor(area, today, fresh) {
    const a = cfg[area];
    if (!a?.notionDatabaseId) return { error: "Not set up in config/areas.json yet" };
    const hit = cache.get(area);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    try {
      const recs = await queryArea({ id: `jump-${area}`, ...a }, a.limit || 50, jumpFilters(cfg, today)[area]);
      const value = { rows: recs.map((r) => rowOf(r, a.fields)) };
      cache.set(area, { at: Date.now(), value });
      return value;
    } catch (err) {
      // the usual first-time problem: the database isn't shared with the integration yet
      const error = err.status === 404 ? "Hanua can't see this database yet: in Notion, open it, then ••• → Connections → add Hanua." : `Couldn't read Jump OS (${err.message}).`;
      return { error };
    }
  }

  app.get("/api/jump", async (req, res, next) => {
    try {
      const today = todayStr(), fresh = req.query.fresh === "1";
      const isLive = live();
      const sources = Object.fromEntries(await Promise.all(AREAS.map(async (area) =>
        [area, isLive ? await rowsFor(area, today, fresh) : { rows: sampleRows(area, today) }])));
      res.json({
        live: isLive, sample: !isLive, fetchedAt: new Date().toISOString(), today,
        ...shapeJump(sources, today, {
          closedStatus: cfg?.escalations?.closedStatus, showStatuses: cfg?.projects?.showStatuses,
          openStatuses: cfg?.questions?.openStatuses, blocking: cfg?.questions?.blocking }),
        section: cfg?.section || "Jump issues",
        links: isLive ? [
          { label: "Jump OS", url: cfg.notionUrl || null },
          ...AREAS.map((a) => ({ label: { escalations: "Escalation log", projects: "Project tracker", questions: "Open questions" }[a], url: linkOf(cfg[a]?.notionDatabaseId) })),
        ].filter((l) => l.url) : [],
      });
    } catch (err) {
      next(err);
    }
  });
}
