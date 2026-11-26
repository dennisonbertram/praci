import Foundation
import RakazoAPI
import Testing

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesModelCatalogAndCredentials() throws {
  let options = try decode([ModelOption].self, "models-list")
  #expect(options.count == 3)
  #expect(options[0].supportsSignIn && options[0].supportsKey)
  #expect(!options[1].supportsSignIn)
  #expect(options[2].placeholder)
  let credentials = try decode([ModelCredential].self, "models-credentials")
  #expect(credentials[0].isDefault && credentials[0].modelId == "model-a")
}

@Test
func decodesOAuthBeginAndStatus() throws {
  let begin = try decode(ModelOAuthBegin.self, "models-oauth-begin")
  #expect(begin.userCode == "ABCD-1234" && !begin.needsPastedCode)
  let status = try decode(ModelOAuthStatus.self, "models-oauth-status")
  #expect(status.status == "error" && status.error == "The code expired.")
}

@Test
func decodesConnections() throws {
  let list = try decode([Connection].self, "connections-list")
  #expect(list[0].isConnected && list[0].writesEnabled)
  let catalog = try decode([ConnectorEntry].self, "connections-catalog")
  #expect(catalog[0].connected && catalog[1].description == nil)
  #expect(try decode(ConnectionBegin.self, "connections-begin").authorizationUrl == nil)
}

@Test
func decodesApprovalRulesAndAutoReview() throws {
  let rules = try decode([ApprovalRule].self, "approval-rules-list")
  #expect(rules[0].matchKind == "category" && rules[0].botId == nil)
  let review = try decode(AutoReview.self, "auto-review-get")
  #expect(!review.enabled && review.checkerAvailable)
}

@Test
func groupsModelsByProviderAndLeadsWithTheCommonSubscription() throws {
  let providers = try decode([ModelOption].self, "models-list").providers
  #expect(providers.map(\.id) == ["example-ai", "keyed-ai", "openai-compatible"])
  #expect(providers[2].isLocalServer)
  #expect(providers.signInProviders.map(\.id) == ["example-ai"])
  let codex = ModelProvider(id: "openai-codex", name: "Codex", models: providers[0].models)
  #expect((providers + [codex]).signInProviders.first?.id == "openai-codex")
}
