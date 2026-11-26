import Foundation
import Observation
import RakazoAPI
import RakazoCore

/// The server's message for a failed call, or the default line when it has none.
func settingsErrorText(_ error: any Error) -> String {
  if let rpc = error as? RPCError { return rpc.errorDescription ?? "Couldn’t continue. Try again." }
  return (error as? LocalizedError)?.errorDescription ?? "Couldn’t continue. Try again."
}

struct ModelsSnapshot: Sendable {
  var credentials: [ModelCredential]
  var providers: [ModelProvider]

  var defaultCredential: ModelCredential? { credentials.first { $0.isDefault } }

  func option(provider: String, modelID: String?) -> ModelOption? {
    providers.first { $0.id == provider }?.models.first { $0.id == modelID }
  }
}

struct ConnectInput: Encodable, Sendable {
  var provider: String
  var apiKey: String?
  var label: String?
  var modelId: String?
  var baseUrl: String?
}

struct DefaultModelInput: Encodable, Sendable {
  var provider: String
  var modelId: String
  var thinkingLevel: String?

  enum CodingKeys: String, CodingKey { case provider, modelId, thinkingLevel }

  // The server accepts null to clear the thinking level; it must be sent explicitly.
  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(provider, forKey: .provider)
    try container.encode(modelId, forKey: .modelId)
    try container.encode(thinkingLevel, forKey: .thinkingLevel)
  }
}

struct ProviderInput: Encodable, Sendable { var provider: String }

@MainActor
@Observable
final class ModelsModel {
  var state: Loadable<ModelsSnapshot> = .idle
  var notice: String?
  var error: String?

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      async let credentials: [ModelCredential] = app.call("models/credentials")
      async let catalog: [ModelOption] = app.call("models/list", timeout: 20)
      state = .loaded(try await ModelsSnapshot(credentials: credentials, providers: catalog.providers))
    } catch {
      state = .failed(settingsErrorText(error))
    }
  }

  func setDefault(_ app: AppModel, provider: String, modelID: String, thinking: String?) async {
    error = nil
    do {
      let _: OKResult = try await app.call(
        "models/setDefault",
        input: DefaultModelInput(provider: provider, modelId: modelID, thinkingLevel: thinking))
      await load(app)
    } catch {
      self.error = settingsErrorText(error)
    }
  }

  func disconnect(_ app: AppModel, provider: String) async -> Bool {
    error = nil
    do {
      let _: OKResult = try await app.call("models/disconnect", input: ProviderInput(provider: provider))
      await load(app)
      return true
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }

  /// Sends the key straight to the server. The key is never stored on the device.
  func connect(_ app: AppModel, _ input: ConnectInput) async -> Bool {
    error = nil
    do {
      let _: ModelCredential = try await app.call("models/connect", input: input)
      await load(app)
      return true
    } catch let rpc as RPCError {
      if case .server(let code, _, _) = rpc, code == "BAD_REQUEST" {
        error = "That key was not accepted. Check it and try again."
      } else {
        error = settingsErrorText(rpc)
      }
      return false
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }
}
