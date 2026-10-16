import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

let client;
const getClient = () => (client ??= new Anthropic());

// A sample server never calls Claude, whatever its .env says (set by server/index.js, like blockPageWrites in notion.js)
let claudeBlocked = false;
export const blockClaude = (on) => { claudeBlocked = Boolean(on); };
export const claudeEnabled = () => !claudeBlocked && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const ASK_SYSTEM = `You are the analyst behind a personal "life dashboard". The user's records come from their Notion databases.
Answer using only the records provided. Be direct and specific: cite numbers, dates and item names.
If the data can't answer the question, say what's missing. Point out anything that looks off (overdue items, unusual spending, neglected areas) even if not asked.
Keep answers short: a one-line answer, then up to 5 bullet points. Plain text with "- " bullets, no markdown headings.`;

function textOf(response) {
  if (response.stop_reason === "refusal") {
    return "Claude declined to answer this one. Try rephrasing the question.";
  }
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// areaData: [{ label, records: [...] }]. One area when a node is open, all of them from the centre node.
export async function ask(question, areaData) {
  const today = new Date().toISOString().slice(0, 10);
  const context = areaData
    .map((a) => `## ${a.label} (${a.records.length} records)\n${JSON.stringify(a.records.map(stripIds))}`)
    .join("\n\n");

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: ASK_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today is ${today}.\n\n<records>\n${context}\n</records>\n\nQuestion: ${question}`,
      },
    ],
  });
  return textOf(response);
}

function stripIds({ id, url, ...rest }) {
  return rest;
}

// Turn a free-text note ("paid $120 for power today") into a draft Notion row.
// areas: [{ id, label, schema }] - only areas with a connected database.
export async function draftEntry(text, areas) {
  const today = new Date().toISOString().slice(0, 10);
  const Draft = z.object({
    areaId: z.enum(areas.map((a) => a.id)),
    properties: z.array(z.object({ name: z.string(), value: z.string() })),
    note: z.string(),
  });

  const schemas = areas
    .map((a) => `- ${a.id} (${a.label}): ${JSON.stringify(a.schema)}`)
    .join("\n");

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Draft) },
    system: `You file quick notes into the right Notion database for a personal dashboard.
Pick the single best area, then fill properties using the exact property names from its schema.
Rules: dates as YYYY-MM-DD (resolve "today", "yesterday", "next Friday" against today's date); numbers as plain digits (expenses negative when the database mixes income and spending); for select/status properties prefer an existing option.
Only fill properties the note supports - leave the rest out. Always fill the title property.
In "note", say in one short sentence what you assumed, or "" if nothing.`,
    messages: [
      {
        role: "user",
        content: `Today is ${today}.\n\nDatabases:\n${schemas}\n\nNote: ${text}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Claude couldn't turn that into an entry. Try adding more detail.");
  }
  return response.parsed_output;
}

const COACH_HABITS = `The person plans their own life with Agile habits, in an ADO-style hierarchy:
Epic = an outcome for this year; Feature = one of the mini-projects that together achieve the Epic (about a quarter); PBI = a slice of value this month; Task = a next action this week.
Every goal has: a title that names the outcome, not the topic ("Move to Sydney", not "Sydney move"; Tasks start with a verb); a Why ("So that ...", for Epics, Features and PBIs); and Done when (acceptance criteria): for Epics and Features 2-4 measurable points about what will have changed, not activities; for PBIs "Done when" bullets or Given/When/Then; for Tasks one line. Work fits its level's timeframe; anything too big is split into vertical slices that each deliver something real.
Write in plain, warm New Zealand English. Keep the person's own facts and words; never invent facts, leave "..." where only they know.`;

// The goal coach: reviews one goal against the habits and suggests a better title, why and done-when.
// Suggestions only: the user decides what to keep, and nothing is saved here.
export async function coachGoal(goal, parent) {
  const Review = z.object({
    verdict: z.enum(["good", "tweak"]),
    feedback: z.array(z.string()).max(3),
    title: z.string(),
    why: z.string(),
    doneWhen: z.string(),
  });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Review) },
    system: `${COACH_HABITS}
Review the goal. "feedback": up to 3 short, specific suggestions, each teaching the principle behind it in a few words. If it's already good, say what makes it good in one item and use verdict "good".
"title", "why" (starting "So that"; empty for a Task) and "doneWhen" ("- " bullets): your improved versions, or the same text if they're fine.`,
    messages: [{
      role: "user",
      content: `Today: ${new Date().toISOString().slice(0, 10)} (a quarter is about 3 months from today)
Level: ${goal.level}
Title: ${goal.title}
Why: ${goal.why || "(none)"}
Done when: ${goal.doneWhen || "(none)"}
Notes: ${goal.description || "(none)"}
Due: ${goal.due || "(none)"}  Effort: ${goal.effort || "(none)"}
Parent ${parent ? `(${parent.level}): ${parent.title}${parent.why ? `\nParent why: ${parent.why}` : ""}${parent.doneWhen ? `\nParent done when: ${parent.doneWhen}` : ""}` : ": (none)"}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Claude couldn't review this one. Try adding a little more detail.");
  return response.parsed_output;
}

// Which children does this goal still need? Reads the parent's why and done-when (each done-when point is a
// clue to a child) against the children it already has. Ideas only; the user picks what to add.
export async function suggestChildren(parent, children, level) {
  const Ideas = z.object({
    gaps: z.string(),
    ideas: z.array(z.object({ title: z.string(), why: z.string(), doneWhen: z.string(), covers: z.string() })).max(5),
  });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Ideas) },
    system: `${COACH_HABITS}
You help break a goal down. Given a parent goal, its why, its done-when points and the ${level}s it already has, suggest the ${level}s that seem to be missing so that, all done together, the parent would be done (the completeness test). Don't repeat ones that already exist. 0 to 5 ideas, most important first.
For each: "title" (outcome-named, or verb-first for a Task), "why" ("So that ..."; empty for a Task), "doneWhen" ("- " bullets, short), "covers" (which done-when point or part of the why it serves, a few words).
"gaps": one sentence on what's missing, or that it already looks complete.`,
    messages: [{
      role: "user",
      content: `Parent (${parent.level}): ${parent.title}
Why: ${parent.why || "(none)"}
Done when: ${parent.doneWhen || "(none)"}
Notes: ${parent.notes || "(none)"}
${level}s it already has: ${children.length ? children.map((c) => `\n- ${c}`).join("") : "none yet"}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Claude couldn't come up with ideas for this one.");
  return response.parsed_output;
}

// Three meal ideas built around the protein Mel picked, kept strictly to the household's tastes (read from the
// Notion "Eating well guide", section "Our tastes"). Ideas only; Mel picks one, and nothing is written for her.
export async function suggestMeals({ meal, day, protein, tastes, planned }) {
  const Ideas = z.object({
    ideas: z.array(z.object({ title: z.string(), note: z.string() })).max(3),
  });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Ideas) },
    system: `You suggest home-cooked meals for a couple in New Zealand (moving to Sydney). Give exactly 3 different ideas for one meal.
Follow the household's tastes strictly: never suggest anything they say they don't eat, and never hide it as an ingredient (e.g. no mushrooms in a sauce).
Build each idea around the chosen protein if one is given. Favour balanced plates: half vegetables, a quarter protein, a quarter wholegrains.
Vary the three (different cuisines or methods), keep them realistic for a weeknight unless it's the weekend, and avoid repeating meals already planned this week.
"title": the meal as it would be written on a whiteboard, under 40 characters (e.g. "Steak, kumara wedges & slaw"). "note": one short line on why it's a good pick or a time-saving tip, under 90 characters.`,
    messages: [{
      role: "user",
      content: `Meal: ${meal} on ${day}
Protein: ${protein || "any (your pick)"}
Our tastes:
${tastes.length ? tastes.map((t) => `- ${t}`).join("\n") : "- (none written yet)"}
Already planned this week: ${planned.length ? planned.join("; ") : "nothing yet"}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Claude couldn't come up with ideas for this one.");
  return response.parsed_output;
}

// The Journal's Reflect (15 Oct 2026; brief docs/plans/2026-10-journal.md): Mel's week, read back to her when she asks.
// She agreed Claude may read her journal to help her clear her head and see how she works; it only ever runs on her
// press, never by itself, and nothing it says is saved unless she writes it in herself.
const REFLECT_SYSTEM = `You are reading one week of a personal journal, at the writer's request, the way a trusted, warm elder would: someone who has seen many weeks and knows what matters. The writer is Pacific (Rotuman / Fijian roots) and lives in Aotearoa; her journal is organised like a fale: Family (the floor), Self, Relationships, Work (the posts), Spirit & culture (the roof), plus Write freely and Carry forward.
Reply in plain text, short, in this shape:
- 2 or 3 things you notice (patterns, what seems to matter to her, what she carried), each one line, in her own terms; quote at most a few of her words.
- One area of the fale that seems quiet or heavy this week, said gently, without judgement (skip if all is in balance).
- One question to sit with, asked as "what" or "who", never a bare "why".
- One small, concrete next step for the coming week.
No diagnosis, no therapy language, no lists of tips, no cultural words she didn't use. If anything suggests she is not safe or is in real distress, say kindly that it might help to talk to someone close, or to call or text 1737 (free, any time, in Aotearoa).`;
export async function reflectJournal(week, sections) {
  const page = Object.entries(sections).filter(([, t]) => t && t.trim()).map(([s, t]) => `## ${s}\n${t.trim()}`).join("\n\n");
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: REFLECT_SYSTEM,
    messages: [{ role: "user", content: `The week of ${week}.\n\n<journal>\n${page}\n</journal>` }],
  });
  return textOf(response);
}

// The Work reflection's two coach panels (16 Oct 2026; brief docs/plans/2026-10-work-reflection.md), on Mel's press
// only. Who sits on each panel, her role and its context come from her Notion page (written by role, never by name);
// her answers are this reflection's, and last is her previous one (so the accountability seat can hold her to it).
const COACH_SYSTEM = `You are two coaching panels reading one work reflection, at the writer's request. She wants a mirror held up to her reality, not encouragement: the perspective she isn't seeing, the bigger picture, and an honest nudge, whether that is to push harder, to hold steady, or to take a breather.
Each seat speaks in its own voice through its own lens (given to you), 2 or 3 sentences, and must:
- anchor in her own words (quote a few where it helps) and her role's context; nothing generic, no praise for its own sake;
- take a position: name one thing she is not seeing, or a pattern, or a tension, and what to do about it;
- where it fits, place a move on her Good / Better / Best ladder ("that's Good; Better would be…").
The accountability seat compares this reflection with her previous one when given; if there is none, it says what it will hold her to next time.
Then "together": the panels agree on one push (where to lean in), one hold (what to keep steady or protect), one breather (where to ease off or recover). One sentence each.
Plain words, warm and direct, the way a trusted senior colleague would speak. Use "what" and "who" questions, never a bare "why". No therapy language, no diagnosis, no cultural words she didn't use, no names of people (refer to roles). If anything suggests she is not safe or is in real distress, the mindset seat says kindly that it might help to talk to someone close, or to call or text 1737 (free, any time, in Aotearoa).`;
export async function coachWorkReflection({ role, context = [], panels, answers, last = [] }) {
  const Seat = z.object({ seat: z.string(), says: z.string() });
  const Reply = z.object({
    hp: z.array(Seat),
    professional: z.array(Seat),
    together: z.object({ push: z.string(), hold: z.string(), breather: z.string() }),
  });
  const seats = (list) => list.map((s) => `- ${s.seat}${s.lens ? `: ${s.lens}` : ""}`).join("\n");
  const qa = (list) => list.map((l) => `## ${l.key}\n${l.q ? `Q: ${l.q}\n` : ""}${l.a}`).join("\n\n");
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(Reply) },
    system: COACH_SYSTEM,
    messages: [{
      role: "user",
      content: `Her role: ${role || "(not given)"}
<context>
${context.map((c) => `- ${c}`).join("\n") || "(none)"}
</context>
HP Panel (high performance), one entry each in "hp", in this order:
${seats(panels.hp)}
Professional Panel, one entry each in "professional", in this order:
${seats(panels.professional)}

<reflection>
${qa(answers)}
</reflection>
${last.length ? `\n<previous_reflection>\n${qa(last)}\n</previous_reflection>` : ""}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("The panels couldn't read this one. Try adding a little more to your answers.");
  return response.parsed_output;
}

// The Jump team (16 Oct 2026; brief docs/plans/2026-10-jump-team.md), on Mel's press only, from server/routes/team.js
// (npm run check, rule 8). One call: the Product Manager routes her stand-up update to the members it touches, each
// answers in its own lane, the PM sums up. Every claim cites the records it rests on (ids it was shown) or says it's
// unconfirmed; anything to change in Jump OS comes back as a proposal for her to approve, never done here.
const TEAM_SYSTEM = `You are an operations team working for one person, the operations partner on a not-for-profit home broadband programme run by a telco with a community delivery partner. Each member owns one stakeholder area and holds a charter (given): what matters there, key risks, what it affects, standing questions, dated context notes. The Product Manager oversees the whole programme.
At a stand-up she gives an update. The Product Manager decides which members it touches ("routed": their ids) and only those members answer. Each answering member, in its own lane, says:
- "handle": how to deal with and resolve what touches its area now (concrete next steps, who in which role, in what order), 2 to 4 sentences;
- "prevent": what would stop it happening again (a process, an owner, a check), 1 to 3 sentences;
- "questions": what it needs from her to be sure (0 to 3, short, "what" or "who" questions);
- "signoffs": changes that need her approval (0 to 3), each one of: kind "change" (area and id from the records, change: a list of { field, value } using only these fields: escalations status, tier, waitingOn, finding, outcome; projects status, next; questions status, waitingOn, resolution), kind "today" (text: a line for her to-do list today), or kind "charter" (member id, edit: { section, op: add|replace|remove, line, with }) for a lasting learning about an area. Fill every field: "" or [] where it doesn't apply;
- "cites": the record ids (from <records>) the answer rests on. If it rests on nothing she was shown, cites is empty and it's unconfirmed.
Then the Product Manager: "synthesis" (3 to 5 sentences: what matters most this week across the areas, conflicts between members and how to settle them, the order of work), "households" (one sentence: what this means for the households the programme serves), "stale" (member ids whose charter is not confirmed or stale and that this update relied on), and "cites".
Rules: the programme's purpose first (fair, affordable, sustainable, and reaching households not reached yet). Facts owned by the partner, ops or care teams are never settled: say "to confirm with" and the role. The partner's vantage point is required, not a courtesy. Strategy sits above operations: flag when something needs sign-off above her. Never invent records, people or numbers; never use people's names, refer to roles. Plain, direct words; no em dashes.`;
export async function coachJumpTeam({ update, answers = [], members, records, today }) {
  // every field always there ("" or [] when it doesn't apply): structured replies keep to a fixed shape
  const Signoff = z.object({ kind: z.enum(["change", "today", "charter"]), why: z.string(), area: z.string(), id: z.string(), change: z.array(z.object({ field: z.string(), value: z.string() })), text: z.string(), member: z.string(), edit: z.object({ section: z.string(), op: z.enum(["add", "replace", "remove"]), line: z.string(), with: z.string() }) });
  const Member = z.object({ member: z.string(), handle: z.string(), prevent: z.string(), questions: z.array(z.string()), signoffs: z.array(Signoff), cites: z.array(z.string()) });
  const Reply = z.object({ routed: z.array(z.string()), members: z.array(Member), pm: z.object({ synthesis: z.string(), households: z.string(), stale: z.array(z.string()), cites: z.array(z.string()) }) });
  const charter = (m) => `### ${m.title} (id ${m.id}; ${m.state})\n${Object.entries(m.sections).filter(([, l]) => l.length).map(([s, l]) => `${s}:\n${l.map((x) => `- ${x}`).join("\n")}`).join("\n")}`;
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 12000,
    output_config: { effort: "medium", format: zodOutputFormat(Reply) },
    system: TEAM_SYSTEM,
    messages: [{ role: "user", content: `Today is ${today}.
<team>
${members.map(charter).join("\n\n")}
</team>
<records>
${JSON.stringify(records)}
</records>
<update>
${update}
</update>${answers.length ? `\n<her_answers_to_your_questions>\n${answers.map((a) => `- ${a.member}: ${a.question}\n  ${a.answer}`).join("\n")}\n</her_answers_to_your_questions>` : ""}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("The team couldn't work through this one. Try adding a little more to the update.");
  return response.parsed_output;
}

// One member folds new context Mel gives it into its own charter: changes to its sections (each approved by her one
// at a time), a dated note of what she said, and what it needs to ask. Nothing is written here.
export async function foldTeamContext({ member, others, note, answers = [], today }) {
  const Reply = z.object({
    note: z.string(),
    edits: z.array(z.object({ section: z.string(), op: z.enum(["add", "replace", "remove"]), line: z.string(), with: z.string(), why: z.string() })), // "with": "" unless replacing
    questions: z.array(z.string()),
  });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 6000,
    output_config: { effort: "medium", format: zodOutputFormat(Reply) },
    system: `You are ${member.title}, a member of an operations team on a not-for-profit home broadband programme. Your charter is below. The operations partner you work for has given you new context about your area. Fold it into your charter so nothing is just stored and left to go stale:
- "edits": 0 to 6 changes to your charter's sections (Holds, What matters, Key risks, Affects, Standing questions, Context notes). Prefer changing or removing a line that this context makes out of date over adding another; for "replace" and "remove", "line" must be copied exactly from the charter. Each with a short "why".
- "note": one line summing up what she told you, in her terms (it is kept, dated, under Context notes).
- "questions": 0 to 3 things you need to ask to understand it properly.
Never use people's names (refer to roles); never invent facts; facts owned by others are "to confirm". Plain words, no em dashes. Other members, for "Affects": ${others.join(", ")}.`,
    messages: [{ role: "user", content: `Today is ${today}.
<charter>
${Object.entries(member.sections).map(([s, l]) => `## ${s}\n${l.map((x) => `- ${x}`).join("\n")}`).join("\n")}
</charter>
<new_context>
${note}
</new_context>${answers.length ? `\n<her_answers>\n${answers.map((a) => `- ${a.question}\n  ${a.answer}`).join("\n")}\n</her_answers>` : ""}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Couldn't fold that in. Try saying a little more.");
  return response.parsed_output;
}
