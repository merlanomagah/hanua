// The day on the desk: today's page, the week before it, the planner prompts, the backup's status, and saving.
// Every other desk module reads these; only this one assigns them (ES module bindings are read-only outside).
import { versionClash, CLASH_TEXT, DESK_VERSION, deskShape, startDay } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { toast } from "../lib.js";

export let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
export let backup = null; // the nightly backup's status (/api/backup): a line in the Archive, a note on the desk if it fails
export let stale = null; // "page" or "server" when the two save a day differently: saving stops and the page says so
export const newId = () => Math.random().toString(36).slice(2, 10);
let saveTimer = 0;

// today's page and the week before it (a new day starts with yesterday's section headers, empty)
export async function fetchDay() {
  deskDay = todayStr();
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (res.ok) {
      const j = await res.json();
      stale = versionClash(j.v); // an old server answers without one
      earlier = j.earlier || {};
      desk = startDay(j.day, earlier, deskDay);
      if (!j.day?.started) save();
    }
  } catch { /* the server's away: an empty page */ }
  loaded = true;
}
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
    if (stale) { toast(CLASH_TEXT[stale], true); return; }
    try {
      const res = await fetch(`/api/desk/${deskDay}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...desk, v: DESK_VERSION }) });
      if (res.status === 409) {
        stale = (await res.json().catch(() => ({}))).stale || "server";
        document.dispatchEvent(new Event("hanua:desk-stale"));
        toast(CLASH_TEXT[stale], true);
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
    }
    catch (err) { toast(`Today's page couldn't be saved: ${err.message}`, true); }
  }, 500);
}

// what a block or list entry points at: a Task (k0..k2) or a line in a section
export function refInfo(ref) {
  const k = /^k(\d)$/.exec(ref);
  if (k) { const obj = desk.key[Number(k[1])]; return obj && { obj, work: desk.keyWork, where: "Tasks" }; }
  for (const s of desk.sections) { const obj = s.lines.find((l) => l.id === ref); if (obj) return { obj, work: s.work, where: s.name || "General" }; }
  return null;
}
