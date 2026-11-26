import RakazoAPI
import RakazoUI
import SwiftUI

struct CalendarScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model: CalendarModel

  init() {
    _model = State(initialValue: CalendarModel(client: CalendarClient(
      agenda: { _, _, _ in throw URLError(.unsupportedURL) },
      waitingOnYou: { [] },
      markDone: { _ in throw URLError(.unsupportedURL) })))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load() } }, content: { items in
      if items.isEmpty {
        ContentUnavailableView("No calendar items", systemImage: "calendar")
      } else {
        CalendarDayRows(items: items, completing: model.completing) { item in
          Task { await model.markDone(item) }
        }
      }
    })
    .overlay(alignment: .bottom) {
      if let error = model.refreshError {
        Text(error).font(.footnote).foregroundStyle(Color.token(.destructive)).padding()
          .accessibilityIdentifier("calendarRefreshError")
      }
    }
    .navigationTitle("Calendar")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        if model.googleNeedsAction {
          Button(model.googleNeedsReconnect ? "Reconnect" : "Connect") {
            app.openSettings(.integrations)
          }
          .accessibilityIdentifier("calendarConnectGoogle")
        }
      }
    }
    .safeAreaInset(edge: .bottom) {
      if let error = model.actionError {
        Text(error).font(.footnote).foregroundStyle(Color.token(.destructive)).padding()
      }
    }
    .refreshable { await model.load() }
    .task(id: "\(app.spaceID ?? "")-\(app.settingsClosings)") {
      model = CalendarModel(app: app)
      await model.load()
    }
  }
}
