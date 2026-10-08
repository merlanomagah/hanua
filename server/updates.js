// Hanua keeps itself up to date (Mel, 6 Oct 2026: the Restart Hanua shortcut kept failing). The real Hanua (started
// by scripts/start.sh, HANUA_MAIN=1) checks every 30 s whether `main` has moved on in this folder (Claude pushing an
// update, or GitHub Desktop pulling one). If so, and nothing has been saved for a little while, it starts a fresh copy
// of itself on the new code and steps aside. The fresh copy is Hanua's own child, so nothing outside (Shortcuts,
// Terminal) can cut it off; it waits for the port to free up. Work on other branches never restarts it.
// POST /api/restart does the same on demand (scripts/restart.sh, the Restart Hanua shortcut).
// (A macOS launch agent was tried first, the same day: macOS won't let one read ~/Documents.)
// On a second Mac (the Mac mini, 6 Oct 2026) nobody moves main by hand, so every 5 minutes Hanua also fetches main
// from GitHub and fast-forwards to it (only when main is checked out and nothing's been changed in the folder; never
// forced); the check above then restarts it on the new code. The repo is public: no login needed.
import { execFile, spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";

export const CHECK_MS = 30_000, QUIET_MS = 15_000;

const git = (root, ...args) => new Promise((resolve) => execFile("git", args, { cwd: root, timeout: 5000 }, (err, out) => resolve(err ? null : out.trim())));
// The commit Hanua should be running: main's, but only while this folder has main checked out
export async function mainCommit(root) {
  if ((await git(root, "rev-parse", "--abbrev-ref", "HEAD")) !== "main") return null;
  return git(root, "rev-parse", "HEAD");
}

// Time to restart? When main is checked out and isn't what this server started on (main moved, or it started on
// another branch's code), and no save is in flight. Never while another branch is checked out.
export function shouldRestart({ running, now, lastWrite }, at = Date.now()) {
  return Boolean(now && now !== running && at - lastWrite >= QUIET_MS);
}

// A fresh copy of this server, detached, writing to the same log. Since the desk health check (6 Oct 2026, F2) the old
// copy only leaves once the new one answers: if the new code fails to start (a mistake on main, an add-on that won't
// install), the old copy takes the port back and keeps running, and says so (/api/status `update`, a note on the
// page). When the add-on list changed since this copy started, `npm ci` runs first; if that fails, nothing restarts.
export const READY_MS = 20_000;
const lockOf = (root) => { try { return readFileSync(path.join(root, "package-lock.json"), "utf8"); } catch { return ""; } };
const npmCi = (root) => new Promise((resolve) => execFile("npm", ["ci", "--no-audit", "--no-fund"], { cwd: root, timeout: 300_000 }, (err, _out, errOut) => resolve(err ? (String(errOut || err.message).trim().split("\n").pop() || "npm ci failed") : null)));

// Is the new copy up? Asked of the port until it answers with someone else's process id, or time runs out.
export async function newCopyAnswers({ port, pid, exited, until, fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  while (Date.now() < until && !exited()) {
    try {
      const j = await (await fetchFn(`http://127.0.0.1:${port}/api/status`)).json();
      if (j?.pid && j.pid !== pid) return true;
    } catch { /* not listening yet */ }
    await wait(400);
  }
  return false;
}

// → { ok: true } (this process then exits) or { ok: false, why } (still running the old code, port taken back)
export async function restartSelf({ root, server, port, relisten, lockAtBoot = null, log = console.log }) {
  if (lockAtBoot != null && lockOf(root) !== lockAtBoot) {
    log("Hanua: the add-on list changed: installing (npm ci) before restarting");
    const failed = await npmCi(root);
    if (failed) { log(`Hanua: couldn't install the new add-ons (${failed}); staying on the running version`); return { ok: false, why: "install" }; }
  }
  log("Hanua: restarting on the latest code");
  mkdirSync(path.join(root, "logs"), { recursive: true });
  const out = openSync(path.join(root, "logs", "hanua.log"), "a");
  await new Promise((r) => { server.close(() => r()); server.closeIdleConnections?.(); setTimeout(r, 1500); });
  let gone = false;
  const child = spawn(process.execPath, process.argv.slice(1), { cwd: root, detached: true, stdio: ["ignore", out, out], env: process.env });
  child.on("exit", () => { gone = true; });
  child.unref();
  if (await newCopyAnswers({ port, pid: process.pid, exited: () => gone, until: Date.now() + READY_MS })) {
    setTimeout(() => process.exit(0), 300).unref();
    return { ok: true };
  }
  try { child.kill(); } catch { /* already gone */ }
  log("Hanua: the new version didn't start; staying on the running version (see logs/hanua.log)");
  relisten();
  return { ok: false, why: "start" };
}

export const PULL_EVERY = 10; // checks: every 10th (5 minutes)
// One look at GitHub. Returns what happened, so Hanua can say it (Hanua Settings → This Mac; a desk note when stuck):
// { at, how: "up to date" | "updated" | "not main" | "changed here" | "offline" | "its own commits", behind }
export async function pullMain(root, log, now = () => new Date().toISOString()) {
  const said = (how, behind = 0) => ({ at: now(), how, behind });
  if ((await git(root, "rev-parse", "--abbrev-ref", "HEAD")) !== "main") return said("not main");
  if ((await git(root, "status", "--porcelain", "--untracked-files=no")) !== "") return said("changed here"); // leave it
  if ((await git(root, "fetch", "-q", "origin", "main")) === null) return said("offline"); // next time
  const behind = Number(await git(root, "rev-list", "--count", "main..origin/main")) || 0;
  if (!behind) return said("up to date");
  if ((await git(root, "merge", "--ff-only", "-q", "origin/main")) === null) {
    log("Hanua: couldn't fast-forward main to GitHub's (has this folder got its own commits?)");
    return said("its own commits", behind);
  }
  return said("updated", behind);
}
// What to tell Mel about updating, if anything: stuck in a way that won't fix itself, or not checked for a day
export function pullWarning(pull, nowMs = Date.now()) {
  if (!pull) return null;
  if (pull.how === "changed here") return "This Mac's Hanua folder has changes of its own, so it isn't taking updates: tell Claude";
  if (pull.how === "its own commits") return "This Mac's Hanua has its own changes and can't take GitHub's: tell Claude";
  if (pull.how === "offline" && nowMs - Date.parse(pull.since || pull.at) > 86_400_000) return "Hanua hasn't been able to reach GitHub for a day, so it isn't updating";
  return null;
}

// state: what /api/status reports, so the page can say when an update didn't take
export function watchForUpdates({ root, getServer, port, relisten, log = console.log }) {
  let running, lastWrite = 0, ticks = 0, busy = false; // running: main's commit at start, or null if another branch was checked out
  const lockAtBoot = lockOf(root);
  const state = { blocked: null, pull: null, commit: null }; // blocked { commit, why, at }: an update that didn't take; pull: the last look at GitHub; commit: running
  git(root, "rev-parse", "--short", "HEAD").then((c) => { state.commit = c; });
  const started = mainCommit(root).then((c) => { running = c; });
  const restart = async () => {
    busy = true;
    const r = await restartSelf({ root, server: getServer(), port, relisten, lockAtBoot, log });
    busy = false;
    if (!r.ok) state.blocked = { commit: (await git(root, "rev-parse", "--short", "HEAD")) || null, why: r.why, at: new Date().toISOString() };
    return r;
  };
  const timer = setInterval(async () => {
    await started;
    if (busy) return;
    if (++ticks % PULL_EVERY === 0 || ticks === 1) {
      const p = await pullMain(root, log);
      p.since = p.how === "offline" ? (state.pull?.how === "offline" ? state.pull.since || state.pull.at : p.at) : undefined; // offline since when
      state.pull = p;
    }
    const now = await mainCommit(root);
    if (!shouldRestart({ running, now, lastWrite })) return;
    log(`Hanua: main is now ${now.slice(0, 7)} (was ${running?.slice(0, 7) || "another branch"})`);
    const r = await restart();
    if (!r.ok) running = now; // not again until main moves on
  }, CHECK_MS);
  timer.unref();
  return { wrote: () => { lastWrite = Date.now(); }, state, restart };
}
