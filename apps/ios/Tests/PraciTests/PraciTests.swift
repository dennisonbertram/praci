import Foundation
import AuthenticationServices
import RakazoCore
import Testing
import UIKit

@testable import Praci

@Test
func keychainStoresAndClearsAnOriginBoundSession() throws {
  let storage = KeychainSessionStorage(service: "com.rakazo.app.tests.\(UUID().uuidString)")
  defer { try? storage.clear() }
  let endpoint = try ServerEndpoint.normalize("https://praci.example.com")

  #expect(try storage.load() == nil)
  try storage.save(StoredSession(endpoint: endpoint, token: "synthetic-test-token"))
  #expect(try storage.load()?.endpoint == endpoint)
  #expect(try storage.load()?.token == "synthetic-test-token")
  try storage.save(StoredSession(endpoint: endpoint, token: "synthetic-replacement-token"))
  #expect(try storage.load()?.token == "synthetic-replacement-token")
  try storage.clear()
  #expect(try storage.load() == nil)
  try storage.clear()
}

@Test
@MainActor
func lateCallbackFromCanceledBrowserAttemptCannotFinishNewAttempt() async throws {
  let factory = BrowserTestSessionFactory()
  let browser = SSOBrowser(sessionFactory: factory, anchorProvider: { UIWindow() })
  let firstURL = URL(string: "https://identity.example/first")!
  let firstTask = Task { @MainActor in try await browser.open(firstURL) }
  let firstSession = await factory.waitForSession(at: 0)
  let firstAttempt = try #require(browser.activeAttemptID)
  browser.cancel(for: firstAttempt)
  await #expect(throws: CancellationError.self) {
    try await firstTask.value
  }

  let secondURL = URL(string: "https://identity.example/second")!
  let secondTask = Task { @MainActor in try await browser.open(secondURL) }
  let secondSession = await factory.waitForSession(at: 1)
  let callbackFromFirstAttempt = URL(string: "rakazo://sign-in?attempt=first")!
  firstSession.complete(callbackFromFirstAttempt)
  await Task.yield()
  let callbackFromSecondAttempt = URL(string: "rakazo://sign-in?attempt=second")!
  secondSession.complete(callbackFromSecondAttempt)
  #expect(try await secondTask.value == callbackFromSecondAttempt)
}

@Test
@MainActor
func staleBrowserCancellationTokenCannotCancelNewAttempt() async throws {
  let factory = BrowserTestSessionFactory()
  let browser = SSOBrowser(sessionFactory: factory, anchorProvider: { UIWindow() })
  let firstTask = Task { @MainActor in
    try await browser.open(URL(string: "https://identity.example/first")!)
  }
  let firstSession = await factory.waitForSession(at: 0)
  let firstAttempt = try #require(browser.activeAttemptID)
  browser.cancel(for: firstAttempt)
  await #expect(throws: CancellationError.self) {
    try await firstTask.value
  }

  let secondTask = Task { @MainActor in
    try await browser.open(URL(string: "https://identity.example/second")!)
  }
  let secondSession = await factory.waitForSession(at: 1)
  browser.cancel(for: firstAttempt)
  #expect(secondSession.cancelCount == 0)
  let callback = URL(string: "rakazo://sign-in?attempt=second")!
  secondSession.complete(callback)
  #expect(try await secondTask.value == callback)
  #expect(firstSession.cancelCount == 1)
}

@MainActor
private final class BrowserTestSession: SSOBrowserSession {
  var presentationContextProvider: (any ASWebAuthenticationPresentationContextProviding)?
  var prefersEphemeralWebBrowserSession = false
  private let completion: (URL?, Error?) -> Void
  private(set) var cancelCount = 0

  init(completion: @escaping (URL?, Error?) -> Void) {
    self.completion = completion
  }

  func start() -> Bool {
    true
  }

  func cancel() {
    cancelCount += 1
  }

  func complete(_ callback: URL) {
    completion(callback, nil)
  }
}

@MainActor
private final class BrowserTestSessionFactory: SSOBrowserSessionFactory {
  private(set) var sessions: [BrowserTestSession] = []

  func makeSession(
    url: URL,
    callbackURLScheme: String,
    completion: @escaping (URL?, Error?) -> Void
  ) -> any SSOBrowserSession {
    let session = BrowserTestSession(completion: completion)
    sessions.append(session)
    return session
  }

  func waitForSession(at index: Int) async -> BrowserTestSession {
    while sessions.count <= index {
      await Task.yield()
    }
    return sessions[index]
  }
}
