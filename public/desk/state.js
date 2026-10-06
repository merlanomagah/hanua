// The day on the desk: today's page, the week before it, the planner prompts, the backup's status, and saving.
// Every other desk module reads these; only this one assigns them (ES module bindings are read-only outside).
import { versionClash, CLASH_TEXT, DESK_VERSION, deskShape, startDay } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { toast } from "../lib.js";
import { saidUpdated, typingIn } from "../sync.js";

export let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
export let fixed = []; // the sections every day has (config/areas.json planner.fixedSections)
export let backup = null; // the nightly backup's status (/api/backup): a line in the Archive, a note on the desk if it fails
export let stale = null; // "page" or "server" when the two save a day differently: saving stops and the page says so
// Settings changed the fixed sections: today follows at once
export const setFixed = (f) => { fixed = f || []; };
export const newId = () => Math.random().toString(36).slice(2, 10);
let saveTimer = 0;
// Two Macs, one shared folder (6 Oct 2026): `rev` is the revision of today's file this page has; every save sends it,
// and the server refuses (409) if the other Mac changed the day since. Nothing saves until the day has really been
// read: a day still coming from iCloud must never be saved over as if it were empty.
let rev, canSave = false, saving = false;
export const dirty = () => Boolean(saveTimer) || saving;
let dayLoaded;
export const dayReady = new Promise((r) => { dayLoaded = r; }); // today's page has been read (or the server's away)

// today's page and the week before it (a new day starts with yesterday's section headers, empty)
export async function fetchDay() {
  if (deskDay !== todayStr()) canSave = false; // a new day: nothing saves until it's been read
  deskDay = todayStr();
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (res.ok) {
      const j = await res.json();
      stale = versionClash(j.v); // an old server answers without one
      earlier = j.earlier || {};
      fixed = j.fixed || [];
      rev = j.rev ?? null;
      canSave = true;
      desk = startDay(j.day, earlier, deskDay, fixed, j.usual);
      if (JSON.stringify(desk) !== JSON.stringify(deskShape(j.day))) save(); // a new day, a fixed section added, an older day converted
    } else if (res.status === 503) stillComing();
  } catch { /* the server's away: an empty page, which won't save */ }
  loaded = true;
  dayLoaded();
}
// today's file is still on its way from iCloud: say so, and try again shortly (then the page draws it)
let retry = 0;
function stillComing() {
  toast("Today's page is still coming from iCloud: it'll appear in a moment (nothing is saved until then)", true);
  clearTimeout(retry);
  retry = setTimeout(async () => { await fetchDay(); if (canSave) document.dispatchEvent(new Event("hanua:day-refreshed")); }, 5000);
}
// The other Mac changed today: read it again and redraw, unless this page has unsaved changes (its save will meet the
// change and ask) or Mel is typing in Plan my day or To-do.txt (then when she leaves the field)
export async function refreshDay() {
  if (!canSave) return fetchDay().then(() => { if (canSave) document.dispatchEvent(new Event("hanua:day-refreshed")); });
  if (dirty()) return;
  const where = [document.getElementById("plan-day"), document.getElementById("todo-txt"), document.getElementById("draft-day")].find(typingIn);
  if (where) { where.addEventListener("focusout", () => setTimeout(refreshDay, 50), { once: true }); return; }
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (!res.ok) return;
    const j = await res.json();
    if (j.rev === rev || dirty()) return; // nothing new (or Mel started typing meanwhile)
    rev = j.rev ?? null;
    earlier = j.earlier || earlier;
    desk = deskShape(j.day);
    document.dispatchEvent(new Event("hanua:day-refreshed"));
    saidUpdated(toast);
  } catch { /* the next change, or coming back to Hanua, tries again */ }
}
document.addEventListener("hanua:room", (e) => {
  const { kind, key } = e.detail || {};
  if (kind === "all" || (kind === "desk" && key === deskDay)) refreshDay();
});
export async function fetchPrompts() {
  try { prompts = (await (await fetch("/api/desk/prompts")).json()).prompts || {}; return true; } catch { return false; /* headings alone */ }
}
export async function fetchBackup() {
  try { backup = await (await fetch("/api/backup")).json(); } catch { backup = null; }
}

// saved half a second after the last change; refused (and said so) when page and server save a day differently
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = 0;
    if (stale) { toast(CLASH_TEXT[stale], true); return; }
    if (!canSave) { toast("Not saved yet: today's page hasn't arrived from iCloud. What you typed is still on the page.", true); return; }
    saving = true;
    try {
      const res = await fetch(`/api/desk/${deskDay}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...desk, v: DESK_VERSION, base: rev }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.conflict === "other-mac") return otherMac(j);
      if (res.status === 409) {
        stale = j.stale || "server";
        document.dispatchEvent(new Event("hanua:desk-stale"));
        toast(CLASH_TEXT[stale], true);
        return;
      }
      if (res.status === 503) { toast(`Today's page couldn't be saved yet: ${j.error || "iCloud is still syncing"}. What you typed is still on the page.`, true); return; }
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      rev = j.rev ?? rev;
    }
    catch (err) { toast(`Today's page couldn't be saved: ${err.message}`, true); }
    finally { saving = false; }
  }, 500);
}
// The other Mac changed today's page since this one read it: Mel picks. Theirs: this page shows the other Mac's
// version. Mine: this page's version is saved over it. Neither (the message goes): the page keeps what's typed, and
// the next change asks again.
function otherMac(j) {
  const theirs = j.current, theirRev = j.rev ?? null;
  toast("Today's page was changed on your other Mac.", true, [
    { label: "Use theirs", run: () => { desk = deskShape(theirs || {}); rev = theirRev; document.dispatchEvent(new Event("hanua:day-refreshed")); } },
    { label: "Keep mine", run: () => { rev = theirRev; save(); } },
  ]);
}

// what a block or list entry points at: a line in a section
export function refInfo(ref) {
  for (const s of desk.sections) { const obj = s.lines.find((l) => l.id === ref); if (obj) return { obj, work: s.work, where: s.name || "General" }; }
  return null;
}
