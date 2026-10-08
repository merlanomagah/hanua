// The Mac's own Calendar and Reminders (server/calendar.js): read and written there, nothing kept here. Split out of
// server/index.js (F6, 9 Oct 2026).
import { addEvent, addReminder, editEvent, getAppleEvents, getEventCalendars, getReminderLists, getShopping, removeEvent, removeReminder, setReminderDone, showDay, showReminders } from "../calendar.js";

export function register({ app }) {
  app.get("/api/reminders/lists", async (_req, res) => { try { res.json(await getReminderLists()); } catch (err) { res.status(500).json({ error: err.message }); } });


  // Apple Reminders (server/calendar.js): the desk's Shopping list and Add reminder. Personal: the page puts them away
  // at work. Nothing is kept here; Reminders is where they live (and on Mel's phone).
  const remindersRoute = (fn) => async (req, res) => {
    try { res.set("Cache-Control", "no-store").json(await fn(req)); }
    catch (err) { res.status(err.status || 500).json({ error: err.message, reason: err.reason }); }
  };
  app.get("/api/reminders/shopping", remindersRoute(() => getShopping()));
  app.post("/api/reminders/shopping", remindersRoute((req) => addReminder({ to: "shopping", title: req.body?.title })));
  app.post("/api/reminders", remindersRoute((req) => addReminder({ to: "reminders", title: req.body?.title, due: req.body?.due })));
  app.post("/api/reminders/:id/done", remindersRoute((req) => setReminderDone(req.params.id, Boolean(req.body?.done))));
  app.post("/api/reminders/:id/remove", remindersRoute((req) => removeReminder(req.params.id)));
  app.post("/api/reminders/show", remindersRoute(() => showReminders()));


  // Apple Calendar, read live from this Mac (never kept): the calendar asks for the weeks it shows
  app.get("/api/calendar", async (req, res, next) => {
    try {
      res.json(await getAppleEvents(String(req.query.from || ""), String(req.query.to || ""), { fresh: req.query.fresh === "1" }));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });
  // Open Calendar.app on a day (Apple events live there, not in Notion)
  app.post("/api/calendar/show", async (req, res, next) => {
    try {
      res.json(await showDay(String(req.body?.date || "")));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  // Add, change and delete Apple Calendar events from the New event window (7 Oct 2026, brief
  // docs/plans/2026-10-apple-calendar-events.md): written straight into Calendar, nothing kept here
  app.get("/api/calendar/calendars", remindersRoute(() => getEventCalendars()));
  app.post("/api/calendar/events", remindersRoute((req) => addEvent(req.body?.event)));
  app.post("/api/calendar/events/:id", remindersRoute((req) => editEvent(req.params.id, req.body?.occurrence, req.body?.span, req.body?.event)));
  app.post("/api/calendar/events/:id/remove", remindersRoute((req) => removeEvent(req.params.id, req.body?.occurrence, req.body?.span)));
}
