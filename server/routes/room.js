// The room's own files that aren't a day or a menu: the plant's log, the old drawn menus, the stickies; and the
// shared folder's live news and state (/api/events, /api/sync). Split out of server/index.js (F6, 9 Oct 2026).
import express from "express";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { stickyShape } from "../../public/shared/desk.js";
import { mergeStickies, mergeWatered } from "../../public/shared/sync.js";
import { pullWarning } from "../updates.js";

export function register({ app, room, roomDir, roomRoute, isDay, choice, updates, reloadSettings }) {
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


  // Sticky notes on the desk's wall: one small file, kept until each is taken down (taken-down notes are marked, not erased)
  const stickiesFile = path.join(roomDir, "stickies.json");
  app.get("/api/stickies", roomRoute(async (_req, res) => res.set("Cache-Control", "no-store").json(stickyShape((await room.load(stickiesFile, [])).data))));
  // both Macs' notes merge, each note by its id, the later edit winning (taken-down notes stay marked, never erased)
  app.put("/api/stickies", roomRoute(async (req, res) => {
    const { data } = await room.write(stickiesFile, stickyShape(req.body), { merge: (cur, mine) => stickyShape(mergeStickies(stickyShape(cur || []), mine)) });
    res.json(data);
  }));

  // The other Mac's changes, as they arrive (server-sent events, server/room.js), and how the sharing is going
  app.get("/api/events", (req, res) => room.events(req, res));
  // setup: what this Mac is missing (a Notion key), said on the desk rather than only in the log (8 Oct 2026)
  app.get("/api/sync", (_req, res) => {
    const s = room.status();
    const stuck = pullWarning(updates()?.state.pull); // not taking updates, said on the desk (Phase 1 step 2)
    res.set("Cache-Control", "no-store").json({ ...s, sample: choice.sample, setup: choice.why, warning: s.warning || choice.why || stuck });
  });
  room.start((what) => { if (what.kind === "settings") reloadSettings().catch(() => {}); });
}
