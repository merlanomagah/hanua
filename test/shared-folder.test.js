// The shared room folder (server/room.js) on a temp folder (Foundations F7, 9 Oct 2026): every read and write of
// Mel's days, menus, stickies, plant and Settings goes through it, on both Macs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRoom } from "../server/room.js";
import { backupRoom, restoreRoom } from "../server/backup.js";

const temp = () => mkdtemp(path.join(tmpdir(), "hanua-room-"));
const quiet = () => {};

test("shared folder: a save says what it started from; a change from the other Mac in between is refused, not overwritten", async () => {
  const dir = await temp(), room = createRoom(dir, { shared: true, log: quiet });
  const f = path.join(dir, "desk", "2026-10-09.json");
  assert.deepEqual(await room.read(f), { state: "missing", rev: null });
  const a = await room.write(f, { v: 1 }, { base: null });
  assert.equal((await room.read(f)).rev, a.rev);
  // the other Mac writes it meanwhile
  await writeFile(f, JSON.stringify({ v: 2, theirs: true }));
  await assert.rejects(room.write(f, { v: 3 }, { base: a.rev }), (e) => e.status === 409 && e.conflict === "other-mac" && e.current.theirs === true);
  assert.equal(JSON.parse(await readFile(f, "utf8")).theirs, true); // untouched
  // a merge (stickies, plant) combines instead of refusing
  const m = await room.write(f, { mine: true }, { merge: (cur, mine) => ({ ...cur, ...mine }) });
  assert.deepEqual(m.data, { v: 2, theirs: true, mine: true });
  // a guard refuses (a file from a newer Hanua)
  await assert.rejects(room.write(f, { x: 1 }, { guard: () => { throw Object.assign(new Error("newer"), { status: 409 }); } }), { status: 409 });
  // writes are whole: no temp file left
  assert.deepEqual((await readdir(path.join(dir, "desk"))).sort(), ["2026-10-09.json"]);
  await rm(dir, { recursive: true });
});

test("shared folder: a file still in the cloud is never read as empty, and never saved over", async () => {
  const dir = await temp(), room = createRoom(dir, { shared: true, log: quiet });
  await mkdir(path.join(dir, "desk"));
  await writeFile(path.join(dir, "desk", ".2026-10-09.json.icloud"), "");
  const f = path.join(dir, "desk", "2026-10-09.json");
  assert.deepEqual(await room.read(f), { state: "pending" });
  await assert.rejects(room.load(f, {}), { status: 503 });
  await assert.rejects(room.write(f, { v: 1 }), { status: 503 });
  // half-arrived (not JSON yet): "bad", also never saved over
  await writeFile(path.join(dir, "plant.json"), "{ half");
  assert.equal((await room.read(path.join(dir, "plant.json"))).state, "bad");
  await assert.rejects(room.write(path.join(dir, "plant.json"), {}), { status: 503 });
  await rm(dir, { recursive: true });
});

test("shared folder: a missing folder (iCloud Drive off) is never made again empty", async () => {
  const dir = path.join(await temp(), "Hanua"), room = createRoom(dir, { shared: true, log: quiet });
  assert.equal(room.missing(), true);
  assert.deepEqual(await room.read(path.join(dir, "settings.json")), { state: "pending" });
  await assert.rejects(room.write(path.join(dir, "settings.json"), {}), { status: 503 });
  assert.equal(room.status().warning.includes("can't find"), true);
  await assert.rejects(readdir(dir)); // still not there
});

test("shared folder: iCloud's clash copies and stuck downloads are named for the desk note", async () => {
  const dir = await temp(), room = createRoom(dir, { shared: true, log: quiet });
  await mkdir(path.join(dir, "desk"));
  await writeFile(path.join(dir, "desk", "2026-10-09.json"), "{}");
  await writeFile(path.join(dir, "desk", "2026-10-09 2.json"), "{}");
  await room.sweep();
  assert.deepEqual(room.status().conflicts, ["desk/2026-10-09 2.json"]);
  assert.match(room.status().warning, /two versions of desk\/2026-10-09\.json/);
  room.stop();
  await rm(dir, { recursive: true });
});

test("backup → wipe → restore: the room comes back as it was, and what was there is moved aside, not deleted", async () => {
  const base = await temp(), room = path.join(base, "Hanua"), backups = path.join(base, "Hanua backup");
  await mkdir(path.join(room, "desk"), { recursive: true });
  await writeFile(path.join(room, "desk", "2026-10-09.json"), JSON.stringify({ focus: ["Real day"] }));
  await writeFile(path.join(room, "stickies.json"), "[]");
  const st = await backupRoom({ from: room, to: backups, now: new Date("2026-10-09T10:00:00") });
  assert.equal(st.ok, true);
  // a bad day: the room is wiped, then something wrong is written
  await rm(room, { recursive: true });
  await mkdir(room);
  await writeFile(path.join(room, "stickies.json"), "[\"oops\"]");
  const r = await restoreRoom({ from: path.join(backups, "2026-10-09"), to: room, now: new Date("2026-10-09T12:00:00Z") });
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(await readFile(path.join(room, "desk", "2026-10-09.json"), "utf8")).focus[0], "Real day");
  assert.equal(await readFile(path.join(room, "stickies.json"), "utf8"), "[]");
  assert.equal(await readFile(path.join(r.aside, "stickies.json"), "utf8"), "[\"oops\"]"); // kept aside
  assert.equal((await readdir(room)).includes("last.json"), false); // the backup's own note isn't copied in
  assert.deepEqual(await restoreRoom({ from: path.join(backups, "2026-01-01"), to: room }), { ok: false, error: `there's no backup at ${path.join(backups, "2026-01-01")}` });
  await rm(base, { recursive: true });
});
