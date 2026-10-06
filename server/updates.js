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
import { openSync } from "node:fs";
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

// A fresh copy of this server, detached, writing to the same log; then this one closes and leaves
export function restartSelf({ root, server, log = console.log }) {
  log("Hanua: restarting on the latest code");
  const out = openSync(path.join(root, "logs", "hanua.log"), "a");
  spawn(process.execPath, process.argv.slice(1), { cwd: root, detached: true, stdio: ["ignore", out, out], env: process.env }).unref();
  server.close();
  setTimeout(() => process.exit(0), 300).unref();
}

export const PULL_EVERY = 10; // checks: every 10th (5 minutes)
async function pullMain(root, log) {
  if ((await git(root, "rev-parse", "--abbrev-ref", "HEAD")) !== "main") return;
  if ((await git(root, "status", "--porcelain", "--untracked-files=no")) !== "") return; // something changed here: leave it
  if ((await git(root, "fetch", "-q", "origin", "main")) === null) return; // offline: next time
  const ahead = await git(root, "rev-list", "--count", "main..origin/main");
  if (!ahead || ahead === "0") return;
  if ((await git(root, "merge", "--ff-only", "-q", "origin/main")) === null) log("Hanua: couldn't fast-forward main to GitHub's (has this folder got its own commits?)");
}

export function watchForUpdates({ root, server, log = console.log }) {
  let running, lastWrite = 0, ticks = 0; // running: main's commit at start, or null if another branch was checked out
  const started = mainCommit(root).then((c) => { running = c; });
  const timer = setInterval(async () => {
    await started;
    if (++ticks % PULL_EVERY === 0) await pullMain(root, log);
    const now = await mainCommit(root);
    if (!shouldRestart({ running, now, lastWrite })) return;
    log(`Hanua: main is now ${now.slice(0, 7)} (was ${running?.slice(0, 7) || "another branch"})`);
    clearInterval(timer);
    restartSelf({ root, server, log });
  }, CHECK_MS);
  timer.unref();
  return { wrote: () => { lastWrite = Date.now(); } };
}
