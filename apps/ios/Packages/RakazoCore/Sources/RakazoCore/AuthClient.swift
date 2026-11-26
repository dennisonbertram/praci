// The auth client keeps every endpoint call in this one file.
// swiftlint:disable file_length
import Foundation
import CoreFoundation

public struct StoredSession: Codable, Sendable, Equatable {
  public let endpoint: URL
  public let token: String

  public init(endpoint: URL, token: String) {
    self.endpoint = endpoint
    self.token = token
  }
}

public protocol SessionStorage: Sendable {
  func load() throws -> StoredSession?
  func save(_ session: StoredSession) throws
  func clear() throws
}

public struct AuthSnapshot: Sendable, Equatable {
  public let endpoint: URL
  public let isSignedIn: Bool
  public let generation: UInt64
  public let sessionEnded: Bool

  public init(endpoint: URL, isSignedIn: Bool, generation: UInt64, sessionEnded: Bool) {
    self.endpoint = endpoint
    self.isSignedIn = isSignedIn
    self.generation = generation
    self.sessionEnded = sessionEnded
  }
}

public struct SSOProvider: Sendable, Equatable {
  public enum Availability: String, Sendable, Equatable {
    case available
    case unavailable
    case checking
  }

  public let name: String
  public let availability: Availability

  public init(name: String, availability: Availability) {
    self.name = name
    self.availability = availability
  }
}

public struct AuthCapabilities: Sendable, Equatable {
  public let passwordAuth: Bool
  public let passwordReset: Bool
  public let resetURL: URL?
  public let sso: SSOProvider?
  public let billing: Bool?

  public init(
    passwordAuth: Bool,
    passwordReset: Bool,
    resetURL: URL?,
    sso: SSOProvider?,
    billing: Bool? = nil
  ) {
    self.passwordAuth = passwordAuth
    self.passwordReset = passwordReset
    self.resetURL = resetURL
    self.sso = sso
    self.billing = billing
  }
}

public enum EmailAuthAction: Sendable, Equatable {
  case signIn
  case signUp
}

public enum EmailAuthResult: Sendable, Equatable {
  case signedIn
  case verificationRequired
}

public struct SSOChallenge: Sendable, Equatable {
  public let url: URL
  let endpoint: URL
  let generation: UInt64
  let attemptID: UUID
}

public enum AuthClientError: LocalizedError, Sendable, Equatable {
  case invalidEndpoint
  case invalidResponse
  case serverUnavailable
  case serverNotPraci
  case httpStatus(Int)
  case unauthorized
  case invalidCapabilities
  case passwordAuthUnavailable
  case passwordResetUnavailable
  case ssoUnavailable
  case ssoAlreadyInProgress
  case invalidEmail
  case invalidPassword
  case invalidName
  case missingSession
  case invalidCallback
  case invalidSSOResponse
  case staleRequest
  case storageFailure

  public var errorDescription: String? {
    switch self {
    case .invalidEndpoint:
      "Enter a valid server address."
    case .invalidResponse, .invalidCapabilities, .invalidSSOResponse:
      "The server returned an invalid response."
    case .serverUnavailable:
      "Couldn’t reach the server. Try again."
    case .serverNotPraci:
      "That URL did not look like a Praci server."
    case .httpStatus(let status):
      status == 401 ? "Your session is no longer valid." : "Couldn’t continue. Try again."
    case .unauthorized:
      "Your session is no longer valid."
    case .passwordAuthUnavailable:
      "Password sign-in is unavailable on this server."
    case .passwordResetUnavailable:
      "Password reset is unavailable on this server."
    case .ssoUnavailable:
      "Single sign-on is unavailable on this server."
    case .ssoAlreadyInProgress:
      "A sign-in attempt is already in progress."
    case .invalidEmail:
      "Enter a valid email."
    case .invalidPassword:
      "Enter a valid password."
    case .invalidName:
      "Enter your name."
    case .missingSession:
      "Sign-in did not return a session."
    case .invalidCallback:
      "Couldn’t continue sign-in."
    case .staleRequest:
      "The server or session changed. Try again."
    case .storageFailure:
      "Couldn’t update the local session."
    }
  }
}

/// `GET /api/auth/account-security`: which ways this account can prove itself.
public struct AccountSecurity: Sendable, Equatable {
  public let hasPassword: Bool
  public let passwordChangeEnabled: Bool
  /// The server can email a deletion code.
  public let emailDeletion: Bool

  public init(hasPassword: Bool, passwordChangeEnabled: Bool, emailDeletion: Bool) {
    self.hasPassword = hasPassword
    self.passwordChangeEnabled = passwordChangeEnabled
    self.emailDeletion = emailDeletion
  }
}

/// What the person typed to confirm deleting the account.
public enum AccountDeletionProof: Sendable, Equatable {
  case password(String)
  case emailedCode(String)
}

/// Deleting an account succeeds on the server first; clearing this device can still fail.
public enum AccountDeletionOutcome: Sendable, Equatable {
  case deleted
  case deletedLocalCleanupFailed
}

/// A refusal from the account endpoints, with the server's own message when it gave one.
public struct AccountRequestError: Error, Sendable, Equatable, LocalizedError {
  public let status: Int
  public let message: String?
  public var errorDescription: String? { message }
}

public struct AuthorizedRequest: Sendable {
  public let request: HTTPRequest
  public let generation: UInt64
  public let hadSpace: Bool
}

// The client keeps every auth call behind one actor so the session state stays serialized.
// swiftlint:disable:next type_body_length
public actor AuthClient {
  private static let authResponseLimit = 64 * 1024
  private static let originHeader = "rakazo://"

  private let storage: any SessionStorage
  private let transport: any HTTPTransport
  private var endpoint: URL
  private var token: String?
  private var generation: UInt64 = 0
  private var sessionEnded = false
  private var cachedCapabilities: AuthCapabilities?
  private var activeSSOAttempt: UUID?
  /// True while a change-password request is in flight. The server revokes the old session
  /// before it answers, so a 401 for the old token in that window is expected and must not
  /// end the session the reply is about to replace.
  private var passwordChangeInFlight = false

  public init(
    endpoint: URL,
    storage: any SessionStorage,
    transport: any HTTPTransport = URLSessionHTTPTransport()
  ) {
    self.endpoint = (try? ServerEndpoint.normalize(endpoint.absoluteString)) ?? endpoint
    self.storage = storage
    self.transport = transport
  }

  public func snapshot() -> AuthSnapshot {
    AuthSnapshot(
      endpoint: endpoint,
      isSignedIn: token != nil,
      generation: generation,
      sessionEnded: sessionEnded
    )
  }

  /// Builds a request for the signed-in session. Pass `generation` and `hadSpace` back to
  /// `handleUnauthorized` if the server answers 401.
  public func authorized(
    path: String,
    method: String,
    body: Data?,
    contentType: String?,
    spaceID: String?,
    timeout: TimeInterval = 8
  ) throws -> AuthorizedRequest {
    guard let token else { throw AuthClientError.unauthorized }
    var headers = ["authorization": "Bearer \(token)", "origin": Self.originHeader]
    if let contentType { headers["content-type"] = contentType }
    if let spaceID, !spaceID.isEmpty { headers["x-rakazo-space-id"] = spaceID }
    let url = try makeURL(endpoint: validatedEndpoint(), path: path)
    return AuthorizedRequest(
      request: HTTPRequest(
        url: url, method: method, headers: headers, body: body, timeout: timeout),
      generation: generation,
      hadSpace: headers["x-rakazo-space-id"] != nil
    )
  }

  /// Decides what a 401 means. Without a space header the session itself was rejected, so it
  /// is invalidated, but only if no newer session replaced the one that sent the request.
  public func handleUnauthorized(generation requestGeneration: UInt64, hadSpace: Bool) -> RPCError
  {
    guard requestGeneration == generation else { return .stale }
    if hadSpace { return .spaceRejected }
    if passwordChangeInFlight { return .stale }
    // Storage failures here still end the in-memory session; the next restore re-checks it.
    try? invalidateSession(endpoint)
    return .unauthorized
  }

  // swiftlint:disable:next function_body_length
  public func restore() async throws {
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let stored: StoredSession?
    do {
      stored = try storage.load()
    } catch {
      invalidateInMemory(sessionEnded: false)
      throw AuthClientError.storageFailure
    }
    guard generation == operationGeneration, endpoint == currentEndpoint else {
      throw AuthClientError.staleRequest
    }
    guard let stored, !stored.token.isEmpty else {
      token = nil
      sessionEnded = false
      return
    }
    guard let storedEndpoint = try? ServerEndpoint.normalize(stored.endpoint.absoluteString),
      storedEndpoint == currentEndpoint
    else {
      token = nil
      sessionEnded = false
      return
    }

    token = stored.token
    sessionEnded = false
    generation &+= 1
    let requestGeneration = generation
    let response: HTTPResponse
    do {
      response = try await send(
        path: "/api/auth/get-session",
        endpoint: currentEndpoint,
        method: "GET",
        bearer: stored.token,
        maximumResponseBytes: Self.authResponseLimit
      )
    } catch {
      guard endpoint == currentEndpoint, generation == requestGeneration else {
        throw AuthClientError.staleRequest
      }
      throw mapTransportError(error)
    }
    guard endpoint == currentEndpoint, generation == requestGeneration else {
      throw AuthClientError.staleRequest
    }
    if response.statusCode == 401 {
      try invalidateSession(currentEndpoint)
      throw AuthClientError.unauthorized
    }
    guard (200..<300).contains(response.statusCode) else {
      throw AuthClientError.httpStatus(response.statusCode)
    }
    if !hasSessionUser(response.body) {
      try invalidateSession(currentEndpoint)
      throw AuthClientError.unauthorized
    }
  }

  public func capabilities(refresh: Bool = false) async throws -> AuthCapabilities {
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    if !refresh, let cachedCapabilities {
      return cachedCapabilities
    }
    let response: HTTPResponse
    do {
      response = try await send(
        path: "/api/auth/capabilities",
        endpoint: currentEndpoint,
        method: "GET",
        maximumResponseBytes: Self.authResponseLimit
      )
    } catch {
      throw mapTransportError(error)
    }
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(response.statusCode) else {
      throw AuthClientError.httpStatus(response.statusCode)
    }
    guard let object = jsonObject(response.body) else {
      throw AuthClientError.invalidCapabilities
    }
    let capabilities = try parseCapabilities(object)
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    cachedCapabilities = capabilities
    return capabilities
  }

  // swiftlint:disable:next cyclomatic_complexity
  public func authenticate(
    _ action: EmailAuthAction,
    email: String,
    password: String,
    name: String
  ) async throws -> EmailAuthResult {
    let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard isValidEmail(normalizedEmail) else { throw AuthClientError.invalidEmail }
    guard !password.isEmpty else { throw AuthClientError.invalidPassword }
    let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if action == .signUp, normalizedName.isEmpty {
      throw AuthClientError.invalidName
    }
    if action == .signUp, password.utf16.count < 8 {
      throw AuthClientError.invalidPassword
    }

    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let capabilities = try await capabilities()
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard capabilities.passwordAuth else {
      throw AuthClientError.passwordAuthUnavailable
    }
    let path = action == .signIn ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email"
    var payload: [String: Any] = ["email": normalizedEmail, "password": password]
    if action == .signUp { payload["name"] = normalizedName }
    let response = try await sendJSON(
      path: path,
      endpoint: currentEndpoint,
      method: "POST",
      payload: payload,
      maximumResponseBytes: Self.authResponseLimit
    )
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(response.statusCode) else {
      throw response.statusCode == 401
        ? AuthClientError.unauthorized : AuthClientError.httpStatus(response.statusCode)
    }
    let object = jsonObject(response.body)
    if action == .signUp, object?["token"] is NSNull {
      return .verificationRequired
    }
    guard let token = tokenFromAuthResponse(response: response, body: object), !token.isEmpty else {
      throw AuthClientError.missingSession
    }
    try adopt(token: token, endpoint: currentEndpoint, operationGeneration: operationGeneration)
    return .signedIn
  }

  public func requestPasswordReset(email: String) async throws {
    let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard isValidEmail(normalizedEmail) else { throw AuthClientError.invalidEmail }
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let capabilities = try await capabilities()
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard capabilities.passwordReset, let resetURL = capabilities.resetURL,
      isTrustedResetURL(resetURL)
    else {
      throw AuthClientError.passwordResetUnavailable
    }
    let response = try await sendJSON(
      path: "/api/auth/request-password-reset",
      endpoint: currentEndpoint,
      method: "POST",
      payload: ["email": normalizedEmail, "redirectTo": resetURL.absoluteString],
      maximumResponseBytes: Self.authResponseLimit
    )
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(response.statusCode) else {
      throw AuthClientError.httpStatus(response.statusCode)
    }
  }

  public func resendVerification(email: String) async throws {
    let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard isValidEmail(normalizedEmail) else { throw AuthClientError.invalidEmail }
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let capabilities = try await capabilities()
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard capabilities.passwordAuth else { throw AuthClientError.passwordAuthUnavailable }
    let response = try await sendJSON(
      path: "/api/auth/send-verification-email",
      endpoint: currentEndpoint,
      method: "POST",
      payload: ["email": normalizedEmail, "callbackURL": "rakazo://sign-in"],
      maximumResponseBytes: Self.authResponseLimit
    )
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(response.statusCode) else {
      throw AuthClientError.httpStatus(response.statusCode)
    }
  }

  public func changeServer(to endpoint: URL) async throws {
    let newEndpoint = try ServerEndpoint.normalize(endpoint.absoluteString)
    guard newEndpoint != self.endpoint else { return }
    let oldEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let health = try await sendHealth(to: newEndpoint)
    guard self.endpoint == oldEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(health.statusCode), healthIsPraci(health.body) else {
      throw AuthClientError.serverNotPraci
    }

    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    sessionEnded = false
    if !wipeStoredSession(endpoint: oldEndpoint) {
      throw AuthClientError.storageFailure
    }
    self.endpoint = newEndpoint
    cachedCapabilities = nil
    generation &+= 1
  }

  public func signOut() async throws {
    let oldEndpoint = try validatedEndpoint()
    let oldToken = token
    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    sessionEnded = false
    let localClearSucceeded = wipeStoredSession(endpoint: oldEndpoint)
    if let oldToken {
      _ = try? await send(
        path: "/api/auth/sign-out",
        endpoint: oldEndpoint,
        method: "POST",
        bearer: oldToken,
        body: Data("{}".utf8),
        headers: ["content-type": "application/json"],
        maximumResponseBytes: Self.authResponseLimit
      )
    }
    if !localClearSucceeded {
      throw AuthClientError.storageFailure
    }
  }

  public func accountSecurity() async throws -> AccountSecurity {
    let response = try await sendSigned(path: "/api/auth/account-security", method: "GET")
    guard (200..<300).contains(response.statusCode) else { throw accountError(response) }
    guard let object = jsonObject(response.body),
      let hasPassword = strictJSONBoolean(object["hasPassword"])
    else { throw AuthClientError.invalidResponse }
    return AccountSecurity(
      hasPassword: hasPassword,
      passwordChangeEnabled: strictJSONBoolean(object["passwordChangeEnabled"]) ?? true,
      emailDeletion: strictJSONBoolean(object["emailDeletion"]) ?? false
    )
  }

  /// Changes the password and revokes every other session. The server also replaces this
  /// device's session, so the new token is adopted here and the person stays signed in.
  public func changePassword(current: String, new: String) async throws {
    guard !current.isEmpty else { throw AuthClientError.invalidPassword }
    guard new.utf16.count >= 8 else { throw AuthClientError.invalidPassword }
    guard !passwordChangeInFlight else { throw AuthClientError.staleRequest }
    let operationGeneration = generation
    let currentEndpoint = try validatedEndpoint()
    let response = try await sendSigned(
      path: "/api/auth/change-password",
      method: "POST",
      payload: ["currentPassword": current, "newPassword": new, "revokeOtherSessions": true],
      replacingSession: true
    )
    guard (200..<300).contains(response.statusCode) else { throw accountError(response) }
    guard let token = tokenFromAuthResponse(response: response, body: jsonObject(response.body)),
      !token.isEmpty
    else {
      // The server revoked this session and gave no replacement.
      try invalidateSession(currentEndpoint)
      throw AuthClientError.missingSession
    }
    try adopt(token: token, endpoint: currentEndpoint, operationGeneration: operationGeneration)
  }

  /// Emails a deletion code to accounts without a password.
  public func requestAccountDeletionCode() async throws {
    let response = try await sendSigned(
      path: "/api/auth/request-account-deletion", method: "POST", payload: [:])
    guard (200..<300).contains(response.statusCode) else { throw accountError(response) }
  }

  /// Deletes the account on the server, then forgets the session on this device. A failure to
  /// clear this device after the server succeeded is reported as an outcome, not thrown.
  @discardableResult
  public func deleteAccount(_ proof: AccountDeletionProof) async throws -> AccountDeletionOutcome {
    let currentEndpoint = try validatedEndpoint()
    let payload: [String: Any]
    switch proof {
    case .password(let password):
      guard !password.isEmpty else { throw AuthClientError.invalidPassword }
      payload = ["password": password]
    case .emailedCode(let code):
      let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmed.isEmpty else { throw AuthClientError.invalidPassword }
      payload = ["token": trimmed]
    }
    let response = try await sendSigned(
      path: "/api/auth/delete-user", method: "POST", payload: payload)
    guard (200..<300).contains(response.statusCode) else { throw accountError(response) }
    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    sessionEnded = false
    return wipeStoredSession(endpoint: currentEndpoint) ? .deleted : .deletedLocalCleanupFailed
  }

  /// Sends a signed account request. The session changing while it was out is a stale request,
  /// and a 401 means the server rejected this session, which ends it.
  private func sendSigned(
    path: String, method: String, payload: [String: Any]? = nil, replacingSession: Bool = false
  ) async throws -> HTTPResponse {
    guard let token else { throw AuthClientError.unauthorized }
    let currentEndpoint = try validatedEndpoint()
    let requestGeneration = generation
    if replacingSession { passwordChangeInFlight = true }
    let response: HTTPResponse
    do {
      response = try await send(
        path: path,
        endpoint: currentEndpoint,
        method: method,
        bearer: token,
        body: payload.map {
          try? JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys])
        } ?? nil,
        headers: payload == nil ? [:] : ["content-type": "application/json"],
        maximumResponseBytes: Self.authResponseLimit
      )
    } catch {
      if replacingSession { passwordChangeInFlight = false }
      throw error
    }
    if replacingSession { passwordChangeInFlight = false }
    guard endpoint == currentEndpoint, generation == requestGeneration else {
      throw AuthClientError.staleRequest
    }
    if response.statusCode == 401 {
      try? invalidateSession(currentEndpoint)
      throw AuthClientError.unauthorized
    }
    return response
  }

  private func accountError(_ response: HTTPResponse) -> AccountRequestError {
    let message = jsonObject(response.body)?["message"] as? String
    return AccountRequestError(status: response.statusCode, message: message)
  }

  // swiftlint:disable:next function_body_length
  public func beginSSO() async throws -> SSOChallenge {
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let capabilities = try await capabilities()
    guard endpoint == currentEndpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    guard let provider = capabilities.sso, provider.availability == .available else {
      throw AuthClientError.ssoUnavailable
    }
    guard activeSSOAttempt == nil else { throw AuthClientError.ssoAlreadyInProgress }
    let attemptID = UUID()
    activeSSOAttempt = attemptID
    do {
      var callbackComponents = URLComponents()
      callbackComponents.scheme = "rakazo"
      callbackComponents.host = "sign-in"
      callbackComponents.queryItems = [
        URLQueryItem(name: "nativeAttempt", value: attemptID.uuidString)
      ]
      guard let callbackURL = callbackComponents.string else {
        throw AuthClientError.invalidSSOResponse
      }
      let response = try await sendJSON(
        path: "/api/auth/sign-in/social",
        endpoint: currentEndpoint,
        method: "POST",
        payload: [
          "provider": "oidc",
          "callbackURL": callbackURL,
          "errorCallbackURL": callbackURL,
          "disableRedirect": true,
        ],
        headers: ["x-skip-oauth-proxy": "true"],
        maximumResponseBytes: Self.authResponseLimit
      )
      guard isCurrentSSO(attemptID, endpoint: currentEndpoint, generation: operationGeneration)
      else {
        throw AuthClientError.staleRequest
      }
      guard (200..<300).contains(response.statusCode),
        let object = jsonObject(response.body),
        let authorizationString = object["url"] as? String,
        let authorization = URL(string: authorizationString),
        authorization.scheme?.lowercased() == "https",
        authorization.host != nil,
        URLComponents(url: authorization, resolvingAgainstBaseURL: false)?.queryItems?.contains(
          where: { $0.name == "state" && !($0.value ?? "").isEmpty }) == true
      else {
        throw AuthClientError.invalidSSOResponse
      }
      let proxyURL = try proxyURL(
        endpoint: currentEndpoint,
        authorization: authorization,
        stateCookie: cookieValue(response.header("set-cookie"), name: "better-auth.oauth_state")
          ?? cookieValue(response.header("set-cookie"), name: "__Secure-better-auth.oauth_state")
      )
      return SSOChallenge(
        url: proxyURL,
        endpoint: currentEndpoint,
        generation: operationGeneration,
        attemptID: attemptID
      )
    } catch {
      if activeSSOAttempt == attemptID { activeSSOAttempt = nil }
      throw mapTransportError(error)
    }
  }

  public func completeSSO(callback: URL, challenge: SSOChallenge) async throws {
    guard
      isCurrentSSO(
        challenge.attemptID, endpoint: challenge.endpoint, generation: challenge.generation)
    else {
      throw AuthClientError.staleRequest
    }
    defer {
      if activeSSOAttempt == challenge.attemptID { activeSSOAttempt = nil }
    }
    guard let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false)
    else {
      throw AuthClientError.invalidCallback
    }
    let nativeAttempts = callbackComponents.queryItems?.filter { $0.name == "nativeAttempt" } ?? []
    guard isValidCallback(callback),
      nativeAttempts.count == 1,
      nativeAttempts[0].value == challenge.attemptID.uuidString,
      let cookie = callbackComponents.queryItems?.first(where: { $0.name == "cookie" })?.value,
      let token = cookieValue(cookie, name: "better-auth.session_token")
        ?? cookieValue(cookie, name: "__Secure-better-auth.session_token"),
      !token.isEmpty
    else {
      throw AuthClientError.invalidCallback
    }

    let response = try await send(
      path: "/api/auth/get-session",
      endpoint: challenge.endpoint,
      method: "GET",
      bearer: token,
      maximumResponseBytes: Self.authResponseLimit
    )
    guard
      isCurrentSSO(
        challenge.attemptID, endpoint: challenge.endpoint, generation: challenge.generation)
    else {
      throw AuthClientError.staleRequest
    }
    guard (200..<300).contains(response.statusCode), hasSessionUser(response.body) else {
      throw response.statusCode == 401
        ? AuthClientError.unauthorized : AuthClientError.invalidCallback
    }
    try adopt(token: token, endpoint: challenge.endpoint, operationGeneration: challenge.generation)
  }

  public func cancelSSO(_ challenge: SSOChallenge) {
    if activeSSOAttempt == challenge.attemptID {
      activeSSOAttempt = nil
    }
  }

  public func validateSession() async throws {
    guard let currentToken = token else { return }
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let response = try await send(
      path: "/api/auth/get-session",
      endpoint: currentEndpoint,
      method: "GET",
      bearer: currentToken,
      maximumResponseBytes: Self.authResponseLimit
    )
    guard endpoint == currentEndpoint, generation == operationGeneration, token == currentToken
    else {
      throw AuthClientError.staleRequest
    }
    if response.statusCode == 401 {
      if passwordChangeInFlight { throw AuthClientError.staleRequest }
      try invalidateSession(currentEndpoint)
      throw AuthClientError.unauthorized
    }
    guard (200..<300).contains(response.statusCode) else {
      throw AuthClientError.httpStatus(response.statusCode)
    }
    guard hasSessionUser(response.body) else {
      try invalidateSession(currentEndpoint)
      throw AuthClientError.unauthorized
    }
  }

  private func sendHealth(to endpoint: URL) async throws -> HTTPResponse {
    try await sendJSON(
      path: "/rpc/health",
      endpoint: endpoint,
      method: "POST",
      payload: ["json": [:]],
      maximumResponseBytes: Self.authResponseLimit
    )
  }

  private func sendJSON(
    path: String,
    endpoint: URL,
    method: String,
    payload: [String: Any],
    headers: [String: String] = [:],
    maximumResponseBytes: Int
  ) async throws -> HTTPResponse {
    let body = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
    return try await send(
      path: path,
      endpoint: endpoint,
      method: method,
      body: body,
      headers: ["content-type": "application/json"].merging(headers) { _, new in new },
      maximumResponseBytes: maximumResponseBytes
    )
  }

  private func send(
    path: String,
    endpoint: URL,
    method: String,
    bearer: String? = nil,
    body: Data? = nil,
    headers: [String: String] = [:],
    maximumResponseBytes: Int
  ) async throws -> HTTPResponse {
    let url = try makeURL(endpoint: endpoint, path: path)
    var requestHeaders = headers
    requestHeaders["origin"] = Self.originHeader
    if let bearer { requestHeaders["authorization"] = "Bearer \(bearer)" }
    do {
      return try await transport.send(
        HTTPRequest(url: url, method: method, headers: requestHeaders, body: body),
        maximumResponseBytes: maximumResponseBytes
      )
    } catch {
      throw mapTransportError(error)
    }
  }

  private func validatedEndpoint() throws -> URL {
    guard let normalized = try? ServerEndpoint.normalize(endpoint.absoluteString) else {
      throw AuthClientError.invalidEndpoint
    }
    if normalized != endpoint { endpoint = normalized }
    return normalized
  }

  private func makeURL(endpoint: URL, path: String) throws -> URL {
    guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
      throw AuthClientError.invalidEndpoint
    }
    components.path = path
    components.query = nil
    components.fragment = nil
    guard let url = components.url else { throw AuthClientError.invalidEndpoint }
    return url
  }

  private func proxyURL(endpoint: URL, authorization: URL, stateCookie: String?) throws -> URL {
    guard
      var components = URLComponents(
        url: try makeURL(endpoint: endpoint, path: "/api/auth/expo-authorization-proxy"),
        resolvingAgainstBaseURL: false)
    else {
      throw AuthClientError.invalidEndpoint
    }
    var queryItems = [URLQueryItem(name: "authorizationURL", value: authorization.absoluteString)]
    if let stateCookie { queryItems.append(URLQueryItem(name: "oauthState", value: stateCookie)) }
    components.queryItems = queryItems
    guard let url = components.url else { throw AuthClientError.invalidEndpoint }
    return url
  }

  private func adopt(token: String, endpoint: URL, operationGeneration: UInt64) throws {
    guard self.endpoint == endpoint, generation == operationGeneration else {
      throw AuthClientError.staleRequest
    }
    self.token = nil
    generation &+= 1
    sessionEnded = false
    do {
      try storage.save(StoredSession(endpoint: endpoint, token: token))
    } catch {
      self.token = nil
      generation &+= 1
      sessionEnded = false
      _ = wipeStoredSession(endpoint: endpoint)
      throw AuthClientError.storageFailure
    }
    self.token = token
    activeSSOAttempt = nil
  }

  private func invalidateSession(_ endpoint: URL) throws {
    invalidateInMemory()
    guard wipeStoredSession(endpoint: endpoint) else {
      throw AuthClientError.storageFailure
    }
  }

  private func invalidateInMemory(sessionEnded: Bool = true) {
    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    self.sessionEnded = sessionEnded
  }

  private func wipeStoredSession(endpoint: URL) -> Bool {
    do {
      try storage.clear()
      return true
    } catch {
      do {
        try storage.save(StoredSession(endpoint: endpoint, token: ""))
        return true
      } catch {
        return false
      }
    }
  }

  private func isCurrentSSO(_ attemptID: UUID, endpoint: URL, generation: UInt64) -> Bool {
    activeSSOAttempt == attemptID && self.endpoint == endpoint && self.generation == generation
  }
}

private func parseCapabilities(_ object: [String: Any]) throws -> AuthCapabilities {
  let modern = object["passwordAuth"] != nil || object["sso"] != nil
  if modern {
    guard let passwordAuth = strictJSONBoolean(object["passwordAuth"]),
      let passwordReset = strictJSONBoolean(object["passwordReset"]),
      object["sso"] != nil,
      object["resetUrl"] != nil
    else { throw AuthClientError.invalidCapabilities }
    let resetURL = try parseOptionalURL(object["resetUrl"])
    let sso = try parseSSO(object["sso"] as Any)
    let billing: Bool?
    if object.keys.contains("billing") {
      guard let value = strictJSONBoolean(object["billing"]) else {
        throw AuthClientError.invalidCapabilities
      }
      billing = value
    } else {
      billing = nil
    }
    return AuthCapabilities(
      passwordAuth: passwordAuth,
      passwordReset: passwordReset,
      resetURL: resetURL,
      sso: sso,
      billing: billing
    )
  }

  let allowed = Set(["passwordReset", "resetUrl", "billing"])
  guard Set(object.keys).isSubset(of: allowed),
    let passwordReset = strictJSONBoolean(object["passwordReset"]),
    object["resetUrl"] != nil
  else { throw AuthClientError.invalidCapabilities }
  let resetURL = try parseOptionalURL(object["resetUrl"])
  let billing: Bool?
  if object.keys.contains("billing") {
    guard let value = strictJSONBoolean(object["billing"]) else {
      throw AuthClientError.invalidCapabilities
    }
    billing = value
  } else {
    billing = nil
  }
  return AuthCapabilities(
    passwordAuth: true,
    passwordReset: passwordReset,
    resetURL: resetURL,
    sso: nil,
    billing: billing
  )
}

private func parseSSO(_ value: Any) throws -> SSOProvider? {
  if value is NSNull { return nil }
  guard let object = value as? [String: Any],
    let name = object["name"] as? String, !name.isEmpty,
    let availabilityString = object["availability"] as? String,
    let availability = SSOProvider.Availability(rawValue: availabilityString)
  else { throw AuthClientError.invalidCapabilities }
  return SSOProvider(name: name, availability: availability)
}

private func parseOptionalURL(_ value: Any?) throws -> URL? {
  if value is NSNull { return nil }
  guard let value = value as? String,
    let url = URL(string: value),
    url.scheme != nil,
    url.host != nil
  else { throw AuthClientError.invalidCapabilities }
  return url
}

private func jsonObject(_ data: Data) -> [String: Any]? {
  (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
}

private func strictJSONBoolean(_ value: Any?) -> Bool? {
  guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
    return nil
  }
  return number.boolValue
}

private func hasSessionUser(_ data: Data) -> Bool {
  guard let object = jsonObject(data),
    let user = object["user"] as? [String: Any],
    let id = user["id"] as? String
  else { return false }
  return !id.isEmpty
}

private func healthIsPraci(_ data: Data) -> Bool {
  guard let object = jsonObject(data),
    let json = object["json"] as? [String: Any]
  else { return false }
  return strictJSONBoolean(json["ok"]) == true
}

private func tokenFromAuthResponse(response: HTTPResponse, body: [String: Any]?) -> String? {
  if let token = body?["token"] as? String, !token.isEmpty { return token }
  if let session = body?["session"] as? [String: Any],
    let token = session["token"] as? String, !token.isEmpty
  {
    return token
  }
  return cookieValue(response.header("set-cookie"), name: "better-auth.session_token")
    ?? cookieValue(response.header("set-cookie"), name: "__Secure-better-auth.session_token")
}

private func cookieValue(_ header: String?, name: String) -> String? {
  guard let header else { return nil }
  let prefix = "\(name)="
  for segment in header.split(separator: ",", omittingEmptySubsequences: false) {
    guard let first = segment.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false)
      .first
    else { continue }
    let pair = first.trimmingCharacters(in: .whitespacesAndNewlines)
    guard pair.hasPrefix(prefix) else { continue }
    let encoded = String(pair.dropFirst(prefix.count))
    guard let decoded = encoded.removingPercentEncoding else { return nil }
    return decoded
  }
  return nil
}

private func isValidCallback(_ callback: URL) -> Bool {
  guard let components = URLComponents(url: callback, resolvingAgainstBaseURL: false),
    components.scheme?.lowercased() == "rakazo",
    components.host == "sign-in",
    components.port == nil,
    components.user == nil,
    components.password == nil,
    components.fragment == nil,
    components.path.isEmpty || components.path == "/",
    components.queryItems?.contains(where: { $0.name == "error" }) != true
  else { return false }
  return true
}

private func isTrustedResetURL(_ url: URL) -> Bool {
  guard url.user == nil,
    url.password == nil,
    let host = url.host, !host.isEmpty,
    (try? ServerEndpoint.normalize(url.absoluteString)) != nil
  else { return false }
  return true
}

private func isValidEmail(_ email: String) -> Bool {
  email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
}

private func mapTransportError(_ error: Error) -> Error {
  if error is AuthClientError { return error }
  if let transportError = error as? HTTPTransportError {
    switch transportError {
    case .timedOut, .responseTooLarge:
      return AuthClientError.serverUnavailable
    default:
      return error
    }
  }
  if error is URLError || error is CancellationError {
    return AuthClientError.serverUnavailable
  }
  return error
}
