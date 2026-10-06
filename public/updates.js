// An open page notices when Hanua was updated (the server restarted on new code: server/updates.js) and reloads
// itself, but only while Hanua is asleep, so it never interrupts typing and the sleep screen is up anyway.
// Awake, it offers a Reload button once. Checked every minute and whenever Hanua comes back into view.
import { asleep } from "./lock.js";
import { toast } from "./lib.js";

let boot = null, pending = false, offered = false, saidBlocked = null;
// an update that didn't take (server/updates.js): said once per update, out loud, never silently
const WHY = { install: "its new add-ons wouldn't install", start: "the new version wouldn't start" };
async function check() {
  try {
    const j = await (await fetch("/api/status", { cache: "no-store" })).json();
    const now = j.boot;
    if (j.update && j.update.commit !== saidBlocked) {
      saidBlocked = j.update.commit;
      toast(`Hanua couldn't update (${WHY[j.update.why] || "something went wrong"}), so it's still running the previous version. Nothing was lost.`, true);
    }
    if (!now) return;
    if (!boot) boot = now;
    else if (now !== boot) pending = true;
  } catch { return; } // restarting just now: next time
  if (!pending) return;
  if (asleep) location.reload();
  else if (!offered) { offered = true; toast("Hanua was updated.", false, { label: "Reload", run: () => location.reload() }); }
}
check();
setInterval(check, 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
