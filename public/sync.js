// The other Mac's changes, live (6 Oct 2026; brief docs/plans/2026-10-shared-room-data.md). The server watches the
// shared room folder and says what changed (/api/events); this passes it on as a "hanua:room" event ({ kind, key }:
// desk + day, menu + week, stickies, settings, plant) for each part of the room to fetch again, unless Mel is in the
// middle of typing there. Coming back to Hanua (the tab shown again) checks everything ({ kind: "all" }), in case
// something slipped by while the Mac slept. Also keeps the shared folder's status for a desk note (/api/sync).
export let syncState = null;
const room = (detail) => document.dispatchEvent(new CustomEvent("hanua:room", { detail }));

export async function fetchSync() {
  try { syncState = await (await fetch("/api/sync")).json(); } catch { syncState = null; }
  document.dispatchEvent(new Event("hanua:sync"));
}

let source = null;
function listen() {
  if (typeof EventSource === "undefined") return;
  source = new EventSource("/api/events");
  source.addEventListener("room", (e) => {
    let what = null;
    try { what = JSON.parse(e.data); } catch { return; }
    room(what);
    fetchSync();
  });
  // the browser reconnects by itself (e.g. after Hanua restarts on an update); on reconnect, catch up
  let opened = false;
  source.addEventListener("open", () => { if (opened) room({ kind: "all" }); opened = true; });
}
listen();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { room({ kind: "all" }); fetchSync(); } });
setInterval(() => { if (!document.hidden) fetchSync(); }, 60_000);
fetchSync();

// "Updated from your other Mac", quietly, at most once a minute
let said = 0;
export function saidUpdated(toast) {
  if (Date.now() - said < 60_000) return;
  said = Date.now();
  toast("Updated from your other Mac");
}
// Is Mel typing inside this element right now? (then a refresh waits until she leaves it)
export const typingIn = (el) => {
  const a = document.activeElement;
  return Boolean(el && a && el.contains(a) && a.matches("input, textarea, select, [contenteditable]"));
};
