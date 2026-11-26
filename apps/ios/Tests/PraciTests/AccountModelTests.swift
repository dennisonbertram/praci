import Foundation
import RakazoCore
import Testing

@testable import Praci

private final class Storage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  var failWrites = false
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws {
    if failWrites { throw AuthClientError.storageFailure }
    self.session = session
  }
  func clear() throws {
    if failWrites { throw AuthClientError.storageFailure }
    session = nil
  }
}

private actor Replies: HTTPTransport {
  private var responses: [HTTPResponse]
  init(_ responses: [HTTPResponse]) { self.responses = responses }
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
  }
}

private let endpoint = URL(string: "http://127.0.0.1:3301")!
private func reply(_ json: String, _ status: Int = 200) -> HTTPResponse {
  HTTPResponse(statusCode: status, body: Data(json.utf8))
}

@MainActor
private func makeApp(_ responses: [HTTPResponse]) async throws -> (AppModel, Storage) {
  let transport = Replies([reply(#"{"user":{"id":"u1"}}"#)] + responses)
  let storage = Storage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  let app = AppModel(
    authentication: authentication, transport: transport,
    defaults: UserDefaults(suiteName: UUID().uuidString)!)
  return (app, storage)
}

private let form = ChangePasswordForm(current: "old-password", new: "new-password", confirmation: "new-password")

@Test
@MainActor
func changePasswordWithoutAReplacementTokenSignsTheUIOut() async throws {
  let (app, _) = try await makeApp([reply(#"{"status":true}"#)])
  #expect(app.authentication.isSignedIn)
  #expect(await AccountModel().changePassword(form, app) == false)
  #expect(!app.authentication.isSignedIn)
}

@Test
@MainActor
func aKeychainFailureWhileAdoptingTheNewTokenSignsTheUIOut() async throws {
  let (app, storage) = try await makeApp([reply(#"{"token":"tok-2"}"#)])
  storage.failWrites = true
  #expect(await AccountModel().changePassword(form, app) == false)
  #expect(!app.authentication.isSignedIn)
}

@Test
@MainActor
func aRejectedSessionOnAnAccountCallSignsTheUIOut() async throws {
  let (app, _) = try await makeApp([reply(#"{"message":"Unauthorized"}"#, 401)])
  let model = AccountModel()
  await model.load(app)
  #expect(!app.authentication.isSignedIn)
}

@Test
@MainActor
func deletionStillResetsAndAnnouncesWhenLocalCleanupFails() async throws {
  let (app, storage) = try await makeApp([reply(#"{"success":true}"#)])
  storage.failWrites = true
  #expect(await AccountModel().delete(.password("old-password"), app) == true)
  #expect(!app.authentication.isSignedIn)
  #expect(app.authentication.notice == "Your account was deleted")
}

@Test
@MainActor
func deletionCodesLoseWhitespaceFromPasting() {
  #expect(AccountModel.cleanCode("  0a1b2c3d\n4e5f 6a7b\t") == "0a1b2c3d4e5f6a7b")
}
