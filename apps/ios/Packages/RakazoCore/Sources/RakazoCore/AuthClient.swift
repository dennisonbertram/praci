import Foundation

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

public actor AuthClient {
  private static let authResponseLimit = 64 * 1024
  private static let rpcResponseLimit = 16 * 1024 * 1024
  private static let originHeader = "rakazo://"

  private let storage: any SessionStorage
  private let transport: any HTTPTransport
  private var endpoint: URL
  private var token: String?
  private var generation: UInt64 = 0
  private var sessionEnded = false
  private var cachedCapabilities: AuthCapabilities?
  private var activeSSOAttempt: UUID?

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

  public func restore() async throws {
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    let stored: StoredSession?
    do {
      stored = try storage.load()
    } catch {
      invalidateInMemory()
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

  public func capabilities() async throws -> AuthCapabilities {
    let currentEndpoint = try validatedEndpoint()
    let operationGeneration = generation
    if let cachedCapabilities {
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
    if action == .signUp, password.count < 8 {
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

    let hadSession = token != nil
    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    sessionEnded = hadSession
    if hadSession, !wipeStoredSession(endpoint: oldEndpoint) {
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
    sessionEnded = true
    let localClearSucceeded = oldToken == nil || wipeStoredSession(endpoint: oldEndpoint)
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

  public func beginSSO() async throws -> SSOChallenge {
    let currentEndpoint = try validatedEndpoint()
    let capabilities = try await capabilities()
    guard endpoint == currentEndpoint else { throw AuthClientError.staleRequest }
    guard let provider = capabilities.sso, provider.availability == .available else {
      throw AuthClientError.ssoUnavailable
    }
    guard activeSSOAttempt == nil else { throw AuthClientError.ssoAlreadyInProgress }
    let attemptID = UUID()
    let operationGeneration = generation
    activeSSOAttempt = attemptID
    do {
      let response = try await sendJSON(
        path: "/api/auth/sign-in/social",
        endpoint: currentEndpoint,
        method: "POST",
        payload: [
          "provider": "oidc",
          "callbackURL": "rakazo://sign-in",
          "errorCallbackURL": "rakazo://sign-in",
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
    guard isValidCallback(callback),
      let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false),
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

  private func sendHealthIsValid(_ response: HTTPResponse) -> Bool {
    response.statusCode >= 200 && response.statusCode < 300 && healthIsPraci(response.body)
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
      sessionEnded = true
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

  private func invalidateInMemory() {
    token = nil
    activeSSOAttempt = nil
    generation &+= 1
    sessionEnded = true
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
    guard object["passwordAuth"] is Bool,
      object["passwordReset"] is Bool,
      object["sso"] != nil,
      object["resetUrl"] != nil
    else { throw AuthClientError.invalidCapabilities }
    let passwordAuth = object["passwordAuth"] as! Bool
    let passwordReset = object["passwordReset"] as! Bool
    let resetURL = try parseOptionalURL(object["resetUrl"])
    let sso = try parseSSO(object["sso"] as Any)
    if object["billing"] != nil, !(object["billing"] is Bool) && !(object["billing"] is NSNull) {
      throw AuthClientError.invalidCapabilities
    }
    let billing = object["billing"] as? Bool
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
    object["passwordReset"] is Bool,
    object["resetUrl"] != nil
  else { throw AuthClientError.invalidCapabilities }
  let resetURL = try parseOptionalURL(object["resetUrl"])
  guard object["billing"] == nil || object["billing"] is Bool else {
    throw AuthClientError.invalidCapabilities
  }
  return AuthCapabilities(
    passwordAuth: true,
    passwordReset: object["passwordReset"] as! Bool,
    resetURL: resetURL,
    sso: nil,
    billing: object["billing"] as? Bool
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
  return json["ok"] as? Bool == true
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
  for segment in header.split(separator: ",", omittingEmptySubsequences: true) {
    let pair = segment.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: true)[0]
      .trimmingCharacters(in: .whitespacesAndNewlines)
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
  guard url.scheme?.lowercased() == "https",
    url.user == nil,
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
