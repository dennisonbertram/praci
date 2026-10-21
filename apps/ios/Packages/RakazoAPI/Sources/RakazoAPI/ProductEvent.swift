import Foundation

public struct ProductEvent: Decodable, Sendable {
  public let id: String
  public let spaceId: String
  public let threadId: String
  public let botId: String
  public let seq: Int
  public let type: String
  public let runId: String?
  public let createdAt: String
  public let payload: [String: JSONValue]
}
