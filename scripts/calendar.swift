// Hanua's window onto Apple Calendar: reads events (never writes) with EventKit, which gives every
// occurrence of a repeating event and covers every account without Calendar.app running.
// Built by server/calendar.js into bin/HanuaCalendar.app, so macOS asks once for "Hanua Calendar"
// (whatever started Hanua), and run through `open`, writing JSON to the file named by --stdout.
//
//   HanuaCalendar status                      → {"status":"granted" | "notDetermined" | "denied" | …}
//   HanuaCalendar events FROM TO [names…]     → {"events":[…],"calendars":[…]} or {"error":"denied"}
//   FROM and TO are days (YYYY-MM-DD, TO included); names, if given, limit it to those calendars.
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
let mode = args.count > 1 ? args[1] : "status"
let store = EKEventStore()
var status = EKEventStore.authorizationStatus(for: .event)
if mode == "status" { out(["status": statusName(status)]) }

guard mode == "events", args.count >= 4 else { out(["error": "usage"]) }

// first time: macOS asks; keep the run loop turning until it has an answer
if status == .notDetermined {
  var answered = false
  store.requestFullAccessToEvents { _, _ in answered = true }
  let giveUp = Date().addingTimeInterval(120)
  while !answered && Date() < giveUp { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
  status = EKEventStore.authorizationStatus(for: .event)
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
