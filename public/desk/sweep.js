// The morning sweep (moved out of page.js, F6, 9 Oct 2026): what wasn't ticked off in the last week, each one done,
// brought into today (a task with its open subtasks) or let go, every decision with Undo. Rules: shared/desk.js.
import { carriedDays, settle } from "../shared/desk.js";
import { parseDay, todayStr } from "../shared/dates.js";
import { h } from "../lib.js";
import { newId, page as desk } from "./state.js";
import { renderTodo, undoable } from "./page.js";
import { view } from "./view.js";

const dayWord = (day) => parseDay(day).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });

// the morning sweep: unfinished things from the last week, each done, brought into today, or let go
export function sweepEl(items) {
  const settleAs = (item, how) => settle(desk, item, how, newId());
  const today = todayStr();
  // where it's from, and how long it's been waiting (from the day it was first written; Mel: here only, not on the line)
  const fromText = (it) => { const n = carriedDays(it, today); return `${it.section} · ${dayWord(it.from || it.day)}${n > 1 ? ` · day ${n}` : ""}`; };
  const act = (label, title, run, said = null) => {
    const b = h("button", { type: "button", className: "sw-act", textContent: label, title });
    b.addEventListener("click", () => (said ? undoable(said, run) : (run(), renderTodo()))); // every decision has an Undo
    return b;
  };
  return h("div", { className: "pl-sweep" },
    h("h3", { textContent: "Before you start" }),
    h("p", { className: "sw-lede", textContent: `${items.length} ${items.length === 1 ? "thing" : "things"} from earlier ${items.length === 1 ? "wasn't" : "weren't"} ticked off. Done already, bring into today, or let go?` }),
    h("ul", { className: "sw-list" }, items.map((it) => h("li", { className: "sw-item" },
      h("span", { className: "sw-from", textContent: fromText(it), title: fromText(it) }),
      h("span", { className: "sw-text", textContent: it.text }, it.kids?.length ? h("span", { className: "sw-kids" }, it.kids.map((k) => h("span", { textContent: `› ${k.text}` }))) : null),
      h("span", { className: "sw-acts" },
        act("✓ Done", "It got done: tick it off", () => settleAs(it, "done"), `Done: ${it.text}`),
        act("→ Today", "Bring it into today", () => settleAs(it, "today"), `Brought into today: ${it.text}`),
        act("✕ Remove", "Let it go", () => settleAs(it, "gone"), `Let go: ${it.text}`))))),
    h("div", { className: "sw-foot" },
      act("All to today", "Bring every one into today", () => items.forEach((it) => settleAs(it, "today")), `${items.length} brought into today`),
      act("Let all go", "Let every one go", () => items.forEach((it) => settleAs(it, "gone")), `${items.length} let go`),
      act("Later", "Plan first; these wait until next time", () => { view.sweepLater = true; })));
}

