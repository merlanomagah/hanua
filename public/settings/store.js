// Settings, as the page holds them (one set for both windows: the desk's Settings in the dock, and Hanua Settings on
// the rail; 8 Oct 2026, brief docs/plans/2026-10-settings-everywhere-and-two-mac-fix.md). Kept in the room folder
// (data/room/settings.json via /api/settings, shared by both Macs through iCloud, backed up nightly). Every change
// saves at once and applies at once: the hanua:settings event (detail: the settings) tells whatever uses them.
// A save sends only the groups that changed, so a change on one Mac never undoes another made on the other meanwhile.
import { toast } from "../lib.js";
import { setTimeWords } from "../shared/desk.js";
import { changedGroups } from "../shared/settings.js";
import { saidUpdated } from "../sync.js";

export let settings = null, defaults = null;
let rev; // the revision this page has

const apply = () => {
  setTimeWords(settings.timeWords);
  document.dispatchEvent(new CustomEvent("hanua:settings", { detail: settings }));
};
// after a save: { before } so the desk can rename today's sections; windows redraw
const saved = (before) => document.dispatchEvent(new CustomEvent("hanua:settings-saved", { detail: { before } }));

export async function loadSettings(quiet = false) {
  let j;
  try { const res = await fetch("/api/settings"); if (!res.ok) return; j = await res.json(); } catch { return; }
  if (quiet && j.rev === rev) return;
  const before = settings;
  ({ settings, defaults } = j); rev = j.rev ?? null;
  apply();
  if (quiet) { saved(before); saidUpdated(toast); }
}
// the other Mac changed Settings: use them here too (a window being typed in waits: see the windows)
document.addEventListener("hanua:room", (e) => {
  const { kind } = e.detail || {};
  if (kind === "all" || kind === "settings") loadSettings(true);
});

// Save `next` (the server tidies it) and apply it. undoText: a toast with Undo back to how it was.
export async function put(next, { undoText = null } = {}) {
  const before = settings;
  const changed = changedGroups(before, next);
  if (!changed.length) return true;
  try {
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, base: rev, changed }) });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.settings) {
      ({ settings, defaults } = j); rev = j.rev ?? null;
      apply(); saved(before);
      toast(j.newer ? "Your other Mac has a newer Hanua: update this one (it does so by itself within a few minutes) before changing Settings here."
        : "Settings were just changed on your other Mac: they're shown now. Make your change again if it's still needed.", true);
      return false;
    }
    if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
    ({ settings, defaults } = j); rev = j.rev ?? rev;
  } catch (err) { toast(`Settings couldn't be saved: ${err.message}`, true); return false; }
  apply(); saved(before);
  if (undoText) toast(undoText, false, { label: "Undo", run: () => put(before) });
  return true;
}
export const change = (fn) => { const next = structuredClone(settings); fn(next); return put(next); };

loadSettings();
