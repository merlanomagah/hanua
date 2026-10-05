// Hanua's window onto Apple Calendar and Reminders, with EventKit. Calendar events are only read; reminders are read
// and, when Mel adds or ticks one in Hanua, written (6 Oct 2026: the Shopping list and Add reminder).
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
let wanted = Set(args.dropFirst(4))
let calendars = all.filter { wanted.isEmpty || wanted.contains($0.title) }
let events = calendars.isEmpty ? [] : store.events(matching: store.predicateForEvents(withStart: from, end: to, calendars: calendars))
out([
  "calendars": all.map { $0.title },
  "events": events.map { e -> [String: Any] in
    [
      "id": e.calendarItemIdentifier,
      "title": e.title ?? "",
      "calendar": e.calendar.title,
      "color": hex(e.calendar.cgColor),
      "allDay": e.isAllDay,
      // all-day: the days it covers (EventKit ends them at the very end of the last day)
      "start": e.isAllDay ? day.string(from: e.startDate) : local.string(from: e.startDate),
      "end": e.isAllDay ? day.string(from: e.endDate.addingTimeInterval(-1)) : local.string(from: e.endDate),
      "location": e.location ?? "",
    ]
  },
])
