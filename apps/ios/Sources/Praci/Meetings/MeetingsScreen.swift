import RakazoAPI
import SwiftUI

struct MeetingsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = MeetingsModel()
  @State private var query = ""
  @State private var record = RecordModel()
  @State private var recording = false

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app, query: query) } }, content: { meetings in
      if meetings.isEmpty {
        if query.isEmpty {
          ContentUnavailableView("No meetings", systemImage: "waveform")
        } else {
          ContentUnavailableView.search(text: query)
        }
      } else {
        List {
          ForEach(meetings) { meeting in
            NavigationLink(value: Route.meeting(id: meeting.id)) {
              VStack(alignment: .leading, spacing: 2) {
                Text(meeting.title)
                Text(meeting.subtitle).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
              }
            }
            .accessibilityIdentifier("meetingRow")
            .task { if meeting.id == meetings.last?.id { await model.loadMore(app, query: query) } }
          }
        }
        .listStyle(.plain)
      }
    })
    .background(Color.token(.background))
    .navigationTitle("Meetings")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $query)
    .toolbar {
      if let options = record.options, options.policy != "off", !app.capture.isBusy {
        ToolbarItem(placement: .topBarTrailing) {
          Button("Record", systemImage: "record.circle") { recording = true }
            .accessibilityIdentifier("record")
        }
      }
    }
    .sheet(isPresented: $recording) {
      RecordSheet(model: record)
    }
    .task { await record.load(app) }
    .onChange(of: app.capture.storedCount) { Task { await model.load(app, query: query) } }
    .task(id: query) {
      if !query.isEmpty { try? await Task.sleep(for: .milliseconds(250)) }
      if Task.isCancelled { return }
      await model.load(app, query: query.trimmingCharacters(in: .whitespaces))
    }
    .refreshable { await model.load(app, query: query) }
  }
}
