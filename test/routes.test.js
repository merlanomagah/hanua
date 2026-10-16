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
    env: { ...process.env, PORT: String(port), HANUA_SAMPLE: "1", HANUA_MAIN: "", NOTION_TOKEN: "", ANTHROPIC_API_KEY: "sk-not-real-sample-must-not-use", ANTHROPIC_AUTH_TOKEN: "",
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
  const cards = j.json.escalations.columns.flatMap((c) => c.items);
  assert.ok(j.json.escalations.open > 0);
  assert.ok(cards.every((r) => r.url === null && /^sample-/.test(r.id))); // a real-looking id would mean it got past the token
  assert.deepEqual(j.json.links, []);
  assert.ok(cards.every((r) => !("issue" in r) && !("outcome" in r) && typeof r.issueSet === "boolean"));
  assert.ok(j.json.options.escalations.status.includes("Closed"));
  assert.ok(j.json.waiting.length > 0 && j.json.projects.items.length > 0 && j.json.questions.items.length > 0);
  assert.equal(j.json.section, "Jump issues");
});

test("routes: the Jump Dashboard writes both ways on sample rows: add, move, close, undo, take back; refusals in plain words", async () => {
  const cards = async () => (await call("/api/jump")).json.escalations.columns.flatMap((c) => c.items.map((r) => ({ ...r, col: c.status })));
  // add
  const add = await call("/api/jump/escalations", { method: "POST", body: { change: { title: "An invented escalation", tier: "T1", issue: "(invented)" } } });
  assert.equal(add.status, 200);
  assert.equal(add.json.live, false);
  const id = add.json.row.id;
  assert.match(id, /^sample-escalations-new-/);
  let mine = (await cards()).find((r) => r.id === id);
  assert.deepEqual([mine.col, mine.age, mine.issueSet], ["Open", 0, true]);
  // move on, and back with its undo
  const moved = await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { status: "Awaiting confirmation" } } });
  assert.deepEqual(moved.json.undo, { status: "Open" });
  assert.equal((await cards()).find((r) => r.id === id).col, "Awaiting confirmation");
  // closing needs the Finding and the Outcome, then sets the date; its undo reopens and clears them
  assert.equal((await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { status: "Closed" } } })).status, 400);
  const closed = await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { status: "Closed", finding: "No guidance existed", outcome: "(invented)" } } });
  assert.equal(closed.status, 200);
  assert.equal(closed.json.row.closed, (await call("/api/jump")).json.today);
  mine = (await cards()).find((r) => r.id === id);
  assert.deepEqual([mine.col, mine.outcomeSet], ["Closed", true]);
  const back = await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: closed.json.undo, undo: true } });
  assert.equal(back.status, 200);
  mine = (await cards()).find((r) => r.id === id);
  assert.deepEqual([mine.col, mine.closed, mine.finding, mine.outcomeSet], ["Awaiting confirmation", null, null, false]);
  // refusals
  assert.equal((await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { status: "Awaitng" } } })).status, 400); // not one of Jump OS's
  assert.equal((await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { issue: "new words" } } })).status, 400); // never overwritten
  assert.equal((await call(`/api/jump/escalations/${id}`, { method: "POST", body: { change: { secret: "x" } } })).status, 400);
  assert.equal((await call("/api/jump/projects", { method: "POST", body: { change: { title: "x" } } })).status, 400); // only escalations are added
  const q = (await call("/api/jump")).json.questions.items[0];
  assert.equal((await call(`/api/jump/questions/${q.id}`, { method: "POST", body: { change: { status: "Answered" } } })).status, 400);
  assert.equal((await call(`/api/jump/questions/${q.id}`, { method: "POST", body: { change: { status: "Answered", resolution: "(invented)" } } })).status, 200);
  const p = (await call("/api/jump")).json.projects.items[0];
  assert.equal((await call(`/api/jump/projects/${p.id}`, { method: "POST", body: { change: { next: "An invented next step" } } })).json.row.next, "An invented next step");
  // only what was just added can be taken back (to the trash)
  assert.equal((await call(`/api/jump/escalations/${p.id}/trash`, { method: "POST", body: {} })).status, 400);
  assert.equal((await call(`/api/jump/escalations/${id}/trash`, { method: "POST", body: {} })).status, 200);
  assert.equal((await cards()).some((r) => r.id === id), false);
});

test("routes: the Journal round trips on invented weeks, refuses a stale save, bins and brings back, and is never a book", async () => {
  const week = "2026-10-12";
  const p = await call("/api/journal/prompts");
  assert.equal(p.json.live, false);
  assert.ok(Object.values(p.json.prompts).flat().every((t) => t.includes("(invented)")));
  const first = await call(`/api/journal/${week}`);
  assert.equal(first.status, 200);
  const saved = await call(`/api/journal/${week}`, { method: "PUT", body: { sections: { Family: "Rang home (invented)" }, base: first.json.edited } });
  assert.equal(saved.status, 200);
  const again = await call(`/api/journal/${week}`);
  assert.equal(again.json.sections.Family, "Rang home (invented)");
  const stale = await call(`/api/journal/${week}`, { method: "PUT", body: { sections: { Family: "Other (invented)" }, base: "2020-01-01T00:00:00.000Z" } });
  assert.equal(stale.status, 409);
  const list = await call("/api/journal");
  assert.ok(list.json.weeks.some((w) => w.week === week && w.areas.includes("Family")));
  assert.equal((await call(`/api/journal/${week}/trash`, { method: "POST" })).json.ok, true);
  assert.equal((await call(`/api/journal/${week}`)).json.sections.Family, "");
  assert.equal((await call(`/api/journal/${week}/restore`, { method: "POST" })).json.ok, true);
  assert.equal((await call(`/api/journal/${week}`)).json.sections.Family, "Rang home (invented)");
  assert.equal((await call("/api/journal/2026-10-13")).status, 400); // weeks start on a Monday
  // never a book: Ask Claude and the Feed read every book, so the Journal must not be one
  const books = await call("/api/areas");
  assert.ok(!JSON.stringify(books.json).toLowerCase().includes("journal"));
});

test("routes: Work reflections round trip apart from the Journal's weeks; the panels on a sample server are invented and never Claude", async () => {
  const role = await call("/api/work/role");
  assert.equal(role.json.live, false);
  assert.ok(role.json.role.includes("(invented)"));
  assert.ok(Object.values(role.json.questions).flat().every((t) => t.includes("(invented)")));
  assert.equal(role.json.panels.hp.length, 4);
  assert.equal(role.json.context, undefined); // the context stays on the server, for the panels
  const week = "2026-10-12";
  await call(`/api/journal/${week}`, { method: "PUT", body: { sections: { Work: "A weekly line (invented)" } } });
  const key = "Where I'm at · The work";
  assert.equal((await call("/api/work", { method: "POST", body: { reflection: {} } })).status, 400); // nothing written
  const made = await call("/api/work", { method: "POST", body: { reflection: { date: week, answers: { [key]: { q: "What moved? (invented)", a: "The report (invented)" } } } } });
  assert.equal(made.status, 200);
  const one = await call(`/api/work/${made.json.id}`);
  assert.equal(one.json.answers[key].a, "The report (invented)");
  assert.equal(one.json.answers[key].q, "What moved? (invented)");
  // the weekly page is untouched by a reflection on the same day
  assert.equal((await call(`/api/journal/${week}`)).json.sections.Work, "A weekly line (invented)");
  assert.ok(!(await call("/api/journal")).json.weeks.some((w) => String(w.id || "").startsWith("sample-work")));
  const stale = await call(`/api/work/${made.json.id}`, { method: "PUT", body: { reflection: one.json, base: "2020-01-01T00:00:00.000Z" } });
  assert.equal(stale.status, 409);
  // the panels: invented on a sample server even though a key is set (it must not be used), and nothing is saved
  const panels = await call("/api/work/panels", { method: "POST", body: { reflection: one.json, id: made.json.id } });
  assert.equal(panels.status, 200);
  assert.equal(panels.json.live, false);
  assert.ok(panels.json.text.includes("(invented)") && panels.json.text.startsWith("HP Panel"));
  assert.equal((await call(`/api/work/${made.json.id}`)).json.panels, "");
  // Keep, then Save: the reply goes in the page
  const kept = await call(`/api/work/${made.json.id}`, { method: "PUT", body: { reflection: { ...one.json, panels: panels.json.text }, base: one.json.edited } });
  assert.equal(kept.status, 200);
  assert.ok((await call("/api/work")).json.items.find((x) => x.id === made.json.id).panelsKept);
  assert.equal((await call(`/api/work/${made.json.id}/trash`, { method: "POST" })).json.ok, true);
  assert.equal((await call(`/api/work/${made.json.id}`)).status, 404);
  assert.equal((await call(`/api/work/${made.json.id}/restore`, { method: "POST" })).json.ok, true);
  assert.equal((await call(`/api/work/${made.json.id}`)).status, 200);
  assert.equal((await call("/api/work/not-an-id")).status, 400);
  // the Journal's Reflect is refused too: the sample server won't use the key
  assert.equal((await call(`/api/journal/${week}/reflect`, { method: "POST", body: { sections: { Work: "x (invented)" } } })).status, 503);
});

test("routes: the Jump team reads invented charters, refuses identifiers, proposes without writing, and saves a charter only when asked", async () => {
  const t = await call("/api/team");
  assert.equal(t.json.live, false);
  assert.equal(t.json.members.length, 8);
  const m = t.json.members[3];
  assert.equal(m.state.label, "Not confirmed yet");
  // identifiers are refused before anything is sent (a key is set on this server, and it still never calls Claude)
  const no = await call("/api/team/standup", { method: "POST", body: { update: "the customer on 021 555 1234 called (invented)" } });
  assert.equal(no.status, 400);
  assert.equal(no.json.scrub, true);
  assert.equal((await call("/api/team/standup", { method: "POST", body: { update: "" } })).status, 400);
  const before = JSON.stringify((await call("/api/jump")).json.escalations);
  const s = await call("/api/team/standup", { method: "POST", body: { update: "Returns are confusing the care team this week (invented)" } });
  assert.equal(s.status, 200);
  assert.equal(s.json.live, false);
  assert.deepEqual(s.json.routed, [t.json.members[3].id, t.json.members[6].id]);
  const care = s.json.members[0];
  assert.equal(care.title, "Ema · Care Lead");
  assert.ok(care.cites.every((c) => s.json.records.some((r) => r.id === c)));
  assert.equal(care.signoffs[0].kind, "change");
  assert.equal(care.signoffs[0].invalid, undefined); // a change Jump OS's own rules accept
  assert.equal(care.signoffs[1].text, "Check the returns article with the care team (invented)");
  assert.equal(s.json.members[1].signoffs[0].kind, "charter");
  assert.equal(s.json.members[1].cites.length, 0); // it cited a record it wasn't shown: dropped, so unconfirmed
  assert.equal(s.json.members[1].unconfirmed, true);
  assert.equal(JSON.stringify((await call("/api/jump")).json.escalations), before); // nothing written before an approval
  for (const r of s.json.records) assert.deepEqual(Object.keys(r).filter((k) => /issue|outcome|resolution|waitingOn|raisedBy/i.test(k)), []);
  // context for one member: proposals only, then a charter saved on approval, then Undo
  const f = await call(`/api/team/${m.id}/context`, { method: "POST", body: { note: "The returns process changed this month (invented)" } });
  assert.equal(f.status, 200);
  assert.equal(f.json.edits.length, 2);
  assert.equal((await call("/api/team")).json.members[3].sections["Key risks"].length, m.sections["Key risks"].length);
  const next = { ...m.sections, "Key risks": [...m.sections["Key risks"], f.json.edits[0].line] };
  const saved = await call(`/api/team/${m.id}`, { method: "PUT", body: { sections: next, base: m.edited } });
  assert.equal(saved.status, 200);
  assert.equal((await call(`/api/team/${m.id}`, { method: "PUT", body: { sections: m.sections, base: "2020-01-01T00:00:00.000Z" } })).status, 409);
  assert.equal((await call(`/api/team/${m.id}`, { method: "PUT", body: { sections: m.sections, base: saved.json.edited } })).status, 200); // Undo
  assert.deepEqual((await call("/api/team")).json.members[3].sections["Key risks"], m.sections["Key risks"]);
});
