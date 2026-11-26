import Foundation

/// Screen-URL rules for the Team Computer page. A port of `apps/mobile/lib/computer.ts`.
/// Times are milliseconds since 1970, as in the capability URLs.
public enum ComputerScreenURL {
  public static let heartbeatInterval: Duration = .seconds(60)
  public static let pollInterval: Duration = .seconds(2)
  /// Boot, takeover and mode changes can create or start a container.
  public static let lifecycleTimeout: TimeInterval = 120
  public static let openAttempts = 5
  public static let retryDelay: Duration = .milliseconds(400)
  /// Re-read an unsealed screen this long after the read.
  public static let renewAfterMs = 50 * 60_000
  /// Sealed capabilities live one hour.
  static let capabilityTTLMs = 60 * 60_000
  static let sourceRenewRemainingMs = capabilityTTLMs - renewAfterMs + 5 * 60_000

  private static func isLocal(_ host: String?) -> Bool {
    guard let host else { return false }
    return ["127.0.0.1", "localhost", "[::1]", "::1"].contains(host)
  }

  /// Points a loopback noVNC URL at the host the app uses for the API. Non-web schemes
  /// (such as the demo's `fake://`) return nil.
  public static func embeddable(_ url: String?, apiBase: URL) -> URL? {
    guard let url, var parts = URLComponents(string: url),
      parts.scheme == "http" || parts.scheme == "https"
    else { return nil }
    if isLocal(parts.host), !isLocal(apiBase.host()) { parts.host = apiBase.host() }
    return parts.url
  }

  private struct Segments {
    var origin: String
    var path: String
    var query: [String: String]
  }

  private static func segments(_ url: String) -> Segments? {
    guard let parts = URLComponents(string: url), let scheme = parts.scheme, let host = parts.host
    else { return nil }
    let port = parts.port.map { ":\($0)" } ?? ""
    var query: [String: String] = [:]
    for item in parts.queryItems ?? [] { query[item.name] = item.value ?? "" }
    return Segments(origin: "\(scheme)://\(host)\(port)", path: parts.path, query: query)
  }

  /// Identity of a live stream, ignoring rotating capability tokens. View versus control stays
  /// in the key so takeover and release reconnect.
  public static func streamKey(_ url: String) -> String {
    guard let parts = segments(url) else { return url }
    let pieces = parts.path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
    // ["", "novnc", "session", "view|control", "<expiry>.<token>", rest...]
    if pieces.count >= 5, pieces[0] == "", pieces[1] == "novnc", pieces[2] == "session",
      pieces[3] == "view" || pieces[3] == "control"
    {
      let rest = pieces.dropFirst(5).map { "/" + $0 }.joined()
      return "\(parts.origin)/novnc/session/\(pieces[3])\(rest)"
    }
    let policy = parts.query["view_only"].map { "?view_only=\($0)" } ?? ""
    return "\(parts.origin)\(parts.path)\(policy)"
  }

  static func capabilityExpiresAt(_ url: String) -> Int? {
    guard let parts = segments(url) else { return nil }
    let pieces = parts.path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
    guard pieces.count >= 5, pieces[1] == "novnc", pieces[2] == "session",
      pieces[3] == "view" || pieces[3] == "control",
      let dot = pieces[4].firstIndex(of: "."), let expiry = Int(pieces[4][..<dot])
    else { return nil }
    return expiry
  }

  /// The time the renew interval is measured from. A sealed capability keeps the expiry it was
  /// issued with, so a later reader renews before that expiry.
  public static func renewReadAt(_ url: String?, readAt: Int) -> Int {
    guard let url, let expiresAt = capabilityExpiresAt(url) else { return readAt }
    return expiresAt - capabilityTTLMs
  }

  /// Keeps the connected URL while only the capability token rotated. A newer same-stream URL
  /// is adopted once the held capability is in its renew window.
  public static func retainSource(_ held: String, _ next: String, now: Int) -> String {
    guard streamKey(held) == streamKey(next) else { return next }
    if let heldExpires = capabilityExpiresAt(held), let nextExpires = capabilityExpiresAt(next),
      nextExpires > heldExpires, heldExpires - now <= sourceRenewRemainingMs
    {
      return next
    }
    return held
  }

  /// The URL the screen should keep loaded. A visible page ignores a same-stream refresh so the
  /// keyboard bridge stays attached to the loaded document; a hidden screen forgets it.
  public static func nextLoaded(held: String?, next: String?, visible: Bool, now: Int) -> String? {
    guard visible, let next else { return nil }
    guard let held else { return next }
    return retainSource(held, next, now: now)
  }

  /// Reads the screen URL, retrying thrown errors and empty answers.
  public static func read(
    attempts: Int = 1, delay: Duration = retryDelay,
    sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) },
    request: @Sendable () async throws -> String?
  ) async throws -> String? {
    let count = max(1, attempts)
    var lastError: Error?
    for attempt in 1...count {
      do {
        if let url = try await request() { return url }
        lastError = nil
      } catch {
        if error is CancellationError { throw error }
        lastError = error
      }
      if attempt < count { try await sleep(delay) }
    }
    if let lastError { throw lastError }
    return nil
  }
}
