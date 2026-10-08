// Every way a day has been saved still opens exactly as it did (F4, 8 Oct 2026). The fixtures are made up (the repo
// is public); *.opened.json is what the code opened them as before lines learnt origin, parent and the gone list.
// Fields added since are left out of the comparison only when they're empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { deskShape } from "../public/shared/desk.js";

const dir = new URL("./fixtures/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
// day-level fields added later: the version that brought each, and its empty value (a fixture from before that
// version must open with it empty; one from that version on already has it in its .opened.json)
const NEW = { gone: { since: 6, empty: [] }, closed: { since: 7, empty: undefined } };
const versionOf = (f) => Number(/^v(\d+)/.exec(f)?.[1] || 0);

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".opened.json"))) {
  test(`fixtures: ${f} opens as it always has`, () => {
    const now = deskShape(read(f));
    for (const [k, { since, empty }] of Object.entries(NEW)) {
      if (versionOf(f) >= since) continue;
      assert.deepEqual(now[k], empty, `${k} starts empty`); delete now[k];
    }
    assert.deepEqual(now, read(f.replace(/\.json$/, ".opened.json")));
    assert.deepEqual(deskShape(now), deskShape(read(f))); // opening it again changes nothing
  });
}
