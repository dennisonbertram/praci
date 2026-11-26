import Observation
import RakazoAPI
import RakazoUI
import SwiftUI

private struct BotRestore: Encodable, Sendable { let botId: String }
private struct GroupRestore: Encodable, Sendable { let groupId: String }

struct ArchivedEntry: Identifiable, Equatable {
  enum Kind { case bot, group }
  let id: String
  let kind: Kind
  let name: String
  let archivedAt: String?
}

@MainActor
@Observable
final class ArchivedModel {
  var state: Loadable<[ArchivedEntry]> = .idle
  var errorMessage: String?
  private(set) var restoring: Set<String> = []

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      async let bots: [BotSummary] = app.call("bots/listArchived")
      async let groups: [GroupSummary] = app.call("groups/listArchived")
      let (botList, groupList) = try await (bots, groups)
      let entries =
        botList.map { ArchivedEntry(id: $0.id, kind: .bot, name: $0.name, archivedAt: $0.archivedAt) }
        + groupList.map { ArchivedEntry(id: $0.id, kind: .group, name: $0.name, archivedAt: $0.archivedAt) }
      // Newest archive first; ISO timestamps sort as text.
      state = .loaded(entries.sorted { ($0.archivedAt ?? "") > ($1.archivedAt ?? "") })
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }

  func restore(_ entry: ArchivedEntry, _ app: AppModel) async {
    guard restoring.insert(entry.id).inserted else { return }
    defer { restoring.remove(entry.id) }
    errorMessage = nil
    do {
      let _: OKResult =
        switch entry.kind {
        case .bot: try await app.call("bots/restore", input: BotRestore(botId: entry.id))
        case .group: try await app.call("groups/restore", input: GroupRestore(groupId: entry.id))
        }
      if case .loaded(let list) = state { state = .loaded(list.filter { $0.id != entry.id }) }
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

struct ArchivedScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = ArchivedModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { entries in
      if entries.isEmpty {
        ContentUnavailableView("No archived agents", systemImage: "archivebox")
      } else {
        List {
          ForEach(entries) { entry in
            HStack {
              VStack(alignment: .leading) {
                Text(entry.name)
                if let date = Self.date(entry.archivedAt) {
                  Text("Archived \(date, format: .dateTime.month(.abbreviated).day())")
                    .font(.caption)
                    .foregroundStyle(Color.token(.mutedForeground))
                }
              }
              Spacer()
              Button("Restore") { Task { await model.restore(entry, app) } }
                .buttonStyle(.bordered)
                .disabled(model.restoring.contains(entry.id))
                .accessibilityIdentifier("restore-\(entry.id)")
            }
          }
          if let message = model.errorMessage {
            Section { Text(message).foregroundStyle(Color.token(.destructive)) }
          }
        }
      }
    })
    .navigationTitle("Archived agents")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
  }

  private static func date(_ iso: String?) -> Date? {
    guard let iso else { return nil }
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
  }
}
