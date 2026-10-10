import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { parse as parseEnv } from "dotenv";
import { blockPageWrites, notionEnabled, NotionError } from "./notion.js";
import { claudeEnabled } from "./claude.js";
import { watchForUpdates } from "./updates.js";
import { createRoom } from "./room.js";
import { localOnly, roomChoice } from "./guard.js";
import * as system from "./routes/system.js";
import * as roomRoutes from "./routes/room.js";
import * as kitchen from "./routes/kitchen.js";
import * as desk from "./routes/desk.js";
import * as settingsRoutes from "./routes/settings.js";
import * as apple from "./routes/apple.js";
import * as money from "./routes/money.js";
import * as music from "./routes/music.js";
import * as books from "./routes/books.js";
import * as jump from "./routes/jump.js";

// Hanua's server: start-up, the guard, which room folder, and the routes by subject in server/routes/ (split into
// them on 9 Oct 2026, Foundations F6; tested end to end in test/routes.test.js).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The real Hanua (scripts/start.sh sets HANUA_MAIN=1, not the sample servers): restarts itself on the new code when
// main moves, and on POST /api/restart (server/updates.js)
const isMain = process.env.HANUA_MAIN === "1";
const bootAt = new Date().toISOString();
let updates = null, server = null;
const config = JSON.parse(await readFile(path.join(root, "config/areas.json"), "utf8"));
const app = express();
const port = Number(process.env.PORT) || 3000;
// only this Mac's own Hanua pages (and scripts on this Mac) may talk to it: server/guard.js
app.use(localOnly(port));
// small JSON everywhere (the drawn menus' larger limit went with their save route, 9 Oct 2026)
app.use(express.json({ limit: "100kb" }));
// a save in flight holds off a restart until things are quiet (server/updates.js)
app.use((req, _res, next) => { if (req.method !== "GET") updates?.wrote(); next(); });
// "no-cache" = Safari must ask each time whether a file changed (a quick 304 when it hasn't), so after an update
// it never keeps showing the old page from its cache (6 Oct 2026)
app.use(express.static(path.join(root, "public"), { setHeaders: (res) => res.set("Cache-Control", "no-cache") }));

// Things the room itself keeps, with no other home: planner days, menus, stickies, the plant's log, Settings.
// In data/room/ (gitignored), or, with ROOM_DATA in .env, one iCloud Drive folder both Macs share (6 Oct 2026):
// every read and write goes through server/room.js (still-coming files never read as empty, whole writes, a save
// refused if the other Mac changed the file since, the folder watched for the other Mac's changes).
// The sample preview keeps its own folder so tests never touch Mel's, and the real Hanua always keeps Mel's: which is
// which comes from how it was started (server/guard.js roomChoice), never from a missing key.
const fileEnv = (() => { try { return parseEnv(readFileSync(path.join(process.cwd(), ".env"))); } catch { return {}; } })();
const choice = roomChoice(process.env, fileEnv);
blockPageWrites(choice.sample); // a sample server never changes Notion (server/notion.js)
if (choice.ignored.length) console.log(`Hanua: a sample server, so .env's ${choice.ignored.join(" and ")} (Mel's real folder) is ignored`);
const home = (p) => (p && p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p); // the same .env line on both Macs
const roomDir = path.resolve(root, home(choice.dir));
if (choice.why) console.error(`Hanua: ${choice.why}`);
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

// The routes, by subject (order matters only where one path could be taken for another, and each file keeps its own)
const ctx = { app, root, config, room, roomDir, sharedRoom, choice, roomRoute, baseOf, readJson, isDay, isMain, bootAt, updates: () => updates };
system.register(ctx);
const settings = await settingsRoutes.register(ctx);
roomRoutes.register({ ...ctx, reloadSettings: settings.reload });
kitchen.register(ctx);
desk.register({ ...ctx, settings: settings.current });
apple.register(ctx);
money.register(ctx);
await music.register(ctx);
await books.register(ctx);
await jump.register(ctx);

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
