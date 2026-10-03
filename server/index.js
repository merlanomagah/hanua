import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { notionEnabled, queryArea, getSchema, toNotionProperties, createPage, updatePage, NotionError } from "./notion.js";
import { claudeEnabled, ask, draftEntry } from "./claude.js";
import { getMoney } from "./money.js";
import { musicStatus, musicAction, playPlaylist } from "./music.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, "config/areas.json"), "utf8"));
const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8"));

const recordCrate = JSON.parse(await readFile(path.join(root, "config/records.json"), "utf8")).records;
const goalsArea = config.goals ? { id: "goals", ...config.goals } : null;

const isLive = (area) => notionEnabled() && Boolean(area.notionDatabaseId);
const notionUrl = (area) => (area.notionDatabaseId ? `https://www.notion.so/${area.notionDatabaseId}` : null);
const findArea = (id) => config.areas.find((a) => a.id === id);

// Short cache so clicking around the tree doesn't hammer Notion's rate limit (~3 req/s).
const cache = new Map();
const CACHE_MS = 60_000;

// Sample data is written around 3 Oct 2026; shift it so the daily view always looks like today.
const SAMPLE_ANCHOR = new Date(2026, 9, 3);
function shiftDate(value) {
  if (!value) return value;
  const today = new Date();
  const offset = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - SAMPLE_ANCHOR) / 86_400_000);
  const [day, time] = value.split("T");
  const [y, m, d] = day.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + offset);
  const out = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
  return time ? `${out}T${time}` : out;
}

async function recordsFor(area, { fresh = false } = {}) {
  if (!isLive(area)) {
    return (sample[area.id] || []).map((r, i) => ({ id: `sample-${area.id}-${i}`, url: null, fields: {}, ...r, date: shiftDate(r.date) }));
  }
  const hit = cache.get(area.id);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.records;
  const records = await queryArea(area);
  cache.set(area.id, { at: Date.now(), records });
  return records;
}

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ notion: notionEnabled(), claude: claudeEnabled() });
});

app.get("/api/areas", async (_req, res, next) => {
  try {
    const areas = await Promise.all(
      config.areas.map(async (area) => {
        const base = { id: area.id, label: area.label, icon: area.icon, color: area.color, summary: area.summary, live: isLive(area), notionUrl: notionUrl(area) };
        try {
          return { ...base, records: await recordsFor(area) };
        } catch (err) {
          // One broken database shouldn't take down the whole tree.
          return { ...base, records: [], error: err.message };
        }
      }),
    );
    res.json({ centre: config.centre, areas, status: { notion: notionEnabled(), claude: claudeEnabled() } });
  } catch (err) {
    next(err);
  }
});

app.get("/api/areas/:id", async (req, res, next) => {
  const area = findArea(req.params.id);
  if (!area) return res.status(404).json({ error: "Unknown area" });
  try {
    res.json({ records: await recordsFor(area, { fresh: true }), live: isLive(area) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/money", async (_req, res, next) => {
  try {
    res.json(await getMoney());
  } catch (err) {
    next(err);
  }
});

// Tick a task off: sets the area's status column to "Done" in Notion.
app.post("/api/areas/:id/records/:recordId/done", async (req, res, next) => {
  const area = findArea(req.params.id);
  if (!area || !isLive(area)) return res.json({ ok: true, live: false }); // sample data: ticked in the browser only
  const statusField = area.fields?.status;
  if (!statusField) return res.status(400).json({ error: `${area.label} has no status column set in config/areas.json.` });
  try {
    const schema = await getSchema(area);
    const value = req.body?.done === false ? "Not started" : "Done";
    await updatePage(req.params.recordId, toNotionProperties(schema, [{ name: statusField, value }]));
    cache.delete(area.id);
    res.json({ ok: true, live: true });
  } catch (err) {
    next(err);
  }
});

// ---------- goals (the pin board). Notion is their home; Hanua reads and, once you confirm, edits them ----------

function toGoal(r) {
  const f = goalsArea.fields, v = r.fields || {};
  const progress = typeof r.amount === "number" ? Math.round(r.amount * 100) : null;
  return { id: r.id, url: r.url, title: r.title, due: r.date, status: r.status, progress, timeframe: v[f.timeframe] ?? null, area: v[f.area] ?? null, notes: v[f.notes] ?? "" };
}

// The pin board's form fields -> Notion column values.
function goalValues(values = {}) {
  const f = goalsArea.fields;
  const out = [];
  const put = (name, value) => { if (name && value !== undefined && value !== null && value !== "") out.push({ name, value: String(value) }); };
  put(f.title, values.title?.trim());
  put(f.status, values.status);
  put(f.timeframe, values.timeframe);
  put(f.area, values.area);
  put(f.date, values.due);
  put(f.notes, values.notes);
  if (values.progress !== undefined && values.progress !== "") put(f.amount, Math.min(100, Math.max(0, Number(values.progress))) / 100);
  return out;
}

app.get("/api/goals", async (_req, res) => {
  if (!goalsArea) return res.json({ goals: [], live: false, notionUrl: null });
  const base = { live: isLive(goalsArea), notionUrl: notionUrl(goalsArea) };
  try {
    res.json({ ...base, goals: (await recordsFor(goalsArea)).map(toGoal) });
  } catch (err) {
    res.json({ ...base, goals: [], error: err.message });
  }
});

app.post("/api/goals", async (req, res, next) => {
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false });
  if (!req.body?.values?.title?.trim()) return res.status(400).json({ error: "Give the goal a name." });
  try {
    const schema = await getSchema(goalsArea);
    const record = await createPage(goalsArea, toNotionProperties(schema, goalValues(req.body.values)));
    cache.delete(goalsArea.id);
    res.json({ ok: true, live: true, goal: toGoal(record) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/goals/:id", async (req, res, next) => {
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false });
  try {
    const schema = await getSchema(goalsArea);
    await updatePage(req.params.id, toNotionProperties(schema, goalValues(req.body?.values)));
    cache.delete(goalsArea.id);
    res.json({ ok: true, live: true });
  } catch (err) {
    next(err);
  }
});

// The record crate: Apple Music playlists listed in config/records.json.
app.get("/api/records", (_req, res) => res.json({ records: recordCrate }));

// The Music app on this Mac: what's playing, play/pause/next/previous, and starting a record.
app.get("/api/music", async (_req, res) => res.json(await musicStatus()));

app.post("/api/music/record", async (req, res, next) => {
  const record = recordCrate.find((r) => r.name === req.body?.name);
  if (!record) return res.status(404).json({ error: "That record isn't in the crate." });
  try {
    res.json(await playPlaylist(record.library || record.name, record.url));
  } catch (err) {
    next(err);
  }
});

app.post("/api/music/:action", async (req, res, next) => {
  try {
    res.json(await musicAction(req.params.action));
  } catch (err) {
    next(err);
  }
});

app.post("/api/ask", async (req, res, next) => {
  const { question, areaId } = req.body ?? {};
  if (!question?.trim()) return res.status(400).json({ error: "Ask a question first." });
  if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to use Ask Claude." });
  try {
    const areas = areaId ? [findArea(areaId)].filter(Boolean) : config.areas;
    const areaData = await Promise.all(areas.map(async (a) => ({ label: a.label, records: await recordsFor(a) })));
    res.json({ answer: await ask(question.trim(), areaData) });
  } catch (err) {
    next(err);
  }
});

// Step 1 of Feed: Claude drafts the row. Nothing is written yet.
app.post("/api/feed/draft", async (req, res, next) => {
  const { text } = req.body ?? {};
  if (!text?.trim()) return res.status(400).json({ error: "Type something to feed in." });
  if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to use Feed." });
  const live = config.areas.filter(isLive);
  if (!live.length) return res.status(503).json({ error: "Connect at least one Notion database to use Feed." });
  try {
    const withSchemas = await Promise.all(live.map(async (a) => ({ id: a.id, label: a.label, schema: await getSchema(a) })));
    const draft = await draftEntry(text.trim(), withSchemas);
    const target = withSchemas.find((a) => a.id === draft.areaId);
    // Drop anything Claude invented that isn't a real column.
    draft.properties = draft.properties.filter((p) => target.schema[p.name]);
    res.json({ draft, areaLabel: target.label });
  } catch (err) {
    next(err);
  }
});

// Step 2 of Feed: the user confirmed (and maybe edited) the draft.
app.post("/api/feed/commit", async (req, res, next) => {
  const { areaId, properties } = req.body ?? {};
  const area = findArea(areaId);
  if (!area || !isLive(area)) return res.status(400).json({ error: "That area isn't connected to Notion." });
  if (!Array.isArray(properties)) return res.status(400).json({ error: "Missing properties." });
  try {
    const schema = await getSchema(area);
    const record = await createPage(area, toNotionProperties(schema, properties));
    cache.delete(area.id);
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof NotionError) {
    const hint = err.status === 404 ? " (is the database shared with your integration?)" : "";
    return res.status(502).json({ error: `Notion: ${err.message}${hint}` });
  }
  if (err instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: "Claude: invalid API key." });
  if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Claude is rate limited - try again shortly." });
  if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `Claude: ${err.message}` });
  res.status(500).json({ error: err.message || "Something went wrong." });
});

const port = Number(process.env.PORT) || 3000;
// Bind to localhost only: this server holds your Notion and Claude keys.
app.listen(port, "127.0.0.1", () => {
  console.log(`Hanua running at http://localhost:${port}`);
  console.log(`  Notion: ${notionEnabled() ? "connected" : "not configured (showing sample data)"}`);
  console.log(`  Claude: ${claudeEnabled() ? "connected" : "not configured"}`);
});
