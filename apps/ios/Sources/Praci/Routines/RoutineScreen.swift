import RakazoAPI
import SwiftUI

struct RoutineScreen: View {
  let routineID: String
  @Environment(AppModel.self) private var app
  @State private var model: RoutineModel

  init(routineID: String) {
    self.routineID = routineID
    _model = State(initialValue: RoutineModel(routineID: routineID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { routine in
      content(routine)
    })
    .background(Color.token(.background))
    .navigationTitle(model.state.value?.name ?? "Routine")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if let routine = model.state.value {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            Task { await model.setActive(!routine.active, app: app) }
          } label: {
            if routine.active {
              Label("Pause", systemImage: "pause.fill")
            } else {
              Label("Resume", systemImage: "play.fill")
            }
          }
          .disabled(model.updating)
          .accessibilityIdentifier(routine.active ? "pauseRoutine" : "resumeRoutine")
        }
      }
    }
    .task(id: app.spaceID) { await model.load(app) }
    .refreshable { await model.load(app) }
    .actionErrorAlert("Couldn’t update this routine", message: Binding(
      get: { model.actionError }, set: { if $0 == nil { model.dismissError() } }))
  }

  private func content(_ routine: Routine) -> some View {
    List {
      Section {
        LabeledContent("Schedule", value: routine.scheduleText)
        LabeledContent("Last ran", value: detailTimestamp(routine.lastRunAt) ?? String(localized: "Never"))
        if routine.active {
          LabeledContent("Next run", value: detailTimestamp(routine.nextRunAt) ?? "—")
        } else if let paused = routine.pausedText {
          Text(paused).foregroundStyle(Color.token(.warning))
        }
      }
      Section("History") {
        if model.runs.isEmpty {
          Text(model.historyError ?? String(localized: "No runs yet"))
            .foregroundStyle(Color.token(.mutedForeground))
        }
        ForEach(model.runs) { run in runRow(run) }
        if model.nextCursor != nil {
          Button("Load more") { Task { await model.loadHistory(app, more: true) } }
        }
      }
      Section("Prompt") {
        Text(routine.prompt).lineLimit(8).textSelection(.enabled)
      }
    }
    .safeAreaInset(edge: .bottom) {
      Button { app.open(.thread(.bot(routine.botId))) } label: {
        Text("Open conversation").frame(maxWidth: .infinity).foregroundStyle(Color.token(.primaryForeground))
      }
      .buttonStyle(.borderedProminent)
      .tint(Color.token(.primary))
      .controlSize(.large)
      .padding()
      .accessibilityIdentifier("openConversation")
    }
  }

  private func runRow(_ run: RoutineRun) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      Image(systemName: icon(run.status)).foregroundStyle(tint(run.status))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(label(run.status))
        Text(detailTimestamp(run.createdAt) ?? "").font(.footnote)
          .foregroundStyle(Color.token(.mutedForeground))
        if let note = run.error ?? run.preview, !note.isEmpty {
          Text(note).font(.footnote).foregroundStyle(Color.token(.mutedForeground)).lineLimit(3)
        }
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("routineRun")
  }

  private func label(_ status: RunStatus) -> LocalizedStringKey {
    switch status {
    case .completed: "Completed"
    case .failed: "Failed"
    case .cancelled: "Cancelled"
    case .queued, .leased: "Queued"
    case .running: "Running"
    case .waitingInput: "Waiting for you"
    case .waitingTakeover: "Waiting for takeover"
    case .unknown: "Unknown"
    }
  }

  private func icon(_ status: RunStatus) -> String {
    switch status {
    case .completed: "checkmark.circle"
    case .failed: "xmark.circle"
    case .cancelled: "slash.circle"
    case .waitingInput, .waitingTakeover: "hand.raised"
    default: "clock"
    }
  }

  private func tint(_ status: RunStatus) -> Color {
    switch status {
    case .completed: Color.token(.success)
    case .failed: Color.token(.destructive)
    case .waitingInput, .waitingTakeover: Color.token(.warning)
    default: Color.token(.mutedForeground)
    }
  }
}
