import RakazoCore
import RakazoUI
import SwiftUI

struct AuthenticationView: View {
  @Bindable var model: AuthenticationModel
  @Environment(\.colorScheme) private var colorScheme
  @State private var showingServer = false
  @State private var passwordVisible = false

  private var title: String {
    switch model.page {
    case .signIn: "Sign in"
    case .signUp: "Sign up"
    case .reset: "Reset password"
    case .verification: "Check your email"
    }
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("Praci")
            .font(.headline)
            .foregroundStyle(color(.mutedForeground))
          if model.isSignedIn {
            signedIn
          } else {
            Text(title)
              .font(.largeTitle.bold())
              .accessibilityAddTraits(.isHeader)
            authentication
          }
          AuthStatus(error: model.errorMessage, notice: model.notice)
          Button("Use a custom server") { showingServer = true }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(color(.mutedForeground))
            .disabled(model.busy)
            .accessibilityIdentifier("customServer")
        }
        .padding(24)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
      }
      .scrollDismissesKeyboard(.interactively)
      .background(color(.background))
      .foregroundStyle(color(.foreground))
      .tint(color(.primary))
      .sheet(isPresented: $showingServer) {
        ServerView(model: model)
      }
      .onChange(of: model.page) { _, _ in passwordVisible = false }
    }
  }

  @ViewBuilder
  private var authentication: some View {
    if model.page == .verification {
      Text("Verify your email, then sign in.")
        .foregroundStyle(color(.mutedForeground))
      primaryButton("Resend verification email") { await model.submit() }
      Button("Back to sign in") { model.navigate(to: .signIn) }
        .frame(maxWidth: .infinity, minHeight: 44)
        .disabled(model.busy)
    } else if let capabilities = model.capabilities {
      if model.page != .reset, let provider = capabilities.sso {
        Button {
          Task { await model.signInWithSSO() }
        } label: {
          Text("Continue with \(provider.name)")
            .frame(maxWidth: .infinity, minHeight: 36)
        }
        .buttonStyle(.bordered)
        .disabled(model.busy || provider.availability != .available)
        .accessibilityIdentifier("ssoSignIn")
        if provider.availability != .available {
          Text(provider.availability == .checking ? "Checking SSO…" : "SSO is unavailable.")
            .font(.footnote)
            .foregroundStyle(color(.mutedForeground))
          Button("Retry") { Task { await model.refreshCapabilities() } }
            .disabled(model.busy)
        }
        if capabilities.passwordAuth {
          Text("or")
            .font(.footnote)
            .foregroundStyle(color(.mutedForeground))
            .frame(maxWidth: .infinity)
        }
      }
      if capabilities.passwordAuth {
        passwordForm(capabilities)
      } else if capabilities.sso == nil {
        Text("No sign-in method is available on this server.")
          .foregroundStyle(color(.mutedForeground))
      }
      if model.busy {
        ProgressView("Working…")
          .frame(maxWidth: .infinity)
      }
    } else if model.busy {
      ProgressView("Connecting…")
        .frame(maxWidth: .infinity)
    } else {
      Button("Retry connection") { Task { await model.refreshCapabilities() } }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity, minHeight: 44)
    }
  }

  private func passwordForm(_ capabilities: AuthCapabilities) -> some View {
    VStack(spacing: 14) {
      VStack(spacing: 0) {
        if model.page == .signUp {
          TextField("Name", text: $model.name)
            .textContentType(.name)
            .padding(14)
          Divider()
        }
        TextField("Email", text: $model.email)
          .textContentType(.emailAddress)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .padding(14)
          .accessibilityIdentifier("email")
        if model.page != .reset {
          Divider()
          HStack {
            Group {
              if passwordVisible {
                TextField("Password", text: $model.password)
              } else {
                SecureField("Password", text: $model.password)
              }
            }
            .textContentType(model.page == .signUp ? .newPassword : .password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("password")
            Button {
              passwordVisible.toggle()
            } label: {
              Image(systemName: passwordVisible ? "eye.slash" : "eye")
                .frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel(passwordVisible ? "Hide password" : "Show password")
          }
          .padding(.leading, 14)
        }
      }
      .background(color(.card), in: RoundedRectangle(cornerRadius: 14))
      .disabled(model.busy)

      primaryButton(model.page == .reset ? "Send reset link" : title) {
        await model.submit()
      }
      if model.page == .signIn {
        if capabilities.passwordReset, capabilities.resetURL != nil {
          Button("Forgot password?") { model.navigate(to: .reset) }
            .frame(minHeight: 44)
            .disabled(model.busy)
        }
        Button("Sign up") { model.navigate(to: .signUp) }
          .frame(maxWidth: .infinity, minHeight: 44)
          .buttonStyle(.bordered)
          .disabled(model.busy)
      } else {
        Button("Back to sign in") { model.navigate(to: .signIn) }
          .frame(maxWidth: .infinity, minHeight: 44)
          .disabled(model.busy)
      }
    }
  }

  private var signedIn: some View {
    VStack(spacing: 20) {
      ContentUnavailableView {
        Label("Signed in", systemImage: "checkmark.circle")
      } description: {
        Text(model.endpoint.host() ?? model.endpoint.absoluteString)
      }
      Button("Sign out", role: .destructive) { Task { await model.signOut() } }
        .buttonStyle(.bordered)
        .disabled(model.busy)
        .accessibilityIdentifier("signOut")
      if model.busy { ProgressView() }
    }
    .frame(maxWidth: .infinity)
  }

  private func primaryButton(
    _ title: String,
    action: @escaping @MainActor () async -> Void
  ) -> some View {
    Button {
      Task { await action() }
    } label: {
      Text(title)
        .frame(maxWidth: .infinity, minHeight: 36)
        .foregroundStyle(color(.primaryForeground))
    }
    .buttonStyle(.borderedProminent)
    .disabled(model.busy)
  }

  private func color(_ token: SemanticColor) -> Color {
    RakazoTokens.color(token, for: colorScheme)
  }
}

struct AuthStatus: View {
  let error: String?
  let notice: String?
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    if let error {
      Text(error)
        .font(.callout)
        .foregroundStyle(RakazoTokens.color(.destructive, for: colorScheme))
        .accessibilityIdentifier("authError")
    }
    if let notice {
      Text(notice)
        .font(.callout)
        .foregroundStyle(RakazoTokens.color(.mutedForeground, for: colorScheme))
        .accessibilityIdentifier("authNotice")
    }
  }
}
