// The Jump team (Mel, 16 Oct 2026; brief docs/plans/2026-10-jump-team.md): eight AI members, one per core stakeholder
// area plus a Product Manager, each with a charter page under "Jump team" in her work OS (config jump.team.pageUrl).
// Hanua reads the charters (5 minutes in memory, never stored), writes one only when Mel approves a change (its body
// replaced; base = the edited time read, 409 if it changed elsewhere), and on her press only sends the team her
// stand-up update or new context for a member, with the charters and what the dashboard shows (teamRows: whitelisted
// fields, identifiers refused first by scrub). The reply comes back as proposals: nothing changes in Jump OS until
// she approves each one (the dashboard's own write path for records). Only this file reaches the team's Claude calls
// (npm run check, rule 8). A sample server uses invented charters and invented replies.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPage, notionEnabled, pageBlocks, replaceBody } from "../notion.js";
import { claudeEnabled, coachJumpTeam, foldTeamContext } from "../claude.js";
import { todayStr } from "../../public/shared/dates.js";
import { WRITABLE, checkWrite } from "../../public/shared/jump.js";
import { SECTIONS, applyEdit, charterBlocks, charterFrom, charterState, grounded, scrub, scrubMessage, teamRows } from "../../public/shared/team.js";

export async function register({ app, root, config, jumpNow }) {
  const cfg = config.jump?.team || {};
  const sample = JSON.parse(await readFile(path.join(root, "data/sample.json"), "utf8")).jump?.team || {};
  const parentId = /([0-9a-f]{32})(?:[?#]|$)/i.exec(cfg.pageUrl || "")?.[1] || null;
  const live = () => notionEnabled() && Boolean(parentId);
  const plain = (err) => (err.status === 404 || err.status === 403 ? "Hanua can't see the Jump team yet: in Notion, open “Jump team” (under Skinny Jump), then ••• → Connections → add Hanua."
    : `Couldn't reach the Jump team in Notion (${err.message}).`);
  const rules = { closedStatus: config.jump?.escalations?.closedStatus, answered: config.jump?.questions?.answered, wontResolve: config.jump?.questions?.wontResolve };

  // ---- sample charters: invented, in memory while this server runs ----
  const mem = (sample.members || []).map((m, i) => ({ id: `sample-team-${i}`, title: m.title, url: null, edited: new Date().toISOString(),
    sections: Object.fromEntries(SECTIONS.map((s) => [s, [...(m.sections?.[s] || [])]])), extra: [] }));
  const shape = (m, today) => ({ ...m, state: charterState(m.sections, today) });

  let cache = null;
  async function members(fresh = false) {
    const today = todayStr();
    if (!live()) return mem.map((m) => shape(m, today));
    if (!fresh && cache && Date.now() - cache.at < 300_000) return cache.value.map((m) => shape(m, today));
    const kids = (await pageBlocks(parentId)).filter((b) => b.type === "child_page");
    const value = [];
    for (const k of kids) { // one at a time: Notion takes about three requests a second
      const [page, blocks] = await Promise.all([getPage(k.id), pageBlocks(k.id)]);
      value.push({ id: k.id, title: k.child_page?.title || page.title, url: page.url, edited: page.edited, ...charterFrom(blocks) });
    }
    cache = { at: Date.now(), value };
    return value.map((m) => shape(m, today));
  }
  const find = async (id) => (await members()).find((m) => m.id === id) || null;

  app.get("/api/team", async (req, res) => {
    try { res.json({ live: live(), url: cfg.pageUrl || null, members: await members(req.query.fresh === "1") }); }
    catch (err) { res.json({ live: true, url: cfg.pageUrl || null, members: [], error: plain(err) }); }
  });

  // a charter saved (an approved change, Confirm, or Undo): its sections; base = the edited time this page read
  app.put("/api/team/:id", async (req, res) => {
    const { id } = req.params, base = req.body?.base ?? null;
    const sections = Object.fromEntries(SECTIONS.map((s) => [s, (Array.isArray(req.body?.sections?.[s]) ? req.body.sections[s] : []).map(String).filter((l) => l.trim()).slice(0, 60)]));
    const extra = (Array.isArray(req.body?.extra) ? req.body.extra : []).map((x) => ({ heading: String(x?.heading || "").slice(0, 200), lines: (x?.lines || []).map(String).slice(0, 60) })).filter((x) => x.heading);
    if (!live()) {
      const m = mem.find((x) => x.id === id);
      if (!m) return res.status(404).json({ error: "That member isn't on the team any more." });
      if (base && m.edited !== base) return res.status(409).json({ error: "This charter was changed somewhere else since you opened it.", conflict: "changed" });
      Object.assign(m, { sections, extra, edited: new Date().toISOString() });
      return res.json({ live: false, ...shape(m, todayStr()) });
    }
    try {
      const m = await find(id);
      if (!m) return res.status(404).json({ error: "That member isn't on the team any more." });
      const now = await getPage(id);
      if (base && now.edited !== base) return res.status(409).json({ error: "This charter was changed in Notion since you opened it.", conflict: "changed" });
      await replaceBody(id, charterBlocks({ sections, extra }));
      cache = null;
      const fresh = await find(id);
      res.json({ live: true, ...fresh });
    } catch (err) { res.status(502).json({ error: plain(err) }); }
  });

  // identifiers in anything Mel typed or said are refused before Claude is called
  const refuse = (texts) => { for (const t of texts) { const s = scrub(t); if (!s.ok) return scrubMessage(s.hits); } return null; };
  const answersOf = (body) => (Array.isArray(body?.answers) ? body.answers : []).map((a) => ({ member: String(a?.member || ""), question: String(a?.question || "").slice(0, 400), answer: String(a?.answer || "").slice(0, 2000) })).filter((a) => a.answer.trim());

  // the stand-up: her update (and her answers to the team's questions, the second time round) → the team's proposals
  app.post("/api/team/standup", async (req, res, next) => {
    const update = String(req.body?.update || "").trim().slice(0, 8000), answers = answersOf(req.body);
    if (!update) return res.status(400).json({ error: "Say what's happening first." });
    const no = refuse([update, ...answers.map((a) => a.answer)]);
    if (no) return res.status(400).json({ error: no, scrub: true });
    try {
      const today = todayStr(), team = await members(), jump = await jumpNow();
      const records = teamRows(jump);
      let reply;
      if (!claudeEnabled()) {
        if (live()) return res.status(503).json({ error: "Claude isn't set up on this Mac (ANTHROPIC_API_KEY in .env)." });
        reply = JSON.parse(JSON.stringify(sample.standup || { routed: [], members: [], pm: { synthesis: "", households: "", stale: [], cites: [] } }));
        const ids = Object.fromEntries(team.map((m, i) => [`m${i}`, m.id])), rec = Object.fromEntries(records.map((r, i) => [`r${i}`, r.id]));
        const swap = (x) => ids[x] || rec[x] || x; // the invented reply names members and records by position
        reply.routed = reply.routed.map(swap); reply.pm.cites = reply.pm.cites.map(swap); reply.pm.stale = reply.pm.stale.map(swap);
        for (const m of reply.members) { m.member = swap(m.member); m.cites = m.cites.map(swap); for (const s of m.signoffs) { s.id = swap(s.id); s.member = swap(s.member); } }
      } else {
        reply = await coachJumpTeam({ update, answers, today, records,
          members: team.map((m) => ({ id: m.id, title: m.title, sections: m.sections, state: m.state.label })) });
      }
      res.json({ live: live(), records, ...check(reply, team, records, jump) });
    } catch (err) {
      if (err.status) return res.status(502).json({ error: plain(err) });
      next(err);
    }
  });

  // What comes back is checked before Mel sees it: cites only what was shown; each sign-off checked the way it would
  // be written (Jump OS's own rules for records; a charter change against the charter as it is), and one that can't
  // be done says why instead of being offered
  function check(reply, team, records, jump) {
    const known = records.map((r) => r.id), byId = new Map(team.map((m) => [m.id, m]));
    const rowOf = (area, id) => (area === "escalations" ? jump.escalations?.columns?.flatMap((c) => c.items) : jump[area]?.items)?.find((r) => r.id === id) || null;
    const members = grounded(reply.members.filter((m) => byId.has(m.member)), known).map((m) => ({
      ...m, title: byId.get(m.member).title,
      signoffs: m.signoffs.map((s) => {
        const out = { kind: s.kind, why: s.why };
        if (s.kind === "change") {
          const change = Object.fromEntries((s.change || []).map((c) => [c.field, c.value]));
          const row = known.includes(s.id) ? rowOf(s.area, s.id) : null;
          if (!WRITABLE[s.area] || !row) return { ...out, invalid: "It points at a record the team wasn't shown." };
          const ok = checkWrite(s.area, change, { options: jump.options?.[s.area] || {}, row, today: todayStr(), cfg: rules });
          return ok.ok ? { ...out, area: s.area, id: s.id, title: row.title, change } : { ...out, area: s.area, id: s.id, title: row.title, change, invalid: ok.error };
        }
        if (s.kind === "today") return scrub(s.text).ok && s.text.trim() ? { ...out, text: s.text.trim().slice(0, 200) } : { ...out, invalid: "No line to add." };
        const target = byId.get(s.member);
        if (!target) return { ...out, invalid: "It names a member who isn't on the team." };
        const ok = applyEdit(target.sections, s.edit);
        return { ...out, member: target.id, memberTitle: target.title, edit: s.edit, ...(ok.ok ? {} : { invalid: ok.error }) };
      }),
    }));
    const [pm] = grounded([{ ...reply.pm }], known);
    return { routed: reply.routed.filter((id) => byId.has(id)), members, pm: { ...pm, stale: (pm.stale || []).filter((id) => byId.has(id)) } };
  }

  // new context for one member: its proposed changes to its own charter, a note, and its questions
  app.post("/api/team/:id/context", async (req, res, next) => {
    const note = String(req.body?.note || "").trim().slice(0, 8000), answers = answersOf(req.body);
    if (!note) return res.status(400).json({ error: "Say something first." });
    const no = refuse([note, ...answers.map((a) => a.answer)]);
    if (no) return res.status(400).json({ error: no, scrub: true });
    try {
      const team = await members(), member = team.find((m) => m.id === req.params.id);
      if (!member) return res.status(404).json({ error: "That member isn't on the team any more." });
      let reply;
      if (!claudeEnabled()) {
        if (live()) return res.status(503).json({ error: "Claude isn't set up on this Mac (ANTHROPIC_API_KEY in .env)." });
        reply = JSON.parse(JSON.stringify(sample.fold || { note: "", edits: [], questions: [] }));
      } else {
        reply = await foldTeamContext({ member, note, answers, today: todayStr(), others: team.filter((m) => m.id !== member.id).map((m) => m.title) });
      }
      const edits = reply.edits.map((e) => { const ok = applyEdit(member.sections, e); return ok.ok ? e : { ...e, invalid: ok.error }; });
      res.json({ live: live(), note: reply.note, edits, questions: reply.questions });
    } catch (err) {
      if (err.status) return res.status(502).json({ error: plain(err) });
      next(err);
    }
  });
}
