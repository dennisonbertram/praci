import RakazoAPI
import SwiftUI

struct AgentRowView: View {
  let row: RosterRow
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @ScaledMetric(relativeTo: .headline) private var avatarSize = 40

  var body: some View {
    HStack(alignment: dynamicTypeSize.isAccessibilitySize ? .top : .center, spacing: 12) {
      BotAvatarView(name: row.name, avatar: row.color, size: avatarSize)
      VStack(alignment: .leading, spacing: 2) {
        let muted = Color.token(.mutedForeground)
        let stamp = Text(rowTimestamp(row.updatedAt)).font(.subheadline).foregroundColor(muted)
        let dot = Circle().fill(Color.token(.primary)).frame(width: 8, height: 8)
          .accessibilityLabel("Unread")
        if dynamicTypeSize.isAccessibilitySize {
          // Large text: name gets the full width; the time follows the preview on the same line.
          Text(row.name).font(.headline).lineLimit(2)
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            if row.unread { dot }
            Text(subtitle).font(.subheadline).foregroundColor(muted) + Text(verbatim: " · ").font(.subheadline)
              .foregroundColor(muted) + stamp
          }
          .lineLimit(2)
        } else {
          HStack {
            Text(row.name).font(.headline).lineLimit(1)
            Spacer(minLength: 8)
            if row.unread { dot }
            stamp
          }
          Text(subtitle).font(.subheadline).lineLimit(1).foregroundStyle(muted)
        }
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var subtitle: String {
    switch row.status {
    case .waitingInput: String(localized: "Needs you")
    case .running: String(localized: "Working")
    default: row.preview
    }
  }
}

struct PageRowView: View {
  let title: LocalizedStringKey
  let systemImage: String
  var count: Int? = nil

  var body: some View {
    HStack {
      Label {
        Text(title)
      } icon: {
        Image(systemName: systemImage).foregroundStyle(Color.token(.foreground))
      }
      Spacer()
      if let count, count > 0 {
        Text(count, format: .number)
          .foregroundStyle(Color.token(.mutedForeground))
          .accessibilityLabel(Text("\(count)"))
      }
    }
  }
}
