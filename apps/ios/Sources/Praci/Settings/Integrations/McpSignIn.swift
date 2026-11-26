import Foundation
import RakazoAPI

/// `rpc_mcp_oauth_begin` output.
struct McpOAuthBegin: Decodable, Sendable {
  var status: String
  var sessionId: String?
  var authorizationUrl: String?
}

struct McpOAuthBeginInput: Encodable, Sendable {
  var serverId: String
  var redirectUri = McpOAuth.redirectURI
  var reauthorize: Bool?
}

struct McpOAuthCompleteInput: Encodable, Sendable {
  var sessionId: String
  var code: String
  var state: String
}

enum McpOAuth {
  /// The one native redirect the server accepts for MCP sign-in.
  static let redirectURI = "rakazo://mcp/oauth/callback"

  enum Callback: Equatable {
    case code(String)
    case providerError
    case invalid
  }

  /// Reads the URL the browser returned. The `state` must equal the one the server issued at
  /// `begin`; anything else is rejected before any call to `complete`.
  static func parse(_ url: URL, expectedState: String) -> Callback {
    guard url.scheme == "rakazo", url.host == "mcp", url.path == "/oauth/callback",
      let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
    else { return .invalid }
    func value(_ name: String) -> String? {
      items.first { $0.name == name }?.value.flatMap { $0.isEmpty ? nil : $0 }
    }
    guard value("state") == expectedState else { return .invalid }
    if value("error") != nil { return .providerError }
    guard let code = value("code") else { return .invalid }
    return .code(code)
  }
}

enum McpSignInOutcome: Equatable {
  case connected
  case cancelled
  case failed(String)
}

/// One sign-in to an MCP server. The code verifier stays on the server; the phone only forwards
/// the code. Nothing here logs the code, the state or the authorization URL.
struct McpSignInFlow: Sendable {
  var begin: @Sendable (_ serverID: String, _ reauthorize: Bool) async throws -> McpOAuthBegin
  var open: @Sendable (URL) async throws -> URL
  var complete: @Sendable (_ sessionID: String, _ code: String, _ state: String) async throws -> Void

  static let unfinished = "Sign-in did not finish. Try again."

  func run(serverID: String, reauthorize: Bool) async -> McpSignInOutcome {
    do {
      let started = try await begin(serverID, reauthorize)
      switch started.status {
      case "already_connected": return .connected
      case "authorization_not_requested": return .failed("This server did not ask for a sign-in.")
      case "authorization_required": break
      default: return .failed(Self.unfinished)
      }
      guard let sessionID = started.sessionId, !sessionID.isEmpty,
        let page = started.authorizationUrl.flatMap(URL.init(string:)),
        ["https", "http"].contains(page.scheme?.lowercased())
      else { return .failed(Self.unfinished) }
      let returned = try await open(page)
      try Task.checkCancellation()
      switch McpOAuth.parse(returned, expectedState: sessionID) {
      case .code(let code):
        // The server's session id is also the OAuth state, as on the web callback page.
        try await complete(sessionID, code, sessionID)
        return .connected
      case .providerError: return .failed("The provider declined the sign-in.")
      case .invalid: return .failed(Self.unfinished)
      }
    } catch is CancellationError {
      return .cancelled
    } catch {
      return .failed(settingsErrorText(error))
    }
  }
}

/// What a row says about an MCP server or a connected app, from fields the server already returns.
enum RowStatus: Equatable {
  case ok, needsReconnect, failed, connecting, off

  var text: String? {
    switch self {
    case .ok: nil
    case .needsReconnect: String(localized: "Needs reconnecting")
    case .failed: String(localized: "Failed")
    case .connecting: String(localized: "Connecting…")
    case .off: String(localized: "Off")
    }
  }

  var isProblem: Bool { self == .needsReconnect || self == .failed }
}

extension Connection {
  var rowStatus: RowStatus {
    if needsReconnect { return .needsReconnect }
    if status == "error" { return .failed }
    if isPending { return .connecting }
    return .ok
  }
}

extension McpServer {
  /// Like the web: a lapsed sign-in, or one that was started and never finished.
  var rowStatus: RowStatus {
    if !enabled { return .off }
    if oauthStatus == "reconnect" || (oauthStatus == "none" && oauthAttempted) { return .needsReconnect }
    return .ok
  }

  var canSignIn: Bool { enabled && transport != "stdio" && oauthSupported }
  /// A first sign-in reads "Sign in"; a lapsed or existing one reads "Reconnect".
  var isFirstSignIn: Bool { oauthStatus == "none" && !oauthAttempted }
}
