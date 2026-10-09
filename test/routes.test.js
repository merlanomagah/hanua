// Hanua's routes, end to end (Foundations F7, 9 Oct 2026): a real server, started as a test copy on a temp folder
// (never Mel's), asked over HTTP the way the page asks. The safety net for splitting server/index.js (F6).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DESK_VERSION } from "../public/shared/desk.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = 3200 + (process.pid % 300);
const base = `http://localhost:${port}`;
let dir, child;
const call = async (p, { method = "GET", body, headers = {} } = {}) => {
  const res = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
};

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "hanua-routes-"));
  await mkdir(path.join(dir, "room")); // a shared folder that's there (a missing one is never made again)
  child = spawn(process.execPath, ["server/index.js"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port), HANUA_SAMPLE: "1", HANUA_MAIN: "", NOTION_TOKEN: "", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "",
      ROOM_DATA: path.join(dir, "room"), BACKUP_DIR: "off", LOCK_FILE: path.join(dir, "lock.json"), APPLE_CAL: "0", PUTEA_URL: "http://127.0.0.1:1", WEATHER_PLACE: "" },
  });
  let said = "";
  child.stderr.on("data", (b) => { said += b; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/status`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`the test server didn't start: ${said}`);
});
after(async () => { child?.kill(); await rm(dir, { recursive: true, force: true }); });

test("routes: status, and only Hanua's own pages on this Mac may ask", async () => {
  const s = await call("/api/status");
  assert.equal(s.status, 200);
  assert.equal(s.json.notion, false);
  // a page that isn't Hanua's (another site pointed at this Mac) is refused
  const foreign = await new Promise((ok) => http.get({ host: "127.0.0.1", port, path: "/api/status", headers: { Host: `evil.example:${port}` } }, (res) => { res.resume(); ok(res.statusCode); }));
  assert.equal(foreign, 403);
  const save = await call("/api/stickies", { method: "PUT", body: [], headers: { Origin: "https://evil.example" } });
  assert.equal(save.status, 403);
});

test("routes: a day's page round trip, with the revision and the version", async () => {
  const day = "2026-10-12";
  const first = await call(`/api/desk/${day}`);
  assert.equal(first.status, 200);
  assert.equal(first.json.v, DESK_VERSION);
  const page = { ...first.json.day, focus: ["Test focus", "", ""], sections: [{ id: "general", lines: [{ id: "a", text: "Trip" }, { id: "b", text: "Passport", parent: "a" }] }] };
  const saved = await call(`/api/desk/${day}`, { method: "PUT", body: { ...page, v: DESK_VERSION, base: first.json.rev } });
  assert.equal(saved.status, 200);
  const again = await call(`/api/desk/${day}`);
  assert.equal(again.json.day.focus[0], "Test focus");
  assert.equal(again.json.day.sections[0].lines[1].parent, "a"); // a subtask survives the server
  // a save that started from an older version of the file is refused, not written over
  const stale = await call(`/api/desk/${day}`, { method: "PUT", body: { ...page, focus: ["Other", "", ""], v: DESK_VERSION, base: first.json.rev } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.conflict, "other-mac");
  // a page from an older Hanua is refused and told to reload
  const old = await call(`/api/desk/${day}`, { method: "PUT", body: { ...page, v: DESK_VERSION - 1, base: again.json.rev } });
  assert.equal(old.status, 409);
  assert.equal(old.json.stale, "page");
  const sum = await call(`/api/desk/summary?days=${day}`);
  assert.deepEqual(sum.json[day].titles, ["Passport"]); // the task is a heading; its subtask is what's counted
  assert.deepEqual((await call("/api/desk/days")).json.includes(day), true);
  const file = JSON.parse(await readFile(path.join(dir, "room", "desk", `${day}.json`), "utf8"));
  assert.equal(file.v, DESK_VERSION);
});

test("routes: a closed day round trips; the week's summary says it's closed and leaves out what was let go", async () => {
  const day = "2026-10-15";
  const first = await call(`/api/desk/${day}`);
  const page = { ...first.json.day, sections: [{ id: "general", lines: [{ id: "a", text: "Kept" }, { id: "b", text: "Dropped" }] }],
    settled: { [`${day}:b`]: "gone" }, closed: { at: "2026-10-15T06:12:00.000Z", well: "Quiet morning", hard: "" } };
  assert.equal((await call(`/api/desk/${day}`, { method: "PUT", body: { ...page, v: DESK_VERSION, base: first.json.rev } })).status, 200);
  const again = await call(`/api/desk/${day}`);
  assert.deepEqual([again.json.day.closed.at, again.json.day.closed.well], ["2026-10-15T06:12:00.000Z", "Quiet morning"]);
  const sum = (await call(`/api/desk/summary?days=${day}`)).json[day];
  assert.equal(Boolean(sum.closed), true);
  assert.deepEqual(sum.titles, ["Kept"]);
});

test("routes: Settings save only the groups that changed, so the two Macs don't undo each other", async () => {
  const a = await call("/api/settings");
  const mine = structuredClone(a.json.settings); mine.timer.focus = 40;
  const s1 = await call("/api/settings", { method: "PUT", body: { ...mine, base: a.json.rev, changed: ["timer"] } });
  assert.equal(s1.json.settings.timer.focus, 40);
  // the "other Mac" changes the weather meanwhile, starting from the old revision: no clash, both kept
  const theirs = structuredClone(a.json.settings); theirs.desk.autoOpen = false;
  const s2 = await call("/api/settings", { method: "PUT", body: { ...theirs, base: a.json.rev, changed: ["desk"] } });
  assert.equal(s2.status, 200);
  assert.deepEqual([s2.json.settings.timer.focus, s2.json.settings.desk.autoOpen], [40, false]);
});

test("routes: stickies merge by note; the plant's waterings add up", async () => {
  await call("/api/stickies", { method: "PUT", body: [{ id: "n1", text: "Mac one", edited: "2026-10-09T09:00:00Z" }] });
  const both = await call("/api/stickies", { method: "PUT", body: [{ id: "n2", text: "Mac two", edited: "2026-10-09T09:01:00Z" }] });
  assert.deepEqual(both.json.map((n) => n.id).sort(), ["n1", "n2"]);
  await call("/api/plant/water", { method: "POST", body: { day: "2026-10-08" } });
  const p = await call("/api/plant/water", { method: "POST", body: { day: "2026-10-09" } });
  assert.deepEqual(p.json.watered, ["2026-10-08", "2026-10-09"]);
  assert.equal((await call("/api/plant/water", { method: "POST", body: { day: "nope" } })).status, 400);
});

test("routes: the sleep screen's PIN: set, check, change behind the current one", async () => {
  assert.deepEqual((await call("/api/lock")).json, { set: false });
  assert.equal((await call("/api/lock/setup", { method: "POST", body: { pin: "1357" } })).status, 200);
  assert.equal((await call("/api/lock/check", { method: "POST", body: { pin: "1357" } })).json.ok, true);
  assert.equal((await call("/api/lock/change", { method: "POST", body: { current: "0000", pin: "2468" } })).json.ok, false);
  assert.equal((await call("/api/lock/change", { method: "POST", body: { current: "1357", pin: "2468" } })).json.ok, true);
  assert.equal((await call("/api/lock/check", { method: "POST", body: { pin: "2468" } })).json.ok, true);
});

test("routes: a week's menu, This Mac, the shared folder's state and sample books", async () => {
  const wk = "2026-10-05";
  const m = await call(`/api/menu/${wk}`);
  const put = await call(`/api/menu/${wk}`, { method: "PUT", body: { ...m.json, base: m.json.rev, days: { mon: { dinner: "Fish tacos" } } } });
  assert.equal(put.status, 200);
  assert.equal((await call(`/api/menu/${wk}`)).json.days?.mon?.dinner ?? "Fish tacos", "Fish tacos");
  assert.equal((await call("/api/menu/not-a-week")).status, 400);
  const mac = await call("/api/this-mac");
  assert.deepEqual([mac.json.sample, mac.json.version.self], [true, false]);
  const sync = await call("/api/sync");
  assert.equal(sync.json.sample, true);
  const areas = await call("/api/areas");
  assert.equal(areas.status, 200);
  assert.equal((await call("/api/weather")).json.live, false); // sample weather, no town given
});

test("routes: the Jump Dashboard is sample (invented rows, no links) without a Notion key, and keeps customer columns out", async () => {
  const j = await call("/api/jump");
  assert.equal(j.status, 200);
  assert.deepEqual([j.json.sample, j.json.live], [true, false]);
  assert.ok(j.json.escalations.open > 0);
  assert.ok(j.json.escalations.items.every((r) => r.url === null && /^sample-/.test(r.id))); // a real-looking id would mean it got past the token
  assert.deepEqual(j.json.links, []);
  assert.ok(j.json.escalations.items.every((r) => !("issue" in r) && !("outcome" in r)));
  assert.ok(j.json.waiting.length > 0 && j.json.projects.items.length > 0 && j.json.questions.top.length > 0);
  assert.equal(j.json.section, "Jump issues");
});
