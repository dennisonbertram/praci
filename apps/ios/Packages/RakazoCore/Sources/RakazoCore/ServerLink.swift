import Foundation

public enum ServerLink {
  public static func parse(_ text: String) throws -> URL {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { throw ServerEndpoint.ValidationError.empty }

    if let components = URLComponents(string: trimmed),
      components.scheme?.lowercased() == "rakazo"
    {
      guard components.host?.lowercased() == "connect",
        components.user == nil,
        components.password == nil,
        components.path.isEmpty,
        components.fragment == nil
      else {
        throw ServerEndpoint.ValidationError.malformed
      }
      let values = components.queryItems?.filter { $0.name == "server" } ?? []
      guard values.count == 1 else {
        throw values.isEmpty ? ServerEndpoint.ValidationError.empty : .malformed
      }
      guard let value = values[0].value,
        !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        throw ServerEndpoint.ValidationError.empty
      }
      return try parseOrigin(value)
    }

    return try parseOrigin(trimmed)
  }

  private static func parseOrigin(_ text: String) throws -> URL {
    let hasExplicitScheme =
      text.range(
        of: #"^[a-z][a-z0-9+.-]*://"#,
        options: [.regularExpression, .caseInsensitive]
      ) != nil
    let candidate = hasExplicitScheme ? text : "https://\(text)"
    guard let components = URLComponents(string: candidate) else {
      return try ServerEndpoint.normalize(text)
    }
    guard components.user == nil,
      components.password == nil,
      components.path.isEmpty,
      components.query == nil,
      components.fragment == nil
    else {
      throw ServerEndpoint.ValidationError.malformed
    }
    return try ServerEndpoint.normalize(text)
  }
}
