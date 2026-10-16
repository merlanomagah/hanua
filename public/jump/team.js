// The Jump team (Mel, 16 Oct 2026; brief docs/plans/2026-10-jump-team.md): a Team button on the Jump Dashboard opens
// the focus window (the room blurred, like the Journal) with two views. Stand-up: her update, typed or spoken (Talk,
// not at work), goes to the team; the Product Manager's summary comes first, then each member it routed to (how to
// handle it, how to prevent it, its questions, what it needs her sign-off on, the records it rests on or
// "unconfirmed"). She answers their questions and asks again, and approves sign-offs one at a time, each with Undo:
// records through the dashboard's own write path (store.js), a line to today's Jump issues, or a lasting change to a
// member's charter. Team: the eight members, how current each charter is, and a member's page, where she adds context
// (typed or spoken) and the member folds it into its charter, a change at a time, never just piling it up.
// Nothing is kept on this Mac but the count of stand-ups a week (the probe's evidence).
import { applyEdit, bumpWeek, confirmCharter, noteLine, NOTES } from "../shared/team.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, store, toast } from "../lib.js";
import { change as changeRecord, data as jumpData } from "./store.js";
import { registerWindow, windowBar, noteOpen, noteClosed } from "../desk/window.js";
import { registerFocus, takeFocus } from "../desk/stepper.js";
import { stopTalk, talkFor } from "../desk/talk.js";
import { arrived, decorate, waitNote, wait } from "../wait.js";

const win = $("team-win");
let team = null; // { live, url, members, error }
let view = "standup"; // "standup" | "team" | a member's id
// What's being worked on, kept on this Mac until Mel presses Start fresh (16 Oct 2026: leaving a member and coming
// back wiped her work): the stand-up, and each member's context, its reply and her answers. A reply that comes back
// while she's elsewhere is kept for whoever asked. Dropped after a week untouched.
const DRAFTS = "team-drafts", WEEK = 7 * 86_400_000;
const freshStandup = () => ({ update: "", reply: null, answers: {}, done: {} });
const freshMember = () => ({ note: "", fold: null, answers: {}, done: {}, noteKept: false });
let drafts = { standup: freshStandup(), members: {} };
try {
  const d = JSON.parse(store(DRAFTS) || "null");
  if (d && typeof d === "object") {
    const recent = (x) => x && Date.now() - (x.at || 0) < WEEK;
    drafts = { standup: recent(d.standup) ? { ...freshStandup(), ...d.standup } : freshStandup(), members: Object.fromEntries(Object.entries(d.members || {}).filter(([, v]) => recent(v)).map(([k, v]) => [k, { ...freshMember(), ...v }])) };
  }
} catch { /* a fresh start */ }
let keepTimer = 0;
function keep(now = false) {
  clearTimeout(keepTimer);
  const write = () => { try { store(DRAFTS, JSON.stringify(drafts)); } catch { /* this visit only */ } };
  if (now) write(); else keepTimer = setTimeout(write, 400);
}
const touch = (x) => { x.at = Date.now(); keep(); return x; };
const su = () => drafts.standup;
const ctxOf = (id) => (drafts.members[id] ||= freshMember());
let hooks = { toToday: async () => false };

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `Request failed (${res.status})`), { status: res.status, body: j });
  return j;
}
async function loadTeam(fresh = false) {
  try { team = await api(`/api/team${fresh ? "?fresh=1" : ""}`); if (team.error) toast(team.error, true); }
  catch (err) { team = { members: [], error: err.message }; }
  render();
}
const member = (id) => team?.members?.find((m) => m.id === id) || null;
const fit = (el) => { el.style.height = "auto"; el.style.height = `${Math.max(el.rows * 24, el.scrollHeight)}px`; };
const say = (live) => (live ? "" : " (sample: not saved to Notion)");

// ---- a charter saved (an approved change, or Confirm), with Undo ----
async function saveCharter(m, sections, label) {
  const before = m.sections;
  try {
    const j = await api(`/api/team/${encodeURIComponent(m.id)}`, { method: "PUT", body: { sections, extra: m.extra, base: m.edited } });
    Object.assign(m, j);
    render();
    toast(`${label}${say(team.live)}`, false, { label: "Undo", run: async () => {
      try { Object.assign(m, await api(`/api/team/${encodeURIComponent(m.id)}`, { method: "PUT", body: { sections: before, extra: m.extra, base: m.edited } })); render(); toast("Put back"); }
      catch (err) { toast(`Couldn't undo: ${err.message}`, true); }
    } });
    return true;
  } catch (err) {
    if (err.status === 409) { toast(`${err.message} Reading it again…`, true); await loadTeam(true); }
    else toast(err.message, true);
    return false;
  }
}

// ---- the stand-up ----
const countStandup = () => {
  const d = new Date(), monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const week = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  let c = {}; try { c = JSON.parse(store("team-standups") || "{}") || {}; } catch { /* a fresh count */ }
  store("team-standups", JSON.stringify(bumpWeek(c, week)));
};
async function sendStandup(again = false) {
  const st = su();
  if (!st.update.trim()) return;
  stopTalk();
  const asked = again ? Object.entries(st.answers).filter(([, a]) => a.trim()).map(([k, answer]) => { const [mid, i] = k.split("|"); return { member: member(mid)?.title || "", question: st.reply?.members?.find((x) => x.member === mid)?.questions?.[Number(i)] || "", answer }; }) : [];
  try {
    const res = await wait("standup", again ? "The team is reading your answers…" : "The team is working through it…", async (signal) => {
      render();
      return api("/api/team/standup", { method: "POST", body: { update: st.update, answers: asked }, signal });
    });
    if (res) {
      st.reply = res;
      if (!again) { countStandup(); st.answers = {}; }
      st.done = {}; touch(st); keep(true);
    }
  } catch (err) { toast(err.message, true); }
  render();
  if (view === "standup") arrived(win.querySelector(".tm-pm"));
}
const recordTitle = (id) => su().reply?.records?.find((r) => r.id === id)?.title || "a record";
function citesEl(item) {
  return h("p", { className: "tm-cites" },
    item.unconfirmed ? h("span", { className: "tm-unconf", textContent: "Unconfirmed: rests on nothing you were shown" }) : null,
    ...(item.cites || []).map((c) => h("span", { className: "tm-cite", textContent: recordTitle(c) })),
    item.droppedCites ? h("span", { className: "tm-unconf", textContent: `${item.droppedCites} made-up reference${item.droppedCites === 1 ? "" : "s"} left out` }) : null);
}
function signoffEl(s, key) {
  const what = s.kind === "change" ? `${s.title}: ${Object.entries(s.change || {}).map(([k, v]) => `${k} → ${v}`).join(", ")}`
    : s.kind === "today" ? `Add to today's ${jumpData?.section || "Jump issues"}: ${s.text}`
    : `${s.memberTitle} · ${s.edit.section}: ${s.edit.op === "add" ? `add “${s.edit.line}”` : s.edit.op === "remove" ? `remove “${s.edit.line}”` : `“${s.edit.line}” → “${s.edit.with}”`}`;
  const long = s.kind === "change" ? Object.keys(s.change || {}).filter((k) => ["outcome", "resolution"].includes(k)) : [];
  const edits = long.map((k) => { const t = h("textarea", { className: "tm-edit", value: s.change[k], rows: 3, ariaLabel: `${k} before approving` }); t.addEventListener("input", () => { s.change[k] = t.value; }); return t; });
  let action;
  if (s.invalid) action = h("span", { className: "tm-invalid", textContent: `Can't be done from here: ${s.invalid}` });
  else if (su().done[key]) action = h("span", { className: "tm-done", textContent: "Done ✓" });
  else {
    action = h("button", { type: "button", className: "pl-go tm-approve", textContent: "Approve" });
    action.addEventListener("click", async () => {
      action.disabled = true;
      let ok = false;
      if (s.kind === "change") ok = await changeRecord(s.area, s.id, s.change, `Jump OS: ${s.title} updated`);
      else if (s.kind === "today") ok = await hooks.toToday(s.text);
      else {
        const m = member(s.member), r = m && applyEdit(m.sections, s.edit);
        if (!r?.ok) toast(r?.error || "That member isn't on the team any more.", true);
        else ok = await saveCharter(m, r.sections, `${m.title}'s charter updated`);
      }
      if (ok) { su().done[key] = true; touch(su()); }
      render();
    });
  }
  return h("li", { className: `tm-signoff${s.invalid ? " invalid" : ""}` }, h("span", { className: "tm-what", textContent: what }), h("span", { className: "tm-why", textContent: s.why }), ...edits, action);
}
function standupEl() {
  const st = su(), { reply, answers } = st;
  const box = h("textarea", { className: "jn-text tm-update", value: st.update, rows: 5, placeholder: "What's happening? Say it the way you'd tell the team.", ariaLabel: "Your stand-up update" });
  box.addEventListener("input", () => { st.update = box.value; touch(st); send.disabled = !st.update.trim(); });
  const talk = focus.on ? { button: null, line: null } : talkFor(box); // speech goes to Apple: not at work (Mel, 16 Oct 2026)
  const send = decorate(h("button", { type: "button", className: "pl-go", textContent: reply ? "Send again (fresh) ✦" : "Send to the team ✦", disabled: !st.update.trim() }), "standup");
  send.addEventListener("click", () => sendStandup(false));
  const fresh = reply || st.update ? h("button", { type: "button", className: "set-reset", textContent: "Start fresh" }) : null;
  fresh?.addEventListener("click", () => { const was = drafts.standup; drafts.standup = freshStandup(); keep(true); render(); toast("Stand-up cleared", false, { label: "Undo", run: () => { drafts.standup = was; keep(true); render(); } }); });
  const top = h("section", { className: "tm-sec" },
    h("header", { className: "jn-head" }, h("h3", { textContent: "Stand-up" }), talk.button),
    h("p", { className: "tm-hint", textContent: "Leave out names and customer details: say the role (“the partner's ops lead”, “a customer”). Hanua won't send emails, phone or account numbers." }),
    box, talk.line, h("div", { className: "tm-row" }, fresh, send));
  const note = waitNote("standup", "The team usually takes 30 to 60 s");
  if (!reply) return [top, note];
  const byId = (id) => member(id)?.title || "a member";
  const pm = h("section", { className: "tm-card tm-pm" },
    h("h4", { textContent: "Product Manager" }),
    h("p", { textContent: reply.pm.synthesis }),
    reply.pm.households ? h("p", { className: "tm-households" }, h("b", { textContent: "For households. " }), document.createTextNode(reply.pm.households)) : null,
    reply.routed.length ? h("p", { className: "tm-routed", textContent: `Working on it: ${reply.routed.map(byId).join(", ")}` }) : null,
    reply.pm.stale?.length ? h("p", { className: "tm-stale", textContent: `Charters to confirm before relying on them: ${reply.pm.stale.map(byId).join(", ")}` }) : null,
    citesEl(reply.pm));
  const cards = reply.members.map((m) => h("section", { className: "tm-card" },
    h("h4", { textContent: m.title }),
    h("p", {}, h("b", { textContent: "Handle. " }), document.createTextNode(m.handle)),
    h("p", {}, h("b", { textContent: "Prevent. " }), document.createTextNode(m.prevent)),
    citesEl(m),
    m.questions.length ? h("div", { className: "tm-qs" }, ...m.questions.map((q, i) => {
      const k = `${m.member}|${i}`, a = h("textarea", { className: "tm-answer", value: answers[k] || "", rows: 2, ariaLabel: q, placeholder: "Your answer" });
      a.addEventListener("input", () => { answers[k] = a.value; touch(st); fit(a); });
      return h("label", { className: "tm-q" }, h("span", { textContent: q }), a);
    })) : null,
    m.signoffs.length ? h("ul", { className: "tm-signoffs" }, ...m.signoffs.map((s, i) => signoffEl(s, `${m.member}|${i}`))) : null));
  const again = decorate(h("button", { type: "button", className: "pl-go", textContent: "Answer and ask again ✦" }), "standup");
  again.addEventListener("click", () => sendStandup(true));
  const hasQs = reply.members.some((m) => m.questions.length);
  return [top, note, pm, ...cards, hasQs ? h("div", { className: "tm-row" }, again) : null];
}

// ---- the team, and one member ----
function teamEl() {
  if (!team) return [h("p", { className: "tm-hint", textContent: "Reading the team…" })];
  if (!team.members.length) return [h("p", { className: "tm-hint", textContent: team.error || "No members yet." })];
  return [h("div", { className: "tm-grid" }, ...team.members.map((m) => {
    const b = h("button", { type: "button", className: `tm-member${m.state.stale ? " stale" : ""}` },
      h("span", { className: "tm-name", textContent: m.title }),
      h("span", { className: "tm-holds", textContent: m.sections.Holds?.[0] || "" }),
      h("span", { className: "tm-state", textContent: `${m.state.label}${m.state.oldNotes ? ` · ${m.state.oldNotes} note${m.state.oldNotes === 1 ? "" : "s"} to review` : ""}` }),
      drafts.members[m.id]?.note || drafts.members[m.id]?.fold ? h("span", { className: "tm-wip", textContent: "Your work in progress is kept" }) : null);
    b.addEventListener("click", () => { view = m.id; render(); }); // its work is kept (ctxOf), never started over
    return b;
  }))];
}
async function fold(again = false) {
  const m = member(view);
  if (!m) return;
  const id = m.id, ctx = ctxOf(id); // the reply is kept for this member, wherever Mel is when it comes back
  if (!ctx.note.trim()) return;
  stopTalk();
  const asked = again ? Object.entries(ctx.answers).filter(([, a]) => a.trim()).map(([i, answer]) => ({ question: ctx.fold?.questions?.[Number(i)] || "", answer })) : [];
  try {
    const res = await wait(`fold:${id}`, again ? `${m.title} is reading your answers…` : `${m.title} is folding it in…`, async (signal) => {
      render();
      return api(`/api/team/${encodeURIComponent(id)}/context`, { method: "POST", body: { note: ctx.note, answers: asked }, signal });
    });
    if (res) { ctx.fold = res; ctx.done = {}; ctx.noteKept = false; if (!again) ctx.answers = {}; touch(ctx); keep(true); }
  } catch (err) { toast(err.message, true); }
  render();
  if (view === id) arrived(win.querySelector(".tm-suggests"));
}
function memberEl(m) {
  const ctx = ctxOf(m.id), key = `fold:${m.id}`;
  const back = h("button", { type: "button", className: "set-reset", textContent: "‹ The team" });
  back.addEventListener("click", () => { view = "team"; render(); });
  const confirm = h("button", { type: "button", className: "set-reset", textContent: "Confirm charter", title: "Say this charter is still right today (sets Last confirmed)" });
  confirm.addEventListener("click", () => saveCharter(m, confirmCharter(m.sections, todayStr()), `${m.title}'s charter confirmed`));
  const sections = Object.entries(m.sections).filter(([s]) => s !== "Last confirmed").map(([s, lines]) => h("section", { className: "tm-charter-sec" },
    h("h4", { textContent: s }), lines.length ? h("ul", {}, ...lines.map((l) => h("li", { textContent: l }))) : h("p", { className: "tm-hint", textContent: "Nothing yet." })));
  const box = h("textarea", { className: "jn-text tm-update", value: ctx.note, rows: 4, placeholder: `Tell ${m.title} what you know about this area: what's changed, what matters, what worries you.`, ariaLabel: `New context for ${m.title}` });
  const talk = focus.on ? { button: null, line: null } : talkFor(box);
  const go = decorate(h("button", { type: "button", className: "pl-go", textContent: "Fold it in ✦", disabled: !ctx.note.trim() }), key);
  box.addEventListener("input", () => { ctx.note = box.value; touch(ctx); go.disabled = !ctx.note.trim(); });
  go.addEventListener("click", () => fold(false));
  const fresh = ctx.note || ctx.fold ? h("button", { type: "button", className: "set-reset", textContent: "Start fresh" }) : null;
  fresh?.addEventListener("click", () => { const was = drafts.members[m.id]; drafts.members[m.id] = freshMember(); keep(true); render(); toast(`Cleared what you were working on with ${m.title}`, false, { label: "Undo", run: () => { drafts.members[m.id] = was; keep(true); render(); } }); });
  const add = h("section", { className: "tm-sec" },
    h("header", { className: "jn-head" }, h("h3", { textContent: "Add context" }), talk.button),
    h("p", { className: "tm-hint", textContent: "It won't just be stored: the member suggests where it changes the charter, and you approve each change. The note itself is kept, dated, and comes up for review after 90 days." }),
    box, talk.line, h("div", { className: "tm-row" }, fresh, go), waitNote(key, "Usually 15 to 40 s"));
  let result = null;
  if (ctx.fold) {
    const f = ctx.fold;
    const keep = ctx.noteKept ? h("span", { className: "tm-done", textContent: "Kept ✓" }) : h("button", { type: "button", className: "pl-go tm-approve", textContent: "Keep the note" });
    if (!ctx.noteKept) keep.addEventListener("click", async () => { if (await saveCharter(m, { ...m.sections, [NOTES]: [...(m.sections[NOTES] || []), noteLine(todayStr(), f.note)] }, `Note kept in ${m.title}'s charter`)) { ctx.noteKept = true; touch(ctx); render(); } });
    result = h("section", { className: "tm-card tm-suggests" },
      h("h4", { textContent: `${m.title} suggests` }),
      h("ul", { className: "tm-signoffs" },
        h("li", { className: "tm-signoff" }, h("span", { className: "tm-what", textContent: `Context notes: add “${noteLine(todayStr(), f.note)}”` }), keep),
        ...f.edits.map((e, i) => {
          const what = `${e.section}: ${e.op === "add" ? `add “${e.line}”` : e.op === "remove" ? `remove “${e.line}”` : `“${e.line}” → “${e.with}”`}`;
          let action;
          if (e.invalid) action = h("span", { className: "tm-invalid", textContent: e.invalid });
          else if (ctx.done[i]) action = h("span", { className: "tm-done", textContent: "Done ✓" });
          else {
            action = h("button", { type: "button", className: "pl-go tm-approve", textContent: "Approve" });
            action.addEventListener("click", async () => {
              const r = applyEdit(m.sections, e);
              if (!r.ok) return toast(r.error, true);
              if (await saveCharter(m, r.sections, `${m.title}'s charter updated`)) { ctx.done[i] = true; touch(ctx); render(); }
            });
          }
          return h("li", { className: `tm-signoff${e.invalid ? " invalid" : ""}` }, h("span", { className: "tm-what", textContent: what }), h("span", { className: "tm-why", textContent: e.why }), action);
        })),
      f.questions.length ? h("div", { className: "tm-qs" }, ...f.questions.map((q, i) => {
        const a = h("textarea", { className: "tm-answer", value: ctx.answers[i] || "", rows: 2, ariaLabel: q, placeholder: "Your answer" });
        a.addEventListener("input", () => { ctx.answers[i] = a.value; touch(ctx); fit(a); });
        return h("label", { className: "tm-q" }, h("span", { textContent: q }), a);
      }), (() => { const b = decorate(h("button", { type: "button", className: "pl-go", textContent: "Answer and fold again ✦" }), key); b.addEventListener("click", () => fold(true)); return b; })()) : null);
  }
  return [h("div", { className: "tm-row tm-member-head" }, back, h("span", { className: `tm-state${m.state.stale ? " stale" : ""}`, textContent: m.state.label }), confirm,
      m.url ? h("a", { className: "b-link", href: m.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null),
    h("h2", { className: "jn-title", textContent: m.title }), add, result, ...sections];
}

function render() {
  if (win.hidden) return;
  stopTalk();
  const tab = (id, label) => { const b = h("button", { type: "button", className: `tm-tab${(view === id || (id === "team" && member(view))) ? " on" : ""}`, textContent: label }); b.addEventListener("click", () => { view = id; render(); }); return b; };
  const stale = team?.members?.filter((m) => m.state.stale).length || 0;
  const notion = team?.url && team.live ? h("a", { className: "b-link", href: team.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null;
  const bar = windowBar(win, "Jump team", [tab("standup", "Stand-up"), tab("team", `Team${stale ? ` · ${stale} to confirm` : ""}`), notion].filter(Boolean), hide);
  const m = member(view);
  const parts = view === "standup" ? standupEl() : m ? memberEl(m) : teamEl();
  const scroll = win.querySelector(".tm-body")?.scrollTop || 0;
  const body = h("div", { className: "tm-body" }, ...parts.filter(Boolean));
  win.replaceChildren(bar, body, h("footer", { className: "jn-foot" }, h("span", { className: "jn-status", textContent: team?.live === false ? "Sample team: invented charters, nothing goes to Notion or Claude" : "Nothing changes in Jump OS until you approve it" })));
  body.scrollTop = scroll;
  for (const t of body.querySelectorAll("textarea")) requestAnimationFrame(() => fit(t));
}

function show() { takeFocus(win); win.hidden = false; render(); loadTeam(); }
function hide() { stopTalk(); keep(true); win.hidden = true; noteClosed("team-win"); $("jump-team")?.focus({ preventScroll: true }); }
registerFocus(win, () => hide());
registerWindow("team-win", { title: "Jump team", icon: '<svg viewBox="0 0 48 60" aria-hidden="true" width="30"><circle cx="17" cy="24" r="7" fill="#c76a3a"/><circle cx="31" cy="24" r="7" fill="#3f7a5a"/><path d="M6 46c2-8 8-12 11-12s9 4 11 12M20 46c2-8 8-12 11-12s9 4 11 12" fill="none" stroke="#6b6155" stroke-width="2"/></svg>', show, hide, shown: () => !win.hidden });
export function openTeam() { if (win.hidden) { show(); noteOpen("team-win"); } }
export function initTeam(opts) { hooks = { ...hooks, ...opts }; $("jump-team")?.addEventListener("click", () => openTeam()); }
win.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.preventDefault(); e.stopPropagation(); hide(); } });
addEventListener("pagehide", () => keep(true));
