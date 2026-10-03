import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

let client;
const getClient = () => (client ??= new Anthropic());

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

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
