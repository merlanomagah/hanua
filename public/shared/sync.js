// One set of days, menus, stickies, plant and Settings on two Macs (Mel, 6 Oct 2026; brief
// docs/plans/2026-10-shared-room-data.md). Each Mac runs its own Hanua; ROOM_DATA points both at one iCloud Drive
// folder. These are the rules that keep that safe, used by the server (and tested); no page imports.
//
// - Every file read comes with a revision (a short hash of its bytes); a save sends back the revision it started
//   from, and is refused if the file has changed since (the other Mac got there first), never written over.
// - iCloud may hold a file only in the cloud (a ".name.icloud" placeholder, or a file it can't read yet): that is
//   "still coming", never "empty", so nothing is ever saved over it.
// - iCloud keeps both sides of a clash as "name 2.json": those are found and named on the desk, never merged or
//   deleted without Mel.
// - Stickies and the plant's waterings merge instead of clashing (each note by its id, the later edit winning; the
//   waterings simply add up).

// A save is fine when it started from what's there now. `base` undefined: a page from before revisions (let it
// through: it reloads itself on the next update). `base` null: "I think there's no file yet".
export function revisionOk(base, current) {
  if (base === undefined) return true;
  return (base ?? null) === (current ?? null);
}

// iCloud's stand-in for a file that's only in the cloud: ".2026-10-06.json.icloud" stands for "2026-10-06.json"
export function placeholderFor(name) {
  const m = /^\.(.+)\.icloud$/.exec(String(name || ""));
  return m ? m[1] : null;
}

// iCloud's copy of the losing side of a clash: "2026-10-06 2.json", "stickies 3.json" → the file it belongs to
export function conflictOf(name) {
  const m = /^(.+?) (\d+)(\.json|\.png)$/.exec(String(name || ""));
  return m && Number(m[2]) >= 2 ? `${m[1]}${m[3]}` : null;
}

// Every kind of file in the room folder, in one list (Foundations F6, 9 Oct 2026): the folder watch, the sweep, the
// news sent to open pages and the clash-copy check all read it, so a new kind of file is added here once.
// dir + name: a file per day or week in a folder; file: one file at the top. quiet: kept (and checked for clash
// copies) but never news for an open page (the old drawn menus, read-only now).
export const ROOM_KINDS = [
  { kind: "desk", dir: "desk", name: /^(\d{4}-\d{2}-\d{2})\.json$/ },
  { kind: "menu", dir: "menu", name: /^(\d{4}-\d{2}-\d{2})\.json$/ },
  { kind: "drawing", dir: "whiteboard", name: /^(\d{4}-\d{2}-\d{2})\.png$/, quiet: true },
  { kind: "stickies", file: "stickies.json" },
  { kind: "settings", file: "settings.json" },
  { kind: "plant", file: "plant.json" },
];
// the folders to look in: the top, and each kind's own folder
export const ROOM_DIRS = ["", ...new Set(ROOM_KINDS.filter((k) => k.dir).map((k) => k.dir))];
// Which kind a path in the folder is (with "/"): { kind, key, quiet } or null (temp files, placeholders, clash copies)
export function kindOf(rel) {
  const p = String(rel || "").replace(/\\/g, "/");
  const parts = p.split("/"), base = parts.at(-1);
  if (!base || base.startsWith(".") || conflictOf(base)) return null;
  for (const k of ROOM_KINDS) {
    if (k.file && p === k.file) return { kind: k.kind, key: "", quiet: Boolean(k.quiet) };
    if (k.dir && parts.length === 2 && parts[0] === k.dir) { const m = k.name.exec(base); if (m) return { kind: k.kind, key: m[1], quiet: Boolean(k.quiet) }; }
  }
  return null;
}
// Which files the 20-second sweep looks at closely (Phase 1 step 5, 9 Oct 2026): the top files, and days and weeks
// from `back` days ago onwards (the other Mac only ever changes recent or coming days); older ones are the archive.
// Clash copies and cloud-only files are still noticed everywhere: that costs no more than listing the folder.
export const WATCH_BACK = 14;
export function worthWatching(rel, today, back = WATCH_BACK) {
  const k = kindOf(rel);
  if (!k || k.quiet) return false;
  if (!k.key) return true;
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
  return k.key >= from;
}

// What a changed file in the room folder means to an open page: { kind, key } or null (anything that isn't news)
export function changeOf(rel) {
  const k = kindOf(rel);
  return k && !k.quiet ? { kind: k.kind, key: k.key } : null;
}

// Stickies from two Macs, as one list: every note either side has (none lost), and where both have one, the later
// edit (`edited`, an ISO time; a note without one counts as oldest). Order: the existing list's, new ones after.
export function mergeStickies(theirs, mine) {
  const out = new Map();
  const t = (n) => (typeof n?.edited === "string" ? n.edited : "");
  for (const n of Array.isArray(theirs) ? theirs : []) if (n?.id) out.set(n.id, n);
  for (const n of Array.isArray(mine) ? mine : []) {
    if (!n?.id) continue;
    const had = out.get(n.id);
    if (!had || t(n) >= t(had)) out.set(n.id, n);
  }
  return [...out.values()];
}

// The plant's waterings from two Macs: every day either side watered, in order
export const mergeWatered = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

// A file written by a newer Hanua (its `v` above what this one understands) must not be saved over by this one:
// it would quietly drop the newer fields
export const fileTooNew = (fileV, mine) => Number.isInteger(fileV) && fileV > mine;

// What to tell Mel about the shared folder, if anything (a desk note): duplicates from a clash, files still coming
// from iCloud, or the folder missing altogether
export function syncWarning({ missing = false, conflicts = [], pending = [] } = {}) {
  if (missing) return "Hanua can't find its shared iCloud folder (is iCloud Drive on?): nothing will save until it's back";
  if (conflicts.length) { // named by the file they belong to: "desk/2026-10-06 2.json" → desk/2026-10-06.json
    const one = String(conflicts[0]).replace(/ \d+(\.\w+)$/, "$1");
    return `iCloud kept two versions of ${conflicts.length === 1 ? one : `${conflicts.length} files`}: one of them needs a look (the copy ends in " 2")`;
  }
  if (pending.length) return `${pending.length === 1 ? pending[0] : `${pending.length} files`} still coming from iCloud: set the Hanua folder to Keep Downloaded`;
  return null;
}
