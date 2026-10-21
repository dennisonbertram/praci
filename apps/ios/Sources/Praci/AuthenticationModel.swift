import Foundation
import Observation
import RakazoCore

@MainActor
@Observable
final class AuthenticationModel {
  enum Page {
    case signIn, signUp, reset, verification
  }

  var page = Page.signIn
  var email = ""
  var password = ""
  var name = ""
  private(set) var endpoint: URL
  private(set) var isSignedIn = false
  private(set) var busy = false
  private(set) var capabilities: AuthCapabilities?
  private(set) var errorMessage: String?
  private(set) var notice: String?

  @ObservationIgnored private let client: AuthClient
  @ObservationIgnored private let browser = SSOBrowser()
  @ObservationIgnored private var started = false
  @ObservationIgnored private var lastHandledSessionGeneration: UInt64?
  private static let endpointKey = "serverOrigin"

  init() {
    let saved = UserDefaults.standard.string(forKey: Self.endpointKey)
    let endpoint = saved.flatMap { try? ServerEndpoint.normalize($0) } ?? ServerEndpoint.defaultURL
    self.endpoint = endpoint
    client = AuthClient(endpoint: endpoint, storage: KeychainSessionStorage())
  }

  func start() async {
    guard !started else { return }
    started = true
    busy = true
    defer { busy = false }
    do {
      try await client.restore()
    } catch {
      show(error)
    }
    await sync()
    await loadCapabilities()
  }

  func refreshCapabilities() async {
    guard !busy else { return }
    busy = true
    errorMessage = nil
    defer { busy = false }
    await loadCapabilities()
  }

  func revalidate() async {
    guard started, !busy, isSignedIn else { return }
    busy = true
    defer { busy = false }
    do {
      try await client.validateSession()
    } catch {
      show(error)
    }
    await sync()
  }

  func navigate(to page: Page) {
    guard !busy else { return }
    self.page = page
    password = ""
    errorMessage = nil
    notice = nil
  }

  func submit() async {
    guard !busy else { return }
    busy = true
    errorMessage = nil
    notice = nil
    defer { busy = false }
    do {
      switch page {
      case .signIn, .signUp:
        let result = try await client.authenticate(
          page == .signIn ? .signIn : .signUp,
          email: email,
          password: password,
          name: name
        )
        password = ""
        switch result {
        case .signedIn: break
        case .verificationRequired: page = .verification
        }
      case .reset:
        try await client.requestPasswordReset(email: email)
        notice = "If an account exists, you’ll receive a reset link."
      case .verification:
        try await client.resendVerification(email: email)
        notice = "Verification email sent."
      }
    } catch {
      password = ""
      show(error)
    }
    await sync()
  }

  func signInWithSSO() async {
    guard !busy else { return }
    busy = true
    errorMessage = nil
    notice = nil
    defer { busy = false }
    var challenge: SSOChallenge?
    do {
      let pending = try await client.beginSSO()
      challenge = pending
      let callback = try await browser.open(pending.url)
      try await client.completeSSO(callback: callback, challenge: pending)
      password = ""
    } catch {
      if let challenge { await client.cancelSSO(challenge) }
      if !(error is CancellationError) { show(error) }
    }
    await sync()
  }

  func changeServer(to endpoint: URL) async -> Bool {
    guard !busy else { return false }
    busy = true
    errorMessage = nil
    notice = nil
    defer { busy = false }
    do {
      try await client.changeServer(to: endpoint)
      await sync()
      UserDefaults.standard.set(self.endpoint.absoluteString, forKey: Self.endpointKey)
      page = .signIn
      password = ""
      email = ""
      name = ""
      capabilities = nil
      await loadCapabilities()
      return true
    } catch {
      show(error)
      await sync()
      return false
    }
  }

  func signOut() async {
    guard !busy else { return }
    busy = true
    errorMessage = nil
    notice = nil
    defer { busy = false }
    do {
      try await client.signOut()
    } catch {
      show(error)
    }
    password = ""
    page = .signIn
    await sync()
  }

  private func loadCapabilities() async {
    capabilities = nil
    do {
      capabilities = try await client.capabilities(refresh: true)
    } catch {
      show(error)
    }
  }

  private func sync() async {
    let snapshot = await client.snapshot()
    endpoint = snapshot.endpoint
    isSignedIn = snapshot.isSignedIn
    if snapshot.sessionEnded, lastHandledSessionGeneration != snapshot.generation {
      lastHandledSessionGeneration = snapshot.generation
      page = .signIn
      password = ""
      notice = "Your session ended. Sign in again."
    }
  }

  private func show(_ error: any Error) {
    errorMessage =
      (error as? any LocalizedError)?.errorDescription ?? "Couldn’t connect. Try again."
  }
}
