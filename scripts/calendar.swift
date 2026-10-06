// Hanua's window onto Apple Calendar and Reminders, with EventKit. Reminders are read and, when Mel adds or ticks one in
// Hanua, written (6 Oct 2026: the Shopping list and Add reminder). Calendar events are read, and since 7 Oct 2026 added,
// changed and deleted from Hanua's New event window (brief docs/plans/2026-10-apple-calendar-events.md).
// EventKit gives every occurrence of a repeating event and covers every account without Calendar.app running.
// Built by server/calendar.js into bin/HanuaCalendar.app, so macOS asks once for "Hanua Calendar"
// (whatever started Hanua), and run through `open`, writing JSON to the file named by --stdout.
//
//   HanuaCalendar                             → (double-clicked) asks for access, then says how it went
//   HanuaCalendar status                      → {"status":"granted" | "notDetermined" | "denied" | …}
//   HanuaCalendar events FROM TO [names…]     → {"events":[…],"calendars":[…]} or {"error":"denied"}
//   FROM and TO are days (YYYY-MM-DD, TO included); names, if given, limit it to those calendars.
//   HanuaCalendar reminders LIST              → {"list":…,"items":[{id,title,due?}]} open items (LIST made if missing)
//   HanuaCalendar remind-add LIST TITLE [DUE] → {"id":…} (LIST "" = the default list; DUE yyyy-MM-ddTHH:mm, with an alert)
//   HanuaCalendar remind-done ID 1|0          → {"ok":true}   ticked or unticked
//   HanuaCalendar remind-remove ID            → {"ok":true}   (Undo of an add)
//   HanuaCalendar reminder-lists              → {"lists":[…],"default":…} (for Settings)
//   HanuaCalendar event-calendars             → {"calendars":[{title,color,writable}],"default":…}
//   HanuaCalendar event-add JSON              → {"id":…,"occurrence":…}   JSON: public/shared/events.js eventShape
//   HanuaCalendar event-edit ID AT this|future JSON → {"ok":true,"id":…,"occurrence":…}  AT: the occurrence's start
//   HanuaCalendar event-remove ID AT this|future    → {"ok":true}
import AppKit
import EventKit
import Foundation

func out(_ obj: Any) -> Never {
  let data = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
  FileHandle.standardOutput.write(data)
  exit(0)
}

func statusName(_ s: EKAuthorizationStatus) -> String {
  switch s {
  case .fullAccess: return "granted"
  case .writeOnly: return "writeOnly"
  case .denied: return "denied"
  case .restricted: return "restricted"
  case .notDetermined: return "notDetermined"
  @unknown default: return "unknown"
  }
}

func hex(_ color: CGColor?) -> String {
  guard let c = color?.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil),
        let p = c.components, p.count >= 3 else { return "#3B6B5A" }
  return String(format: "#%02X%02X%02X", Int(p[0] * 255), Int(p[1] * 255), Int(p[2] * 255))
}

// local days and times, as Hanua writes them
let dayF = DateFormatter()
dayF.locale = Locale(identifier: "en_US_POSIX")
dayF.timeZone = .current
dayF.dateFormat = "yyyy-MM-dd"
let stampF = DateFormatter()
stampF.locale = Locale(identifier: "en_US_POSIX")
stampF.timeZone = .current
stampF.dateFormat = "yyyy-MM-dd'T'HH:mm"

// A repeat as Hanua's words (public/shared/events.js REPEATS); anything else is "custom" and left as it is
func repeatOf(_ e: EKEvent) -> [String: Any] {
  guard let rules = e.recurrenceRules, let r = rules.first else { return ["repeat": "none"] }
  let days = (r.daysOfTheWeek ?? []).map { $0.dayOfTheWeek.rawValue }.sorted()
  var word = "custom"
  if rules.count == 1 && r.daysOfTheMonth == nil && r.monthsOfTheYear == nil && r.setPositions == nil {
    switch r.frequency {
    case .daily: if r.interval == 1 { word = "daily" }
    case .weekly:
      if r.interval == 1 && days == [2, 3, 4, 5, 6] { word = "weekdays" }
      else if r.interval == 1 && days.count <= 1 { word = "weekly" }
      else if r.interval == 2 && days.count <= 1 { word = "fortnightly" }
    case .monthly: if r.interval == 1 && days.isEmpty { word = "monthly" }
    case .yearly: if r.interval == 1 && days.isEmpty { word = "yearly" }
    @unknown default: break
    }
  }
  var o: [String: Any] = ["repeat": word]
  if let end = r.recurrenceEnd {
    if let d = end.endDate { o["until"] = dayF.string(from: d) } else if end.occurrenceCount > 0 { o["count"] = end.occurrenceCount }
  }
  return o
}

let args = CommandLine.arguments
let mode = args.count > 1 && !args[1].hasPrefix("-") ? args[1] : "ask"
let store = EKEventStore()
var status = EKEventStore.authorizationStatus(for: .event)
if mode == "status" { out(["status": statusName(status)]) }

// macOS shows its question for a proper app in front, so be one (no Dock icon) and turn the run loop until answered
func waitFor(_ start: (@escaping () -> Void) -> Void) {
  let app = NSApplication.shared
  app.setActivationPolicy(.accessory)
  app.activate(ignoringOtherApps: true)
  var done = false
  start { done = true }
  let giveUp = Date().addingTimeInterval(180)
  while !done && Date() < giveUp { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
}

// ---- reminders: the Shopping list and Add reminder ----
if mode.hasPrefix("remind") {
  var rstatus = EKEventStore.authorizationStatus(for: .reminder)
  if mode == "reminders-status" { out(["status": statusName(rstatus)]) }
  if rstatus == .notDetermined {
    waitFor { finish in store.requestFullAccessToReminders { _, _ in finish() } }
    rstatus = EKEventStore.authorizationStatus(for: .reminder)
  }
  guard rstatus == .fullAccess else { out(["error": statusName(rstatus)]) }
  let local = DateFormatter()
  local.locale = Locale(identifier: "en_US_POSIX")
  local.timeZone = .current
  local.dateFormat = "yyyy-MM-dd'T'HH:mm"
  func list(_ name: String) -> EKCalendar? {
    if name.isEmpty { return store.defaultCalendarForNewReminders() }
    if let found = store.calendars(for: .reminder).first(where: { $0.title.lowercased() == name.lowercased() }) { return found }
    guard let source = store.defaultCalendarForNewReminders()?.source else { return nil }
    let made = EKCalendar(for: .reminder, eventStore: store)
    made.title = name
    made.source = source
    do { try store.saveCalendar(made, commit: true) } catch { return nil }
    return made
  }
  func item(_ id: String) -> EKReminder? { store.calendarItem(withIdentifier: id) as? EKReminder }
  switch mode {
  case "reminder-lists":
    out(["lists": store.calendars(for: .reminder).map { $0.title }.sorted(), "default": store.defaultCalendarForNewReminders()?.title ?? ""])
  case "reminders":
    guard args.count >= 3, let cal = list(args[2]) else { out(["error": "list"]) }
    var found: [EKReminder] = []
    waitFor { finish in
      store.fetchReminders(matching: store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: [cal])) { r in found = r ?? []; finish() }
    }
    found.sort { ($0.creationDate ?? .distantPast) < ($1.creationDate ?? .distantPast) }
    out(["list": cal.title, "items": found.map { r -> [String: Any] in
      var o: [String: Any] = ["id": r.calendarItemIdentifier, "title": r.title ?? ""]
      if let dc = r.dueDateComponents, let due = Calendar.current.date(from: dc) {
        o["due"] = dc.hour == nil ? String(local.string(from: due).prefix(10)) : local.string(from: due) // a day, or a day and time
      }
      return o
    }])
  case "remind-add":
    guard args.count >= 4, let cal = list(args[2]) else { out(["error": "list"]) }
    let r = EKReminder(eventStore: store)
    r.calendar = cal
    r.title = args[3]
    if args.count >= 5, let due = local.date(from: args[4]) {
      r.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: due)
      r.addAlarm(EKAlarm(absoluteDate: due))
    }
    do { try store.save(r, commit: true) } catch { out(["error": "save"]) }
    out(["id": r.calendarItemIdentifier, "list": cal.title])
  case "remind-done":
    guard args.count >= 4, let r = item(args[2]) else { out(["error": "missing"]) }
    r.isCompleted = args[3] == "1"
    do { try store.save(r, commit: true) } catch { out(["error": "save"]) }
    out(["ok": true])
  case "remind-remove":
    guard args.count >= 3, let r = item(args[2]) else { out(["error": "missing"]) }
    do { try store.remove(r, commit: true) } catch { out(["error": "save"]) }
    out(["ok": true])
  default:
    out(["error": "usage"])
  }
}

// ---- events: add, change, delete (7 Oct 2026) ----
if mode.hasPrefix("event-") {
  if status == .notDetermined {
    waitFor { finish in store.requestFullAccessToEvents { _, _ in finish() } }
    status = EKEventStore.authorizationStatus(for: .event)
  }
  guard status == .fullAccess else { out(["error": statusName(status)]) }
  func parse(_ s: String) -> [String: Any] {
    (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any] ?? [:]
  }
  // a calendar Mel can write to, by name ("" = the Mac's default for new events)
  func writable(_ name: String) -> EKCalendar? {
    if name.isEmpty { return store.defaultCalendarForNewEvents }
    return store.calendars(for: .event).first { $0.title == name && $0.allowsContentModifications }
  }
  // the occurrence Mel opened (a repeating event has one per day; AT is its start as Hanua read it)
  func occurrence(_ id: String, _ at: String) -> EKEvent? {
    guard let master = store.calendarItem(withIdentifier: id) as? EKEvent else { return nil }
    guard master.hasRecurrenceRules, let when = stampF.date(from: at) ?? dayF.date(from: at) else { return master }
    let near = store.events(matching: store.predicateForEvents(withStart: when.addingTimeInterval(-86_400), end: when.addingTimeInterval(2 * 86_400), calendars: [master.calendar]))
    return near.first { $0.calendarItemIdentifier == id && ($0.isAllDay ? dayF.string(from: $0.startDate) : stampF.string(from: $0.startDate)) == at } ?? master
  }
  func rule(_ word: String, _ f: [String: Any]) -> EKRecurrenceRule? {
    var end: EKRecurrenceEnd? = nil
    if let u = f["until"] as? String, let d = dayF.date(from: u), let last = Calendar.current.date(byAdding: DateComponents(day: 1, second: -1), to: d) {
      end = EKRecurrenceEnd(end: last)
    } else if let n = (f["count"] as? NSNumber)?.intValue, n > 0 {
      end = EKRecurrenceEnd(occurrenceCount: n)
    }
    switch word {
    case "daily": return EKRecurrenceRule(recurrenceWith: .daily, interval: 1, end: end)
    case "weekdays":
      let days = [EKWeekday.monday, .tuesday, .wednesday, .thursday, .friday].map { EKRecurrenceDayOfWeek($0) }
      return EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, daysOfTheWeek: days, daysOfTheMonth: nil, monthsOfTheYear: nil, weeksOfTheYear: nil, daysOfTheYear: nil, setPositions: nil, end: end)
    case "weekly": return EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, end: end)
    case "fortnightly": return EKRecurrenceRule(recurrenceWith: .weekly, interval: 2, end: end)
    case "monthly": return EKRecurrenceRule(recurrenceWith: .monthly, interval: 1, end: end)
    case "yearly": return EKRecurrenceRule(recurrenceWith: .yearly, interval: 1, end: end)
    default: return nil
    }
  }
  // the window's fields onto an event; nil when all went on, else what was wrong
  func apply(_ f: [String: Any], _ e: EKEvent, series: Bool) -> String? {
    let title = (f["title"] as? String) ?? ""
    e.title = title.isEmpty ? "New Event" : title
    guard let cal = writable((f["calendar"] as? String) ?? "") else { return "calendar" }
    e.calendar = cal
    let allDay = (f["allDay"] as? Bool) ?? false
    let s = (f["start"] as? String) ?? "", en = (f["end"] as? String) ?? ""
    if allDay {
      // all day: from the first day's midnight to the very end of the last (as EventKit reads them back)
      guard let a = dayF.date(from: s), let b = dayF.date(from: en),
            let last = Calendar.current.date(byAdding: DateComponents(day: 1, second: -1), to: b) else { return "dates" }
      e.isAllDay = true
      e.startDate = a
      e.endDate = last
    } else {
      guard let a = stampF.date(from: s), let b = stampF.date(from: en) else { return "dates" }
      e.isAllDay = false
      e.startDate = a
      e.endDate = b
    }
    let location = (f["location"] as? String) ?? ""
    e.location = location.isEmpty ? nil : location
    let notes = (f["notes"] as? String) ?? ""
    e.notes = notes.isEmpty ? nil : notes
    let url = (f["url"] as? String) ?? ""
    e.url = url.isEmpty ? nil : URL(string: url)
    // a repeat is set on the whole series (or from here on), never on one day of it; "custom" is left as Calendar has it
    let word = (f["repeat"] as? String) ?? "none"
    if series && word != "custom" {
      for r in e.recurrenceRules ?? [] { e.removeRecurrenceRule(r) }
      if let r = rule(word, f) { e.addRecurrenceRule(r) }
    }
    for a in e.alarms ?? [] { e.removeAlarm(a) }
    if let m = f["alert"] as? NSNumber { e.addAlarm(EKAlarm(relativeOffset: -m.doubleValue * 60)) }
    return nil
  }
  let at = { (e: EKEvent) -> String in e.isAllDay ? dayF.string(from: e.startDate) : stampF.string(from: e.startDate) }
  switch mode {
  case "event-calendars":
    out([
      "calendars": store.calendars(for: .event).map { ["title": $0.title, "color": hex($0.cgColor), "writable": $0.allowsContentModifications] as [String: Any] },
      "default": store.defaultCalendarForNewEvents?.title ?? "",
    ])
  case "event-add":
    guard args.count >= 3 else { out(["error": "usage"]) }
    let e = EKEvent(eventStore: store)
    if let wrong = apply(parse(args[2]), e, series: true) { out(["error": wrong]) }
    do { try store.save(e, span: .futureEvents, commit: true) } catch { out(["error": "save", "detail": error.localizedDescription]) }
    out(["id": e.calendarItemIdentifier, "occurrence": at(e)])
  case "event-edit":
    guard args.count >= 6, let e = occurrence(args[2], args[3]) else { out(["error": "missing"]) }
    guard e.calendar.allowsContentModifications else { out(["error": "readonly"]) }
    let future = args[4] == "future" || !e.hasRecurrenceRules
    if let wrong = apply(parse(args[5]), e, series: future) { out(["error": wrong]) }
    do { try store.save(e, span: future ? .futureEvents : .thisEvent, commit: true) } catch { out(["error": "save", "detail": error.localizedDescription]) }
    out(["ok": true, "id": e.calendarItemIdentifier, "occurrence": at(e)])
  case "event-remove":
    guard args.count >= 5, let e = occurrence(args[2], args[3]) else { out(["error": "missing"]) }
    guard e.calendar.allowsContentModifications else { out(["error": "readonly"]) }
    do { try store.remove(e, span: args[4] == "future" ? .futureEvents : .thisEvent, commit: true) } catch { out(["error": "save", "detail": error.localizedDescription]) }
    out(["ok": true])
  default:
    out(["error": "usage"])
  }
}

guard mode == "ask" || (mode == "events" && args.count >= 4) else { out(["error": "usage"]) }

// first time: macOS asks
if status == .notDetermined {
  waitFor { finish in store.requestFullAccessToEvents { _, _ in finish() } }
  status = EKEventStore.authorizationStatus(for: .event)
}
if mode == "ask" {
  let alert = NSAlert()
  alert.messageText = status == .fullAccess ? "Hanua can read your calendars now." : "Hanua still can't read your calendars."
  alert.informativeText = status == .fullAccess ? "You can close this. Restart Hanua to see your events." : "System Settings → Privacy & Security → Calendars: turn on Hanua Calendar (Full Access)."
  NSApplication.shared.setActivationPolicy(.accessory)
  NSApplication.shared.activate(ignoringOtherApps: true)
  alert.runModal()
  out(["status": statusName(status)])
}
guard status == .fullAccess else { out(["error": statusName(status)]) }

let day = DateFormatter()
day.locale = Locale(identifier: "en_US_POSIX")
day.timeZone = .current
day.dateFormat = "yyyy-MM-dd"
guard let from = day.date(from: args[2]), let last = day.date(from: args[3]),
      let to = Calendar.current.date(byAdding: .day, value: 1, to: last) else { out(["error": "dates"]) }

let local = DateFormatter()
local.locale = Locale(identifier: "en_US_POSIX")
local.timeZone = .current
local.dateFormat = "yyyy-MM-dd'T'HH:mm"

let all = store.calendars(for: .event)
let alarmOf = { (e: EKEvent) -> Any in
  guard let a = e.alarms?.first, a.absoluteDate == nil else { return NSNull() }
  return Int((-a.relativeOffset / 60).rounded())
}
let wanted = Set(args.dropFirst(4))
let calendars = all.filter { wanted.isEmpty || wanted.contains($0.title) }
let events = calendars.isEmpty ? [] : store.events(matching: store.predicateForEvents(withStart: from, end: to, calendars: calendars))
out([
  "calendars": all.map { $0.title },
  "events": events.map { e -> [String: Any] in
    var o: [String: Any] = [
      "id": e.calendarItemIdentifier,
      "title": e.title ?? "",
      "calendar": e.calendar.title,
      "color": hex(e.calendar.cgColor),
      "allDay": e.isAllDay,
      // all-day: the days it covers (EventKit ends them at the very end of the last day)
      "start": e.isAllDay ? day.string(from: e.startDate) : local.string(from: e.startDate),
      "end": e.isAllDay ? day.string(from: e.endDate.addingTimeInterval(-1)) : local.string(from: e.endDate),
      "location": e.location ?? "",
      // what Hanua's window needs to change it (7 Oct 2026)
      "occurrence": e.isAllDay ? day.string(from: e.startDate) : local.string(from: e.startDate),
      "notes": e.notes ?? "",
      "url": e.url?.absoluteString ?? "",
      "writable": e.calendar.allowsContentModifications,
      "alert": alarmOf(e),
    ]
    for (k, v) in repeatOf(e) { o[k] = v }
    return o
  },
])
