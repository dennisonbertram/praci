import RakazoAPI
import RakazoCore
import SwiftUI

struct LogCallSheet: View {
  let prospect: FundraisingProspect
  let onSave: (String, String, FundraisingCallLogInput.NextCall) async -> Bool
  let onCancel: () -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var outcome: String?
  @State private var note = ""
  @State private var nextChoice: NextChoice
  @State private var nextDate = Date()
  @State private var saving = false

  init(
    prospect: FundraisingProspect,
    onSave: @escaping (String, String, FundraisingCallLogInput.NextCall) async -> Bool,
    onCancel: @escaping () -> Void
  ) {
    self.prospect = prospect
    self.onSave = onSave
    self.onCancel = onCancel
    _nextChoice = State(initialValue: prospect.pipelineRecord?.nextCallAt == nil ? .none : .keep)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker("Outcome", selection: $outcome) {
            Text("Choose an outcome").tag(String?.none)
            Text("Spoke").tag(String?.some("spoke"))
            Text("Left message").tag(String?.some("left_message"))
            Text("No answer").tag(String?.some("no_answer"))
          }
        }
        Section {
          TextField("Note", text: $note, axis: .vertical)
            .lineLimit(2 ... 5)
        }
        Section {
          Picker("Next call", selection: $nextChoice) {
            if prospect.pipelineRecord?.nextCallAt != nil { Text("Keep existing date").tag(NextChoice.keep) }
            Text("Choose date").tag(NextChoice.date)
            Text("None").tag(NextChoice.none)
          }
          if nextChoice == .date {
            DatePicker("Date", selection: $nextDate, in: Date()..., displayedComponents: .date)
          }
        }
      }
      .navigationTitle("Log a call")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel", action: onCancel).disabled(saving)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { Task { await save() } }
            .disabled(outcome == nil || saving)
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func save() async {
    guard let outcome, !saving else { return }
    saving = true
    let next: FundraisingCallLogInput.NextCall
    switch nextChoice {
    case .keep: next = .keep
    case .none: next = .set(at: nil)
    case .date:
      next = .set(at: pipelineCallISO(day: selectedDay))
    }
    if await onSave(outcome, note, next) { dismiss() }
    saving = false
  }

  private var selectedDay: String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    let parts = calendar.dateComponents([.year, .month, .day], from: nextDate)
    return String(format: "%04d-%02d-%02d", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
  }
}

private enum NextChoice: Hashable {
  case keep, date, none
}
