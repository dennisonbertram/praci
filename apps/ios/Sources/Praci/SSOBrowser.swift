import AuthenticationServices
import UIKit

@MainActor
protocol SSOBrowserSession: AnyObject {
  var presentationContextProvider: (any ASWebAuthenticationPresentationContextProviding)? {
    get set
  }
  var prefersEphemeralWebBrowserSession: Bool { get set }
  func start() -> Bool
  func cancel()
}

@MainActor
protocol SSOBrowserSessionFactory {
  func makeSession(
    url: URL,
    callbackURLScheme: String,
    completion: @escaping (URL?, Error?) -> Void
  ) -> any SSOBrowserSession
}

@MainActor
private final class ASWebAuthenticationSessionAdapter: SSOBrowserSession {
  private let session: ASWebAuthenticationSession

  init(
    url: URL,
    callbackURLScheme: String,
    completion: @escaping (URL?, Error?) -> Void
  ) {
    session = ASWebAuthenticationSession(
      url: url,
      callbackURLScheme: callbackURLScheme,
      completionHandler: completion
    )
  }

  var presentationContextProvider: (any ASWebAuthenticationPresentationContextProviding)? {
    get { session.presentationContextProvider }
    set { session.presentationContextProvider = newValue }
  }

  var prefersEphemeralWebBrowserSession: Bool {
    get { session.prefersEphemeralWebBrowserSession }
    set { session.prefersEphemeralWebBrowserSession = newValue }
  }

  func start() -> Bool {
    session.start()
  }

  func cancel() {
    session.cancel()
  }
}

@MainActor
final class ASWebAuthenticationSessionFactory: SSOBrowserSessionFactory {
  func makeSession(
    url: URL,
    callbackURLScheme: String,
    completion: @escaping (URL?, Error?) -> Void
  ) -> any SSOBrowserSession {
    ASWebAuthenticationSessionAdapter(
      url: url,
      callbackURLScheme: callbackURLScheme,
      completion: completion
    )
  }
}

@MainActor
final class SSOBrowser: NSObject, ASWebAuthenticationPresentationContextProviding {
  private let sessionFactory: any SSOBrowserSessionFactory
  private let anchorProvider: @MainActor () -> UIWindow?
  private var session: (any SSOBrowserSession)?
  private var continuation: CheckedContinuation<URL, any Error>?
  private var anchor: UIWindow?
  private(set) var activeAttemptID: UUID?

  init(
    sessionFactory: any SSOBrowserSessionFactory = ASWebAuthenticationSessionFactory(),
    anchorProvider: @escaping @MainActor () -> UIWindow? = SSOBrowser.defaultAnchor
  ) {
    self.sessionFactory = sessionFactory
    self.anchorProvider = anchorProvider
    super.init()
  }

  func open(_ url: URL) async throws -> URL {
    guard !Task.isCancelled else { throw CancellationError() }
    guard session == nil else { throw BrowserError.unavailable }
    anchor = anchorProvider()
    guard anchor != nil else { throw BrowserError.unavailable }
    let attemptID = UUID()
    activeAttemptID = attemptID

    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        self.continuation = continuation
        if Task.isCancelled {
          self.finish(.failure(CancellationError()), attemptID: attemptID)
          return
        }
        let session = self.sessionFactory.makeSession(
          url: url,
          callbackURLScheme: "rakazo"
        ) { [weak self] callback, error in
          Task { @MainActor [weak self] in
            guard let self else { return }
            if let error = error as? ASWebAuthenticationSessionError,
              error.code == .canceledLogin
            {
              self.finish(.failure(CancellationError()), attemptID: attemptID)
            } else if error != nil {
              self.finish(.failure(BrowserError.unavailable), attemptID: attemptID)
            } else if let callback {
              self.finish(.success(callback), attemptID: attemptID)
            } else {
              self.finish(.failure(BrowserError.unavailable), attemptID: attemptID)
            }
          }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = true
        self.session = session
        if Task.isCancelled {
          self.cancel(for: attemptID)
        } else if !session.start() {
          self.finish(.failure(BrowserError.unavailable), attemptID: attemptID)
        }
      }
    } onCancel: {
      Task { @MainActor [weak self] in
        self?.cancel(for: attemptID)
      }
    }
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    anchor ?? ASPresentationAnchor()
  }

  func cancel() {
    guard let attemptID = activeAttemptID else { return }
    cancel(for: attemptID)
  }

  func cancel(for attemptID: UUID) {
    guard activeAttemptID == attemptID else { return }
    session?.cancel()
    finish(.failure(CancellationError()), attemptID: attemptID)
  }

  private func finish(_ result: Result<URL, any Error>, attemptID: UUID) {
    guard activeAttemptID == attemptID else { return }
    let pending = continuation
    continuation = nil
    session = nil
    anchor = nil
    activeAttemptID = nil
    pending?.resume(with: result)
  }

  static func defaultAnchor() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { $0.activationState == .foregroundActive }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
  }

  private enum BrowserError: LocalizedError {
    case unavailable

    var errorDescription: String? { "Couldn’t open sign-in. Try again." }
  }
}
