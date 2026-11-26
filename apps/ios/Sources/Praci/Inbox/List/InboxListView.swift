import RakazoAPI
import RakazoUI
import SwiftUI

/// The grouped mail list with its problem banner and empty states.
struct InboxListView: View {
  let model: InboxModel
  let list: InboxList
  let open: (InboxRow) -> Void
  let goToSettings: () -> Void
  @State private var showCleanup = false

  var body: some View {
    let groups = groupInbox(list.rows, now: .now)
    List {
      if let problem = model.problem, !list.rows.isEmpty {
        ProblemBanner(problem: problem, retry: { Task { await model.retry() } }, reconnect: goToSettings)
          .listRowSeparator(.hidden)
          .listRowBackground(Color.token(.background))
      }
      TodosCard()
        .listRowSeparator(.hidden)
        .listRowBackground(Color.token(.background))
      section("Needs reply", groups.needsReply, count: true)
      section("Today", groups.today)
      section("Earlier", groups.earlier)
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .refreshable { await model.pullToRefresh() }
    .overlay {
      if list.rows.isEmpty { EmptyInbox(model: model, list: list, goToSettings: goToSettings) }
    }
    .accessibilityIdentifier("inboxList")
    .toolbar {
      ToolbarItem {
        Menu {
          Button { showCleanup = true } label: { Label("Cleanup", systemImage: "checklist") }
            .accessibilityIdentifier("inboxCleanup")
        } label: {
          Label("More", systemImage: "ellipsis")
        }
        .accessibilityIdentifier("inboxMore")
      }
    }
    .navigationDestination(isPresented: $showCleanup) { CleanupScreen() }
  }

  @ViewBuilder
  private func section(_ title: LocalizedStringKey, _ rows: [InboxRow], count: Bool = false)
    -> some View
  {
    if !rows.isEmpty {
      Section {
        ForEach(rows) { row in
          Button { open(row) } label: { InboxRowView(row: row, now: .now) }
            .buttonStyle(.plain)
            .listRowBackground(Color.token(.background))
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
              Button { Task { await model.archive(row) } } label: {
                Label("Archive", systemImage: "archivebox")
              }
              .tint(Color.token(.primary))
              Button { Task { await model.markSpam(row) } } label: {
                Label("Spam", systemImage: "exclamationmark.octagon")
              }
              .tint(Color.token(.warning))
            }
            .swipeActions(edge: .leading) {
              Button { Task { await model.setRead(row, read: row.unread) } } label: {
                row.unread
                  ? Label("Read", systemImage: "envelope.open")
                  : Label("Unread", systemImage: "envelope.badge")
              }
              .tint(Color.token(.link))
            }
            .contextMenu {
              Button { Task { await model.setRead(row, read: row.unread) } } label: {
                row.unread
                  ? Label("Mark as read", systemImage: "envelope.open")
                  : Label("Mark as unread", systemImage: "envelope.badge")
              }
              Button { Task { await model.archive(row) } } label: {
                Label("Archive", systemImage: "archivebox")
              }
              Button { Task { await model.markSpam(row) } } label: {
                Label("Spam", systemImage: "exclamationmark.octagon")
              }
            }
            .task { await model.loadMoreIfNeeded(after: row) }
        }
      } header: {
        HStack {
          Text(title)
          if count {
            Text(rows.count, format: .number).foregroundStyle(Color.token(.mutedForeground))
          }
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(Color.token(.foreground))
      }
    }
  }
}

private struct ProblemBanner: View {
  let problem: InboxProblem
  let retry: () -> Void
  let reconnect: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        switch problem {
        case .reconnect: Text("Gmail needs to reconnect").font(.subheadline.weight(.semibold))
        case .rateLimited: Text("Gmail is limiting requests").font(.subheadline.weight(.semibold))
        case .unreachable: Text("Couldn’t reach Gmail").font(.subheadline.weight(.semibold))
        }
      }
      Spacer()
      switch problem {
      case .reconnect: Button("Reconnect", action: reconnect).accessibilityIdentifier("inboxReconnect")
      default: Button("Try again", action: retry).accessibilityIdentifier("inboxRetry")
      }
    }
    .buttonStyle(.bordered)
    .padding(12)
    .background(Color.token(.card), in: .rect(cornerRadius: 12))
    .accessibilityIdentifier("inboxBanner")
  }
}

private struct EmptyInbox: View {
  let model: InboxModel
  let list: InboxList
  let goToSettings: () -> Void

  var body: some View {
    Group {
      if list.accounts.isEmpty {
        ContentUnavailableView {
          Label("No mail account", systemImage: "envelope")
        } description: {
          Text("Connect Gmail to see your inbox here.")
        } actions: {
          PrimaryActionButton("Connect Gmail", action: goToSettings)
        }
      } else if let problem = model.problem {
        problemView(problem)
      } else if !model.query.isEmpty {
        ContentUnavailableView.search(text: model.query)
      } else if list.syncedAt == nil {
        // Never synced: the first sync is still running.
        VStack(spacing: 12) {
          ProgressView()
          Text("Syncing mail").foregroundStyle(Color.token(.mutedForeground))
        }
      } else {
        ContentUnavailableView {
          Label("Inbox zero", systemImage: "tray")
        } description: {
          if let synced = list.syncedAt.flatMap(InboxRow.parseDate) {
            Text("Synced \(synced, format: .dateTime.hour().minute())")
          }
        }
      }
    }
    .accessibilityIdentifier("inboxEmpty")
  }

  @ViewBuilder
  private func problemView(_ problem: InboxProblem) -> some View {
    switch problem {
    case .reconnect:
      ContentUnavailableView {
        Label("Gmail needs to reconnect", systemImage: "link.badge.plus")
      } description: {
        Text("Reconnect to see new mail.")
      } actions: {
        PrimaryActionButton("Reconnect", action: goToSettings)
          .accessibilityIdentifier("inboxReconnect")
      }
    case .rateLimited:
      ContentUnavailableView {
        Label("Gmail is limiting requests", systemImage: "clock")
      } description: {
        Text("Try again in a moment.")
      } actions: {
        PrimaryActionButton("Try again") { Task { await model.retry() } }
          .accessibilityIdentifier("inboxRetry")
      }
    case .unreachable:
      ContentUnavailableView {
        Label("Couldn’t reach Gmail", systemImage: "exclamationmark.triangle")
      } actions: {
        PrimaryActionButton("Try again") { Task { await model.retry() } }
          .accessibilityIdentifier("inboxRetry")
      }
    }
  }
}
