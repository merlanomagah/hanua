// The room's own data (planner days, menus, stickies, plant, Settings) on two Macs (Mel, 6 Oct 2026; brief
// docs/plans/2026-10-shared-room-data.md). Each Mac runs its own Hanua; ROOM_DATA points both at one iCloud Drive
// folder. Every read and write of that folder goes through here, so that:
// - a file that's only in the cloud (or can't be read yet) is "still coming", never "empty", and nothing is saved
//   over it (iCloud is asked to bring it down);
// - every write is whole (a temp file beside it, then renamed), so iCloud never sends half a file;
// - a save names the revision it started from and is refused if the other Mac changed the file since (409);
// - the folder is watched (file events, plus a sweep every 20 s, as iCloud's downloads can slip past the events),
//   and open pages are told of anything the other Mac changed (server-sent events, /api/events);
// - iCloud's clash copies ("2026-10-06 2.json") and stuck downloads are listed for a desk note (/api/sync).
// Rules: public/shared/sync.js (tested).
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { changeOf, conflictOf, placeholderFor, revisionOk, syncWarning } from "../public/shared/sync.js";

export const revOf = (bytes) => createHash("sha1").update(bytes).digest("hex").slice(0, 16);
const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const STILL_COMING = "This is still coming from iCloud: try again in a moment (nothing was changed)";

export function createRoom(dir, { shared = false, log = console.log } = {}) {
  const missing = () => shared && !existsSync(dir); // the shared folder isn't there (iCloud Drive off?): never recreate it empty
  const rel = (file) => path.relative(dir, file).split(path.sep).join("/");
  const asked = new Map(); // file → when iCloud was last asked to bring it down
  function download(file) {
    if (Date.now() - (asked.get(file) || 0) < 60_000) return;
    asked.set(file, Date.now());
    execFile("brctl", ["download", file], { timeout: 10_000 }, () => { /* best effort: the next read tells */ });
  }

  // { state: "ok", data, rev } | { state: "missing", rev: null } | { state: "pending" } | { state: "bad", rev }
  async function read(file) {
    if (missing()) return { state: "pending" };
    let buf;
    try { buf = await readFile(file); }
    catch (err) {
      const holder = path.join(path.dirname(file), `.${path.basename(file)}.icloud`);
      if (err.code === "ENOENT" && !existsSync(holder)) return { state: "missing", rev: null };
      download(file);
      return { state: "pending" };
    }
    try { return { state: "ok", data: JSON.parse(buf.toString("utf8")), rev: revOf(buf) }; }
    catch { download(file); return { state: "bad", rev: revOf(buf) }; }
  }
  // for routes: the data (or `fallback` when there's no file yet) and its revision; throws 503 when it can't be read
  async function load(file, fallback) {
    const r = await read(file);
    if (r.state === "ok") return { data: r.data, rev: r.rev };
    if (r.state === "missing") return { data: fallback, rev: null };
    throw fail(503, r.state === "bad" ? "This file couldn't be read (it may still be syncing): try again in a moment" : STILL_COMING, { pending: true });
  }

  // one write at a time per file
  const queues = new Map();
  const queued = (file, job) => {
    const next = (queues.get(file) || Promise.resolve()).catch(() => {}).then(job);
    queues.set(file, next);
    return next;
  };
  const mine = new Set(); // "rel@rev" of our own writes, so the watcher doesn't report them back
  async function writeWhole(file, bytes) {
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    await mkdir(path.dirname(file), { recursive: true }); // desk/, menu/ (the room folder itself is checked first)
    await writeFile(tmp, bytes);
    try { await rename(tmp, file); } catch (err) { await unlink(tmp).catch(() => {}); throw err; }
  }
  // Save `value` to `file`. base: the revision the page started from (undefined: don't check). merge(current, value):
  // combine with what's there instead of refusing. guard(current): throw to refuse (e.g. a file from a newer Hanua).
  function write(file, value, { base, merge, guard } = {}) {
    return queued(file, async () => {
      if (missing()) throw fail(503, "Hanua can't find its shared iCloud folder (is iCloud Drive on?): nothing was saved");
      const cur = await read(file);
      if (cur.state === "pending" || cur.state === "bad") throw fail(503, STILL_COMING, { pending: true });
      guard?.(cur.data);
      if (!merge && !revisionOk(base, cur.rev)) throw fail(409, "Changed on your other Mac", { conflict: "other-mac", current: cur.data ?? null, rev: cur.rev });
      const data = merge ? merge(cur.data ?? null, value) : value;
      const text = JSON.stringify(data, null, 2) + "\n";
      await writeWhole(file, text);
      const rev = revOf(text);
      mine.add(`${rel(file)}@${rev}`);
      if (mine.size > 500) mine.delete(mine.values().next().value);
      return { data, rev };
    });
  }
  // a picture (the old drawn menus): whole, no revision
  const writeBytes = (file, bytes) => queued(file, () => writeWhole(file, bytes));

  // ---- watching the folder: tell open pages what the other Mac changed ----
  const clients = new Set();
  let lastRemote = null, conflicts = [], pending = [];
  const known = new Map(); // rel → "mtime:size", for the sweep
  function send(event) {
    const msg = `event: room\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(msg);
  }
  async function changed(r) {
    const what = changeOf(r);
    if (!what) return;
    const got = await read(path.join(dir, r));
    if (got.state === "pending" || got.state === "bad") return; // reported when it lands
    const key = `${r}@${got.rev}`;
    if (mine.has(key)) return; // our own save coming back round
    lastRemote = new Date().toISOString();
    onChange?.(what);
    send({ ...what, rev: got.rev });
  }
  let onChange = null;
  const timers = new Map();
  function soon(r) { // file events come in bursts: wait for them to settle
    clearTimeout(timers.get(r));
    timers.set(r, setTimeout(() => { timers.delete(r); changed(r).catch(() => {}); }, 300));
  }
  // every file we care about, its stamp, plus what's odd (clash copies, cloud-only files)
  async function scan() {
    const out = new Map(), odd = { conflicts: [], pending: [] };
    for (const sub of ["", "desk", "menu"]) {
      const names = await readdir(path.join(dir, sub)).catch(() => []);
      for (const n of names) {
        const r = sub ? `${sub}/${n}` : n;
        if (conflictOf(n)) { odd.conflicts.push(r); continue; }
        const real = placeholderFor(n);
        if (real && changeOf(sub ? `${sub}/${real}` : real)) { odd.pending.push(sub ? `${sub}/${real}` : real); continue; }
        if (!changeOf(r)) continue;
        const s = await stat(path.join(dir, r)).catch(() => null);
        if (s) out.set(r, `${s.mtimeMs}:${s.size}`);
      }
    }
    return { stamps: out, ...odd };
  }
  async function sweep() {
    const { stamps, conflicts: c, pending: p } = await scan();
    conflicts = c; pending = p;
    for (const [r, stamp] of stamps) if (known.has(r) && known.get(r) !== stamp) soon(r);
    known.clear();
    for (const [r, stamp] of stamps) known.set(r, stamp);
  }
  let watcher = null; const intervals = [];
  function start(handler) {
    onChange = handler;
    sweep().catch(() => {});
    intervals.push(setInterval(() => sweep().catch(() => {}), 20_000));
    try {
      watcher = watch(dir, { recursive: true }, (_ev, name) => { if (name) soon(String(name).split(path.sep).join("/")); });
      watcher.on("error", (err) => log(`Hanua: can't watch the room folder (${err.message}); the 20 s sweep carries on`));
    } catch (err) { log(`Hanua: can't watch the room folder (${err.message}); the 20 s sweep carries on`); }
    // a quiet line every 25 s keeps each page's connection open
    intervals.push(setInterval(() => { for (const res of clients) res.write(": still here\n\n"); }, 25_000));
    for (const t of intervals) t.unref();
  }
  // stop watching (tests; a server shutting down)
  function stop() { watcher?.close(); watcher = null; for (const t of intervals.splice(0)) clearInterval(t); for (const t of timers.values()) clearTimeout(t); timers.clear(); }
  function events(req, res) {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.flushHeaders();
    res.write(": hello\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
  }
  function status() {
    const s = { shared, folder: shared ? dir.split(path.sep).slice(-1)[0] : null, missing: missing(), conflicts, pending, lastRemote };
    return { ...s, warning: syncWarning(s) };
  }
  return { dir, read, load, write, writeBytes, start, stop, sweep, events, status, missing };
}
