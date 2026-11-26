import Observation
import RakazoAPI
import RakazoUI
import SwiftUI

@MainActor
@Observable
final class NotificationPreferencesModel {
  var state: Loadable<NotificationPreferences> = .idle
  var errorMessage: String?

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      state = .loaded(try await app.call("notifications/preferences"))
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }

  /// Shows the new value at once; the server's answer replaces it, or the old value returns.
  func update(
    _ app: AppModel, _ change: NotificationPreferencesUpdate,
    apply: (inout NotificationPreferences) -> Void
  ) async {
    guard var prefs = state.value else { return }
    let previous = prefs
    apply(&prefs)
    state = .loaded(prefs)
    errorMessage = nil
    do {
      state = .loaded(try await app.call("notifications/updatePreferences", input: change))
    } catch {
      state = .loaded(previous)
      errorMessage = error.localizedDescription
    }
  }
}

struct NotificationPreferencesScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = NotificationPreferencesModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { prefs in
      List {
        Section("Tell me when an agent") {
          toggle("Finishes", prefs.finish, id: "notifyFinish") {
            NotificationPreferencesUpdate(finish: $0)
          } apply: { $0.finish = $1 }
          toggle("Needs help", prefs.help, id: "notifyHelp") {
            NotificationPreferencesUpdate(help: $0)
          } apply: { $0.help = $1 }
          toggle("Needs takeover", prefs.takeover, id: "notifyTakeover") {
            NotificationPreferencesUpdate(takeover: $0)
          } apply: { $0.takeover = $1 }
        }
        if prefs.hasPhone || prefs.hasImessage {
          Section("Send to") {
            if prefs.hasPhone {
              toggle("Phone", prefs.push, id: "notifyPush") {
                NotificationPreferencesUpdate(channels: .init(push: $0))
              } apply: { $0.push = $1 }
            }
            if prefs.hasImessage {
              toggle("iMessage", prefs.imessage, id: "notifyImessage") {
                NotificationPreferencesUpdate(channels: .init(imessage: $0))
              } apply: { $0.imessage = $1 }
            }
          }
        }
        if let message = model.errorMessage {
          Section { Text(message).foregroundStyle(Color.token(.destructive)) }
        }
      }
    })
    .navigationTitle("Notifications")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
  }

  private func toggle(
    _ title: LocalizedStringKey, _ value: Bool, id: String,
    update: @escaping (Bool) -> NotificationPreferencesUpdate,
    apply: @escaping (inout NotificationPreferences, Bool) -> Void
  ) -> some View {
    Toggle(
      title,
      isOn: Binding(
        get: { value },
        set: { new in
          Task { await model.update(app, update(new)) { apply(&$0, new) } }
        })
    )
    .accessibilityIdentifier(id)
  }
}
