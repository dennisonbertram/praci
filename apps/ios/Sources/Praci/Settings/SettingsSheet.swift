import SwiftUI

/// A Settings screen that other screens can open directly (a Connect button, a Reconnect banner).
enum SettingsDestination: Hashable {
  case integrations, models
}

/// The Settings sheet. With a destination it opens that screen already pushed; Done closes it.
struct SettingsSheet: View {
  @Environment(AppModel.self) private var app
  @State private var path: [SettingsDestination]
  @State private var detent: PresentationDetent

  init(destination: SettingsDestination?) {
    _path = State(initialValue: destination.map { [$0] } ?? [])
    // A short screen opened directly (Connect a model) starts at half height; Settings starts full.
    _detent = State(initialValue: destination == .models ? .medium : .large)
  }

  var body: some View {
    NavigationStack(path: $path) {
      SettingsScreen()
        .navigationDestination(for: SettingsDestination.self) { destination in
          screen(destination)
            .toolbar {
              ToolbarItem(placement: .topBarTrailing) {
                Button { app.showingSettings = false } label: { Label("Done", systemImage: "xmark") }
                  .accessibilityIdentifier("closeSettings")
              }
            }
        }
    }
    .presentationDetents([.medium, .large], selection: $detent)
  }

  @ViewBuilder
  private func screen(_ destination: SettingsDestination) -> some View {
    switch destination {
    case .integrations: IntegrationsScreen()
    case .models: ModelsScreen()
    }
  }
}
