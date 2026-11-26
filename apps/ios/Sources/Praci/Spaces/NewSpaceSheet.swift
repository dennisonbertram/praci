import SwiftUI

struct NewSpaceSheet: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var model = SpacesModel()
  @State private var name = ""
  @FocusState private var focused: Bool

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
            .focused($focused)
            .submitLabel(.done)
            .accessibilityIdentifier("spaceName")
        } footer: {
          if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
        }
      }
      .navigationTitle("New space")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          if model.busy {
            ProgressView()
          } else {
            Button("Create") {
              Task { if await model.create(name, app: app) { dismiss() } }
            }
            .disabled(SpacesModel.clean(name).isEmpty)
            .accessibilityIdentifier("createSpace")
          }
        }
      }
      .onAppear { focused = true }
    }
    .presentationDetents([.medium])
  }
}
