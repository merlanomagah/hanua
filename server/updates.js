// Hanua keeps itself up to date (Mel, 6 Oct 2026: the Restart Hanua shortcut kept failing). When it runs as the Mac's
// launch agent (scripts/agent.sh, HANUA_AGENT=1), it checks every 30 s whether `main` has moved on in this folder
// (Claude pushing an update, or GitHub Desktop pulling one). If so, and nothing has been saved for a little while, it
// exits with "restart me" and macOS starts it again on the new code. Work on other branches never restarts it.
import { execFile } from "node:child_process";

export const RESTART_CODE = 75, CHECK_MS = 30_000, QUIET_MS = 15_000;

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

export function watchForUpdates({ root, log = console.log, exit = (c) => process.exit(c) }) {
  let running, lastWrite = 0; // running: main's commit at start, or null if another branch was checked out
  const started = mainCommit(root).then((c) => { running = c; });
  const timer = setInterval(async () => {
    await started;
    const now = await mainCommit(root);
    if (shouldRestart({ running, now, lastWrite })) { log(`Hanua: main is now ${now.slice(0, 7)} (was ${running?.slice(0, 7) || "another branch"}), restarting on the new code`); clearInterval(timer); exit(RESTART_CODE); }
  }, CHECK_MS);
  timer.unref();
  return { wrote: () => { lastWrite = Date.now(); } };
}
