import Foundation

public enum ServerEndpoint {
  public enum ValidationError: LocalizedError, Sendable, Equatable {
    case empty
    case malformed
    case unsupportedScheme
    case publicHTTP

    public var errorDescription: String? {
      switch self {
      case .empty:
        "Enter a server URL."
      case .malformed:
        "That doesn’t look like a URL."
      case .unsupportedScheme:
        "Use an http or https URL."
      case .publicHTTP:
        "Public servers need https://."
      }
    }
  }

  public static let `defaultURL` = URL(string: "http://127.0.0.1:3100")!

  public static func normalize(_ input: String) throws -> URL {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { throw ValidationError.empty }
    let hasExplicitScheme =
      trimmed.range(
        of: #"^[a-z][a-z0-9+.-]*://"#,
        options: [.regularExpression, .caseInsensitive]
      ) != nil
    if !hasExplicitScheme, let colon = trimmed.firstIndex(of: ":") {
      let port = trimmed[trimmed.index(after: colon)...].prefix(while: { !"/?#".contains($0) })
      if port.isEmpty || !port.allSatisfy(\.isNumber) {
        throw ValidationError.unsupportedScheme
      }
    }
    let withScheme = hasExplicitScheme ? trimmed : "https://\(trimmed)"
    guard var components = URLComponents(string: withScheme),
      let scheme = components.scheme?.lowercased(),
      let host = components.host,
      !host.isEmpty
    else {
      throw ValidationError.malformed
    }
    guard scheme == "http" || scheme == "https" else {
      throw ValidationError.unsupportedScheme
    }

    let normalizedHost = host.lowercased()
    if scheme == "http", !isLanOrLocalHost(normalizedHost) {
      throw ValidationError.publicHTTP
    }

    components.scheme = scheme
    components.host = normalizedHost
    components.user = nil
    components.password = nil
    components.path = ""
    components.query = nil
    components.fragment = nil
    if (scheme == "https" && components.port == 443)
      || (scheme == "http" && components.port == 80)
    {
      components.port = nil
    }
    guard let url = components.url, url.host != nil else {
      throw ValidationError.malformed
    }
    return url
  }

  private static func isLanOrLocalHost(_ value: String) -> Bool {
    let host = value.trimmingCharacters(in: CharacterSet(charactersIn: "[]")).lowercased()
    if host == "localhost" || host == "127.0.0.1" || host == "::1" {
      return true
    }
    if host.hasSuffix(".local"), host.count > ".local".count {
      return true
    }
    guard let octets = ipv4Octets(host) else { return false }
    let (first, second) = (octets[0], octets[1])
    return first == 10
      || (first == 192 && second == 168)
      || (first == 172 && (16...31).contains(second))
      || (first == 100 && (64...127).contains(second))
  }

  private static func ipv4Octets(_ host: String) -> [UInt8]? {
    let parts = host.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 4 else { return nil }
    var octets: [UInt8] = []
    for part in parts {
      guard !part.isEmpty, part.count <= 3,
        part.allSatisfy(\.isNumber),
        let value = UInt8(part)
      else {
        return nil
      }
      octets.append(value)
    }
    return octets
  }
}
