import RakazoAPI
import SwiftUI

struct MeetingDetailScreen: View {
  let meetingID: String
  @Environment(AppModel.self) private var app
  @State private var model: MeetingDetailModel
  @State private var deleting = false

  init(meetingID: String) {
    self.meetingID = meetingID
    _model = State(initialValue: MeetingDetailModel(meetingID: meetingID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { detail in
      content(detail)
    })
    .background(Color.token(.background))
    .navigationTitle(model.state.value?.meeting.title ?? "")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if model.state.value != nil {
        ToolbarItem(placement: .topBarTrailing) {
          Button("Delete", role: .destructive) { deleting = true }
            .accessibilityIdentifier("deleteMeeting")
        }
      }
    }
    .task {
      await model.load(app)
      await model.pollWhileSummarizing(app)
    }
    .refreshable { await model.load(app) }
    .confirmationDialog(
      "Delete \"\(model.state.value?.meeting.title ?? "")\"?", isPresented: $deleting,
      titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        Task { if await model.delete(app) { app.path.removeAll { $0 == .meeting(id: meetingID) } } }
      }
    } message: {
      if model.state.value?.meeting.provider == "granola" {
        Text("Removes this meeting and its to-dos from Praci. Your note in Granola is not changed.")
      } else {
        Text("Removes this meeting and its to-dos from Praci.")
      }
    }
    .actionErrorAlert("Couldn’t save that", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private func content(_ detail: MeetingDetail) -> some View {
    List {
      Section {
        Text(detail.meeting.subtitle).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
        if detail.partial {
          Text("Part of this meeting could not be transcribed.").foregroundStyle(Color.token(.destructive))
        }
        if model.isSummarizing {
          Text("Summarizing…").foregroundStyle(Color.token(.mutedForeground))
        }
        if !detail.summary.isEmpty { Text(detail.summary) }
      }
      if !detail.decisions.isEmpty {
        Section("Decisions") { ForEach(detail.decisions, id: \.self) { Text($0) } }
      }
      if !detail.followUps.isEmpty {
        Section("Follow-ups") { ForEach(detail.followUps, id: \.self) { Text($0) } }
      }
      if !detail.todos.isEmpty {
        Section("Your to-dos") { ForEach(detail.todos) { todoRow($0) } }
      }
      if let transcript = detail.transcript, !transcript.isEmpty {
        Section {
          DisclosureGroup("Transcript") { Text(transcript).font(.footnote).textSelection(.enabled) }
        }
      }
    }
    .listStyle(.insetGrouped)
  }

  private func todoRow(_ todo: MeetingTodo) -> some View {
    let done = todo.doneAt != nil
    return HStack {
      Button {
        Task { await model.setDone(todo, done: !done, app: app) }
      } label: {
        Image(systemName: done ? "checkmark.circle.fill" : "circle")
          .font(.title2)
          .foregroundStyle(Color.token(done ? .primary : .mutedForeground))
          .frame(width: 44, height: 44)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(todo.text)
      .accessibilityValue(done ? "Done" : "Not done")
      .accessibilityIdentifier("meetingTodo")
      Text(todo.text)
        .strikethrough(done)
        .foregroundStyle(Color.token(done ? .mutedForeground : .foreground))
      Spacer(minLength: 8)
      if let due = todo.dueOn.flatMap({ TodoDue.label($0) }) {
        Text(due).font(.caption).foregroundStyle(Color.token(.mutedForeground))
      }
    }
  }
}
