// The day on the desk: today's page, the week before it, the planner prompts, the backup's status, and saving.
// Every other desk module reads these; only this one assigns them (ES module bindings are read-only outside).
// Two days can be open at once (Mel, 6 Oct 2026, evening: plan tomorrow on Tuesday evening): **today** (`desk`,
// `deskDay`: what Up next, To-do.txt, the timer and the post-its use) and **the page's day** (`page`, `pageDay`: what
// Plan my day and the draft day show and edit). They're the same day, and the same object, unless Mel is planning
// ahead. Each day has its own revision and its own save.
import { tidyDay, versionClash, CLASH_TEXT, DESK_VERSION, deskShape, startDay } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { toast } from "../lib.js";
import { saidUpdated, typingIn } from "../sync.js";

export let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
export let pageDay = deskDay, page = desk, pageEarlier = earlier;
export let fixed = []; // the sections every day has (config/areas.json planner.fixedSections)
export let backup = null; // the nightly backup's status (/api/backup): a line in the Archive, a note on the desk if it fails
export let stale = null; // "page" or "server" when the two save a day differently: saving stops and the page says so
// Settings changed the fixed sections: today follows at once
export const setFixed = (f) => { fixed = f || []; };
export const newId = () => Math.random().toString(36).slice(2, 10);

// One open day: its page, the week before it, and how saving it is going.
// Two Macs, one shared folder (6 Oct 2026): `rev` is the revision of the day's file this page has; every save sends it,
// and the server refuses (409) if the other Mac changed the day since. Nothing saves until the day has really been
// read: a day still coming from iCloud must never be saved over as if it were empty.
const open = (key) => ({ key, data: deskShape({}), earlier: {}, rev: null, canSave: false, timer: 0, saving: false });
let T = open(deskDay); // today
let P = null; // another day being planned, or null when Plan my day shows today
const stores = () => [T, P].filter(Boolean);
const storeOf = (d) => stores().find((s) => s.data === d) || null;
function bind() {
  deskDay = T.key; desk = T.data; earlier = T.earlier;
  const p = P || T;
  pageDay = p.key; page = p.data; pageEarlier = p.earlier;
}
export const dirty = () => stores().some((s) => s.timer || s.saving);
export const planningAhead = () => Boolean(P);
let dayLoaded;
export const dayReady = new Promise((r) => { dayLoaded = r; }); // today's page has been read (or the server's away)

// a day's page and the week before it (a new day starts with the last day's section headers, empty)
async function read(s, { keepNew = true } = {}) {
  try {
    const res = await fetch(`/api/desk/${s.key}`);
    if (res.ok) {
      const j = await res.json();
      stale = versionClash(j.v); // an old server answers without one
      s.earlier = j.earlier || {};
      fixed = j.fixed || [];
      s.rev = j.rev ?? null;
      s.canSave = true;
      s.data = startDay(j.day, s.earlier, s.key, fixed, j.usual);
      // a new day, a fixed section added, an older day converted: saved now. A day ahead isn't saved just for being
      // looked at (keepNew false): only once something's written, so the week doesn't fill with empty files.
      if (keepNew && JSON.stringify(s.data) !== JSON.stringify(deskShape(j.day))) queue(s);
      return true;
    }
    if (res.status === 503) stillComing(s);
  } catch { /* the server's away: an empty page, which won't save */ }
  return false;
}
export async function fetchDay() {
  const today = todayStr();
  if (T.key !== today) {
    clearTimeout(T.timer);
    // a new day: the day that was being planned ahead may be today now (then it simply is today)
    T = P?.key === today ? P : open(today);
    if (P && P.key <= today) P = null;
  }
  await read(T);
  bind();
  loaded = true;
  dayLoaded();
}
// Plan my day shows another day (or today again): read it first, then the page draws it
export async function showDay(key) {
  const today = todayStr();
  if (!key || key <= today || key === T.key) { if (P) { flush(P); P = null; } bind(); return true; }
  if (P?.key === key) return true;
  if (P) flush(P);
  const s = open(key);
  const ok = await read(s, { keepNew: false });
  P = s;
  bind();
  return ok;
}
// the day's file is still on its way from iCloud: say so, and try again shortly (then the page draws it)
let retry = 0;
function stillComing(s) {
  toast(`${s === T ? "Today's page" : "That day's page"} is still coming from iCloud: it'll appear in a moment (nothing is saved until then)`, true);
  clearTimeout(retry);
  retry = setTimeout(async () => { await read(s); bind(); if (s.canSave) document.dispatchEvent(new Event("hanua:day-refreshed")); }, 5000);
}
// The other Mac changed a day that's open here: read it again and redraw, unless this page has unsaved changes (its
// save will meet the change and ask) or Mel is typing in Plan my day or To-do.txt (then when she leaves the field)
async function refresh(s) {
  if (!s.canSave) { await read(s); bind(); if (s.canSave) document.dispatchEvent(new Event("hanua:day-refreshed")); return; }
  if (s.timer || s.saving) return;
  const where = [document.getElementById("plan-day"), document.getElementById("todo-txt"), document.getElementById("draft-day")].find(typingIn);
  if (where) { where.addEventListener("focusout", () => setTimeout(() => refresh(s), 50), { once: true }); return; }
  try {
    const res = await fetch(`/api/desk/${s.key}`);
    if (!res.ok) return;
    const j = await res.json();
    if (j.rev === s.rev || s.timer || s.saving) return; // nothing new (or Mel started typing meanwhile)
    s.rev = j.rev ?? null;
    s.earlier = j.earlier || s.earlier;
    s.data = deskShape(j.day);
    bind();
    document.dispatchEvent(new Event("hanua:day-refreshed"));
    saidUpdated(toast);
  } catch { /* the next change, or coming back to Hanua, tries again */ }
}
export const refreshDay = () => refresh(T);
document.addEventListener("hanua:room", (e) => {
  const { kind, key } = e.detail || {};
  for (const s of stores()) if (kind === "all" || (kind === "desk" && key === s.key)) refresh(s);
  if (kind === "all" || kind === "desk") document.dispatchEvent(new CustomEvent("hanua:day-changed", { detail: key || null }));
});
export async function fetchPrompts() {
  try { prompts = (await (await fetch("/api/desk/prompts")).json()).prompts || {}; return true; } catch { return false; /* headings alone */ }
}
export async function fetchBackup() {
  try { backup = await (await fetch("/api/backup")).json(); } catch { backup = null; }
}

// Saved half a second after the last change; refused (and said so) when page and server save a day differently.
// save() is today's (Up next, To-do.txt, the post-its); savePage() the page's day (Plan my day, the draft day);
// saveDay(d) whichever open day `d` is.
export const save = () => saveDay(desk);
export const savePage = (d = page) => saveDay(d);
export function saveDay(d) { const s = storeOf(d); if (s) queue(s); }
function queue(s) {
  clearTimeout(s.timer);
  s.timer = setTimeout(() => write(s), 500);
}
function flush(s) { if (s.timer) { clearTimeout(s.timer); write(s); } } // a day being left: its last change goes now
async function write(s) {
  s.timer = 0;
  const name = s === T ? "Today's page" : "That day's page";
  if (stale) { toast(CLASH_TEXT[stale], true); return; }
  if (!s.canSave) { toast(`Not saved yet: ${name.toLowerCase()} hasn't arrived from iCloud. What you typed is still on the page.`, true); return; }
  s.saving = true;
  tidyDay(s.data); // subtasks: the page keeps the same rules as the file (a task whose words were cleared lets go of its subtasks)
  try {
    const res = await fetch(`/api/desk/${s.key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s.data, v: DESK_VERSION, base: s.rev }) });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.conflict === "other-mac") return otherMac(s, j);
    if (res.status === 409) {
      stale = j.stale || "server";
      document.dispatchEvent(new Event("hanua:desk-stale"));
      toast(CLASH_TEXT[stale], true);
      return;
    }
    if (res.status === 503) { toast(`${name} couldn't be saved yet: ${j.error || "iCloud is still syncing"}. What you typed is still on the page.`, true); return; }
    if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
    s.rev = j.rev ?? s.rev;
    document.dispatchEvent(new CustomEvent("hanua:day-saved", { detail: s.key }));
  }
  catch (err) { toast(`${name} couldn't be saved: ${err.message}`, true); }
  finally { s.saving = false; }
}
// The other Mac changed this day since this page read it: Mel picks. Theirs: this page shows the other Mac's
// version. Mine: this page's version is saved over it. Neither (the message goes): the page keeps what's typed, and
// the next change asks again.
function otherMac(s, j) {
  const theirs = j.current, theirRev = j.rev ?? null;
  toast(`${s === T ? "Today's page" : "That day's page"} was changed on your other Mac.`, true, [
    { label: "Use theirs", run: () => { s.data = deskShape(theirs || {}); s.rev = theirRev; bind(); document.dispatchEvent(new Event("hanua:day-refreshed")); } },
    { label: "Keep mine", run: () => { s.rev = theirRev; queue(s); } },
  ]);
}

// A change to a day that may not be open here (sending lines to another day): an open day changes in place and saves
// as usual; any other is read, changed and saved straight away (with its revision, so the other Mac is respected).
// change(d) changes the day's shape. Resolves true once it's saved (or queued).
export async function changeDay(key, change) {
  const s = stores().find((x) => x.key === key);
  if (s) { if (!s.canSave) return false; change(s.data); queue(s); return true; }
  try {
    const res = await fetch(`/api/desk/${key}`);
    if (!res.ok) return false;
    const j = await res.json();
    const d = startDay(j.day, j.earlier || {}, key, j.fixed || fixed, j.usual);
    change(d);
    const put = await fetch(`/api/desk/${key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, v: DESK_VERSION, base: j.rev ?? null }) });
    if (put.ok) document.dispatchEvent(new CustomEvent("hanua:day-saved", { detail: key }));
    return put.ok;
  } catch { return false; }
}

// what a block or list entry points at: a line in a section (of today, or of the day given)
export function refIn(d, ref) {
  for (const s of d.sections) { const obj = s.lines.find((l) => l.id === ref); if (obj) return { obj, work: s.work, where: s.name || "General" }; }
  return null;
}
export const refInfo = (ref) => refIn(desk, ref);
