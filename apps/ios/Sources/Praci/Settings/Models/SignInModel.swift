import Foundation
import Observation
import RakazoAPI

struct BeginOAuthInput: Encodable, Sendable {
  var provider: String
  var label: String
  var modelId: String
}
struct LoginInput: Encodable, Sendable { var loginId: String }
struct LoginCodeInput: Encodable, Sendable {
  var loginId: String
  var code: String
}

/// Subscription sign-in: begin, wait for the provider to approve (polling every 2 s), then finish.
@MainActor
@Observable
final class SignInModel {
  enum Phase {
    case starting
    case waiting(ModelOAuthBegin)
    case failed(String)
    case done
  }

  var phase: Phase = .starting
  var submittingCode = false
  private var loginID: String?
  private var polling: Task<Void, Never>?

  func start(_ app: AppModel, provider: ModelProvider) async {
    guard loginID == nil, let first = provider.models.first else { return }
    phase = .starting
    do {
      let begin: ModelOAuthBegin = try await app.call(
        "models/beginOAuth",
        input: BeginOAuthInput(provider: provider.id, label: provider.name, modelId: first.id))
      loginID = begin.loginId
      phase = .waiting(begin)
      polling = Task { await poll(app, begin) }
    } catch {
      phase = .failed(settingsErrorText(error))
    }
  }

  func submit(_ app: AppModel, code: String) async {
    guard let loginID, !code.isEmpty else { return }
    submittingCode = true
    defer { submittingCode = false }
    do {
      let _: OKResult = try await app.call(
        "models/submitOAuthCode", input: LoginCodeInput(loginId: loginID, code: code))
    } catch {
      phase = .failed(settingsErrorText(error))
      await cancel(app)
    }
  }

  func cancel(_ app: AppModel) async {
    polling?.cancel()
    polling = nil
    guard let id = loginID else { return }
    loginID = nil
    let _: OKResult? = try? await app.call("models/cancelOAuth", input: LoginInput(loginId: id))
  }

  private func poll(_ app: AppModel, _ begin: ModelOAuthBegin) async {
    let deadline = Date.now.addingTimeInterval(TimeInterval(begin.expiresInSeconds))
    while !Task.isCancelled, Date.now < deadline {
      try? await Task.sleep(for: .seconds(2))
      if Task.isCancelled { return }
      do {
        let status: ModelOAuthStatus = try await app.call(
          "models/completeOAuth", input: LoginInput(loginId: begin.loginId))
        switch status.status {
        case "ready":
          let _: ModelCredential = try await app.call(
            "models/finishOAuth", input: LoginInput(loginId: begin.loginId))
          loginID = nil
          phase = .done
          return
        case "error":
          phase = .failed(status.error ?? "Sign-in did not finish.")
          loginID = nil
          return
        default:
          continue
        }
      } catch {
        phase = .failed(settingsErrorText(error))
        return
      }
    }
    if !Task.isCancelled {
      phase = .failed("Sign-in did not finish. The code expired.")
      await cancel(app)
    }
  }
}
