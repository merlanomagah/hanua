import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { notionEnabled, queryArea, getSchema, toNotionProperties, createPage, updatePage, archivePage, pageSection, pageSections, NotionError } from "./notion.js";
import { claudeEnabled, ask, draftEntry, coachGoal, suggestChildren, suggestMeals } from "./claude.js";
import { getMoney, getMoneyMonth, isMonthKey } from "./money.js";
import { addEvent, addReminder, editEvent, getAppleEvents, getEventCalendars, removeEvent, getReminderLists, getShopping, removeReminder, setListNames, setReminderDone, showDay, showReminders } from "./calendar.js";
import { defaults as settingDefaults, settingsShape } from "../public/shared/settings.js";
import { musicStatus, musicAction, playPlaylist } from "./music.js";
import { toGoal, goalProperties, goalOptions } from "./goals.js";
import { rollUp } from "../public/shared/goals.js";
import { weekKey } from "../public/shared/dates.js";
import { MEALS, menuShape } from "../public/shared/menu.js";
import { dayKey, daySummary, deskShape, stepDay, stickyShape, versionClash, CARRY_DAYS, CLASH_TEXT, DESK_VERSION } from "../public/shared/desk.js";
import { lockStatus, setPin, checkPin } from "./lock.js";
import { getWeather } from "./weather.js";
import { backupDue, backupRoom, backupWarning, readStatus } from "./backup.js";
import os from "node:os";
import { watchForUpdates } from "./updates.js";
import { createRoom } from "./room.js";
import { localOnly, roomChoice } from "./guard.js";
import { parse as parseEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { fileTooNew, mergeStickies, mergeWatered } from "../public/shared/sync.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The real Hanua (scripts/start.sh sets HANUA_MAIN=1, not the sample servers): restarts itself on the new code when
// main moves, and on POST /api/restart (server/updates.js)
const isMain = process.env.HANUA_MAIN === "1";
const bootAt = new Date().toISOString();
let updates = null, server = null;
const config = JSON.parse(await readFile(path.join(root, "config/areas.json"), "utf8"));
const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8"));

const recordCrate = JSON.parse(await readFile(path.join(root, "config/records.json"), "utf8")).records;
const goalsArea = config.goals ? { id: "goals", ...config.goals } : null;
const reviewsArea = config.reviews ? { id: "reviews", ...config.reviews } : null;
const shopArea = config.shop ? { id: "shop", ...config.shop } : null;

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
    const shiftField = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? shiftDate(v) : v);
    return (sample[area.id] || []).map((r, i) => ({
      id: `sample-${area.id}-${i}`, url: null, ...r, date: shiftDate(r.date), edited: shiftDate(r.edited) ?? null,
      fields: Object.fromEntries(Object.entries(r.fields || {}).map(([k, v]) => [k, shiftField(v)])),
    }));
  }
  const hit = cache.get(area.id);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.records;
  const records = await queryArea(area, area.limit || 50);
  cache.set(area.id, { at: Date.now(), records });
  return records;
}

const app = express();
const port = Number(process.env.PORT) || 3000;
// only this Mac's own Hanua pages (and scripts on this Mac) may talk to it: server/guard.js
app.use(localOnly(port));
// small JSON everywhere; the whiteboard's drawings (a few hundred KB) have their own, larger limit
const smallJson = express.json({ limit: "100kb" });
app.use((req, res, next) => (req.path.startsWith("/api/board/") ? next() : smallJson(req, res, next)));
// a save in flight holds off a restart until things are quiet (server/updates.js)
app.use((req, _res, next) => { if (req.method !== "GET") updates?.wrote(); next(); });
// "no-cache" = Safari must ask each time whether a file changed (a quick 304 when it hasn't), so after an update
// it never keeps showing the old page from its cache (6 Oct 2026)
app.use(express.static(path.join(root, "public"), { setHeaders: (res) => res.set("Cache-Control", "no-cache") }));

// The sleep screen's PIN (a hash in data/lock.json, or LOCK_FILE; the sample preview uses its own file)
const lockFile = path.resolve(root, process.env.LOCK_FILE || "data/lock.json");
app.get("/api/lock", async (_req, res) => res.json(await lockStatus(lockFile)));
app.post("/api/lock/setup", async (req, res) => {
  try { await setPin(lockFile, req.body?.pin); res.json({ ok: true }); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});
app.post("/api/lock/check", async (req, res) => res.json(await checkPin(lockFile, req.body?.pin)));

// Things the room itself keeps, with no other home: planner days, menus, stickies, the plant's log, Settings.
// In data/room/ (gitignored), or, with ROOM_DATA in .env, one iCloud Drive folder both Macs share (6 Oct 2026):
// every read and write goes through server/room.js (still-coming files never read as empty, whole writes, a save
// refused if the other Mac changed the file since, the folder watched for the other Mac's changes).
// The sample preview keeps its own folder so tests never touch Mel's: a sample server (NOTION_TOKEN blanked) ignores
// the ROOM_DATA / BACKUP_DIR it would inherit from .env (server/guard.js roomChoice).
const fileEnv = (() => { try { return parseEnv(readFileSync(path.join(process.cwd(), ".env"))); } catch { return {}; } })();
const choice = roomChoice(process.env, fileEnv);
if (choice.ignored.length) console.log(`Hanua: a sample server, so .env's ${choice.ignored.join(" and ")} (Mel's real folder) is ignored`);
const home = (p) => (p && p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p); // the same .env line on both Macs
const roomDir = path.resolve(root, home(choice.room) || (notionEnabled() ? "data/room" : "data/room-sample"));
const sharedRoom = ![path.resolve(root, "data/room"), path.resolve(root, "data/room-sample")].includes(roomDir); // a folder of its own (iCloud): shared
const room = createRoom(roomDir, { shared: sharedRoom });
if (room.missing()) console.error(`Hanua: the shared room folder isn't there (${roomDir}). Nothing will save until it is (iCloud Drive on?)`);
const readJson = async (file, fallback) => { const r = await room.read(file); return r.state === "ok" ? r.data : fallback; }; // read-only uses (hints, the archive's neighbours)
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
// a room route: a refused save (409, the other Mac got there first) or a file still coming from iCloud (503) is
// answered with what the page needs to say so, never as a crash
const roomRoute = (fn) => async (req, res, next) => {
  try { await fn(req, res); }
  catch (err) {
    if (err.status === 409 || err.status === 503) return res.status(err.status).json({ error: err.message, conflict: err.conflict, stale: err.stale, pending: err.pending, current: err.current, rev: err.rev });
    next(err);
  }
};
const baseOf = (body) => (body && typeof body === "object" && "base" in body ? body.base ?? null : undefined);
const plantFile = path.join(roomDir, "plant.json");
app.get("/api/plant", roomRoute(async (_req, res) => {
  const { data } = await room.load(plantFile, { watered: [] });
  res.set("Cache-Control", "no-store").json({ watered: mergeWatered(data?.watered, []) });
}));
app.post("/api/plant/water", roomRoute(async (req, res) => {
  const day = req.body?.day;
  if (!isDay(day)) return res.status(400).json({ error: "Which day was it watered?" });
  // waterings from both Macs simply add up: never a clash
  const { data } = await room.write(plantFile, { watered: [day] }, { merge: (cur, v) => ({ ...(cur || {}), watered: mergeWatered(cur?.watered, v.watered) }) });
  res.json({ watered: data.watered });
}));
// The whiteboard: one PNG per week, named by its Monday
const boardDir = path.join(roomDir, "whiteboard");
app.get("/api/board", async (_req, res) => {
  const weeks = await readdir(boardDir).catch(() => []);
  res.json({ weeks: weeks.filter((f) => /^\d{4}-\d{2}-\d{2}\.png$/.test(f)).map((f) => f.slice(0, 10)).sort() });
});
app.get("/api/board/:week", async (req, res) => {
  if (!isDay(req.params.week)) return res.status(400).end();
  try { res.type("png").set("Cache-Control", "no-store").send(await readFile(path.join(boardDir, `${req.params.week}.png`))); }
  catch { res.status(404).end(); }
});
app.put("/api/board/:week", express.json({ limit: "6mb" }), roomRoute(async (req, res) => {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image || "");
  if (!isDay(req.params.week) || !m) return res.status(400).json({ error: "That drawing couldn't be saved" });
  if (room.missing()) return res.status(503).json({ error: "Hanua can't find its shared iCloud folder: nothing was saved" });
  await room.writeBytes(path.join(boardDir, `${req.params.week}.png`), Buffer.from(m[1], "base64"));
  res.json({ ok: true });
}));

// (Before /api/menu/:week, so these aren't taken for a week's name.)
// The household's tastes: the "Our tastes" section of the Notion Eating well guide (Notion is their home; Hanua
// only reads them, for Claude's meal ideas). Cached 5 minutes. Sample mode has made-up tastes.
const SAMPLE_TASTES = ["Dinners are shared; breakfasts and lunches are mostly mine.", "Partner: loves steak; no seafood except snapper; no mushrooms.", "Me: prawns, salmon and white fish are fine; not oysters, crab, mussels or octopus."];
let tastesCache = null;
async function readTastes() {
  const url = config.menu?.guideUrl || null;
  if (!notionEnabled()) return { tastes: SAMPLE_TASTES, url, sample: true };
  if (tastesCache && Date.now() - tastesCache.at < 300_000) return tastesCache.value;
  const id = /([0-9a-f]{32})(?:[?#]|$)/i.exec(url || "")?.[1];
  if (!id) return { tastes: [], url, error: "No Eating well guide is set in config/areas.json (menu.guideUrl)." };
  try {
    const value = { tastes: await pageSection(id, "Our tastes"), url };
    tastesCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    const error = err.status === 404 || err.status === 403
      ? "Hanua can't see the Eating well guide yet: in Notion, open it, then ••• → Connections → add Hanua."
      : `Couldn't read your tastes from Notion (${err.message}).`;
    return { tastes: [], url, error };
  }
}
app.get("/api/menu/tastes", async (_req, res) => res.json(await readTastes()));
// The kitchen window: today's and tomorrow's weather (Open-Meteo, cached 30 min; sample weather without WEATHER_PLACE)
app.get("/api/weather", async (_req, res) => res.json(await getWeather()));
// Three ideas around a protein, for one meal. Suggestions only: Mel picks, and the board is only changed in the page.
app.post("/api/menu/ideas", async (req, res, next) => {
  const { meal, day, protein, planned } = req.body ?? {};
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Which meal?" });
  if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to ask Claude for ideas." });
  try {
    const { tastes } = await readTastes();
    const clip = (v, n) => String(v || "").slice(0, n);
    res.json(await suggestMeals({ meal, day: clip(day, 30), protein: clip(protein, 40), tastes, planned: (Array.isArray(planned) ? planned : []).slice(0, 21).map((p) => clip(p, 120)) }));
  } catch (err) {
    next(err);
  }
});

// The menu: one small JSON file per week, named by its Monday, holding what was typed in each box
const menuDir = path.join(roomDir, "menu");
app.get("/api/menu/:week", roomRoute(async (req, res) => {
  if (!weekKey(req.params.week)) return res.status(400).json({ error: "Which week?" });
  const { data, rev } = await room.load(path.join(menuDir, `${req.params.week}.json`), {});
  res.set("Cache-Control", "no-store").json({ ...menuShape(data), guideUrl: config.menu?.guideUrl || null, rev });
}));
app.put("/api/menu/:week", roomRoute(async (req, res) => {
  if (!weekKey(req.params.week)) return res.status(400).json({ error: "That week's menu couldn't be saved" });
  const { data, rev } = await room.write(path.join(menuDir, `${req.params.week}.json`), menuShape(req.body), { base: baseOf(req.body) });
  res.json({ ...data, rev });
}));

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
// Sticky notes on the desk's wall: one small file, kept until each is taken down (taken-down notes are marked, not erased)
const stickiesFile = path.join(roomDir, "stickies.json");
app.get("/api/stickies", roomRoute(async (_req, res) => res.set("Cache-Control", "no-store").json(stickyShape((await room.load(stickiesFile, [])).data))));
// both Macs' notes merge, each note by its id, the later edit winning (taken-down notes stay marked, never erased)
app.put("/api/stickies", roomRoute(async (req, res) => {
  const { data } = await room.write(stickiesFile, stickyShape(req.body), { merge: (cur, mine) => stickyShape(mergeStickies(stickyShape(cur || []), mine)) });
  res.json(data);
}));
// Settings Mel changes herself (the desk's Settings window; public/shared/settings.js): on this Mac beside the days,
// so the nightly backup has them. Unset ones fall back to config/areas.json, .env and the code.
const settingsFile = path.join(roomDir, "settings.json");
const settingBase = () => settingDefaults(config.planner?.fixedSections || []);
let settings = settingsShape(await readJson(settingsFile, {}), settingBase()), settingsRev = (await room.read(settingsFile)).rev ?? null;
setListNames(settings.lists);
// the other Mac changed Settings (or they arrived from iCloud): use them here too
async function reloadSettings() {
  const r = await room.read(settingsFile);
  if (r.state !== "ok" && r.state !== "missing") return;
  settings = settingsShape(r.data || {}, settingBase()); settingsRev = r.rev;
  setListNames(settings.lists);
}
app.get("/api/settings", roomRoute(async (_req, res) => { await reloadSettings(); res.set("Cache-Control", "no-store").json({ settings, defaults: settingBase(), rev: settingsRev }); }));
app.put("/api/settings", async (req, res, next) => {
  try {
    const { data, rev } = await room.write(settingsFile, settingsShape(req.body, settingBase()), { base: baseOf(req.body) });
    settings = data; settingsRev = rev;
    setListNames(settings.lists);
    res.json({ settings, defaults: settingBase(), rev });
  } catch (err) {
    if (err.status === 409) { await reloadSettings(); return res.status(409).json({ error: err.message, conflict: err.conflict, settings, defaults: settingBase(), rev: settingsRev }); }
    if (err.status === 503) return res.status(503).json({ error: err.message, pending: true });
    next(err);
  }
});
app.get("/api/reminders/lists", async (_req, res) => { try { res.json(await getReminderLists()); } catch (err) { res.status(500).json({ error: err.message }); } });

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
  res.set("Cache-Control", "no-store").json({ day: deskShape(data), rev, earlier, v: DESK_VERSION, fixed: settings.fixedSections, usual: settings.day });
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

// The other Mac's changes, as they arrive (server-sent events, server/room.js), and how the sharing is going
app.get("/api/events", (req, res) => room.events(req, res));
app.get("/api/sync", (_req, res) => res.set("Cache-Control", "no-store").json(room.status()));
room.start((what) => { if (what.kind === "settings") reloadSettings().catch(() => {}); });

// The nightly backup of the room's data (server/backup.js): checked every 15 minutes while Hanua runs. The sample
// server backs up its own folder beside it; BACKUP_DIR in .env can point elsewhere, or say "off".
// With a shared room folder (in iCloud), the backup goes to this Mac's own disk, outside iCloud, so a wiped file can't
// carry into the copies; only one Mac backs up (the other sets BACKUP_DIR=off).
const backupDir = choice.backup === "off" ? null : path.resolve(root, choice.backup
  || (roomDir.endsWith("room-sample") ? "data/room-sample-backup"
    : sharedRoom ? path.join(os.homedir(), "Hanua backup")
      : path.join(os.homedir(), "Library/Mobile Documents/com~apple~CloudDocs/Hanua backup")));
let backupStatus = null, backingUp = false;
async function backupTick() {
  if (!backupDir || backingUp) return;
  backingUp = true;
  try {
    backupStatus ??= await readStatus(backupDir);
    if (backupDue(backupStatus)) {
      if (!room.missing()) await mkdir(roomDir, { recursive: true });
      backupStatus = await backupRoom({ from: roomDir, to: backupDir });
      if (!backupStatus.ok) console.error(`Backup failed: ${backupStatus.error}`);
    }
  } finally { backingUp = false; }
}
if (backupDir) { setTimeout(backupTick, 5_000); setInterval(backupTick, 15 * 60_000); }
app.get("/api/backup", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  if (!backupDir) return res.json({ off: true });
  backupStatus ??= await readStatus(backupDir); // asked before the first check has run
  res.json({ at: backupStatus?.at || null, ok: backupStatus?.ok ?? null, good: backupStatus?.good || null, warning: backupWarning(backupStatus),
    where: backupDir.includes("CloudDocs") ? `iCloud Drive › ${path.basename(backupDir)}`
      : backupDir.startsWith(os.homedir()) && !backupDir.startsWith(root) ? `${path.basename(backupDir)}, in your home folder on this Mac`
        : path.relative(root, backupDir) || backupDir });
});

// Restart Hanua (scripts/restart.sh, so the shortcut only sends this and finishes; nothing for it to cut off).
// The custom header means another website can't trigger it from Safari.
app.post("/api/restart", (req, res) => {
  if (!isMain || req.get("X-Hanua") !== "restart") return res.status(403).json({ error: "Not this Hanua" });
  res.json({ restarting: true });
  setTimeout(() => updates?.restart(), 100);
});

// Apple Reminders (server/calendar.js): the desk's Shopping list and Add reminder. Personal: the page puts them away
// at work. Nothing is kept here; Reminders is where they live (and on Mel's phone).
const remindersRoute = (fn) => async (req, res) => {
  try { res.set("Cache-Control", "no-store").json(await fn(req)); }
  catch (err) { res.status(err.status || 500).json({ error: err.message, reason: err.reason }); }
};
app.get("/api/reminders/shopping", remindersRoute(() => getShopping()));
app.post("/api/reminders/shopping", remindersRoute((req) => addReminder({ to: "shopping", title: req.body?.title })));
app.post("/api/reminders", remindersRoute((req) => addReminder({ to: "reminders", title: req.body?.title, due: req.body?.due })));
app.post("/api/reminders/:id/done", remindersRoute((req) => setReminderDone(req.params.id, Boolean(req.body?.done))));
app.post("/api/reminders/:id/remove", remindersRoute((req) => removeReminder(req.params.id)));
app.post("/api/reminders/show", remindersRoute(() => showReminders()));

app.get("/api/status", (_req, res) => {
  // boot changes on every start, so an open page can tell Hanua was updated (public/updates.js)
  // pid: how a fresh copy is told apart from this one; update: an update that didn't take (server/updates.js)
  res.set("Cache-Control", "no-store").json({ notion: notionEnabled(), claude: claudeEnabled(), boot: bootAt, pid: process.pid, update: updates?.state.blocked || null });
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

// Another month for the Money book's ‹ › pages (read from Pūtea, never kept).
app.get("/api/money/:ym", async (req, res, next) => {
  if (!isMonthKey(req.params.ym)) return res.status(400).json({ error: "Months look like 2026-10" });
  try {
    res.json(await getMoneyMonth(req.params.ym));
  } catch (err) {
    next(err);
  }
});

// Apple Calendar, read live from this Mac (never kept): the calendar asks for the weeks it shows
app.get("/api/calendar", async (req, res, next) => {
  try {
    res.json(await getAppleEvents(String(req.query.from || ""), String(req.query.to || ""), { fresh: req.query.fresh === "1" }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});
// Open Calendar.app on a day (Apple events live there, not in Notion)
app.post("/api/calendar/show", async (req, res, next) => {
  try {
    res.json(await showDay(String(req.body?.date || "")));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Add, change and delete Apple Calendar events from the New event window (7 Oct 2026, brief
// docs/plans/2026-10-apple-calendar-events.md): written straight into Calendar, nothing kept here
app.get("/api/calendar/calendars", remindersRoute(() => getEventCalendars()));
app.post("/api/calendar/events", remindersRoute((req) => addEvent(req.body?.event)));
app.post("/api/calendar/events/:id", remindersRoute((req) => editEvent(req.params.id, req.body?.occurrence, req.body?.span, req.body?.event)));
app.post("/api/calendar/events/:id/remove", remindersRoute((req) => removeEvent(req.params.id, req.body?.occurrence, req.body?.span)));

// A new row in a book from a line typed on the desk (the Work list): title, due today, not started.
// The desk only sends it after five quiet minutes on that line, and offers Undo (which moves it to Notion's trash).
app.post("/api/areas/:id/records", async (req, res, next) => {
  const area = findArea(req.params.id);
  const title = String(req.body?.title || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const due = dayKey(req.body?.due);
  if (!area) return res.status(404).json({ error: "Unknown area" });
  if (!title) return res.status(400).json({ error: "Nothing to add." });
  const { title: titleField, date: dateField, status: statusField } = area.fields || {};
  if (!isLive(area)) {
    return res.json({ live: false, record: { id: `sample-${area.id}-new-${Date.now()}`, url: null, title, date: due, status: "Not started", fields: {} } });
  }
  try {
    const schema = await getSchema(area);
    const values = [{ name: titleField, value: title }];
    if (dateField && due) values.push({ name: dateField, value: due });
    if (statusField) values.push({ name: statusField, value: "Not started" });
    const record = await createPage(area, toNotionProperties(schema, values));
    putRecord(area, record);
    res.json({ live: true, record });
  } catch (err) {
    next(err);
  }
});
app.post("/api/areas/:id/records/:recordId/delete", async (req, res, next) => {
  const area = findArea(req.params.id);
  if (!area || !isLive(area)) return res.json({ ok: true, live: false });
  try {
    await archivePage(req.params.recordId);
    patchCache(area, (rows) => rows.filter((r) => r.id !== req.params.recordId));
    res.json({ ok: true, live: true });
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

// ---------- goals (the pin board): an ADO-style hierarchy, Epic > Feature > PBI > Task ----------
// Notion is their home. Each goal links to its Parent; progress rolls up from children (public/shared/goals.js), never stored.

const goalRow = (r) => toGoal(r, goalsArea.fields);

// Writes keep the cached rows in step (Notion sends each saved row back), so the next read doesn't go to Notion.
function patchCache(area, change) {
  const hit = cache.get(area.id);
  if (hit) hit.records = change(hit.records);
}
const putRecord = (area, record) => patchCache(area, (rows) => (rows.some((r) => r.id === record.id) ? rows.map((r) => (r.id === record.id ? record : r)) : [record, ...rows]));

app.get("/api/goals", async (req, res) => {
  if (!goalsArea) return res.json({ goals: [], live: false, notionUrl: null });
  const live = isLive(goalsArea);
  const base = { live, notionUrl: notionUrl(goalsArea), guideUrl: goalsArea.guideUrl || null, coach: claudeEnabled() };
  try {
    const [records, schema] = await Promise.all([recordsFor(goalsArea, { fresh: req.query.fresh === "1" }), live ? getSchema(goalsArea).catch(() => null) : null]);
    res.json({ ...base, goals: rollUp(records.map(goalRow)), options: schema ? goalOptions(schema, goalsArea.fields) : null, fetchedAt: live ? cache.get(goalsArea.id)?.at ?? Date.now() : Date.now() });
  } catch (err) {
    res.json({ ...base, goals: [], error: err.message });
  }
});

async function createGoal(values) {
  if (!values?.title?.trim()) throw Object.assign(new Error("Give the goal a name."), { status: 400 });
  const record = await createPage(goalsArea, goalProperties(await getSchema(goalsArea), values, goalsArea.fields));
  putRecord(goalsArea, record);
  return goalRow(record);
}

app.post("/api/goals", async (req, res, next) => {
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false });
  try {
    res.json({ ok: true, live: true, goal: await createGoal(req.body?.values) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Several goals at once (Plan). Two at a time to stay inside Notion's rate limit; a result for every row,
// so a refusal part-way says exactly which ones were added.
app.post("/api/goals/batch", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 25) : [];
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false, results: items.map(() => ({ ok: true })) });
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, goal: await createGoal(items[i]) }; }
      catch (err) { results[i] = { ok: false, error: err.message }; }
    }
  };
  await Promise.all([worker(), worker()]);
  res.json({ ok: results.every((r) => r.ok), live: true, results });
});

// Ask Claude to review a goal before saving. Returns suggestions only; nothing is written.
app.post("/api/goals/coach", async (req, res, next) => {
  const { goal, parent } = req.body ?? {};
  if (!goal?.title?.trim()) return res.status(400).json({ error: "Give the goal a title first." });
  if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to use the coach." });
  try {
    res.json(await coachGoal(goal, parent));
  } catch (err) {
    next(err);
  }
});

// Ask Claude which children a goal still needs, from its why, its done-when and the children it has.
app.post("/api/goals/ideas", async (req, res, next) => {
  const { parent, children, level } = req.body ?? {};
  if (!parent?.title) return res.status(400).json({ error: "Pick a parent first." });
  if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to use ideas." });
  try {
    res.json(await suggestChildren(parent, children || [], level));
  } catch (err) {
    next(err);
  }
});

// Delete a goal, after the user confirms on the board: moves it to Notion's trash.
app.post("/api/goals/:id/delete", async (req, res, next) => {
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false });
  try {
    await archivePage(req.params.id);
    // Notion unlinks its children; the cached rows follow suit
    const { parent: P, children: C } = goalsArea.fields;
    const unlink = (v) => (Array.isArray(v) ? v.filter((id) => id !== req.params.id) : v);
    patchCache(goalsArea, (rows) => rows.filter((r) => r.id !== req.params.id)
      .map((r) => ({ ...r, fields: { ...r.fields, ...(P in (r.fields || {}) ? { [P]: unlink(r.fields[P]) } : {}), ...(C in (r.fields || {}) ? { [C]: unlink(r.fields[C]) } : {}) } })));
    res.json({ ok: true, live: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/goals/:id", async (req, res, next) => {
  if (!goalsArea || !isLive(goalsArea)) return res.json({ ok: true, live: false });
  try {
    const record = await updatePage(req.params.id, goalProperties(await getSchema(goalsArea), req.body?.values, goalsArea.fields), goalsArea.fields);
    putRecord(goalsArea, record);
    res.json({ ok: true, live: true, goal: goalRow(record) });
  } catch (err) {
    next(err);
  }
});

// ---------- weekly reviews: one Notion row per review, written from the goals board ----------

const REVIEW_FORM = ["title", "date", "wins", "stuck", "wip", "weekGoal", "tryNext", "done", "active", "atRisk", "energy", "points"];

function toReview(r) {
  const f = reviewsArea.fields, v = r.fields || {};
  const out = { id: r.id, url: r.url, week: r.title, date: r.date };
  for (const key of REVIEW_FORM.slice(2)) out[key] = v[f[key]] ?? null;
  return out;
}

app.get("/api/reviews", async (_req, res) => {
  if (!reviewsArea) return res.json({ reviews: [], live: false });
  const base = { live: isLive(reviewsArea), notionUrl: notionUrl(reviewsArea) };
  try {
    res.json({ ...base, reviews: (await recordsFor(reviewsArea)).map(toReview) });
  } catch (err) {
    res.json({ ...base, reviews: [], error: err.message });
  }
});

// Saving a review is the user's explicit "Save review" at the end of the walkthrough.
app.post("/api/reviews", async (req, res, next) => {
  if (!reviewsArea || !isLive(reviewsArea)) return res.json({ ok: true, live: false });
  const values = req.body?.values || {};
  try {
    const schema = await getSchema(reviewsArea);
    const f = reviewsArea.fields;
    const props = REVIEW_FORM.filter((k) => values[k] !== undefined && values[k] !== "" && values[k] !== null)
      .map((k) => ({ name: f[k], value: String(values[k]) }));
    const record = await createPage(reviewsArea, toNotionProperties(schema, props));
    cache.delete(reviewsArea.id);
    res.json({ ok: true, live: true, review: toReview(record) });
  } catch (err) {
    next(err);
  }
});

// ---------- the treat shop: rewards, purchases and money moved. Coins are worked out from goals, never stored ----------

app.get("/api/shop", async (_req, res) => {
  if (!shopArea) return res.json({ items: [], live: false });
  const base = { live: isLive(shopArea), notionUrl: notionUrl(shopArea), coinsPerDollar: shopArea.coinsPerDollar, coinsPerLevel: shopArea.coinsPerLevel };
  const f = shopArea.fields;
  try {
    const items = (await recordsFor(shopArea)).map((r) => ({
      id: r.id, url: r.url, item: r.title, type: r.status, coins: r.amount, date: r.date,
      dollars: r.fields?.[f.dollars] ?? null, notes: r.fields?.[f.notes] ?? "",
    }));
    res.json({ ...base, items });
  } catch (err) {
    res.json({ ...base, items: [], error: err.message });
  }
});

// A purchase or a money-moved note, from an explicit Buy / "I've moved it" in the shop.
app.post("/api/shop", async (req, res, next) => {
  if (!shopArea || !isLive(shopArea)) return res.json({ ok: true, live: false });
  const { item, type, coins, dollars } = req.body?.values || {};
  if (!item || !["Bought", "Moved"].includes(type)) return res.status(400).json({ error: "Missing item or type." });
  try {
    const schema = await getSchema(shopArea);
    const f = shopArea.fields;
    const props = [{ name: f.title, value: item }, { name: f.status, value: type }, { name: f.date, value: new Date().toISOString().slice(0, 10) }];
    if (coins != null) props.push({ name: f.amount, value: String(coins) });
    if (dollars != null) props.push({ name: f.dollars, value: String(dollars) });
    await createPage(shopArea, toNotionProperties(schema, props));
    cache.delete(shopArea.id);
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

// Bind to localhost only: this server holds your Notion and Claude keys.
// A fresh copy started by restartSelf may find the old one still letting go of the port: it tries again for 10 s
function listen(tries = 0) {
  server = app.listen(port, "127.0.0.1", () => {
    console.log(`Hanua running at http://localhost:${port}${isMain ? " (restarts itself when main is updated)" : ""}`);
    console.log(`  Notion: ${notionEnabled() ? "connected" : "not configured (showing sample data)"}`);
    console.log(`  Claude: ${claudeEnabled() ? "connected" : "not configured"}`);
    if (isMain && !updates) { // once: a failed restart takes the port back with listen() again
      writeFile(path.resolve(root, process.env.HANUA_PID_FILE || ".hanua.pid"), `${process.pid}\n`).catch(() => {});
      updates = watchForUpdates({ root, getServer: () => server, port, relisten: () => listen() });
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && tries < 30) { setTimeout(() => listen(tries + 1), 350); return; }
    console.error(err.message);
    process.exit(1);
  });
}
listen();
