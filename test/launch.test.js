// Every sample preview must name its own folders and never reach Mel's real data; the real Hanua must say it's the
// real one (8 Oct 2026: a real Hanua with a blank Notion key took itself for a sample and kept a day in the test folder).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const configs = JSON.parse(readFileSync(new URL("../.claude/launch.json", import.meta.url), "utf8")).configurations;

test("launch configs: every sample server says so and keeps to its own folders", () => {
  const samples = configs.filter((c) => (c.runtimeArgs || []).includes("NOTION_TOKEN="));
  assert.ok(samples.length > 0);
  for (const c of samples) {
    const args = c.runtimeArgs;
    const val = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
    assert.equal(val("HANUA_SAMPLE"), "1", `${c.name}: HANUA_SAMPLE=1`);
    assert.equal(val("HANUA_MAIN"), undefined, `${c.name}: never HANUA_MAIN`);
    assert.ok(val("ROOM_DATA") === "data/room-sample" || val("ROOM_DATA")?.startsWith("/tmp/"), `${c.name}: its own ROOM_DATA`);
    assert.equal(val("BACKUP_DIR"), "off", `${c.name}: BACKUP_DIR=off`);
    assert.match(val("LOCK_FILE") || "", /^data\/lock-[\w-]+\.json$/, `${c.name}: its own LOCK_FILE`);
    assert.notEqual(c.port, 3000, `${c.name}: not the real port`);
    assert.ok(!JSON.stringify(c).includes("/Users/"), `${c.name}: no paths from one Mac`);
  }
});

test("start.sh starts the real Hanua as the real one", () => {
  const start = readFileSync(new URL("../scripts/start.sh", import.meta.url), "utf8");
  assert.match(start, /HANUA_MAIN=1 nohup node server\/index\.js/);
});
