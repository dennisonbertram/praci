import Foundation
import Testing

@testable import RakazoCore

private let sessionOK = rpcResponse(#"{"user":{"id":"u1"}}"#)

private func bodyJSON(_ request: HTTPRequest) throws -> [String: Any] {
  let data = try #require(request.body)
  return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
}

@Test
func changePasswordSendsBothPasswordsAndKeepsTheNewSession() async throws {
  let transport = FakeTransport([sessionOK, rpcResponse(#"{"token":"tok-2","user":{"id":"u1"}}"#)])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  try await client.changePassword(current: "old-password", new: "new-password")
  let request = try #require(await transport.requests.last)
  #expect(request.url.path == "/api/auth/change-password")
  #expect(request.headers["authorization"] == "Bearer tok-1")
  let body = try bodyJSON(request)
  #expect(body["currentPassword"] as? String == "old-password")
  #expect(body["newPassword"] as? String == "new-password")
  #expect(body["revokeOtherSessions"] as? Bool == true)
  #expect(storage.session?.token == "tok-2")
  #expect((await client.snapshot()).isSignedIn)
}

@Test
func changePasswordWrongCurrentPasswordKeepsTheSessionAndShowsTheServerMessage() async throws {
  let transport = FakeTransport([
    sessionOK, rpcResponse(#"{"message":"Invalid password"}"#, status: 400),
  ])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  await #expect(throws: AccountRequestError(status: 400, message: "Invalid password")) {
    try await client.changePassword(current: "wrong", new: "new-password")
  }
  #expect(storage.session?.token == "tok-1")
  #expect((await client.snapshot()).isSignedIn)
}

@Test
func changePasswordRejectsShortNewPasswordWithoutASend() async throws {
  let transport = FakeTransport([sessionOK])
  let client = try await signedInClient(transport)
  await #expect(throws: AuthClientError.invalidPassword) {
    try await client.changePassword(current: "old-password", new: "short")
  }
  #expect(await transport.requests.count == 1)
}

@Test
func changePasswordWithoutAReplacementTokenEndsTheSession() async throws {
  let transport = FakeTransport([sessionOK, rpcResponse(#"{"status":true}"#)])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  await #expect(throws: AuthClientError.missingSession) {
    try await client.changePassword(current: "old-password", new: "new-password")
  }
  #expect(!(await client.snapshot()).isSignedIn)
  #expect(storage.session == nil)
}

@Test
func deleteAccountByPasswordSendsItAndForgetsTheSession() async throws {
  let transport = FakeTransport([sessionOK, rpcResponse(#"{"success":true}"#)])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  try await client.deleteAccount(.password("old-password"))
  let request = try #require(await transport.requests.last)
  #expect(request.url.path == "/api/auth/delete-user")
  #expect(try bodyJSON(request) as NSDictionary == ["password": "old-password"])
  #expect(!(await client.snapshot()).isSignedIn)
  #expect(storage.session == nil)
}

@Test
func deleteAccountByEmailedCodeSendsTheToken() async throws {
  let transport = FakeTransport([sessionOK, rpcResponse(#"{"success":true}"#)])
  let client = try await signedInClient(transport)
  try await client.deleteAccount(.emailedCode(" abc123 "))
  let request = try #require(await transport.requests.last)
  #expect(try bodyJSON(request) as NSDictionary == ["token": "abc123"])
}

@Test
func deleteAccountFailureKeepsTheSignedInSession() async throws {
  let transport = FakeTransport([
    sessionOK, rpcResponse(#"{"message":"Invalid password"}"#, status: 400),
  ])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  await #expect(throws: AccountRequestError(status: 400, message: "Invalid password")) {
    try await client.deleteAccount(.password("wrong"))
  }
  #expect((await client.snapshot()).isSignedIn)
  #expect(storage.session?.token == "tok-1")
}

@Test
func accountSecurityReadsTheSignInOptions() async throws {
  let transport = FakeTransport([
    sessionOK,
    rpcResponse(
      #"{"freshOidcAuth":false,"ssoLinked":false,"hasPassword":false,"#
        + #""passwordChangeEnabled":true,"emailDeletion":true,"sso":null}"#
    ),
    rpcResponse(#"{"success":true}"#),
  ])
  let client = try await signedInClient(transport)
  let security = try await client.accountSecurity()
  #expect(security == AccountSecurity(hasPassword: false, passwordChangeEnabled: true, emailDeletion: true))
  try await client.requestAccountDeletionCode()
}

/// Holds the change-password response until the test releases it.
private actor GatedTransport: HTTPTransport {
  private var responses: [HTTPResponse]
  private var gate: CheckedContinuation<HTTPResponse, Never>?
  private var gateWaiter: CheckedContinuation<Void, Never>?
  init(_ responses: [HTTPResponse]) { self.responses = responses }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    if request.url.path == "/api/auth/change-password" {
      gateWaiter?.resume()
      gateWaiter = nil
      return await withCheckedContinuation { gate = $0 }
    }
    return responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
  }

  func waitUntilHeld() async {
    if gate != nil { return }
    await withCheckedContinuation { gateWaiter = $0 }
  }

  func release(_ response: HTTPResponse) {
    gate?.resume(returning: response)
    gate = nil
  }
}

@Test
func anOldTokenRejectionDuringChangePasswordDoesNotDropTheReplacement() async throws {
  let transport = GatedTransport([sessionOK])
  let storage = FakeStorage(session: StoredSession(endpoint: testEndpoint, token: "tok-1"))
  let client = AuthClient(endpoint: testEndpoint, storage: storage, transport: transport)
  try await client.restore()
  let generation = (await client.snapshot()).generation
  let change = Task { try await client.changePassword(current: "old-password", new: "new-password") }
  await transport.waitUntilHeld()
  // The server already revoked tok-1, so a concurrent RPC gets 401.
  _ = await client.handleUnauthorized(generation: generation, hadSpace: false)
  await transport.release(rpcResponse(#"{"token":"tok-2"}"#))
  try await change.value
  #expect((await client.snapshot()).isSignedIn)
  #expect(storage.session?.token == "tok-2")
}

@Test
func signOutDuringChangePasswordStillWins() async throws {
  let transport = GatedTransport([sessionOK, rpcResponse("{}")])
  let storage = FakeStorage(session: StoredSession(endpoint: testEndpoint, token: "tok-1"))
  let client = AuthClient(endpoint: testEndpoint, storage: storage, transport: transport)
  try await client.restore()
  let change = Task { try await client.changePassword(current: "old-password", new: "new-password") }
  await transport.waitUntilHeld()
  try await client.signOut()
  await transport.release(rpcResponse(#"{"token":"tok-2"}"#))
  await #expect(throws: AuthClientError.staleRequest) { try await change.value }
  #expect(!(await client.snapshot()).isSignedIn)
  #expect(storage.session == nil)
}

@Test
func accountEndpoint401EndsTheSessionInsteadOfBecomingARequestError() async throws {
  for call in 0..<4 {
    let transport = FakeTransport([sessionOK, rpcResponse(#"{"message":"Unauthorized"}"#, status: 401)])
    let storage = FakeStorage()
    let client = try await signedInClient(transport, storage: storage)
    await #expect(throws: AuthClientError.unauthorized) {
      switch call {
      case 0: _ = try await client.accountSecurity()
      case 1: try await client.changePassword(current: "old-password", new: "new-password")
      case 2: try await client.requestAccountDeletionCode()
      default: _ = try await client.deleteAccount(.password("old-password"))
      }
    }
    #expect(!(await client.snapshot()).isSignedIn)
    #expect(storage.session == nil)
  }
}

@Test
func deleteAccountReportsLocalCleanupFailureSeparatelyFromServerSuccess() async throws {
  let transport = FakeTransport([sessionOK, rpcResponse(#"{"success":true}"#)])
  let storage = FakeStorage()
  let client = try await signedInClient(transport, storage: storage)
  storage.failWrites = true
  let outcome = try await client.deleteAccount(.password("old-password"))
  #expect(outcome == .deletedLocalCleanupFailed)
  #expect(!(await client.snapshot()).isSignedIn)
}
