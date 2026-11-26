import RakazoAPI
import RakazoCore
import SwiftUI

struct CalendarDayRows: View {
  let items: [CalendarItem]
  let completing: Set<String>
  let onDone: (CalendarItem) -> Void
  private var days: [(day: String, items: [CalendarItem])] {
    let grouped = Dictionary(grouping: items, by: { dayOf($0) })
    return grouped.keys.sorted().map { day in
      (day, grouped[day, default: []].sorted { ($0.start, $0.id) < ($1.start, $1.id) })
    }
  }

  var body: some View {
    List {
      ForEach(days, id: \.day) { group in
        Section(dayTitle(group.day)) {
          ForEach(group.items) { item in
            CalendarItemRow(item: item)
              .swipeActions(edge: .trailing) {
                if item.kind == .todo, item.id.hasPrefix("todo:") {
                  Button("Done", systemImage: "checkmark") { onDone(item) }
                    .tint(Color.token(.success))
                    .disabled(completing.contains(item.id))
                }
              }
              .contextMenu {
                if item.kind == .todo, item.id.hasPrefix("todo:") {
                  Button("Done", systemImage: "checkmark") { onDone(item) }
                    .disabled(completing.contains(item.id))
                }
              }
          }
        }
      }
    }
    .accessibilityIdentifier("calendarList")
  }

  private func dayOf(_ item: CalendarItem) -> String {
    guard let date = parseISO(item.start) else { return String(item.start.prefix(10)) }
    return AgendaDays.day(of: date, allDay: item.allDay)
  }

  private func dayTitle(_ day: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = .current
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateStyle = .full
    formatter.timeStyle = .none
    return formatter.string(from: parseISO(day + "T00:00:00Z") ?? .now)
  }

  private func parseISO(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }
}

private struct CalendarItemRow: View {
  let item: CalendarItem
  @Environment(AppModel.self) private var app

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      itemAction
      Spacer(minLength: 4)
      if let joinUrl = item.joinUrl, let url = URL(string: joinUrl), url.scheme == "https" {
        Link(destination: url) {
          Label("Join", systemImage: "video")
            .labelStyle(.iconOnly)
        }
        .accessibilityLabel("Join")
      }
    }
    .padding(.vertical, 2)
  }

  @ViewBuilder
  private var itemAction: some View {
    if let href = item.href, let url = URL(string: href) {
      Link(destination: url) { label }
    } else if let mailId = item.mailId {
      Button { app.open(.inboxMessage(messageID: mailId)) } label: { label }
        .buttonStyle(.plain)
    } else if let botId = item.botId {
      Button { app.open(.thread(.bot(botId))) } label: { label }
        .buttonStyle(.plain)
    } else {
      label
    }
  }

  private var label: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(item.title).font(.body).foregroundStyle(Color.token(.foreground))
      HStack(spacing: 6) {
        if !item.allDay, let date = parseISO(item.start) {
          Text(date, format: .dateTime.hour().minute())
        }
        if let botName = item.botName { Text(botName) }
      }
      .font(.subheadline)
      .foregroundStyle(Color.token(.mutedForeground))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(Rectangle())
  }

  private func parseISO(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }
}
