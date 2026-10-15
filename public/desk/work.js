// The Work reflection (Mel, 16 Oct 2026; brief docs/plans/2026-10-work-reflection.md): one of the Journal's entry
// types (the file's menu). Two parts, Where I'm at and Where I'm heading, a layer at a time (the work, the people, the
// landscape, me; direction, growth, the next step), each with a question from Mel's Notion role page; "Deeper ↓" goes
// on to the next one down. Every box is optional. Save (⌘S) writes it to Notion's Work reflections, with Undo; until
// then what's typed is kept on this Mac. "Send to the panels ✦" (her press only) has the High Performance and
// Professional panels read it back; Keep puts their reply in the reflection. Personal: put away at work and asleep.
import { KEYS, LAYERS, PARTS, isEmpty, questionFor, reflectionShape, reflectionTitle } from "../shared/reflect.js";
import { journalShown } from "../shared/journal.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { asleep } from "../lock.js";
import { noteClosed, noteOpen, registerWindow, windowBar } from "./window.js";
import { startStep, reviewAt } from "../shared/steps.js";
import { stopTalk, talkFor } from "./talk.js";
import { iconButton } from "./icons.js";
import { forget, markDot, navEl, progressEl, registerFocus, stageEl, stepKeys, takeFocus } from "./stepper.js";
import { openFileMenu } from "./filemenu.js";

const win = $("work-win");
const file = $("open-journal");
const ICON = '<svg viewBox="0 0 48 60" aria-hidden="true" width="30"><rect x="6" y="3" width="36" height="54" rx="3" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M12 3v54" stroke="#3f7a5a" stroke-width="2"/><path d="M17 20h19M17 27h19M17 34h13" stroke="#b9b2a5" stroke-width="1.6"/><path d="M28 44l4-4 4 4" fill="none" stroke="#3f7a5a" stroke-width="1.6"/></svg>';
const N = LAYERS.length;
let step = 0; // the layer showing (N = Review); one at a time since 16 Oct 2026
let role = null; // { role, confirmed, url, questions, panels: { hp: [names], professional: [names] }, error? }
let items = []; // past reflections, newest first: { id, date, title, url }
let page = null; // the reflection as Notion has it: { id, url, edited, date, ...reflection } (id null = not saved yet)
let r = reflectionShape({ date: todayStr() }); // what's on screen
const depth = {};
let reply = null, replyText = "", asking = false, saving = false;

// ---- the draft, kept on this Mac by reflection ("new" for one not saved yet) ----
const DRAFTS = "work-drafts";
const readDrafts = () => { try { const d = JSON.parse(localStorage.getItem(DRAFTS) || "{}"); return d && typeof d === "object" ? d : {}; } catch { return {}; } };
const writeDrafts = (d) => { try { localStorage.setItem(DRAFTS, JSON.stringify(d)); } catch { /* this visit only */ } };
const slot = () => page?.id || "new";
const same = (a, b) => KEYS.every((k) => (a?.answers?.[k]?.a || "") === (b?.answers?.[k]?.a || "")) && (a?.panels || "") === (b?.panels || "") && (a?.extra || "") === (b?.extra || "");
const unsaved = () => (page ? !same(r, page) : !isEmpty(r));
let draftTimer = 0;
function keepDraft() {
  clearTimeout(draftTimer);
  const d = readDrafts();
  if (!unsaved()) delete d[slot()];
  else d[slot()] = { reflection: r, base: page?.edited || null, at: new Date().toISOString(), step };
  writeDrafts(d);
}
const dropDraft = (s = slot()) => { const d = readDrafts(); delete d[s]; writeDrafts(d); };

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `Request failed (${res.status})`), { status: res.status, body: j });
  return j;
}
const allowed = () => journalShown({ atWork: focus.on, asleep });

async function loadRole() {
  try { role = await api("/api/work/role"); } catch (err) { role = { questions: {}, panels: { hp: [], professional: [] }, error: err.message }; }
  if (role.error) toast(role.error, true);
}
async function loadList() {
  try { const j = await api("/api/work"); items = j.items || []; if (j.error) toast(j.error, true); } catch { items = []; }
}
// a new reflection (today's), or the one kept as a draft
function startNew() {
  const kept = readDrafts().new;
  page = null; reply = null; replyText = "";
  r = kept ? reflectionShape(kept.reflection) : reflectionShape({ date: todayStr() });
  if (!r.date) r.date = todayStr();
  step = startStep({ n: N, kept: kept?.step }); forget(win);
  render();
}
async function openItem(id) {
  keepDraft();
  page = { id, loading: true }; reply = null; replyText = ""; render();
  try {
    const p = await api(`/api/work/${id}`);
    page = p;
    const kept = readDrafts()[id];
    const fresh = kept && !same(kept.reflection, p);
    r = fresh ? reflectionShape({ ...kept.reflection, date: p.date }) : reflectionShape(p);
    step = startStep({ n: N, kept: fresh ? kept.step : null, saved: true }); forget(win);
  } catch (err) { toast(err.message, true); page = null; startNew(); return; }
  render();
}

// a textarea as tall as its words, on ruled lines
function fit(el) { el.style.height = "auto"; el.style.height = `${Math.max(3, Math.ceil(el.scrollHeight / 28)) * 28}px`; }
const ask = (key) => { const list = role?.questions?.[key] || []; return list.length; };

function layerEl(l) {
  const ans = r.answers[l.key];
  const shown = ans.a.trim() && ans.q ? ans.q : questionFor(role?.questions, l.key, depth[l.key] || 0);
  const deeper = ask(l.key) > 1 ? h("button", { type: "button", className: "jn-again wk-deeper", textContent: "Deeper ↓", title: "The next question down", ariaLabel: `A deeper question on ${l.name}` }) : null;
  deeper?.addEventListener("click", () => {
    depth[l.key] = (depth[l.key] || 0) + 1;
    const q = questionFor(role?.questions, l.key, depth[l.key]);
    r = { ...r, answers: { ...r.answers, [l.key]: { ...r.answers[l.key], q } } };
    deeper.closest(".wk-layer").querySelector(".jn-q").textContent = q;
    keepDraft();
  });
  const text = h("textarea", { className: "jn-text", value: ans.a, ariaLabel: `${l.name}${shown ? `: ${shown}` : ""}`, spellcheck: true, rows: 3 });
  const talk = talkFor(text); // 🎤 Talk: listens until Done (16 Oct 2026)
  text.addEventListener("input", () => {
    const q = r.answers[l.key].q || shown;
    r = { ...r, answers: { ...r.answers, [l.key]: { q, a: text.value } } };
    markDot(win, LAYERS.indexOf(l), Boolean(text.value.trim()));
    fit(text);
    clearTimeout(draftTimer); draftTimer = setTimeout(keepDraft, 400);
    status();
  });
  requestAnimationFrame(() => fit(text));
  const el = h("section", { className: "jn-sec wk-layer" },
    h("span", { className: "jn-eyebrow", textContent: l.part }),
    h("header", { className: "jn-head" }, h("h3", { className: "wk-layer-name", textContent: l.name }), deeper, talk.button),
    shown ? h("p", { className: "jn-q", textContent: shown }) : null,
    text, talk.line);
  el.dataset.key = l.key;
  return el;
}

function panelsEl() {
  if (reply) {
    const col = (name, list) => h("div", { className: "wk-panel" }, h("h5", { textContent: name }),
      ...(list || []).map((s) => h("p", { className: "wk-seat" }, h("b", { textContent: `${s.seat}. ` }), document.createTextNode(s.says))));
    const t = reply.together || {};
    const keep = h("button", { type: "button", className: "pl-go", textContent: "Keep it" });
    keep.addEventListener("click", () => { r = { ...r, panels: replyText }; reply = null; replyText = ""; keepDraft(); render(); toast("Kept in this reflection: Save writes it to Notion"); });
    const drop = h("button", { type: "button", className: "set-reset", textContent: "Let it go" });
    drop.addEventListener("click", () => { reply = null; replyText = ""; render(); });
    return h("aside", { className: "jn-reflection wk-panels" },
      h("h4", { textContent: "The panels ✦" }),
      h("div", { className: "wk-cols" }, col("HP Panel", reply.hp), col("Professional Panel", reply.professional)),
      h("div", { className: "wk-together" }, h("h5", { textContent: "Together" }),
        h("p", {}, h("b", { textContent: "Push. " }), document.createTextNode(t.push || "")),
        h("p", {}, h("b", { textContent: "Hold. " }), document.createTextNode(t.hold || "")),
        h("p", {}, h("b", { textContent: "Breather. " }), document.createTextNode(t.breather || ""))),
      h("div", { className: "wk-keep" }, drop, keep));
  }
  if (r.panels) {
    const out = h("button", { type: "button", className: "set-reset", textContent: "Take it out" });
    out.addEventListener("click", () => { const was = r.panels; r = { ...r, panels: "" }; keepDraft(); render(); toast("Taken out of this reflection", false, { label: "Undo", run: () => { r = { ...r, panels: was }; keepDraft(); render(); } }); });
    return h("aside", { className: "jn-reflection wk-panels" }, h("h4", { textContent: "What the panels said" }), h("p", { className: "jn-r-text", textContent: r.panels }), out);
  }
  return null;
}

let statusEl = null, saveEl = null, askEl = null;
function status() {
  if (!statusEl) return;
  // the buttons follow what's typed (no redraw while typing)
  if (saveEl) saveEl.disabled = saving || Boolean(page?.loading) || isEmpty(r) || (Boolean(page) && !unsaved());
  if (askEl) askEl.disabled = asking || isEmpty(r);
  statusEl.textContent = saving ? "Saving…" : page?.loading ? "Opening…" : unsaved() ? "Not saved yet · kept on this Mac" : page?.edited ? `Saved ${new Date(page.edited).toLocaleString("en-NZ", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Every question is optional";
}
const monthsSince = (day) => (day ? (Date.now() - new Date(`${day}T00:00:00`).getTime()) / (30 * 86_400_000) : 0);

// one question at a time: a tile per layer, the dots under their part, Review last (16 Oct 2026)
function goStep(i) {
  if (i === step) return;
  step = i; keepDraft(); render();
  if (step < N) setTimeout(() => { const t = win.querySelector(".jf-tile textarea"); if (t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); } }, 30);
}
function reviewEl() {
  const extra = r.extra ? (() => {
    const t = h("textarea", { className: "jn-text", value: r.extra, ariaLabel: "Also written" });
    t.addEventListener("input", () => { r = { ...r, extra: t.value }; fit(t); keepDraft(); status(); });
    requestAnimationFrame(() => fit(t));
    return h("section", { className: "jn-sec" }, h("h4", { className: "jf-answer-name", textContent: "Also written" }), t);
  })() : null;
  const rows = [];
  for (const part of PARTS) {
    rows.push(h("h4", { className: "wk-part-name", textContent: part }));
    for (const l of LAYERS.filter((x) => x.part === part)) {
      const a = r.answers[l.key];
      const b = h("button", { type: "button", className: `jf-answer${a.a.trim() ? "" : " empty"}`, title: `Change ${l.name}` },
        h("span", { className: "jf-answer-name", textContent: l.name }),
        a.a.trim() && a.q ? h("span", { className: "jf-answer-q", textContent: a.q }) : null,
        h("span", { className: "jf-answer-text", textContent: a.a.trim() || "Nothing yet · add something" }));
      b.addEventListener("click", () => goStep(LAYERS.indexOf(l)));
      rows.push(b);
    }
  }
  return h("div", { className: "jf-review-body" }, h("h3", { className: "jf-review-title", textContent: "All together" }), panelsEl(), ...rows, extra);
}
function render() {
  if (win.hidden) return;
  stopTalk(); // the tile is drawn again: listening stops (Next, Back, a save)
  const past = iconButton(h, "history", "Past reflections", { className: "set-reset wk-past" });
  past.addEventListener("click", () => openFileMenu(past, "Work reflections", [
    { label: "New reflection", sub: "Today", run: () => { keepDraft(); startNew(); } },
    ...items.slice(0, 12).map((it) => ({ label: it.title, sub: it.panelsKept ? "with the panels" : "", run: () => openItem(it.id) })),
  ]));
  const notion = page?.url ? h("a", { className: "b-link jn-notion", href: page.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null;
  const bar = windowBar(win, "Work reflection", [past, notion].filter(Boolean), hide);
  const stale = role?.confirmed && monthsSince(role.confirmed) > 3;
  const roleLine = h("p", { className: "wk-role" },
    document.createTextNode(role?.role ? `${role.role}${role.confirmed ? ` · confirmed ${new Date(`${role.confirmed}T00:00:00`).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "Your role isn't set yet"),
    role?.url ? h("a", { className: "b-link wk-role-link", href: role.url, target: "_blank", rel: "noopener", textContent: stale ? " · Still right? Update it in Notion ↗" : " · Role changed? ↗" }) : null);
  const head = h("header", { className: "jf-head" },
    h("span", { className: "jn-eyebrow", textContent: page?.id ? "Looking back" : "Work reflection" }), h("h2", { className: "jn-title jf-title", textContent: reflectionTitle(r.date || todayStr()) }), roleLine,
    role?.error ? h("p", { className: "jn-note", textContent: role.error }) : null);
  const progress = progressEl(LAYERS.map((l) => ({ label: l.name, group: l.part, done: Boolean(r.answers[l.key].a.trim()) })), step, goStep);
  statusEl = h("span", { className: "jn-status" });
  const onReview = step === reviewAt(N);
  saveEl = askEl = null;
  let extra = [];
  if (onReview) {
    const saveBtn = h("button", { type: "button", className: "pl-go jn-save", textContent: "Save", title: "Save to Work reflections in Notion (⌘S)", disabled: saving || page?.loading || isEmpty(r) });
    saveBtn.addEventListener("click", () => save());
    const askBtn = h("button", { type: "button", className: "set-reset wk-ask", textContent: asking ? "The panels are reading…" : "Send to the panels ✦", title: "The High Performance and Professional panels read this back to you", disabled: asking || isEmpty(r) });
    askBtn.addEventListener("click", () => askPanels());
    const bin = page?.id && !page.loading ? iconButton(h, "trash", "Bin this reflection: to Notion's trash (Undo brings it back)", { className: "set-reset jn-bin" }) : null;
    bin?.addEventListener("click", () => binIt());
    saveEl = saveBtn; askEl = askBtn;
    extra = [bin, askBtn, saveBtn].filter(Boolean);
  }
  const scroll = onReview && win.querySelector(".jf-review-body") ? win.querySelector(".jf-tile")?.scrollTop || 0 : 0;
  const stage = stageEl(win, step, onReview ? reviewEl() : layerEl(LAYERS[step]));
  win.replaceChildren(bar, h("div", { className: "jf-top" }, head, progress), stage, navEl(step, N, goStep, { status: statusEl, extra }));
  if (onReview) stage.firstChild.scrollTop = scroll;
  status();
}

async function save() {
  if (saving || page?.loading || isEmpty(r)) return;
  const before = page ? reflectionShape(page) : null, wasNew = !page?.id, mine = r;
  saving = true; status();
  try {
    const j = wasNew ? await api("/api/work", { method: "POST", body: { reflection: mine } })
      : await api(`/api/work/${page.id}`, { method: "PUT", body: { reflection: mine, base: page.edited } });
    dropDraft(wasNew ? "new" : j.id);
    page = { ...mine, ...j };
    items = [{ id: j.id, date: j.date, title: j.title, url: j.url, panelsKept: Boolean(mine.panels) }, ...items.filter((x) => x.id !== j.id)];
    saving = false; render();
    toast(`Saved to Work reflections${j.live === false ? " (sample: not Notion)" : ""}`, false, { label: "Undo", run: async () => {
      try {
        if (wasNew) { await api(`/api/work/${j.id}/trash`, { method: "POST" }); items = items.filter((x) => x.id !== j.id); if (page?.id === j.id) { page = null; r = mine; keepDraft(); render(); } }
        else { const back = await api(`/api/work/${j.id}`, { method: "PUT", body: { reflection: before, base: null } }); if (page?.id === j.id) { page = { ...before, ...back }; r = reflectionShape(before); render(); } }
      } catch (err) { toast(`Couldn't undo: ${err.message}`, true); }
    } });
  } catch (err) {
    saving = false; status();
    if (err.status === 409) {
      const id = page.id;
      toast("This reflection was changed somewhere else (your phone or the other Mac) since you opened it.", true, [
        { label: "Show theirs", run: () => { dropDraft(id); openItem(id); } },
        { label: "Keep mine", run: () => { page = { ...page, edited: err.body?.edited || page.edited }; save(); } },
      ]);
    } else toast(`Not saved: ${err.message}. What you wrote is kept on this Mac.`, true);
  }
}

async function binIt() {
  const id = page.id, title = reflectionTitle(page.date);
  try {
    await api(`/api/work/${id}/trash`, { method: "POST" });
    dropDraft(id);
    items = items.filter((x) => x.id !== id);
    startNew();
    toast(`${title} moved to Notion's trash`, false, { label: "Undo", run: async () => { try { await api(`/api/work/${id}/restore`, { method: "POST" }); await loadList(); openItem(id); } catch (err) { toast(err.message, true); } } });
  } catch (err) { toast(`Couldn't bin it: ${err.message}`, true); }
}

async function askPanels() {
  if (asking || isEmpty(r)) return;
  asking = true; render();
  try { const j = await api("/api/work/panels", { method: "POST", body: { reflection: r, id: page?.id || null } }); reply = j.reply; replyText = j.text || ""; }
  catch (err) { toast(err.message, true); }
  asking = false; render();
  win.querySelector(".jf-tile")?.scrollTo({ top: 0 });
}

// ---- opening and closing (a desk window, like the Journal's) ----
async function show() {
  if (!allowed()) return;
  takeFocus(win);
  win.hidden = false;
  startNew();
  await Promise.all([loadRole(), loadList()]);
  if (!win.hidden && !page) render();
}
function hide() { stopTalk(); keepDraft(); win.hidden = true; noteClosed("work-win"); file.focus({ preventScroll: true }); }
registerFocus(win, () => hide());
registerWindow("work-win", { title: "Work reflection", icon: ICON, show, hide, shown: () => !win.hidden, personal: true });
export function openWork() {
  if (!allowed()) return;
  if (win.hidden) { show(); noteOpen("work-win"); }
  setTimeout(() => win.querySelector(".jf-tile textarea")?.focus({ preventScroll: true }), 400);
}

stepKeys(win, { at: () => step, n: () => N, go: goStep });
// ⌘S saves here (not the Feed's Spotlight); Esc closes, the draft kept (a menu open inside closes first)
win.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopPropagation(); save(); return; }
  if (e.key === "Escape" && !document.querySelector("dialog[open]") && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); hide(); }
});
// at work (or asleep) it's put away, and nothing is fetched
document.addEventListener("hanua:focus", () => { if (focus.on && !win.hidden) { keepDraft(); win.hidden = true; } });
document.addEventListener("visibilitychange", () => { if (!win.hidden && unsaved()) keepDraft(); });
addEventListener("pagehide", () => { if (!win.hidden && unsaved()) keepDraft(); });
