// The goal coach: Agile habits (outcome naming, INVEST, a clear "done when", WIP limits)
// turned into gentle prompts in the goal form. Soft hints only: nothing is ever blocked.
// The full guide with sources lives in Notion ("Goals guide"), linked from the board.

export const GUIDE = {
  Epic: {
    when: "This year",
    what: "An outcome you want your life to look like by the end of the year. Big, worth it, and too large to do in one go.",
    example: "Move to Sydney · Run a half marathon · Launch Bula Collective's first range",
    horizonDays: 400,
    template: "Outcome: \nSo that: \n\nWe'll know it's done when:\n- \n- \n- ",
  },
  Feature: {
    when: "This quarter",
    what: "A milestone that makes a real difference towards its Epic, finished within about three months.",
    example: "Land a job in Sydney · Run 10 km without stopping",
    horizonDays: 120,
    template: "So that: \n\nDone when:\n- \n- ",
  },
  PBI: {
    when: "This month",
    what: "A slice of value you can finish this month. Small, useful on its own, and clearly testable.",
    example: "Shortlist three suburbs to live in · Apply for five Sydney roles",
    horizonDays: 45,
    maxEffort: 8,
    template: "As me, I want  so that \n\nDone when:\n- Given , when , then \n- ",
  },
  Task: {
    when: "This week",
    what: "A concrete next action, done in a day or two. Starts with a verb.",
    example: "Book a flight for flat viewings · Email the recruiter at Atlassian",
    horizonDays: 14,
    maxEffort: 3,
    template: "Done when: ",
  },
};

// Personal Kanban's second rule: limit work in progress. Three is the usual starting point for one person.
export const WIP_LIMIT = 3;

// Common action verbs. A title starting with one reads as something to achieve, not a topic.
const VERBS = new Set(`
accept achieve add apply arrange ask attend become book build buy call cancel celebrate change choose clean clear close
complete confirm contact cook create cut cycle decide declutter deliver design draft drink drive earn eat email fill finalise
finalize find finish fix fly gain get grow have hire hit host improve increase install invest join keep land launch lead learn
lease lift list live lose maintain make master meditate meet mentor move open order organise organize own pack paint pass pay
pick plan practise practice prepare publish raise reach read reduce register renew renovate rent repair replace research
return review run save schedule secure sell send set settle share ship shortlist sign sketch sleep sort start stop stretch
study submit swim teach test text tidy track train travel update upgrade visit walk write`.trim().split(/\s+/));

const firstWord = (title) => (title.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z']/g, "");
const actionLed = (title) => { const w = firstWord(title); return VERBS.has(w) || /ed$/.test(w); };

// values: the form's fields. ctx: { parentLevel, openSiblings, today }.
// Returns [{ ok, text }]: ok true shows a tick, false a gentle nudge.
export function coachChecks(values, ctx = {}) {
  const g = GUIDE[values.level] || GUIDE.Task;
  const out = [];
  const title = (values.title || "").trim();
  const desc = values.description || "";

  if (title) {
    if (values.level === "Task") {
      out.push(actionLed(title)
        ? { ok: true, text: "Starts with an action you can do" }
        : { ok: false, text: `Start with a verb so it's a clear next action, e.g. “Book …”, “Email …”, “Draft …”` });
    } else {
      out.push(actionLed(title)
        ? { ok: true, text: "Named as an outcome" }
        : { ok: false, text: `Name the outcome, not the topic: “Move to Sydney” rather than “Sydney move”` });
    }
  }

  if (values.level !== "Epic") {
    out.push(values.parent
      ? { ok: true, text: `Linked to a ${ctx.parentLevel || "parent"}, so you can see what it serves` }
      : { ok: false, text: `Link it to a ${ctx.parentLevel || "parent"}: every piece of work should serve something bigger` });
  }

  if (values.level === "Epic" || values.level === "Feature") {
    out.push(/so that|because|\bwhy\b/i.test(desc.replace(/So that:\s*$/m, ""))
      ? { ok: true, text: "Has a why" }
      : { ok: false, text: "Add the why (“So that …”). It's what keeps you going, and tells you when to stop" });
  }
  if (values.level !== "Task") {
    // filled-in bullets only (an untouched template doesn't count)
    const listed = (desc.match(/^[ \t]*-[ \t]+(?!Given[ \t]*,)\S/gim) || []).length;
    const gwt = /given\s+\w.*when\s+\w.*then\s+\w/i.test(desc);
    out.push((/done when|know it's done/i.test(desc) && listed) || gwt
      ? { ok: true, text: "Says what done looks like" }
      : { ok: false, text: values.level === "PBI"
          ? "Add a “Done when” (Given … when … then …) so you know when it's finished"
          : "Add 2 to 4 measurable “we'll know it's done when” points: what will have changed, not what you'll do" });
  }

  if (values.due && ctx.today) {
    const days = Math.round((new Date(values.due) - new Date(ctx.today)) / 86_400_000);
    out.push(days <= g.horizonDays
      ? { ok: true, text: `Fits in ${g.when.toLowerCase()}` }
      : { ok: false, text: `Due ${days} days away, which is long for a ${values.level}. Split it, or make it a level up` });
  }

  if (g.maxEffort && Number(values.effort) > g.maxEffort) {
    out.push({ ok: false, text: `${values.effort} points is big for a ${values.level}. Split it into smaller pieces that each work on their own` });
  }

  if (ctx.openSiblings >= 5 && !values.id) {
    out.push({ ok: false, text: values.level === "Epic"
      ? `You already have ${ctx.openSiblings} open Epics. Three to five a year keeps focus`
      : `This parent already has ${ctx.openSiblings} open ${values.level}s. Finish some before adding more` });
  }
  return out;
}
