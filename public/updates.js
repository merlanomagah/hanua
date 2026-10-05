// An open page notices when Hanua was updated (the server restarted on new code: server/updates.js) and reloads
// itself, but only while Hanua is asleep, so it never interrupts typing and the sleep screen is up anyway.
// Awake, it offers a Reload button once. Checked every minute and whenever Hanua comes back into view.
import { asleep } from "./lock.js";
import { toast } from "./lib.js";

let boot = null, pending = false, offered = false;
async function check() {
  try {
    const now = (await (await fetch("/api/status", { cache: "no-store" })).json()).boot;
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
