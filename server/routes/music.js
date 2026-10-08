// The record player: the crate (config/records.json) and the Music app on this Mac (server/music.js). Split out of
// server/index.js (F6, 9 Oct 2026).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { musicAction, musicStatus, playPlaylist } from "../music.js";

export async function register({ app, root }) {
  const recordCrate = JSON.parse(await readFile(path.join(root, "config/records.json"), "utf8")).records;
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
}
