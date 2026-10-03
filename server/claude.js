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

// The goal coach: reviews one goal (Epic / Feature / PBI / Task) against Agile habits and suggests a
// better title and description. Suggestions only: the user decides what to keep, and nothing is saved here.
export async function coachGoal(goal, parent) {
  const Review = z.object({
    verdict: z.enum(["good", "tweak"]),
    feedback: z.array(z.string()).max(3),
    title: z.string(),
    description: z.string(),
  });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Review) },
    system: `You coach one person who is learning to plan their own life with Agile habits, in an ADO-style hierarchy:
Epic = an outcome for this year; Feature = a milestone this quarter; PBI = a slice of value this month; Task = a next action this week.
Good habits: name the outcome, not the topic ("Move to Sydney", not "Sydney move"); Tasks start with a verb; Epics and Features have a why ("So that ...") and 2-4 measurable "we'll know it's done when" points about what changes, not activities; PBIs are INVEST-shaped (small, valuable on their own, testable) with "Done when" acceptance criteria (Given/When/Then is fine); work fits its level's timeframe; anything too big is split into vertical slices.
Review the goal. "feedback": up to 3 short, warm, specific suggestions in plain New Zealand English, each teaching the principle behind it in a few words. If it's already good, say what makes it good in one item and use verdict "good".
"title": your suggested title (or the same title if it's fine). "description": an improved description in the right shape for its level, keeping the person's own facts and words; never invent facts, leave blanks like "..." where only they know. Plain text, "- " bullets.`,
    messages: [{
      role: "user",
      content: `Today: ${new Date().toISOString().slice(0, 10)} (a quarter is about 3 months from today)\nLevel: ${goal.level}\nTitle: ${goal.title}\nDescription: ${goal.description || "(none)"}\nDue: ${goal.due || "(none)"}\nEffort: ${goal.effort || "(none)"}\nParent ${parent ? `(${parent.level}): ${parent.title}` : ": (none)"}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Claude couldn't review this one. Try adding a little more detail.");
  return response.parsed_output;
}
