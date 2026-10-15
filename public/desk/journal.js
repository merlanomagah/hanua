// The Journal (Mel, 15 Oct 2026; brief docs/plans/2026-10-journal.md): a file on the desk that opens this week's
// ruled page, a section per area of life (Family, Self, Relationships, Work, Spirit & culture), Write freely and Carry
// forward, each with a question to start the thinking (from the Notion page "Hanua journal prompts"; ↻ for another).
// A small fale at the top shows which areas the last four weeks have held (the Fonofale idea: a house in balance).
// The page lives in Notion (the Journal database, one page a week): Save (or ⌘S) writes it, with Undo; until then
// what's typed is kept on this Mac (it survives Hanua going to sleep and reloading). Reflect asks Claude to read the
// week back, only when Mel presses it. Personal: put away at work, and never fetched at work or asleep.
import { journalShape, journalShown, promptFor, faleOf, faleSpan, weekOf, weekTitle, areasWritten, isEmpty, AREAS, FALE, SECTIONS, FREELY } from "../shared/journal.js";
import { addDays, todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { asleep } from "../lock.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";
import { openFileMenu } from "./filemenu.js";
import { openWork } from "./work.js";
import { TYPES } from "../shared/reflect.js";

const win = $("journal-win");
const file = $("open-journal");
const ready = resizable(win);
const ICON = '<svg viewBox="0 0 48 60" aria-hidden="true" width="30"><rect x="6" y="3" width="36" height="54" rx="3" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M12 3v54" stroke="#c76a3a" stroke-width="2"/><path d="M17 20h19M17 27h19M17 34h19M17 41h13" stroke="#b9b2a5" stroke-width="1.6"/></svg>';
let placed = false;
let week = weekOf(todayStr());
let page = null; // { week, id, url, edited, sections } as Notion has it
let sections = journalShape({}).sections; // what's on the page now
let prompts = null, promptNote = "";
const skips = {};
let weeks = []; // [{ week, areas }] for the fale
let reflection = "", reflecting = false, saving = false;

// ---- the draft: what's typed and not yet saved, kept on this Mac by week (an unsent letter, like the review's) ----
const DRAFTS = "journal-drafts";
const readDrafts = () => { try { const d = JSON.parse(localStorage.getItem(DRAFTS) || "{}"); return d && typeof d === "object" ? d : {}; } catch { return {}; } };
const writeDrafts = (d) => { try { localStorage.setItem(DRAFTS, JSON.stringify(d)); } catch { /* this visit only */ } };
const same = (a, b) => SECTIONS.every((s) => (a?.[s] || "") === (b?.[s] || ""));
let draftTimer = 0;
function keepDraft() {
  clearTimeout(draftTimer);
  const d = readDrafts();
  if (page && same(sections, page.sections)) delete d[week];
  else d[week] = { sections, base: page?.edited || null, at: new Date().toISOString() };
  writeDrafts(d);
}
const dropDraft = (w = week) => { const d = readDrafts(); delete d[w]; writeDrafts(d); };
const unsaved = () => Boolean(page) && !same(sections, page.sections);

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `Request failed (${res.status})`), { status: res.status, body: j });
  return j;
}
const allowed = () => journalShown({ atWork: focus.on, asleep });

async function load(w) {
  const kept = readDrafts()[w];
  week = w; page = null; reflection = ""; sections = kept ? journalShape(kept).sections : journalShape({}).sections; render();
  try {
    const [p, list] = await Promise.all([api(`/api/journal/${w}`), api("/api/journal"), prompts ? null : loadPrompts()]);
    if (week !== w) return;
    page = p; weeks = list.weeks || [];
    if (list.error) toast(list.error, true);
    const draft = readDrafts()[w];
    sections = draft && !same(draft.sections, p.sections) ? journalShape(draft).sections : { ...p.sections };
  } catch (err) {
    if (week !== w) return;
    page = { week: w, id: null, url: null, edited: null, sections: journalShape({}).sections, error: err.message };
    const draft = readDrafts()[w];
    sections = draft ? journalShape(draft).sections : page.sections;
  }
  render();
}
async function loadPrompts() {
  try { const j = await api("/api/journal/prompts"); prompts = j.prompts || {}; promptNote = j.error || ""; } catch { prompts = {}; }
}

// ---- the fale: floor, three posts, roof; each part as full as the weeks it was written in (of the last four) ----
function faleEl() {
  const span = faleSpan(week);
  const counts = faleOf([...weeks.filter((w) => w.week !== week), { week, areas: areasWritten(sections) }], span.from, span.to);
  const fill = (a) => Math.min(1, counts[a] / 4);
  const part = (a, d) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    el.setAttribute("class", `jn-part${counts[a] ? " on" : ""}`);
    el.style.setProperty("--f", String(0.25 + 0.75 * fill(a)));
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = `${a}: ${counts[a]} of the last 4 weeks`;
    el.append(t);
    el.addEventListener("click", () => win.querySelector(`[data-sec="${a}"] textarea`)?.focus());
    return el;
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 78");
  svg.setAttribute("class", "jn-fale");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `The last four weeks: ${AREAS.map((a) => `${a} ${counts[a]}`).join(", ")}`);
  svg.append(
    part("Spirit & culture", "M8 30 Q60 -6 112 30 Z"),
    part("Self", "M24 32h8v34h-8z"),
    part("Relationships", "M56 32h8v34h-8z"),
    part("Work", "M88 32h8v34h-8z"),
    part("Family", "M12 66h96v8H12z"));
  return h("figure", { className: "jn-fale-box" }, svg, h("figcaption", { textContent: "The last four weeks" }));
}

// a textarea as tall as its words, on ruled lines
function fit(el) { el.style.height = "auto"; el.style.height = `${Math.max(3, Math.ceil(el.scrollHeight / 28)) * 28}px`; }

function sectionEl(s) {
  const q = prompts ? promptFor(prompts, s, week, skips[s] || 0) : "";
  const area = s in FALE ? FALE[s] : "";
  const again = q ? h("button", { type: "button", className: "jn-again", textContent: "↻", title: "Another question", ariaLabel: `Another question for ${s}` }) : null;
  again?.addEventListener("click", () => { skips[s] = (skips[s] || 0) + 1; const p = again.closest(".jn-sec").querySelector(".jn-q"); p.textContent = promptFor(prompts, s, week, skips[s]); });
  const text = h("textarea", { className: "jn-text", value: sections[s], ariaLabel: `${s}${q ? `: ${q}` : ""}`, spellcheck: true, rows: 3 });
  text.addEventListener("input", () => {
    sections = { ...sections, [s]: text.value };
    fit(text);
    clearTimeout(draftTimer); draftTimer = setTimeout(keepDraft, 400);
    status();
  });
  requestAnimationFrame(() => fit(text));
  const el = h("section", { className: `jn-sec${area ? ` jn-${area}` : ""}` },
    h("header", { className: "jn-head" }, h("h3", { textContent: s }), again),
    q ? h("p", { className: "jn-q", textContent: q }) : null,
    text);
  el.dataset.sec = s;
  return el;
}

let statusEl = null;
function status() {
  if (!statusEl) return;
  statusEl.textContent = saving ? "Saving…" : !page ? "Opening…" : page.error ? `Not connected: ${page.error}` : unsaved() ? "Not saved yet · kept on this Mac" : page.edited ? `Saved ${new Date(page.edited).toLocaleString("en-NZ", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Nothing written this week yet";
}

function render() {
  if (win.hidden) return;
  const thisWeek = weekOf(todayStr());
  const nav = (label, step, aria) => { const b = h("button", { type: "button", className: "ip-nav jn-nav", textContent: label, ariaLabel: aria, disabled: step > 0 && week >= thisWeek }); b.addEventListener("click", () => go(addDays(week, 7 * step))); return b; };
  const notion = page?.url ? h("a", { className: "b-link jn-notion", href: page.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null;
  const bar = windowBar(win, "Journal", [nav("‹", -1, "Week before"), nav("›", 1, "Week after"), notion].filter(Boolean), hide);
  const head = h("header", { className: "jn-top" },
    h("div", {}, h("span", { className: "jn-eyebrow", textContent: week === thisWeek ? "This week" : "Looking back" }), h("h2", { className: "jn-title", textContent: weekTitle(week) }),
      promptNote ? h("p", { className: "jn-note", textContent: promptNote }) : null),
    faleEl());
  const saveBtn = h("button", { type: "button", className: "pl-go jn-save", textContent: "Save", title: "Save to your Journal in Notion (⌘S)", disabled: saving || !page || Boolean(page.error) });
  saveBtn.addEventListener("click", () => save());
  const reflectBtn = h("button", { type: "button", className: "set-reset jn-reflect", textContent: reflecting ? "Reading…" : "Reflect ✦", title: "Claude reads this week back to you", disabled: reflecting || isEmpty(sections) });
  reflectBtn.addEventListener("click", () => reflect());
  const bin = page?.id ? h("button", { type: "button", className: "set-reset jn-bin", textContent: "Bin this week", title: "Move this week's page to Notion's trash (Undo brings it back)" }) : null;
  bin?.addEventListener("click", () => binWeek());
  statusEl = h("span", { className: "jn-status" });
  const reflectEl = reflection ? h("aside", { className: "jn-reflection" },
    h("h4", { textContent: "Reflecting back ✦" }), h("p", { className: "jn-r-text", textContent: reflection }),
    (() => { const b = h("button", { type: "button", className: "set-reset", textContent: "Keep it in Write freely" }); b.addEventListener("click", () => { sections = { ...sections, [FREELY]: `${sections[FREELY] ? `${sections[FREELY].replace(/\s+$/, "")}\n\n` : ""}Reflecting back (Claude):\n${reflection}` }; reflection = ""; keepDraft(); render(); }); return b; })()) : null;
  const scroll = win.querySelector(".txt-body")?.scrollTop || 0;
  const typing = document.activeElement?.closest?.("#journal-win [data-sec]")?.dataset.sec;
  const body = h("div", { className: "txt-body jn-body" }, head, reflectEl, ...SECTIONS.map(sectionEl));
  const foot = h("footer", { className: "jn-foot" }, statusEl, bin, reflectBtn, saveBtn);
  win.replaceChildren(bar, body, foot);
  body.scrollTop = scroll;
  if (typing) body.querySelector(`[data-sec="${typing}"] textarea`)?.focus({ preventScroll: true });
  status();
}

async function go(w) {
  keepDraft();
  await load(w);
}

async function save() {
  if (!page || saving || page.error) return;
  const before = { ...page.sections }, wasNew = !page.id, w = week;
  saving = true; status();
  try {
    const j = await api(`/api/journal/${w}`, { method: "PUT", body: { sections, base: page.edited } });
    page = { ...page, ...j, sections: { ...sections } };
    dropDraft(w);
    weeks = [{ week: w, areas: areasWritten(sections) }, ...weeks.filter((x) => x.week !== w)];
    saving = false; render();
    toast(`Saved to your Journal${j.live === false ? " (sample: not Notion)" : ""}`, false, { label: "Undo", run: async () => {
      try {
        if (wasNew && j.id) await api(`/api/journal/${w}/trash`, { method: "POST" });
        else { const back = await api(`/api/journal/${w}`, { method: "PUT", body: { sections: before, base: page?.week === w ? page.edited : null } }); if (page?.week === w) page = { ...page, ...back }; }
        if (week === w) { sections = { ...before }; page = { ...page, sections: { ...before }, ...(wasNew ? { id: null, url: null, edited: null } : {}) }; render(); }
      } catch (err) { toast(`Couldn't undo: ${err.message}`, true); }
    } });
  } catch (err) {
    saving = false; status();
    if (err.status === 409) {
      toast("This week was changed somewhere else (your phone or the other Mac) since you opened it.", true, [
        { label: "Show theirs", run: () => { dropDraft(w); load(w); } },
        { label: "Keep mine", run: () => { page = { ...page, edited: err.body?.edited || page.edited }; save(); } },
      ]);
    } else toast(`Not saved: ${err.message}. What you wrote is kept on this Mac.`, true);
  }
}

async function binWeek() {
  const w = week;
  try {
    await api(`/api/journal/${w}/trash`, { method: "POST" });
    dropDraft(w);
    weeks = weeks.filter((x) => x.week !== w);
    await load(w);
    toast(`${weekTitle(w)} moved to Notion's trash`, false, { label: "Undo", run: async () => { try { await api(`/api/journal/${w}/restore`, { method: "POST" }); if (week === w) load(w); } catch (err) { toast(err.message, true); } } });
  } catch (err) { toast(`Couldn't bin it: ${err.message}`, true); }
}

async function reflect() {
  if (reflecting || isEmpty(sections)) return;
  reflecting = true; render();
  try { reflection = (await api(`/api/journal/${week}/reflect`, { method: "POST", body: { sections } })).reflection || ""; }
  catch (err) { toast(err.message, true); }
  reflecting = false; render();
  win.querySelector(".txt-body")?.scrollTo({ top: 0 });
}

// ---- opening and closing (a desk window like To-do.txt) ----
function show() {
  if (!allowed()) return;
  win.hidden = false;
  if (!placed) { restorePlace(win); placed = true; ready(); }
  load(weekOf(todayStr()));
}
function hide() { keepDraft(); win.hidden = true; noteClosed("journal-win"); file.focus({ preventScroll: true }); }
registerWindow("journal-win", { title: "Journal", icon: ICON, show, hide, shown: () => !win.hidden, personal: true });
// focus: which section to start in (Close the day's "Write more" opens at Write freely)
export function openJournal({ at = null } = {}) {
  if (!allowed()) return;
  if (win.hidden) { show(); noteOpen("journal-win"); }
  if (at) setTimeout(() => win.querySelector(`[data-sec="${at}"] textarea`)?.focus(), 300);
}
// The file opens a menu of the Journal's entry types (16 Oct 2026): Brain dump (this week's page) first, so
// double-click then Enter is still this week; right-click opens it too
const chooser = () => openFileMenu(file, "Journal", TYPES.map((t) => ({ label: t.label, sub: t.sub, run: t.id === "work" ? () => openWork() : () => openJournal() })));
export function initJournal(desktopFile) {
  desktopFile(file, () => { if (allowed()) chooser(); });
  file.addEventListener("contextmenu", (e) => { e.preventDefault(); if (allowed()) chooser(); });
  applyWork();
}

// ⌘S saves here (not the Feed's Spotlight); Esc closes, the draft kept
win.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopPropagation(); save(); return; }
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.preventDefault(); e.stopPropagation(); hide(); }
});
// at work (or asleep) the Journal is put away, file and window, and nothing is fetched
function applyWork() {
  file.hidden = focus.on;
  if (focus.on && !win.hidden) { keepDraft(); win.hidden = true; }
}
document.addEventListener("hanua:focus", applyWork);
document.addEventListener("visibilitychange", () => { if (!win.hidden && unsaved()) keepDraft(); });
addEventListener("pagehide", () => { if (!win.hidden && unsaved()) keepDraft(); });
