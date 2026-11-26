import RakazoAPI
import SwiftUI

struct SpaceSettingsSheet: View {
  let space: SpaceSummary
  let onChange: () -> Void
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var model = SpacesModel()
  @State private var name: String
  @State private var confirmingDelete = false

  init(space: SpaceSummary, onChange: @escaping () -> Void) {
    self.space = space
    self.onChange = onChange
    _name = State(initialValue: space.name)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
            .disabled(!space.canRename)
            .accessibilityIdentifier("spaceName")
        } footer: {
          if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
        }
        if space.canDelete {
          Section {
            Button("Delete space", role: .destructive) { confirmingDelete = true }
              .accessibilityIdentifier("deleteSpace")
          }
        }
      }
      .navigationTitle("Space settings")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          if model.busy {
            ProgressView()
          } else {
            Button("Save") {
              Task {
                if await model.rename(space, to: name, app: app) {
                  onChange()
                  dismiss()
                }
              }
            }
            .disabled(!space.canRename || SpacesModel.clean(name).isEmpty || SpacesModel.clean(name) == space.name)
            .accessibilityIdentifier("saveSpace")
          }
        }
      }
      .confirmationDialog("Delete \(space.name)?", isPresented: $confirmingDelete, titleVisibility: .visible) {
        Button("Delete", role: .destructive) {
          Task { if await model.remove(space, app: app) { dismiss() } }
        }
      } message: {
        Text("This removes its agents, chats and files. This cannot be undone.")
      }
    }
    .presentationDetents([.medium])
  }
}
