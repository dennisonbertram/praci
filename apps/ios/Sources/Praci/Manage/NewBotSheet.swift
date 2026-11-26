import RakazoAPI
import RakazoUI
import SwiftUI

struct NewBotSheet: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let onCreated: (ThreadTarget) -> Void
  @State private var name = ""
  @State private var role = ""
  @State private var color = BotPalette.colors[0]
  @State private var spawnKey = UUID().uuidString
  @State private var busy = false
  @State private var error: String?
  @FocusState private var focused: Bool

  private var cleanName: String { ManageClient.clean(name) }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
            .focused($focused)
            .accessibilityIdentifier("botName")
          TextField("Role", text: $role)
            .accessibilityIdentifier("botRole")
        } footer: {
          if let error {
            Text(error).foregroundStyle(Color.token(.destructive))
          } else if cleanName.isEmpty {
            Text("Add a name to create the agent.")
          }
        }
        Section("Color") { ColorSwatches(selection: $color) }
      }
      .accessibilityIdentifier("newBot")
      .navigationTitle("New agent")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button { dismiss() } label: { Label("Cancel", systemImage: "xmark") }
        }
        ToolbarItem(placement: .confirmationAction) {
          if busy {
            ProgressView()
          } else {
            Button("Create") { Task { await create() } }
              .disabled(cleanName.isEmpty)
              .accessibilityIdentifier("create")
          }
        }
      }
      .onAppear { focused = true }
    }
    .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.medium, .large])
  }

  private func create() async {
    busy = true
    error = nil
    defer { busy = false }
    do {
      let bot = try await ManageClient.createBot(
        BotCreateInput(
          name: cleanName, title: role.trimmingCharacters(in: .whitespacesAndNewlines),
          color: color, spawnKey: spawnKey),
        app: app)
      onCreated(.bot(bot.id))
    } catch {
      self.error = error.localizedDescription
    }
  }
}

/// The bot colour choices; colours are identity values, not semantic tokens.
struct ColorSwatches: View {
  @Binding var selection: String

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 12) {
        ForEach(BotPalette.colors, id: \.self) { hex in
          Button { selection = hex } label: {
            Circle().fill(Color(hex: hex)).frame(width: 32, height: 32)
              .overlay {
                if selection.caseInsensitiveCompare(hex) == .orderedSame {
                  Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(.white)
                }
              }
          }
          .buttonStyle(.plain)
          .accessibilityLabel(hex)
          .accessibilityAddTraits(selection.caseInsensitiveCompare(hex) == .orderedSame ? .isSelected : [])
        }
      }
      .padding(.vertical, 4)
    }
  }
}
