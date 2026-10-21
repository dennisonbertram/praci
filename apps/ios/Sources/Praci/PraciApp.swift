import SwiftUI

@main
struct PraciApp: App {
  @State private var authentication = AuthenticationModel()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      AuthenticationView(model: authentication)
        .task { await authentication.start() }
        .onChange(of: scenePhase) { _, phase in
          if phase == .active {
            Task { await authentication.revalidate() }
          }
        }
    }
  }
}
