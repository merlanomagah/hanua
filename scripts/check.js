// The check before every release (Foundations, Phase 1 step 1; brief docs/plans/2026-10-two-device-build-principles.md):
// `npm run check`. Each rule here is one the two Macs depend on; a rule only lives here if a check can hold it.
//  1. every server, page and script file is valid JavaScript
//  2. public/shared/ (loaded by the page and the server) imports nothing from the page
//  3. every .env name the code reads is explained in .env.example (a Mac set up from it must not miss one)
//  4. only the files allowed to write to disk do (room.js, backup.js, lock.js, calendar.js, index.js, updates.js)
//  5. the tests pass
//  6. when the add-on list changed since GitHub's main, say so (each Mac installs them itself before restarting)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rel = (f) => path.relative(root, f);
const problems = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const f = path.join(dir, n);
  if (n === "node_modules" || n.startsWith(".")) return [];
  return statSync(f).isDirectory() ? walk(f) : f.endsWith(".js") ? [f] : [];
});
const code = [...walk(path.join(root, "server")), ...walk(path.join(root, "public")), ...walk(path.join(root, "scripts"))];

// 1. valid JavaScript
for (const f of code) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) problems.push(`${rel(f)} isn't valid JavaScript:\n${(r.stderr || "").split("\n").slice(0, 4).join("\n")}`);
}

// 2. shared rules import only shared rules
for (const f of walk(path.join(root, "public/shared"))) {
  for (const m of readFileSync(f, "utf8").matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (m[1].startsWith(".") && !target.startsWith(path.join(root, "public/shared"))) problems.push(`${rel(f)} imports ${m[1]}: public/shared/ must not import page code (the server loads it)`);
  }
}

// 3. every .env name is in .env.example
const example = readFileSync(path.join(root, ".env.example"), "utf8");
const named = new Set([...example.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].map((m) => m[1]));
const read = new Set();
for (const f of code.filter((f) => !f.includes(`${path.sep}public${path.sep}`) || f.includes(`${path.sep}shared${path.sep}`))) {
  for (const m of readFileSync(f, "utf8").matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]+)\b/g)) read.add(m[1]);
}
for (const k of read) if (!named.has(k)) problems.push(`.env.example doesn't explain ${k}, which the code reads`);

// 4. only these write to disk
// (updates.js only makes the logs folder for a restarted copy)
const WRITERS = new Set(["server/room.js", "server/backup.js", "server/lock.js", "server/calendar.js", "server/index.js", "server/updates.js"]);
for (const f of walk(path.join(root, "server"))) {
  if (/\b(writeFile|appendFile|createWriteStream|copyFile|rename|unlink|rm|mkdir)(Sync)?\(/.test(readFileSync(f, "utf8")) && !WRITERS.has(rel(f))) {
    problems.push(`${rel(f)} writes to disk but isn't one of the files allowed to (scripts/check.js WRITERS): room data goes through server/room.js`);
  }
}

// 5. the tests
const tests = spawnSync("npm", ["test", "--silent"], { cwd: root, encoding: "utf8" });
const tally = (tests.stdout || "").match(/ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/);
if (tests.status !== 0) problems.push(`the tests failed${tally ? ` (${tally[2]} of ${Number(tally[1]) + Number(tally[2])})` : ""}:\n${(tests.stdout || "").split("\n").filter((l) => l.startsWith("✖")).slice(0, 8).join("\n")}`);

// 6. add-ons changed since GitHub's main?
let addons = "";
try {
  const diff = execFileSync("git", ["diff", "--name-only", "origin/main", "--", "package-lock.json"], { cwd: root, encoding: "utf8" }).trim();
  if (diff) addons = "The add-on list changed since GitHub's main: each Mac installs them (npm ci) before it restarts on this.";
} catch { /* no git here: nothing to compare */ }

if (problems.length) {
  console.error(`✖ Not ready to release (${problems.length}):\n\n${problems.map((p) => `- ${p}`).join("\n\n")}`);
  process.exit(1);
}
console.log(`✔ Ready to release: ${code.length} files valid, shared rules self-contained, .env.example complete, disk writes where they belong${tally ? `, ${tally[1]} tests pass` : ", tests pass"}.`);
if (addons) console.log(addons);
