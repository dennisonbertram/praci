import RakazoAPI
import SwiftUI

struct AuditRow: View {
  let audit: AuditRequest
  let onClose: (String) -> Void

  var body: some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 3) {
        Text("Audit request · \(audit.fund)")
          .font(.headline)
          .lineLimit(2)
        HStack(spacing: 5) {
          if let dueDate = audit.dueDate { Text("due \(investorDay(dueDate))") }
          if audit.dueDate == nil {
            Text(audit.status.displayName)
          } else {
            Text("· \(audit.status.displayName)")
          }
        }
        .font(.subheadline)
        .foregroundStyle(Color.token(.mutedForeground))
      }
      Spacer(minLength: 4)
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button("Mark done") { onClose("done") }
        .tint(Color.token(.primary))
      Button("Dismiss", role: .destructive) { onClose("dismissed") }
        .tint(Color.token(.destructive))
    }
    .contextMenu {
      Button("Mark done") { onClose("done") }
      Button("Dismiss", role: .destructive) { onClose("dismissed") }
    }
    .accessibilityElement(children: .contain)
  }
}

/// A day (`YYYY-MM-DD`, or the start of an ISO timestamp) shown as a medium date, read in UTC so it never shifts.
func investorDay(_ value: String) -> String {
  let parser = DateFormatter()
  parser.calendar = Calendar(identifier: .gregorian)
  parser.timeZone = TimeZone(secondsFromGMT: 0)
  parser.dateFormat = "yyyy-MM-dd"
  guard let date = parser.date(from: String(value.prefix(10))) else { return value }
  var style = Date.FormatStyle(date: .abbreviated, time: .omitted)
  style.timeZone = TimeZone(secondsFromGMT: 0)!
  return date.formatted(style)
}
