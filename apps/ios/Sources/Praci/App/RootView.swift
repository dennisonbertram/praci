import SwiftUI

struct RootView: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    @Bindable var authentication = app.authentication
    Group {
      if authentication.isSignedIn {
        AppShell()
      } else {
        AuthenticationView(model: authentication)
      }
    }
    .onChange(of: authentication.isSignedIn) { _, signedIn in
      if !signedIn { app.reset() }
    }
    .onChange(of: authentication.endpoint) { _, _ in app.reloadSpace() }
    .consentSheet(app.consent)
    .sheet(
      isPresented: $authentication.serverSheetPresented,
      onDismiss: { authentication.dismissServerSheet() }
    ) {
      ServerView(model: authentication)
    }
    .onOpenURL { url in
      if !authentication.handleExternalURL(url) {
        app.open(url)
      }
    }
  }
}
