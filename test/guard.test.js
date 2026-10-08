import { test } from "node:test";
import assert from "node:assert/strict";
import { hostAllowed, originAllowed, refusal, roomChoice } from "../server/guard.js";
import { newCopyAnswers } from "../server/updates.js";

test("guard: only this Mac's own name for Hanua, on its own port", () => {
  assert.equal(hostAllowed("localhost:3000", 3000), true);
  assert.equal(hostAllowed("127.0.0.1:3000", 3000), true);
  assert.equal(hostAllowed("[::1]:3000", 3000), true);
  assert.equal(hostAllowed("LOCALHOST:3000", 3000), true);
  assert.equal(hostAllowed("localhost:3001", 3000), false); // another port
  assert.equal(hostAllowed("evil.example:3000", 3000), false); // DNS rebinding: the page's own name
  assert.equal(hostAllowed("localhost.evil.example:3000", 3000), false);
  assert.equal(hostAllowed("", 3000), false);
  assert.equal(hostAllowed(undefined, 3000), false);
});

test("guard: saves come from Hanua's own page, or from no page at all", () => {
  assert.equal(originAllowed(undefined, 3000), true); // curl in scripts/restart.sh
  assert.equal(originAllowed("http://localhost:3000", 3000), true);
  assert.equal(originAllowed("https://evil.example", 3000), false);
  assert.equal(originAllowed("http://localhost:3001", 3000), false);
  assert.equal(originAllowed("null", 3000), false); // a sandboxed frame or a file
  const ok = { host: "localhost:3000" };
  assert.equal(refusal({ ...ok, method: "GET", origin: "https://evil.example" }, 3000), null); // reads are guarded by Host
  assert.equal(refusal({ ...ok, method: "PUT", origin: "https://evil.example" }, 3000), "origin");
  assert.equal(refusal({ ...ok, method: "POST", origin: "http://localhost:3000" }, 3000), null);
  assert.equal(refusal({ host: "evil.example:3000", method: "GET" }, 3000), "host");
  assert.equal(refusal({ host: "evil.example:3000", method: "POST", origin: "http://evil.example:3000" }, 3000), "host");
});

test("guard: a sample server never inherits Mel's real room folder from .env", () => {
  const fileEnv = { ROOM_DATA: "~/Library/Mobile Documents/com~apple~CloudDocs/Hanua", BACKUP_DIR: "~/Hanua backup" };
  // the sample launch configs blank NOTION_TOKEN; ROOM_DATA came from .env
  const s = roomChoice({ NOTION_TOKEN: "", ...fileEnv }, fileEnv);
  assert.deepEqual([s.sample, s.room, s.backup], [true, null, null]);
  assert.deepEqual(s.ignored, ["ROOM_DATA", "BACKUP_DIR"]);
  // a folder given to the sample server itself is used (sync-a / sync-b)
  const t = roomChoice({ NOTION_TOKEN: "", ROOM_DATA: "/tmp/hanua-shared-room-test", BACKUP_DIR: "off" }, fileEnv);
  assert.deepEqual([t.room, t.backup, t.ignored.length], ["/tmp/hanua-shared-room-test", "off", 0]);
  // "off" is always kept, even when .env says it too
  assert.equal(roomChoice({ NOTION_TOKEN: "", BACKUP_DIR: "off" }, { BACKUP_DIR: "off" }).backup, "off");
  // the real Hanua (a token, or none set at all) uses .env as it is
  assert.equal(roomChoice({ NOTION_TOKEN: "secret", ...fileEnv }, fileEnv).room, fileEnv.ROOM_DATA);
  assert.equal(roomChoice({ ...fileEnv }, fileEnv).room, fileEnv.ROOM_DATA);
});

test("guard: how Hanua was started decides real or sample, never a missing key (8 Oct 2026)", () => {
  const icloud = "~/Library/Mobile Documents/com~apple~CloudDocs/Hanua";
  // the Mac mini on 8 Oct: started by start.sh, .env with a blank NOTION_TOKEN and the shared folder
  const mini = { NOTION_TOKEN: "", ROOM_DATA: icloud };
  const a = roomChoice({ ...mini, HANUA_MAIN: "1" }, mini);
  assert.deepEqual([a.sample, a.dir, a.ignored.length], [false, icloud, 0]);
  assert.match(a.why, /no Notion key/);
  // started by start.sh with a key: .env as it is, nothing to say
  const b = roomChoice({ NOTION_TOKEN: "secret", ROOM_DATA: icloud, BACKUP_DIR: "off", HANUA_MAIN: "1" }, {});
  assert.deepEqual([b.sample, b.dir, b.backup, b.why], [false, icloud, "off", null]);
  // the real Hanua with no key and no folder: data/room, never the sample's folder
  const c = roomChoice({ HANUA_MAIN: "1" }, {});
  assert.deepEqual([c.sample, c.dir], [false, "data/room"]);
  // a sample config (blank token in the config, a key in .env): sample, the inherited folder and backup ignored
  const d = roomChoice({ HANUA_SAMPLE: "1", NOTION_TOKEN: "", ROOM_DATA: icloud, BACKUP_DIR: "~/Hanua backup" }, { NOTION_TOKEN: "secret", ROOM_DATA: icloud, BACKUP_DIR: "~/Hanua backup" });
  assert.deepEqual([d.sample, d.dir, d.backup], [true, "data/room-sample", null]);
  // a sample config run on the mini (blank token in both): still sample, the iCloud folder still ignored
  const e = roomChoice({ NOTION_TOKEN: "", ROOM_DATA: icloud }, mini);
  assert.deepEqual([e.sample, e.dir], [true, "data/room-sample"]);
  // a sample server never uses an iCloud folder, even one given to it directly
  const f = roomChoice({ HANUA_SAMPLE: "1", ROOM_DATA: "/Users/x/Library/Mobile Documents/com~apple~CloudDocs/Hanua" }, {});
  assert.deepEqual([f.dir, f.ignored], ["data/room-sample", ["ROOM_DATA"]]);
  // a sample given a /tmp folder of its own uses it
  assert.equal(roomChoice({ HANUA_SAMPLE: "1", ROOM_DATA: "/tmp/hanua-shared-room-test" }, {}).dir, "/tmp/hanua-shared-room-test");
});

test("updates: the old copy waits for a new one to answer, and gives up if it never does", async () => {
  const wait = () => Promise.resolve();
  const answers = (seq) => { let i = 0; return async () => { const v = seq[Math.min(i++, seq.length - 1)]; if (v instanceof Error) throw v; return { json: async () => v }; }; };
  const until = Date.now() + 60_000;
  // not listening yet, then the old copy's own answer (shouldn't happen, but isn't "new"), then the new copy
  assert.equal(await newCopyAnswers({ port: 1, pid: 7, exited: () => false, until, wait, fetchFn: answers([new Error("refused"), { pid: 7 }, { pid: 8 }]) }), true);
  // the new copy crashed on start
  assert.equal(await newCopyAnswers({ port: 1, pid: 7, exited: () => true, until, wait, fetchFn: answers([new Error("refused")]) }), false);
  // never answers in time
  assert.equal(await newCopyAnswers({ port: 1, pid: 7, exited: () => false, until: Date.now() - 1, wait, fetchFn: answers([{ pid: 8 }]) }), false);
});

test("updates: a Mac that's stuck says so; one that's just offline for a while doesn't", async () => {
  const { pullWarning } = await import("../server/updates.js");
  const now = Date.parse("2026-10-09T09:00:00Z");
  assert.equal(pullWarning(null, now), null);
  assert.equal(pullWarning({ how: "up to date", at: "2026-10-09T08:58:00Z" }, now), null);
  assert.match(pullWarning({ how: "changed here", at: "2026-10-09T08:58:00Z" }, now), /changes of its own/);
  assert.match(pullWarning({ how: "its own commits" }, now), /can't take GitHub's/);
  assert.equal(pullWarning({ how: "offline", at: "2026-10-09T08:58:00Z", since: "2026-10-09T02:00:00Z" }, now), null);
  assert.match(pullWarning({ how: "offline", at: "2026-10-09T08:58:00Z", since: "2026-10-08T07:00:00Z" }, now), /a day/);
});
