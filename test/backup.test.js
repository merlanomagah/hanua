import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { backupDue, backupRoom, backupWarning, toPrune } from "../server/backup.js";
import { versionClash, DESK_VERSION } from "../public/shared/desk.js";

const at = (s) => new Date(s);

test("backup: due when none yet, on a new day, once after 9 pm, and an hour after a failure", () => {
  assert.equal(backupDue(null, at("2026-10-06T10:00")), true);
  assert.equal(backupDue({ at: at("2026-10-05T22:00").toISOString(), ok: true }, at("2026-10-06T08:00")), true);
  assert.equal(backupDue({ at: at("2026-10-06T08:00").toISOString(), ok: true }, at("2026-10-06T15:00")), false);
  assert.equal(backupDue({ at: at("2026-10-06T08:00").toISOString(), ok: true }, at("2026-10-06T21:05")), true);
  assert.equal(backupDue({ at: at("2026-10-06T21:05").toISOString(), ok: true }, at("2026-10-06T23:00")), false);
  assert.equal(backupDue({ at: at("2026-10-06T08:00").toISOString(), ok: false }, at("2026-10-06T08:30")), false);
  assert.equal(backupDue({ at: at("2026-10-06T08:00").toISOString(), ok: false }, at("2026-10-06T09:01")), true);
});

test("backup: says so out loud when it failed or nothing good for two days", () => {
  const now = at("2026-10-06T12:00");
  assert.equal(backupWarning(null, now), null);
  assert.equal(backupWarning({ at: now.toISOString(), ok: true, good: now.toISOString() }, now), null);
  assert.match(backupWarning({ at: now.toISOString(), ok: false, error: "disk full" }, now), /disk full/);
  assert.match(backupWarning({ at: now.toISOString(), ok: true, good: at("2026-10-04T08:00").toISOString() }, now), /two days/);
});

test("backup: keeps the newest 30 days and nothing else is touched", () => {
  const days = Array.from({ length: 33 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`.replace("09-31", "10-01").replace("09-32", "10-02").replace("09-33", "10-03"));
  assert.deepEqual(toPrune([...days, "last.json"]).sort(), ["2026-09-01", "2026-09-02", "2026-09-03"]);
});

test("backup: copies the room into today's folder and notes it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hanua-backup-"));
  const from = path.join(dir, "room"), to = path.join(dir, "out");
  await mkdir(path.join(from, "desk"), { recursive: true });
  await writeFile(path.join(from, "desk", "2026-10-06.json"), "{\"focus\":[\"x\"]}");
  await mkdir(path.join(to, "2026-08-01"), { recursive: true });
  const s = await backupRoom({ from, to, now: at("2026-10-06T21:00"), keep: 1 });
  assert.equal(s.ok, true);
  assert.equal(await readFile(path.join(to, "2026-10-06", "desk", "2026-10-06.json"), "utf8"), "{\"focus\":[\"x\"]}");
  assert.deepEqual((await readdir(to)).sort(), ["2026-10-06", "last.json"]);
  const bad = await backupRoom({ from: path.join(dir, "nowhere"), to, now: at("2026-10-07T08:00") });
  assert.equal(bad.ok, false);
  assert.equal(bad.good, s.good); // the last good one is remembered
});

test("desk: a save from an older page or to an older server is refused, not trimmed", () => {
  assert.equal(versionClash(DESK_VERSION), null);
  assert.equal(versionClash(undefined), "page"); // pages from before the check
  assert.equal(versionClash(DESK_VERSION - 1), "page");
  assert.equal(versionClash(DESK_VERSION + 1), "server");
  assert.equal(versionClash("2"), "page");
});
