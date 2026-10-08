// Two Macs, one shared folder (Phase 1 step 6, 9 Oct 2026): two Hanua test copies on two ports share one temp
// folder, the way the Air and the mini share iCloud Drive › Hanua. What one saves, the other sees; a save that
// started from an older version is refused; stickies merge; the other one hears about a change as it happens.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DESK_VERSION } from "../public/shared/desk.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const portA = 3500 + (process.pid % 200), portB = portA + 250;
let dir; const kids = [];
const at = (port) => async (p, { method = "GET", body } = {}) => {
  const res = await fetch(`http://localhost:${port}${p}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const A = at(portA), B = at(portB);
async function start(port) {
  const child = spawn(process.execPath, ["server/index.js"], { cwd: root, stdio: "ignore",
    env: { ...process.env, PORT: String(port), HANUA_SAMPLE: "1", HANUA_MAIN: "", NOTION_TOKEN: "", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "",
      ROOM_DATA: path.join(dir, "Hanua"), BACKUP_DIR: "off", LOCK_FILE: path.join(dir, `lock-${port}.json`), APPLE_CAL: "0", PUTEA_URL: "http://127.0.0.1:1", WEATHER_PLACE: "" } });
  kids.push(child);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/status`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`test copy on ${port} didn't start`);
}
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "hanua-two-macs-"));
  await mkdir(path.join(dir, "Hanua"));
  await Promise.all([start(portA), start(portB)]);
});
after(async () => { for (const k of kids) k.kill(); await rm(dir, { recursive: true, force: true }); });

test("two Macs: a day planned on one shows on the other; a save from an older version is refused", async () => {
  const day = "2026-10-13";
  const a0 = await A(`/api/desk/${day}`);
  const page = { ...a0.json.day, focus: ["From the mini", "", ""], sections: [{ id: "general", lines: [{ id: "t1", text: "Book cleaners" }] }] };
  const a1 = await A(`/api/desk/${day}`, { method: "PUT", body: { ...page, v: DESK_VERSION, base: a0.json.rev } });
  assert.equal(a1.status, 200);
  const b = await B(`/api/desk/${day}`);
  assert.equal(b.json.day.focus[0], "From the mini");
  // the Air still had the page from before the mini saved: its save is refused, the mini's day is untouched
  const late = await B(`/api/desk/${day}`, { method: "PUT", body: { ...a0.json.day, focus: ["From the Air", "", ""], v: DESK_VERSION, base: a0.json.rev } });
  assert.equal(late.status, 409);
  assert.equal(late.json.current.focus[0], "From the mini"); // what the page offers as "theirs"
  assert.equal((await A(`/api/desk/${day}`)).json.day.focus[0], "From the mini");
});

test("two Macs: a day closed on one is closed on the other; the other's older save can't undo the close", async () => {
  const day = "2026-10-16";
  const a0 = await A(`/api/desk/${day}`);
  const closed = { ...a0.json.day, sections: [{ id: "general", lines: [{ id: "t1", text: "Ring the bank" }] }], closed: { at: "2026-10-16T05:30:00.000Z", well: "", hard: "Too many calls" } };
  assert.equal((await A(`/api/desk/${day}`, { method: "PUT", body: { ...closed, v: DESK_VERSION, base: a0.json.rev } })).status, 200);
  assert.equal((await B(`/api/desk/${day}`)).json.day.closed.hard, "Too many calls");
  const late = await B(`/api/desk/${day}`, { method: "PUT", body: { ...a0.json.day, v: DESK_VERSION, base: a0.json.rev } });
  assert.equal(late.status, 409);
  assert.equal(late.json.current.closed.at, "2026-10-16T05:30:00.000Z"); // "theirs" says closed, so the page can warn
});

test("two Macs: stickies from both stay; a setting changed on one is used by the other", async () => {
  await A("/api/stickies", { method: "PUT", body: [{ id: "mini", text: "From the mini", edited: "2026-10-09T09:00:00Z" }] });
  await B("/api/stickies", { method: "PUT", body: [{ id: "air", text: "From the Air", edited: "2026-10-09T09:01:00Z" }] });
  assert.deepEqual((await A("/api/stickies")).json.map((n) => n.id).sort(), ["air", "mini"]);
  const s = await A("/api/settings");
  const next = structuredClone(s.json.settings); next.timer.focus = 45;
  await A("/api/settings", { method: "PUT", body: { ...next, base: s.json.rev, changed: ["timer"] } });
  assert.equal((await B("/api/settings")).json.settings.timer.focus, 45);
});

test("two Macs: the other one hears about a change as it happens", async () => {
  const ctrl = new AbortController();
  const res = await fetch(`http://localhost:${portB}/api/events`, { signal: ctrl.signal });
  const reader = res.body.getReader(), dec = new TextDecoder();
  let heard = "";
  const listening = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) return; heard += dec.decode(value); if (/"key":"2026-10-14"/.test(heard)) return; } })(); // earlier tests' news may come first
  await new Promise((r) => setTimeout(r, 300)); // B is listening
  const d = await A("/api/desk/2026-10-14");
  await A("/api/desk/2026-10-14", { method: "PUT", body: { ...d.json.day, focus: ["Live", "", ""], v: DESK_VERSION, base: d.json.rev } });
  await Promise.race([listening, new Promise((_, no) => setTimeout(() => no(new Error(`B heard nothing in 5 s: ${heard}`)), 5000))]);
  ctrl.abort();
  assert.match(heard, /"key":"2026-10-14"/);
});
