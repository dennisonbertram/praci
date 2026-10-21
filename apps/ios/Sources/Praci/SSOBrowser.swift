import AuthenticationServices
import UIKit

@MainActor
final class SSOBrowser: NSObject, ASWebAuthenticationPresentationContextProviding {
  private var session: ASWebAuthenticationSession?
  private var continuation: CheckedContinuation<URL, any Error>?
  private var anchor: UIWindow?

  func open(_ url: URL) async throws -> URL {
    guard session == nil else { throw BrowserError.unavailable }
    anchor = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { $0.activationState == .foregroundActive }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
    guard anchor != nil else { throw BrowserError.unavailable }

    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        self.continuation = continuation
        let session = ASWebAuthenticationSession(
          url: url,
          callbackURLScheme: "rakazo"
        ) { [weak self] callback, error in
          Task { @MainActor in
            if let error = error as? ASWebAuthenticationSessionError,
              error.code == .canceledLogin
            {
              self?.finish(.failure(CancellationError()))
            } else if error != nil {
              self?.finish(.failure(BrowserError.unavailable))
            } else if let callback {
              self?.finish(.success(callback))
            } else {
              self?.finish(.failure(BrowserError.unavailable))
            }
          }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = true
        self.session = session
        if !session.start() { finish(.failure(BrowserError.unavailable)) }
      }
    } onCancel: {
      Task { @MainActor [weak self] in self?.cancel() }
    }
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    anchor ?? ASPresentationAnchor()
  }

  func cancel() {
    session?.cancel()
    finish(.failure(CancellationError()))
  }

  private func finish(_ result: Result<URL, any Error>) {
    let pending = continuation
    continuation = nil
    session = nil
    anchor = nil
    pending?.resume(with: result)
  }

  private enum BrowserError: LocalizedError {
    case unavailable

    var errorDescription: String? { "Couldn’t open sign-in. Try again." }
  }
}
