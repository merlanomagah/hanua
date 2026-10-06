// The New event window (7 Oct 2026, brief docs/plans/2026-10-apple-calendar-events.md; Mel: yes / yes / no tick on Up
// next): add an event to Apple Calendar, or change or delete one Hanua shows, without leaving Hanua. Like Calendar's own
// window: title, calendar, all-day, starts, ends, repeat, alert, location, a link and notes. Enter saves, Esc closes, the
// end moves with the start. A repeating event asks "only this event / all future events" the way Calendar does. Every
// change offers Undo. Nothing is kept here: it's written straight into Calendar (server/calendar.js, the EventKit
// helper), and the wall and Up next re-read it at once. At work only the Work calendars are offered; personal events
// show as "Busy" and can't be opened. Invitees and travel time stay in Calendar.app (EventKit can't send invitations).
import { $, api, focus, h, toast } from "./lib.js";
import { dayOf, timeOf, todayStr } from "./shared/dates.js";
import { ALERTS, ALL_DAY_ALERTS, REPEATS, defaultCalendar, eventShape, moveStart, newEventTimes, setAllDay, writableCalendars } from "./shared/events.js";

let chosen = ""; // Settings → Calendar: where new events go ("" = the Mac's default)
document.addEventListener("hanua:settings", (e) => { chosen = e.detail?.calendar?.default || ""; });

const dlg = h("dialog", { id: "event-dialog", className: "ev-dialog" });
dlg.setAttribute("aria-labelledby", "ev-title");
document.body.append(dlg);
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

// the wall, Up next and the day window read Calendar again (each month they've asked for), so a change shows at once
let reread = async () => {};
export const onEventsChanged = (fn) => { reread = fn; };

const enc = encodeURIComponent;
const add = (event) => api("/api/calendar/events", { event });
const edit = (id, occurrence, span, event) => api(`/api/calendar/events/${enc(id)}`, { occurrence, span, event });
const remove = (id, occurrence, span) => api(`/api/calendar/events/${enc(id)}/remove`, { occurrence, span });

// Open the window: { day } for a new event on that day, { item } to change an Apple event Hanua shows; back: what to
// show again when it's closed without a change (the day window it was opened from). After a change it stays closed:
// a modal day window would sit over the toast's Undo
let back = null;
dlg.addEventListener("close", () => { const b = back; back = null; b?.(); });
export async function openEvent({ day, item = null, fallback = null, onClose = null } = {}) {
  let cals;
  try { cals = await api("/api/calendar/calendars"); } catch (err) { toast(err.message, true); return; }
  const choices = writableCalendars(cals.calendars, { atWork: focus.on, work: cals.work });
  if (!cals.live && cals.reason !== "off") {
    // no Calendar to write to: say why, and offer the old way (a Notion row drafted by the Feed)
    const msg = cals.reason === "denied" ? "Hanua isn't allowed to change your calendars: System Settings → Privacy & Security → Calendars → Hanua Calendar → Full Access." : cals.reason === "ask" ? "Hanua needs your OK to use Calendar first: allow it when macOS asks." : "Calendar didn't answer.";
    toast(msg, true, fallback ? { label: "Add to Notion instead", run: fallback } : null);
    return;
  }
  if (item && (!item.writable || !item.event)) { toast(`${item.calendar || "That calendar"} is read-only: change it in Calendar.`, true); return; }
  if (!choices.length) { toast(focus.on ? "None of your Work calendars can be added to from here." : "Hanua can't find a calendar it can add to.", true); return; }

  const editing = Boolean(item);
  const before = editing ? { ...item.event } : null;
  const series = editing && before.repeat !== "none";
  const times = newEventTimes(day || dayOf(item?.date) || todayStr());
  let f = editing ? { ...before } : { title: "", calendar: defaultCalendar(choices, { chosen, macDefault: cals.default }), allDay: false, ...times, location: "", notes: "", url: "", repeat: "none", until: "", count: null, alert: null };
  // the event's own calendar stays offered even if it isn't a usual pick (e.g. at work, a Work one by another name)
  const options = editing && !choices.some((c) => c.title === f.calendar) ? [...choices, { title: f.calendar, color: item.color }] : choices;

  // ---- the fields ----
  const field = (label, ...el) => h("label", { className: "ev-row" }, h("span", { className: "ev-label", textContent: label }), h("span", { className: "ev-field" }, ...el));
  const title = h("input", { type: "text", className: "ev-name", name: "title", value: f.title, placeholder: "New Event", maxLength: 200, autocomplete: "off", ariaLabel: "Title" });
  const dot = h("i", { className: "ev-dot", ariaHidden: "true" });
  const cal = h("select", { className: "ev-in", name: "calendar" }, options.map((c) => h("option", { value: c.title, textContent: c.title, selected: c.title === f.calendar })));
  const paint = () => { dot.style.setProperty("--dot", options.find((c) => c.title === cal.value)?.color || "var(--green)"); };
  const allDay = h("input", { type: "checkbox", name: "allDay", checked: f.allDay });
  const sDate = h("input", { type: "date", className: "ev-in", ariaLabel: "Starts on", required: true });
  const sTime = h("input", { type: "time", className: "ev-in", ariaLabel: "Starts at", step: 300 });
  const eDate = h("input", { type: "date", className: "ev-in", ariaLabel: "Ends on", required: true });
  const eTime = h("input", { type: "time", className: "ev-in", ariaLabel: "Ends at", step: 300 });
  const repeat = h("select", { className: "ev-in", name: "repeat" }, Object.entries(REPEATS).map(([v, t]) => h("option", { value: v, textContent: t })), f.repeat === "custom" ? h("option", { value: "custom", textContent: "Custom (as set in Calendar)" }) : null);
  const endKind = h("select", { className: "ev-in", ariaLabel: "End repeat" }, h("option", { value: "never", textContent: "Never" }), h("option", { value: "until", textContent: "On date" }), h("option", { value: "count", textContent: "After" }));
  const until = h("input", { type: "date", className: "ev-in", ariaLabel: "Last day it repeats" });
  const count = h("input", { type: "number", className: "ev-in ev-num", min: 1, max: 999, ariaLabel: "How many times" });
  const countWord = h("span", { className: "ev-hint", textContent: "times" });
  const endRow = field("End repeat", endKind, until, count, countWord);
  const alert = h("select", { className: "ev-in", name: "alert" });
  const location = h("input", { type: "text", className: "ev-in ev-wide", value: f.location, placeholder: "Add location", maxLength: 200, autocomplete: "off", ariaLabel: "Location" });
  const url = h("input", { type: "url", className: "ev-in ev-wide", value: f.url, placeholder: "Add a link (https://…)", maxLength: 500, autocomplete: "off", ariaLabel: "Link" });
  const notes = h("textarea", { className: "ev-in ev-wide ev-notes", value: f.notes, placeholder: "Add notes", rows: 3, maxLength: 4000, ariaLabel: "Notes" });

  // the window's state ⇄ the fields (only what changes shape is redrawn, so the cursor never jumps)
  const put = () => {
    sDate.value = dayOf(f.start); eDate.value = dayOf(f.end);
    sTime.value = timeOf(f.start); eTime.value = timeOf(f.end);
    sTime.hidden = eTime.hidden = f.allDay;
    allDay.checked = f.allDay;
    repeat.value = f.repeat;
    endKind.value = f.until ? "until" : f.count ? "count" : "never";
    until.value = f.until || ""; count.value = f.count || "";
    const rep = f.repeat !== "none" && f.repeat !== "custom";
    endRow.hidden = !rep;
    until.hidden = endKind.value !== "until"; count.hidden = countWord.hidden = endKind.value !== "count";
    const list = f.allDay ? ALL_DAY_ALERTS : ALERTS;
    alert.replaceChildren(...Object.entries(list).map(([v, t]) => h("option", { value: v, textContent: t })));
    const a = f.alert == null ? "" : String(f.alert);
    alert.value = a in list ? a : ""; if (alert.value !== a && f.alert != null) alert.prepend(h("option", { value: a, textContent: `${f.alert} minutes before`, selected: true }));
    paint();
  };
  const startOf = () => (f.allDay ? sDate.value : `${sDate.value}T${sTime.value || "09:00"}`);
  const endOf = () => (f.allDay ? eDate.value : `${eDate.value}T${eTime.value || "10:00"}`);
  // the start moved: the end goes with it, keeping the length (as in Calendar)
  for (const el of [sDate, sTime]) el.addEventListener("change", () => { if (sDate.value) { f = moveStart(f, startOf()); put(); } });
  for (const el of [eDate, eTime]) el.addEventListener("change", () => { if (eDate.value) f.end = endOf(); });
  allDay.addEventListener("change", () => { f = setAllDay(f, allDay.checked); put(); });
  repeat.addEventListener("change", () => { f.repeat = repeat.value; if (f.repeat === "none") { f.until = ""; f.count = null; } put(); });
  endKind.addEventListener("change", () => {
    f.until = endKind.value === "until" ? (f.until || dayOf(f.start)) : "";
    f.count = endKind.value === "count" ? (f.count || 5) : null;
    put();
    (endKind.value === "until" ? until : count).focus?.();
  });
  until.addEventListener("change", () => { f.until = until.value; });
  count.addEventListener("change", () => { f.count = Number(count.value) || null; });
  alert.addEventListener("change", () => { f.alert = alert.value === "" ? null : Number(alert.value); });
  cal.addEventListener("change", () => { f.calendar = cal.value; paint(); });
  const read = () => ({ ...f, title: title.value, calendar: cal.value, location: location.value, url: url.value, notes: notes.value, start: startOf(), end: endOf() });

  // ---- the foot: Save / Cancel, or a question in their place (delete? only this one or all future ones?) ----
  const foot = h("div", { className: "ev-foot" });
  const status = h("p", { className: "ev-status", ariaLive: "polite" });
  const btn = (text, cls, run) => { const b = h("button", { type: "button", className: cls, textContent: text }); b.addEventListener("click", run); return b; };
  const showInCalendar = () => api("/api/calendar/show", { date: dayOf(f.start) }).catch((err) => toast(err.message, true));
  const usual = () => foot.replaceChildren(
    h("span", { className: "ev-foot-l" },
      editing ? btn("Delete…", "ghost ev-del", askDelete) : null,
      btn("Open in Calendar ↗", "link-btn", showInCalendar)),
    btn("Cancel", "ghost", () => dlg.close()),
    h("button", { type: "submit", className: "ev-save", textContent: editing ? "Save" : "Add" }));
  const ask = (q, ...buttons) => { foot.replaceChildren(h("span", { className: "ev-ask", textContent: q }), ...buttons); buttons.at(-1)?.focus(); };
  const busy = (on) => { for (const b of foot.querySelectorAll("button")) b.disabled = on; status.textContent = on ? "Saving to Calendar…" : ""; };

  async function save(span) {
    const { event, error } = eventShape(read());
    if (error) { status.textContent = error; return; }
    busy(true);
    try {
      if (!editing) {
        const r = await add(event);
        back = null; dlg.close();
        toast(`Added to ${event.calendar}: ${event.title}`, false, { label: "Undo", run: () => undo(() => remove(r.id, r.occurrence, "future"), "Taken out of Calendar") });
      } else {
        const r = await edit(item.eid, item.occurrence, span, event);
        back = null; dlg.close();
        // Undo puts the old fields back on what was just saved (one day of a series stays that one day)
        const prev = span === "this" ? { ...before, repeat: "none", until: "", count: null } : before;
        toast(`Saved: ${event.title}`, false, { label: "Undo", run: () => undo(() => edit(r.id, r.occurrence, span === "this" ? "this" : "future", prev), "Put back as it was") });
      }
      reread();
    } catch (err) { busy(false); status.textContent = err.message; }
  }
  async function del(span) {
    busy(true);
    try {
      await remove(item.eid, item.occurrence, span);
      back = null; dlg.close();
      // Undo makes it again from what Hanua read: the whole series from this day, or just this day
      const again = span === "this" && series ? { ...before, repeat: "none", until: "", count: null } : before;
      toast(`Deleted: ${before.title}${span === "future" && series ? " (this and future)" : ""}`, false, { label: "Undo", run: () => undo(() => add(again), "Back in Calendar") });
      reread();
    } catch (err) { busy(false); status.textContent = err.message; }
  }
  async function undo(fn, said) {
    try { await fn(); toast(said); } catch (err) { toast(`Couldn't undo: ${err.message}`, true); }
    reread();
  }
  function askDelete() {
    if (series) ask("Delete only this event, or this and all future ones?", btn("Cancel", "ghost", usual), btn("All future events", "ghost", () => del("future")), btn("Only this event", "ev-save", () => del("this")));
    else ask(`Delete “${before.title}”?`, btn("Cancel", "ghost", usual), btn("Delete", "ev-save ev-danger", () => del("future")));
  }

  const form = h("form", { className: "ev-form", method: "dialog", noValidate: true });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!sDate.value) { status.textContent = "Pick the day it starts"; sDate.focus(); return; }
    // a repeating event: only this one, or this and the rest (a change to the repeat itself always means the rest)
    if (series && repeat.value === before.repeat) ask("Change only this event, or this and all future ones?", btn("Cancel", "ghost", usual), btn("All future events", "ghost", () => save("future")), btn("Only this event", "ev-save", () => save("this")));
    else save("future");
  });
  // Enter in a one-line field saves (as in Calendar); in Notes it's a new line
  form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "SELECT") { e.preventDefault(); form.requestSubmit(); } });

  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Close", title: "Close (Esc)" });
  close.addEventListener("click", () => dlg.close());
  form.append(
    h("div", { className: "pw-bar ev-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
      h("span", { className: "pw-title", id: "ev-title", textContent: editing ? "Event" : "New event" }), h("span")),
    h("div", { className: "ev-body" },
      title,
      field("Calendar", dot, cal),
      h("label", { className: "ev-row ev-check" }, h("span", { className: "ev-label" }), h("span", { className: "ev-field" }, allDay, h("span", { textContent: "All-day" }))),
      field("Starts", sDate, sTime),
      field("Ends", eDate, eTime),
      field("Repeat", repeat),
      endRow,
      field("Alert", alert),
      field("Location", location),
      field("Link", url),
      field("Notes", notes),
      h("p", { className: "ev-note", textContent: "To invite people or add travel time, use Open in Calendar." })),
    status, foot);
  dlg.replaceChildren(form);
  usual(); put();
  if (dlg.open) { back = null; dlg.close(); }
  if ($("day-dialog")?.open) $("day-dialog").close();
  back = onClose;
  dlg.showModal();
  title.focus(); if (editing) title.select();
}
