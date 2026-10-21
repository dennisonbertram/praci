import Foundation
import RakazoCore
import Testing

@Test
func normalizesTrustedOriginsAndRejectsPublicHTTP() throws {
  #expect(
    try ServerEndpoint.normalize("  app.example.com/rpc  ").absoluteString
      == "https://app.example.com")
  #expect(
    try ServerEndpoint.normalize("https://USER:pass@RAKAZO.EXAMPLE.COM:443/api").absoluteString
      == "https://rakazo.example.com")
  #expect(
    try ServerEndpoint.normalize("HTTPS://RAKAZO.EXAMPLE.COM:443/api").absoluteString
      == "https://rakazo.example.com")
  #expect(
    try ServerEndpoint.normalize("app.example.com:8443/rpc").absoluteString
      == "https://app.example.com:8443")
  #expect(
    try ServerEndpoint.normalize("http://192.168.1.20:3100/").absoluteString
      == "http://192.168.1.20:3100")
  #expect(
    try ServerEndpoint.normalize("http://100.127.255.255:80").absoluteString
      == "http://100.127.255.255")
  #expect(throws: ServerEndpoint.ValidationError.publicHTTP) {
    try ServerEndpoint.normalize("http://app.example.com")
  }
  #expect(throws: ServerEndpoint.ValidationError.publicHTTP) {
    try ServerEndpoint.normalize("http://100.128.0.1")
  }
  #expect(throws: ServerEndpoint.ValidationError.unsupportedScheme) {
    try ServerEndpoint.normalize("javascript:alert(1)")
  }
}

@Test
func rejectsMalformedAndOutOfRangePrivateAddressVectors() throws {
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerEndpoint.normalize("http://")
  }
  #expect(
    try ServerEndpoint.normalize("http://10.255.255.255").absoluteString == "http://10.255.255.255")
  #expect(try ServerEndpoint.normalize("http://172.16.0.1").absoluteString == "http://172.16.0.1")
  #expect(throws: ServerEndpoint.ValidationError.publicHTTP) {
    try ServerEndpoint.normalize("http://172.15.0.1")
  }
  #expect(throws: ServerEndpoint.ValidationError.publicHTTP) {
    try ServerEndpoint.normalize("http://192.168.1.999")
  }
  #expect(
    try ServerEndpoint.normalize("http://printer.local/path").absoluteString
      == "http://printer.local")
  #expect(try ServerEndpoint.normalize("http://[::1]:3100").absoluteString == "http://[::1]:3100")
}

@Test
func parsesStrictModernAndLegacyCapabilities() async throws {
  let legacy = TestTransport(responses: [
    try jsonResponse(["passwordReset": true, "resetUrl": "https://app.example/reset"])
  ])
  let legacyClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: legacy)
  let legacyCapabilities = try await legacyClient.capabilities()
  #expect(legacyCapabilities.passwordAuth)
  #expect(legacyCapabilities.sso == nil)

  let modern = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "checking"],
    ])
  ])
  let modernClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: modern)
  let modernCapabilities = try await modernClient.capabilities()
  #expect(!modernCapabilities.passwordAuth)
  #expect(modernCapabilities.sso?.availability == .checking)
}

@Test
func refreshCapabilitiesBypassesCachedAvailability() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "checking"],
    ]),
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "available"],
    ]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: transport)
  #expect(try await client.capabilities().sso?.availability == .checking)
  #expect(try await client.capabilities(refresh: true).sso?.availability == .available)
  #expect((await transport.calls).count == 2)
}

@Test
func malformedModernCapabilitiesDoNotDowngradeToLegacy() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordReset": true, "resetUrl": "https://app.example/reset", "sso": NSNull(),
    ])
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: transport)
  await #expect(throws: AuthClientError.invalidCapabilities) { try await client.capabilities() }
}

@Test
func rejectsIntegerAndNullCapabilityBooleans() async throws {
  let malformedCapabilities: [[String: Any]] = [
    [
      "passwordAuth": 1,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": NSNull(),
    ],
    [
      "passwordAuth": true,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": NSNull(),
      "billing": NSNull(),
    ],
    ["passwordReset": 1, "resetUrl": NSNull()],
  ]
  for capabilities in malformedCapabilities {
    let client = AuthClient(
      endpoint: ServerEndpoint.defaultURL,
      storage: TestStorage(),
      transport: TestTransport(responses: [try jsonResponse(capabilities)])
    )
    await #expect(throws: AuthClientError.invalidCapabilities) {
      try await client.capabilities()
    }
  }
}

@Test
func extractsJSONAndCookieSessionTokensAndRequiresExplicitSignupNull() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["session": ["token": "json-token"]]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  #expect(
    try await client.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "") == .signedIn)
  #expect(storage.session?.token == "json-token")

  let cookieStorage = TestStorage()
  let cookieTransport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    HTTPResponse(
      statusCode: 200,
      headers: [
        "set-cookie":
          "unrelated=ignore; Path=/, better-auth.session_token=token%2Ffrom-cookie; Path=/"
      ],
      body: Data("{}".utf8)
    ),
  ])
  let cookieClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: cookieStorage, transport: cookieTransport)
  #expect(
    try await cookieClient.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "") == .signedIn)
  #expect(cookieStorage.session?.token == "token/from-cookie")

  let signupStorage = TestStorage()
  let signupTransport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": NSNull()]),
  ])
  let signupClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: signupStorage, transport: signupTransport)
  #expect(
    try await signupClient.authenticate(
      .signUp, email: "ada@example.test", password: "password", name: "Ada")
      == .verificationRequired)
  #expect(signupStorage.session == nil)
}

@Test
func signupUsesUTF16PasswordLengthAndPreservesPasswordPayload() async throws {
  let password = "😀😀😀😀😀😀😀"
  #expect(password.count == 7)
  #expect(password.utf16.count >= 8)

  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": "signup-token"]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  #expect(
    try await client.authenticate(
      .signUp, email: "ada@example.test", password: password, name: "Ada") == .signedIn)
  #expect(storage.session?.token == "signup-token")
  let calls = await transport.calls
  let requestBody = try #require(calls.last?.body)
  let request = try #require(JSONSerialization.jsonObject(with: requestBody) as? [String: Any])
  #expect(request["password"] as? String == password)

  let shortPasswordTransport = TestTransport(responses: [])
  let shortPasswordClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: shortPasswordTransport)
  await #expect(throws: AuthClientError.invalidPassword) {
    try await shortPasswordClient.authenticate(
      .signUp, email: "ada@example.test", password: "1234567", name: "Ada")
  }
  #expect((await shortPasswordTransport.calls).isEmpty)
}

@Test
func malformedCookieHeaderIsTreatedAsMissingSession() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    HTTPResponse(statusCode: 200, headers: ["set-cookie": ";"], body: Data("{}".utf8)),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  await #expect(throws: AuthClientError.missingSession) {
    try await client.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "")
  }
  #expect(storage.session == nil)
}

@Test
func passwordActionsValidateInputAndServerCapability() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false, "passwordReset": true, "resetUrl": "https://app.example/reset",
      "sso": NSNull(),
    ]),
    HTTPResponse(statusCode: 200),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: transport)
  await #expect(throws: AuthClientError.invalidEmail) {
    try await client.authenticate(.signIn, email: "invalid", password: "password", name: "")
  }
  await #expect(throws: AuthClientError.passwordAuthUnavailable) {
    try await client.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "")
  }
  try await client.requestPasswordReset(email: "ada@example.test")
  let calls = await transport.calls
  #expect(calls[1].maximumResponseBytes == 64 * 1024)
  #expect(calls[1].headers["origin"] == "rakazo://")
  let resetBody = try #require(
    JSONSerialization.jsonObject(with: calls[1].body!) as? [String: String]
  )
  #expect(resetBody["redirectTo"] == "https://app.example/reset")
}

@Test
func staleAuthSuccessCannotReplaceANewerSession() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    nil,
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  let pending = Task {
    try await client.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "")
  }
  await transport.waitForPending()
  try await client.signOut()
  await transport.release(HTTPResponse(statusCode: 200, body: Data(#"{"token":"old-token"}"#.utf8)))
  await #expect(throws: AuthClientError.staleRequest) { try await pending.value }
  #expect(!(await client.snapshot()).isSignedIn)
}

@Test
func stale401CannotEndANewerSession() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": "first-token"]),
    nil,
    try jsonResponse(["token": "new-token"]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  _ = try await client.authenticate(
    .signIn, email: "ada@example.test", password: "password", name: "")
  let pending = Task { try await client.validateSession() }
  await transport.waitForPending()
  _ = try await client.authenticate(
    .signIn, email: "ada@example.test", password: "password", name: "")
  await transport.release(HTTPResponse(statusCode: 401))
  await #expect(throws: AuthClientError.staleRequest) { try await pending.value }
  #expect((await client.snapshot()).isSignedIn)
  #expect(storage.session?.token == "new-token")
}

@Test
func signOutResponseCannotClearANewerLogin() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": "first-token"]),
    nil,
    try jsonResponse(["token": "new-token"]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  _ = try await client.authenticate(
    .signIn, email: "ada@example.test", password: "password", name: "")
  let signOut = Task { try await client.signOut() }
  await transport.waitForPending()
  _ = try await client.authenticate(
    .signIn, email: "ada@example.test", password: "password", name: "")
  await transport.release(HTTPResponse(statusCode: 200))
  try await signOut.value
  #expect((await client.snapshot()).isSignedIn)
  #expect(storage.session?.token == "new-token")
}

@Test
func storageFailureHidesNewTokenAndTransientRestorePreservesStoredToken() async throws {
  let failingStorage = TestStorage()
  failingStorage.failSave = true
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": "not-stored"]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: failingStorage, transport: transport)
  await #expect(throws: AuthClientError.storageFailure) {
    try await client.authenticate(
      .signIn, email: "ada@example.test", password: "password", name: "")
  }
  #expect(!(await client.snapshot()).isSignedIn)
  #expect(!(await client.snapshot()).sessionEnded)

  let endpoint = ServerEndpoint.defaultURL
  let stored = StoredSession(endpoint: endpoint, token: "still-valid")
  let restoreStorage = TestStorage(session: stored)
  let restoreClient = AuthClient(
    endpoint: endpoint, storage: restoreStorage, transport: FailingTransport())
  await #expect(throws: AuthClientError.serverUnavailable) { try await restoreClient.restore() }
  #expect((await restoreClient.snapshot()).isSignedIn)
  #expect(restoreStorage.session == stored)
}

@Test
func restore401InvalidatesAndServerSwitchDoesNotSendOldBearer() async throws {
  let oldEndpoint = ServerEndpoint.defaultURL
  let storage = TestStorage(session: StoredSession(endpoint: oldEndpoint, token: "old-token"))
  let transport = TestTransport(responses: [HTTPResponse(statusCode: 401)])
  let client = AuthClient(endpoint: oldEndpoint, storage: storage, transport: transport)
  await #expect(throws: AuthClientError.unauthorized) { try await client.restore() }
  #expect(storage.session == nil)

  let switchStorage = TestStorage(session: StoredSession(endpoint: oldEndpoint, token: "old-token"))
  let switchTransport = TestTransport(responses: [
    HTTPResponse(statusCode: 200, body: Data(#"{"json":{"ok":true,"version":"0.1.0"}}"#.utf8))
  ])
  let switchClient = AuthClient(
    endpoint: oldEndpoint, storage: switchStorage, transport: switchTransport)
  try await switchClient.changeServer(to: URL(string: "https://new.example.test/path")!)
  let calls = await switchTransport.calls
  #expect(calls.count == 1)
  #expect(calls[0].maximumResponseBytes == 64 * 1024)
  #expect(calls[0].headers["origin"] == "rakazo://")
  #expect(calls[0].headers["authorization"] == nil)
  #expect((await switchClient.snapshot()).endpoint.absoluteString == "https://new.example.test")
  #expect(switchStorage.session == nil)
  #expect(!(await switchClient.snapshot()).sessionEnded)
}

@Test
func changeServerRejectsIntegerHealthBoolean() async throws {
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL,
    storage: TestStorage(),
    transport: TestTransport(responses: [try jsonResponse(["json": ["ok": 1]])])
  )
  await #expect(throws: AuthClientError.serverNotPraci) {
    try await client.changeServer(to: URL(string: "https://new.example.test")!)
  }
  #expect((await client.snapshot()).endpoint == ServerEndpoint.defaultURL)
}

@Test
func signOutClearsStoredSessionBeforeRestore() async throws {
  let endpoint = ServerEndpoint.defaultURL
  let storage = TestStorage(session: StoredSession(endpoint: endpoint, token: "stored-token"))
  let client = AuthClient(
    endpoint: endpoint, storage: storage, transport: TestTransport(responses: []))
  try await client.signOut()
  #expect(storage.session == nil)
  #expect(!(await client.snapshot()).sessionEnded)
}

@Test
func failedSessionDeletionFallsBackToAnEmptyStoredToken() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true, "passwordReset": false, "resetUrl": NSNull(), "sso": NSNull(),
    ]),
    try jsonResponse(["token": "session-token"]),
    HTTPResponse(statusCode: 200),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  _ = try await client.authenticate(
    .signIn, email: "ada@example.test", password: "password", name: "")
  storage.failClear = true
  try await client.signOut()
  #expect(!(await client.snapshot()).isSignedIn)
  #expect(storage.session?.token == "")
}

@Test
func ssoUsesProxyStateAndOnlyCommitsVerifiedCallback() async throws {
  let storage = TestStorage()
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "available"],
    ]),
    HTTPResponse(
      statusCode: 200,
      headers: ["set-cookie": "better-auth.oauth_state=state%2Fvalue; Path=/"],
      body: Data(#"{"url":"https://identity.example/authorize?state=abc"}"#.utf8)
    ),
    try jsonResponse(["user": ["id": "user-1"]]),
  ])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  let challenge = try await client.beginSSO()
  #expect(
    URLComponents(url: challenge.url, resolvingAgainstBaseURL: false)?.path
      == "/api/auth/expo-authorization-proxy")
  #expect(
    URLComponents(url: challenge.url, resolvingAgainstBaseURL: false)?.queryItems?.contains {
      $0.name == "oauthState" && $0.value == "state/value"
    } == true)
  let calls = await transport.calls
  let socialRequest = try #require(calls.dropFirst().first)
  let socialBody = try #require(socialRequest.body)
  let socialPayload = try #require(JSONSerialization.jsonObject(with: socialBody) as? [String: Any])
  let callbackString = try #require(socialPayload["callbackURL"] as? String)
  #expect(socialPayload["errorCallbackURL"] as? String == callbackString)
  let nativeAttempts = URLComponents(string: callbackString)?.queryItems?.filter {
    $0.name == "nativeAttempt"
  } ?? []
  #expect(nativeAttempts.count == 1)
  let callback = try callbackURL(
    from: socialRequest,
    adding: [
      URLQueryItem(name: "cookie", value: "better-auth.session_token=sso-token; Path=/")
    ])
  try await client.completeSSO(callback: callback, challenge: challenge)
  #expect(storage.session?.token == "sso-token")
}

@Test
func beginSSORejectsCapabilitiesFromAnOlderGeneration() async throws {
  let transport = TestTransport(responses: [nil])
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: transport)
  let beginSSO = Task { try await client.beginSSO() }
  await transport.waitForPending()
  try await client.signOut()
  let response = try jsonResponse([
    "passwordAuth": false,
    "passwordReset": false,
    "resetUrl": NSNull(),
    "sso": ["name": "Example", "availability": "available"],
  ])
  await transport.release(response)
  await #expect(throws: AuthClientError.staleRequest) { try await beginSSO.value }
  #expect((await transport.calls).count == 1)
}

@Test
func canceledSSOCallbackCannotSaveToken() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "available"],
    ]),
    try jsonResponse(["url": "https://identity.example/authorize?state=abc"]),
  ])
  let storage = TestStorage()
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  let challenge = try await client.beginSSO()
  let calls = await transport.calls
  let callback = try callbackURL(
    from: try #require(calls.dropFirst().first),
    adding: [
      URLQueryItem(name: "cookie", value: "better-auth.session_token=bad; Path=/")
    ])
  await client.cancelSSO(challenge)
  await #expect(throws: AuthClientError.staleRequest) {
    try await client.completeSSO(callback: callback, challenge: challenge)
  }
  #expect(storage.session == nil)
}

@Test
func rejectsSSOCallbackWithWrongHostOrError() async throws {
  for invalidity in ["wrong-host", "port", "error"] {
    let transport = TestTransport(responses: [
      try jsonResponse([
        "passwordAuth": false,
        "passwordReset": false,
        "resetUrl": NSNull(),
        "sso": ["name": "Example", "availability": "available"],
      ]),
      try jsonResponse(["url": "https://identity.example/authorize?state=abc"]),
    ])
    let storage = TestStorage()
    let client = AuthClient(
      endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
    let challenge = try await client.beginSSO()
    let calls = await transport.calls
    let validCallback = try callbackURL(
      from: try #require(calls.dropFirst().first),
      adding: [
        URLQueryItem(name: "cookie", value: "better-auth.session_token=bad; Path=/")
      ])
    var components = try #require(
      URLComponents(url: validCallback, resolvingAgainstBaseURL: false))
    switch invalidity {
    case "wrong-host":
      components.host = "wrong-host"
    case "port":
      components.port = 3100
    case "error":
      components.queryItems?.append(URLQueryItem(name: "error", value: "access_denied"))
    default:
      break
    }
    let callback = try #require(components.url)
    await #expect(throws: AuthClientError.invalidCallback) {
      try await client.completeSSO(callback: callback, challenge: challenge)
    }
    #expect(storage.session == nil)
    #expect((await transport.calls).count == 2)
  }
}

@Test
func rejectsMissingWrongOrDuplicateSSOAttemptNonceBeforeSessionValidation() async throws {
  for invalidity in ["missing", "wrong", "duplicate"] {
    let transport = TestTransport(responses: [
      try jsonResponse([
        "passwordAuth": false,
        "passwordReset": false,
        "resetUrl": NSNull(),
        "sso": ["name": "Example", "availability": "available"],
      ]),
      try jsonResponse(["url": "https://identity.example/authorize?state=abc"]),
      try jsonResponse(["user": ["id": "user-1"]]),
    ])
    let storage = TestStorage()
    let client = AuthClient(
      endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
    let challenge = try await client.beginSSO()
    let calls = await transport.calls
    let socialRequest = try #require(calls.dropFirst().first)
    var components = try #require(
      URLComponents(
        url: try callbackURL(from: socialRequest),
        resolvingAgainstBaseURL: false))
    var queryItems = components.queryItems ?? []
    let attemptIndex = try #require(queryItems.firstIndex { $0.name == "nativeAttempt" })
    switch invalidity {
    case "missing":
      queryItems.remove(at: attemptIndex)
    case "wrong":
      queryItems[attemptIndex].value = "not-this-attempt"
    case "duplicate":
      queryItems.append(queryItems[attemptIndex])
    default:
      break
    }
    queryItems.append(
      URLQueryItem(name: "cookie", value: "better-auth.session_token=sso-token; Path=/"))
    components.queryItems = queryItems
    let callback = try #require(components.url)
    await #expect(throws: AuthClientError.invalidCallback) {
      try await client.completeSSO(callback: callback, challenge: challenge)
    }
    #expect(storage.session == nil)
    #expect((await transport.calls).count == 2)
  }
}

@Test
func rejectsPreviousSSOAttemptNonce() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "available"],
    ]),
    try jsonResponse(["url": "https://identity.example/authorize?state=first"]),
    try jsonResponse(["url": "https://identity.example/authorize?state=second"]),
    try jsonResponse(["user": ["id": "user-1"]]),
  ])
  let storage = TestStorage()
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  let firstChallenge = try await client.beginSSO()
  let firstCalls = await transport.calls
  let firstRequest = try #require(firstCalls.dropFirst().first)
  let firstCallback = try callbackURL(from: firstRequest)
  let firstAttempt = try #require(
    URLComponents(url: firstCallback, resolvingAgainstBaseURL: false)?.queryItems?
      .first(where: { $0.name == "nativeAttempt" })?.value)
  await client.cancelSSO(firstChallenge)

  let secondChallenge = try await client.beginSSO()
  let calls = await transport.calls
  let secondRequest = try #require(calls.last)
  var components = try #require(
    URLComponents(
      url: try callbackURL(from: secondRequest),
      resolvingAgainstBaseURL: false))
  #expect(
    components.queryItems?.first(where: { $0.name == "nativeAttempt" })?.value != firstAttempt)
  var queryItems = (components.queryItems ?? []).filter { $0.name != "nativeAttempt" }
  queryItems.append(URLQueryItem(name: "nativeAttempt", value: firstAttempt))
  queryItems.append(
    URLQueryItem(name: "cookie", value: "better-auth.session_token=sso-token; Path=/"))
  components.queryItems = queryItems
  let callback = try #require(components.url)
  await #expect(throws: AuthClientError.invalidCallback) {
    try await client.completeSSO(callback: callback, challenge: secondChallenge)
  }
  #expect(storage.session == nil)
  #expect((await transport.calls).count == 3)
}

@Test
func changingServerInvalidatesAnOutstandingSSOChallenge() async throws {
  let transport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": false,
      "passwordReset": false,
      "resetUrl": NSNull(),
      "sso": ["name": "Example", "availability": "available"],
    ]),
    try jsonResponse(["url": "https://identity.example/authorize?state=abc"]),
    HTTPResponse(statusCode: 200, body: Data(#"{"json":{"ok":true}}"#.utf8)),
  ])
  let storage = TestStorage()
  let client = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: storage, transport: transport)
  let challenge = try await client.beginSSO()
  let calls = await transport.calls
  let callback = try callbackURL(
    from: try #require(calls.dropFirst().first),
    adding: [
      URLQueryItem(name: "cookie", value: "better-auth.session_token=bad; Path=/")
    ])
  try await client.changeServer(to: URL(string: "https://other.example.test")!)
  await #expect(throws: AuthClientError.staleRequest) {
    try await client.completeSSO(callback: callback, challenge: challenge)
  }
  #expect(storage.session == nil)
}

@Test
func passwordResetAcceptsTrustedLocalHTTPButRejectsPublicHTTP() async throws {
  let localResetURL = "http://192.168.1.20:3100/reset"
  let localTransport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true,
      "passwordReset": true,
      "resetUrl": localResetURL,
      "sso": NSNull(),
    ]),
    HTTPResponse(statusCode: 200),
  ])
  let localClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: localTransport)
  try await localClient.requestPasswordReset(email: "ada@example.test")
  let localCalls = await localTransport.calls
  let requestBody = try #require(localCalls.last?.body)
  let requestObject = try #require(
    JSONSerialization.jsonObject(with: requestBody) as? [String: Any])
  #expect(requestObject["redirectTo"] as? String == localResetURL)

  let publicTransport = TestTransport(responses: [
    try jsonResponse([
      "passwordAuth": true,
      "passwordReset": true,
      "resetUrl": "http://public.example/reset",
      "sso": NSNull(),
    ])
  ])
  let publicClient = AuthClient(
    endpoint: ServerEndpoint.defaultURL, storage: TestStorage(), transport: publicTransport)
  await #expect(throws: AuthClientError.passwordResetUnavailable) {
    try await publicClient.requestPasswordReset(email: "ada@example.test")
  }
  #expect((await publicTransport.calls).count == 1)
}

private final class TestStorage: SessionStorage, @unchecked Sendable {
  var session: StoredSession?
  var failSave = false
  var failClear = false

  init(session: StoredSession? = nil) {
    self.session = session
  }

  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws {
    if failSave { throw TestFailure.storage }
    self.session = session
  }
  func clear() throws {
    if failClear { throw TestFailure.storage }
    session = nil
  }
}

private actor TestTransport: HTTPTransport {
  struct Call: Sendable {
    let url: URL
    let method: String
    let headers: [String: String]
    let body: Data?
    let maximumResponseBytes: Int
  }

  private var responses: [HTTPResponse?]
  private var pending: [CheckedContinuation<HTTPResponse, Error>] = []
  private var pendingWaiters: [CheckedContinuation<Void, Never>] = []
  private(set) var calls: [Call] = []

  init(responses: [HTTPResponse?]) {
    self.responses = responses
  }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    calls.append(
      Call(
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
        maximumResponseBytes: maximumResponseBytes
      )
    )
    if !responses.isEmpty {
      let response = responses.removeFirst()
      if let response { return response }
    }
    return try await withCheckedThrowingContinuation {
      pending.append($0)
      for waiter in pendingWaiters {
        waiter.resume()
      }
      pendingWaiters.removeAll()
    }
  }

  func waitForPending() async {
    if !pending.isEmpty { return }
    await withCheckedContinuation { pendingWaiters.append($0) }
  }

  func release(_ response: HTTPResponse) {
    guard !pending.isEmpty else { return }
    pending.removeFirst().resume(returning: response)
  }
}

private struct FailingTransport: HTTPTransport {
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    throw URLError(.notConnectedToInternet)
  }
}

private enum TestFailure: Error {
  case storage
}

private func jsonResponse(_ object: Any, status: Int = 200) throws -> HTTPResponse {
  HTTPResponse(
    statusCode: status,
    body: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
  )
}

private func callbackURL(
  from call: TestTransport.Call,
  adding queryItems: [URLQueryItem] = []
) throws -> URL {
  let body = try #require(call.body)
  let payload = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
  let callbackString = try #require(payload["callbackURL"] as? String)
  var components = try #require(URLComponents(string: callbackString))
  components.queryItems = (components.queryItems ?? []) + queryItems
  return try #require(components.url)
}
