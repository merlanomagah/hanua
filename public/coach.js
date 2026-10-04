// The goal coach: Agile habits (outcome naming, INVEST, a clear "done when", WIP limits)
// turned into gentle prompts in the goal form. Soft hints only: nothing is ever blocked.
// The full guide with sources lives in Notion ("Goals guide"), linked from the board.

export const GUIDE = {
  Epic: {
    when: "This year",
    what: "An outcome you want your life to look like by the end of the year. Big, worth it, and too large to do in one go.",
    example: "Move to Sydney · Run a half marathon · Launch Bula Collective's first range",
    horizonDays: 400,
    why: "Why does this matter to you? e.g. So that I'm closer to family and can start the next chapter",
    doneLabel: "We'll know it's done when (2 to 4 measurable changes)",
    done: "- Signed a lease in Sydney\n- Started a job there\n- Apartment here rented out",
    scaffold: "- \n- \n- ",
    childHint: "Each point is a clue to a Feature you'll need.",
  },
  Feature: {
    when: "This quarter",
    what: "One of the mini-projects that together achieve the Epic, each finished within about a quarter.",
    example: "Under “Move to Sydney”: Rent out the apartment · Land a job in Sydney · Declutter the flat · Close down power and broadband",
    horizonDays: 120,
    why: "How does it serve the Epic? e.g. So that I have income lined up before I move",
    doneLabel: "Done when (2 to 4 measurable points)",
    done: "- Accepted an offer in Sydney\n- Start date confirmed",
    scaffold: "- \n- ",
    childHint: "Each point is a clue to a PBI: a slice you can finish in a month.",
  },
  PBI: {
    when: "This month",
    what: "A slice of value you can finish this month. Small, useful on its own, and clearly testable.",
    example: "Shortlist three suburbs to live in · Apply for five Sydney roles",
    horizonDays: 45,
    maxEffort: 8,
    why: "So that … e.g. So that I only spend viewing trips on places I'd actually live",
    doneLabel: "Done when (acceptance criteria)",
    done: "- Given my budget and commute, when I compare suburbs, then I have three picks",
    scaffold: "- Given , when , then \n- ",
    childHint: "Break it into Tasks you can each do in a day or two.",
  },
  Task: {
    when: "This week",
    what: "A concrete next action, done in a day or two. Starts with a verb.",
    example: "Book a flight for flat viewings · Email the recruiter at Atlassian",
    horizonDays: 14,
    maxEffort: 3,
    why: "",
    doneLabel: "Done when (one line is enough)",
    done: "- Email sent to three agents",
    scaffold: "- ",
  },
};

// Effort points: relative size, not hours. The skipping scale is on purpose: the bigger something is,
// the less precisely you can size it. Starter examples until you have finished goals of your own.
export const SIZES = [
  { pts: 1, feel: "An hour or two", eg: "Send an email · book an appointment" },
  { pts: 2, feel: "Half a day", eg: "Sort a cupboard · fill in a form that needs documents" },
  { pts: 3, feel: "A solid day", eg: "Clean out the garage · research and compare three options" },
  { pts: 5, feel: "A few days, over a week or two", eg: "Get the apartment photos and listing ready" },
  { pts: 8, feel: "A big chunk of a month", eg: "Find and sign up a property manager" },
  { pts: 13, feel: "Too big to size well: split it", eg: "" },
];
const LADDER = SIZES.map((s) => s.pts);

// The three things points blend: how much work, how much is unknown, how much depends on others.
export const SIZE_QUESTIONS = {
  work: { label: "How much work?", options: ["An hour", "Half a day", "A day", "A few days", "Weeks"] },
  unknown: { label: "How much is unknown?", options: ["Nothing", "Some", "Lots"] },
  waiting: { label: "Waiting on others?", options: ["No", "Yes"] },
};
export function suggestSize({ work, unknown = 0, waiting = 0 }) {
  if (work == null) return null;
  const step = Math.min(LADDER.length - 1, work + unknown + waiting);
  const reasons = [SIZE_QUESTIONS.work.options[work].toLowerCase() + " of work"];
  if (unknown) reasons.push(unknown === 2 ? "lots unknown" : "some unknowns");
  if (waiting) reasons.push("waiting on others");
  return { pts: LADDER[step], why: reasons.join(", ") };
}

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

// values: the form's fields. ctx: { parentLevel, openSiblings, childCount, today }.
// Returns [{ ok, text }]: ok true shows a tick, false a gentle nudge, null a question to ask yourself.
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

  const why = (values.why || "").replace(/^so that\s*\.*\s*$/i, "").trim();
  if (values.level !== "Task") {
    out.push(why
      ? { ok: true, text: "Has a why" }
      : { ok: false, text: "Add the why (“So that …”). It's what keeps you going, and tells you when to stop" });
  }
  // filled-in bullets only (an untouched scaffold doesn't count)
  const done = values.doneWhen || "";
  const points = (done.match(/^[ \t]*[-•*][ \t]+(?!Given[ \t]*,)\S/gim) || []).length + (done.trim() && !/^[ \t]*[-•*]/m.test(done) ? 1 : 0);
  const gwt = /given\s+\w.*when\s+\w.*then\s+\w/i.test(done);
  if (values.level === "Epic" || values.level === "Feature") {
    out.push(points >= 2
      ? { ok: true, text: `Says what done looks like (${points} point${points > 1 ? "s" : ""})` }
      : { ok: false, text: points === 1
          ? "Add one or two more “done when” points. What else will have changed?"
          : "Add 2 to 4 measurable “done when” points: what will have changed, not what you'll do" });
  } else if (values.level === "PBI") {
    out.push(points || gwt
      ? { ok: true, text: "Has acceptance criteria" }
      : { ok: false, text: "Add a “done when” (Given … when … then …) so you know when it's finished" });
  } else if (points) {
    out.push({ ok: true, text: "Clear finish line" });
  }

  if (values.due && ctx.today) {
    const days = Math.round((new Date(values.due) - new Date(ctx.today)) / 86_400_000);
    out.push(days <= g.horizonDays
      ? { ok: true, text: `Fits in ${g.when.toLowerCase()}` }
      : { ok: false, text: `Due ${days} days away, which is long for a ${values.level}. Split it, or make it a level up` });
  }

  // dates that can't work inside the parent's (ctx.parentDue / parentStart as YYYY-MM-DD, with display labels)
  if (values.due && ctx.parentDue && values.due.slice(0, 10) > ctx.parentDue) {
    out.push({ ok: false, text: `Due after its ${ctx.parentLevel} (${ctx.parentDueLabel || ctx.parentDue}). Bring it earlier, or move the ${ctx.parentLevel}'s date` });
  }
  if (values.start && ctx.parentStart && values.start.slice(0, 10) < ctx.parentStart) {
    out.push({ ok: false, text: `Starts before its ${ctx.parentLevel} does (${ctx.parentStartLabel || ctx.parentStart})` });
  }

  if ((values.level === "Task" || values.level === "PBI") && !values.effort && !ctx.childCount) {
    out.push({ ok: false, text: "Give it a size (use “Help me size it”). Sizing everything is how you learn your pace" });
  }
  if (g.maxEffort && Number(values.effort) > g.maxEffort) {
    out.push({ ok: false, text: `${values.effort} points is big for a ${values.level}. Split it into smaller pieces that each work on their own` });
  }

  // the completeness test: the children should add up to the whole
  if (ctx.childCount && values.level !== "Task") {
    const kids = { Epic: "Feature", Feature: "PBI", PBI: "Task" }[values.level];
    out.push({ ok: null, text: `Ask yourself: if every ${kids} below were done, would this be done? If not, a ${kids} is missing` });
  }

  if (ctx.openSiblings >= 5 && !values.id) {
    out.push({ ok: false, text: values.level === "Epic"
      ? `You already have ${ctx.openSiblings} open Epics. Three to five a year keeps focus`
      : `This parent already has ${ctx.openSiblings} open ${values.level}s. Finish some before adding more` });
  }
  return out;
}
