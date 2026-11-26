import RakazoAPI
import RakazoUI
import SwiftUI

/// One mail row (DS-05): unread dot, sender, label, time, subject and one line of summary.
struct InboxRowView: View {
  let row: InboxRow
  let now: Date
  @Environment(\.dynamicTypeSize) private var typeSize

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      Circle()
        .fill(row.unread ? Color.token(.primary) : .clear)
        .frame(width: 8, height: 8)
        .padding(.top, 6)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        let large = typeSize.isAccessibilitySize
        let header = HStack(spacing: 6) {
          if row.isSuspicious {
            Image(systemName: "exclamationmark.triangle.fill")
              .font(.footnote)
              .foregroundStyle(Color.token(.destructive))
              .accessibilityLabel("Suspicious")
          }
          Text(row.from)
            .font(.headline.weight(row.unread ? .semibold : .regular))
            .foregroundStyle(Color.token(.foreground))
            .lineLimit(large ? 2 : 1)
          if let label = inboxLabel(for: row) { LabelText(label: label) }
          Spacer(minLength: 4)
          if !large { TimeText(row: row, now: now) }
        }
        header
        if large { TimeText(row: row, now: now) }
        Text(row.subject)
          .font(.subheadline)
          .foregroundStyle(Color.token(.foreground))
          .lineLimit(large ? 2 : 1)
        if !row.summary.isEmpty, !large {
          Text(row.summary)
            .font(.subheadline)
            .foregroundStyle(Color.token(.mutedForeground))
            .lineLimit(1)
        }
      }
      .opacity(row.feedback == "noise" ? 0.6 : 1)
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("inboxRow")
  }
}

private struct LabelText: View {
  let label: InboxLabel

  var body: some View {
    switch label {
    case .attention: Text("Needs attention").foregroundStyle(Color.token(.mutedForeground)).font(.caption)
    case .newsletter: Text("Newsletter").foregroundStyle(Color.token(.mutedForeground)).font(.caption)
    case .spam: Text("Spam").foregroundStyle(Color.token(.warning)).font(.caption)
    case .junk: Text("Junk").foregroundStyle(Color.token(.warning)).font(.caption)
    }
  }
}

private struct TimeText: View {
  let row: InboxRow
  let now: Date

  var body: some View {
    Group {
      if let date = row.date {
        switch inboxTimeStyle(of: date, now: now) {
        case .time: Text(date, format: .dateTime.hour().minute())
        case .weekday: Text(date, format: .dateTime.weekday(.wide))
        case .monthDay: Text(date, format: .dateTime.month(.abbreviated).day())
        }
      }
    }
    .font(.subheadline)
    .foregroundStyle(Color.token(.mutedForeground))
    .lineLimit(1)
  }
}
