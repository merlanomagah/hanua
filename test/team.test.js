// The Jump team (16 Oct 2026): charters to Notion and back, staying current, one change at a time, nothing that
// identifies a customer sent to Claude, and answers that may only cite what they were shown. Invented text only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, applyEdit, bumpWeek, watching, memberName, titleOf, initialOf, colourOf, cadenceOf, plainLine, whoWhat, linksTo, charterBlocks, charterFrom, charterState, confirmCharter, grounded, noteLine, scrub, teamRows } from "../public/shared/team.js";

const b = (type, t) => ({ type, [type]: { rich_text: [{ plain_text: t }] } });
const plain = (blocks) => blocks.map((x) => ({ type: x.type, [x.type]: { rich_text: x[x.type].rich_text.map((t) => ({ plain_text: t.text.content })) } }));

test("team: a charter goes to Notion and comes back the same, unknown headings kept", () => {
  const page = charterFrom([
    b("callout", "an intro, not a section (invented)"),
    b("heading_2", "What matters"), b("bulleted_list_item", "Stock flows (invented)"), b("paragraph", ""),
    b("heading_3", "key risks"), b("bulleted_list_item", "Missed cases (invented)"),
    b("heading_2", "Mel's own (invented)"), b("bulleted_list_item", "Kept (invented)"),
    b("heading_2", "Last confirmed"), b("bulleted_list_item", "2026-10-01"),
  ]);
  assert.deepEqual(page.sections["What matters"], ["Stock flows (invented)"]);
  assert.deepEqual(page.sections["Key risks"], ["Missed cases (invented)"]);
  assert.deepEqual(page.extra, [{ heading: "Mel's own (invented)", lines: ["Kept (invented)"] }]);
  const back = charterFrom(plain(charterBlocks(page)));
  assert.deepEqual(back, page);
  assert.equal(charterBlocks(page).filter((x) => x.type === "heading_2").length, SECTIONS.length + 1);
});

test("team: a charter goes stale after 30 days unconfirmed; old context notes come up for review", () => {
  const s = { "Last confirmed": ["Not yet"], "Context notes": [noteLine("2026-06-01", "old (invented)"), noteLine("2026-10-10", "new (invented)")] };
  assert.deepEqual(charterState(s, "2026-10-16"), { confirmed: null, days: null, stale: true, oldNotes: 1, label: "Not confirmed yet" });
  const c = confirmCharter(s, "2026-10-16");
  assert.equal(charterState(c, "2026-10-16").label, "Confirmed today");
  assert.equal(charterState(c, "2026-11-15").stale, false);
  assert.equal(charterState(c, "2026-11-16").stale, true);
  assert.match(charterState(c, "2026-11-16").label, /^Stale: confirmed 31 days ago/);
});

test("team: one change at a time, and only to a line that's really there", () => {
  const s = { "Key risks": ["A (invented)"] };
  assert.deepEqual(applyEdit(s, { section: "key risks", op: "add", line: "B (invented)" }).sections["Key risks"], ["A (invented)", "B (invented)"]);
  assert.deepEqual(applyEdit(s, { section: "Key risks", op: "replace", line: "a (invented)", with: "A2 (invented)" }).sections["Key risks"], ["A2 (invented)"]);
  assert.deepEqual(applyEdit(s, { section: "Key risks", op: "remove", line: "A (invented)" }).sections["Key risks"], []);
  assert.equal(applyEdit(s, { section: "Key risks", op: "remove", line: "Z" }).ok, false);
  assert.equal(applyEdit(s, { section: "Key risks", op: "add", line: "A (invented)" }).ok, false);
  assert.equal(applyEdit(s, { section: "Last confirmed", op: "add", line: "2026-10-16" }).ok, false); // only Mel confirms
  assert.equal(applyEdit(s, { section: "Nowhere", op: "add", line: "x" }).ok, false);
  assert.deepEqual(s, { "Key risks": ["A (invented)"] }); // never changed in place
});

test("team: identifiers are refused before anything goes to Claude; ordinary words, dates and labels pass", () => {
  for (const t of ["write to someone@example.invalid", "call 021 555 1234", "ring +64 9 555 1234", "account 1234567", "BB 98-765-4321", "acct details", "the ONT serial"])
    assert.equal(scrub(t).ok, false, t);
  for (const t of ["Met on 2026-10-16 about T2", "Person A asked for 3 modems", "up 12% this week", "the partner (invented) said 1,200 households", "Q3 and FY27"])
    assert.equal(scrub(t).ok, true, t);
  assert.ok(scrub("x@y.zz and 0215551234").hits.length >= 2); // a phone number is also a long number
});

test("team: the team sees whitelisted fields only, never Issue, Outcome, Resolution or who it waits on", () => {
  const jump = {
    escalations: { columns: [{ items: [{ id: "e1", title: "Modem not freed (invented)", status: "Open", tier: "T2", age: 4, issueSet: true, issue: "a customer's details", outcome: "x", waitingOn: "Person A", raisedBy: "Person B" },
      { id: "e2", title: "Customer 0215551234 (invented)", status: "Open" }] }] },
    projects: { items: [{ id: "p1", title: "Stock sheet (invented)", status: "Active", date: "2026-11-01", next: "secret next" }] },
    questions: { items: [{ id: "q1", title: "Who owns it? (invented)", status: "Open", priority: "Blocking", age: 9, resolution: "hidden" }] },
  };
  const rows = teamRows(jump), text = JSON.stringify(rows);
  assert.deepEqual(rows.map((r) => r.id), ["e1", "e2", "p1", "q1"]);
  for (const bad of ["customer's", "Person A", "Person B", "secret", "hidden", "0215551234"]) assert.equal(text.includes(bad), false, bad);
  assert.match(rows[1].title, /withheld/);
});

test("team: an answer may only cite what the team was shown", () => {
  const out = grounded([{ say: "a", cites: ["e1", "zz"] }, { say: "b", cites: [] }, { say: "c", cites: ["q1"] }], ["e1", "q1"]);
  assert.deepEqual(out.map((x) => [x.cites, x.unconfirmed, x.droppedCites || 0]), [[["e1"], false, 1], [[], true, 0], [["q1"], false, 0]]);
});

test("team: stand-ups counted by week, the last 8 kept", () => {
  let c = {};
  for (let i = 1; i <= 10; i++) c = bumpWeek(c, `2026-0${i < 10 ? i : 9}-01`.replace("-010-", "-10-"));
  assert.ok(Object.keys(c).length <= 8);
  assert.equal(bumpWeek({ "2026-10-12": 2 }, "2026-10-12")["2026-10-12"], 3);
});

test("team: the job's headings come first and round-trip like the rest", () => {
  const page = charterFrom([b("heading_2", "Role purpose"), b("bulleted_list_item", "Keep it strong (invented)"), b("heading_2", "FY focus areas"), b("bulleted_list_item", "FY27: one thing (invented)"), b("heading_2", "Watches"), b("bulleted_list_item", "tier: Partner")]);
  assert.deepEqual(page.sections["Role purpose"], ["Keep it strong (invented)"]);
  assert.deepEqual(page.extra, []);
  const blocks = charterBlocks(page), heads = blocks.filter((x) => x.type === "heading_2").map((x) => x.heading_2.rich_text[0].text.content);
  assert.equal(heads[0], "Role purpose");
  assert.ok(heads.indexOf("Watches") > heads.indexOf("Holds"));
  assert.deepEqual(charterFrom(plain(blocks)), page);
  assert.equal(applyEdit(page.sections, { section: "Key responsibilities", op: "add", line: "A duty (invented)" }).ok, true);
});

test("team: what a member watches: tiers, areas and keywords; nothing when it has no rules", () => {
  const rows = [
    { id: "e1", area: "escalations", title: "Modem not delinked (invented)", tier: "T2" },
    { id: "e2", area: "escalations", title: "Partner can't log in (invented)", tier: "Partner" },
    { id: "p1", area: "projects", title: "Stock sheet tidy (invented)" },
    { id: "q1", area: "questions", title: "Who owns the app? (invented)" },
  ];
  const ids = (w) => watching({ Watches: w }, rows).map((r) => r.id);
  assert.deepEqual(ids(["tier: Partner"]), ["e2"]);
  assert.deepEqual(ids(["keyword: DELINK", "keyword: stock"]), ["e1", "p1"]);
  assert.deepEqual(ids(["area: questions"]), ["q1"]);
  assert.deepEqual(ids(["Tiers: t2 (invented)"]), ["e1"]);
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids(["just a note"]), []);
});

test("team: names, initials, colours", () => {
  assert.deepEqual(memberName("Ana · DIAA Partnership Lead"), { name: "Ana", role: "DIAA Partnership Lead" });
  assert.deepEqual(memberName("Care Lead"), { name: "Care Lead", role: "" });
  assert.equal(titleOf(" Ana ", "DIAA Partnership Lead"), "Ana · DIAA Partnership Lead");
  assert.equal(initialOf("leilani"), "L");
  assert.equal(colourOf({ title: "Ana · DIAA Partnership Lead", sections: {} }), "green");
  assert.equal(colourOf({ title: "Leilani · Care Lead", sections: { Colour: ["Plum"] } }), "plum");
  assert.equal(colourOf({ title: "Someone · Unusual", sections: { Colour: ["neon"] } }), "slate");
});

test("team: rhythm lanes, plain lines, who and what", () => {
  assert.deepEqual(["Internal: weekly Jump Ops stand-up (proposed)", "With the partner: fortnightly operations meeting", "Monthly: reconciliation", "Quarterly look-back", "Twice a year: a review", "A heads-up before a change"].map(cadenceOf),
    ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly", "As needed"]);
  assert.deepEqual(plainLine("Internal: weekly Jump Ops stand-up (proposed)"), { text: "weekly Jump Ops stand-up", lead: "Internal", proposed: true });
  assert.deepEqual(plainLine("With the partner: fortnightly meeting"), { text: "fortnightly meeting", lead: "With the partner", proposed: false });
  assert.deepEqual(whoWhat("The partner's operations lead: open items (fortnightly)"), { who: "The partner's operations lead", what: "open items (fortnightly)" });
  assert.deepEqual(whoWhat("Just a note"), { who: "", what: "Just a note" });
});

test("team: who a member's area affects, by the words of their roles", () => {
  const ms = [{ id: "a", title: "Ana · DIAA Partnership Lead" }, { id: "h", title: "Hemi · Community Partners Lead" }, { id: "l", title: "Leilani · Care Lead" }, { id: "s", title: "Losa · Distribution & Stock Lead" }, { id: "t", title: "Tama · Product Manager" }];
  assert.deepEqual(linksTo(["Community delivery partners (training)", "Distribution & stock (delinking)", "Skinny Care (escalations)"], ms, "a"), ["h", "l", "s"]);
  assert.deepEqual(linksTo([], ms, "a"), []);
});
