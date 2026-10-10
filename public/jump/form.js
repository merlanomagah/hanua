// The Jump Dashboard's small windows (v2): + Escalation, closing one, answering a question, editing who it's waiting on
// and a project's status / next action. One <dialog> (shown modally), so Esc closes the window first, before the
// dashboard or the desk hear it. Nothing typed here is kept by Hanua: it goes to Jump OS when saved, or nowhere.
import { todayStr } from "../shared/dates.js";
import { $, h } from "../lib.js";
import { add, change, data, rowIn } from "./store.js";

const dlg = () => $("jump-dialog");
const field = (label, input, hint) => h("label", { className: "jd-field" }, h("span", { className: "jd-label", textContent: label }), input, hint ? h("span", { className: "jd-hint", textContent: hint }) : null);
const select = (name, choices, value, blank = null) => h("select", { name }, blank ? h("option", { value: "", textContent: blank }) : null, choices.map((c) => h("option", { value: c, textContent: c, selected: c === value })));
const text = (name, value = "", attrs = {}) => h("input", { type: "text", name, value, autocomplete: "off", maxLength: 200, ...attrs });
const long = (name, attrs = {}) => h("textarea", { name, rows: 3, maxLength: 1900, ...attrs });

// opens the window with a title, its fields and what Save does (a function of the form's values → a promise of ok)
function open(title, fields, save, { saveLabel = "Save", note = "" } = {}) {
  const form = h("form", { className: "jd-form", method: "dialog" },
    h("h3", { className: "jd-title", textContent: title }),
    note ? h("p", { className: "jd-note", textContent: note }) : null,
    ...fields,
    h("p", { className: "jd-err", role: "alert" }),
    h("div", { className: "jd-acts" },
      h("button", { type: "button", className: "b-btn ghost jd-cancel", textContent: "Cancel" }),
      h("button", { type: "submit", className: "b-btn jd-save", textContent: saveLabel })));
  form.querySelector(".jd-cancel").addEventListener("click", () => dlg().close());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
    const missing = [...form.querySelectorAll("[required]")].find((el) => !el.value.trim());
    if (missing) { form.querySelector(".jd-err").textContent = `${missing.closest(".jd-field")?.querySelector(".jd-label")?.textContent || "That"} is needed.`; missing.focus(); return; }
    form.querySelector(".jd-save").disabled = true;
    const ok = await save(values);
    form.querySelector(".jd-save").disabled = false;
    if (ok) dlg().close();
  });
  dlg().replaceChildren(form);
  dlg().showModal();
  form.querySelector("input, select, textarea")?.focus();
}

const opts = (area, key) => data?.options?.[area]?.[key] || [];

export function addEscalation() {
  open("New escalation", [
    field("Escalation", text("title", "", { required: true, placeholder: "What it's about, in a few words" })),
    h("div", { className: "jd-row" },
      field("Tier", select("tier", opts("escalations", "tier"), "", "—")),
      field("Raised", h("input", { type: "date", name: "date", value: todayStr(), max: todayStr() }))),
    field("Raised by", text("raisedBy", "", { placeholder: "Person and their team" })),
    field("Waiting on", text("waitingOn", "", { placeholder: "Who, and the question they need to answer" })),
    field("Issue", long("issue", { placeholder: "What was actually asked, in their words" }), "Goes straight to Jump OS; Hanua doesn't keep or show it."),
  ], (v) => add(v), { saveLabel: "Add to Jump OS" });
}

// closing asks for what Jump OS needs to see a pattern: the Finding, and the Outcome if none is recorded yet
export function closeEscalation(id) {
  const row = rowIn("escalations", id);
  if (!row) return;
  open(`Close “${row.title}”`, [
    field("Finding", select("finding", opts("escalations", "finding"), row.finding, "Why did it happen?"), "This is what turns single escalations into a pattern."),
    row.outcomeSet ? h("p", { className: "jd-note", textContent: "Outcome: already recorded in Jump OS ✓" })
      : field("Outcome", long("outcome", { placeholder: "What was decided, and what Care was told" }), "The permanent answer, not interim guidance. No customer details."),
  ].map((el) => { el.querySelector?.("select, textarea")?.setAttribute("required", ""); return el; }),
  (v) => change("escalations", id, { status: data.escalations.columns.at(-1).status, ...v }, `Closed: ${row.title}`), { saveLabel: "Close it" });
}

export function editWaiting(area, id) {
  const row = rowIn(area, id) || data?.waiting?.flatMap((p) => p.items).find((i) => i.id === id);
  if (!row) return;
  open(area === "questions" ? "Who can settle it" : "Waiting on", [field(row.title, text("waitingOn", row.waitingOn || "", { required: true, placeholder: "Who, and what they need to answer" }))],
    (v) => change(area, id, v, `Waiting on: ${v.waitingOn}`));
}

export function editProject(id) {
  const row = rowIn("projects", id);
  if (!row) return;
  open(row.title, [
    field("Status", select("status", opts("projects", "status"), row.status)),
    field("Next action", text("next", row.next || "", { placeholder: "The single, specific next task" })),
  ], (v) => {
    const diff = Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== (row[k] || "")));
    if (!Object.keys(diff).length) return true;
    return change("projects", id, diff, diff.status ? `${row.title}: ${diff.status}` : `Next action: ${diff.next}`);
  });
}

export function answerQuestion(id) {
  const row = rowIn("questions", id);
  if (!row) return;
  const statuses = opts("questions", "status").filter((s) => s === "Answered" || /wont|won't/i.test(s));
  open(row.title, [
    field("Close it as", select("status", statuses, statuses[0])),
    row.resolutionSet ? h("p", { className: "jd-note", textContent: "Resolution: already recorded in Jump OS ✓" })
      : field("Resolution", long("resolution", { required: true, placeholder: "The answer, and what was updated as a result" }), "For “Wont resolve”, say why. No customer details."),
  ], (v) => change("questions", id, v, `${v.status}: ${row.title}`), { saveLabel: "Save" });
}
