import Foundation

public struct MessageBlock: Codable, Sendable {
  public enum Kind: Hashable, Sendable {
    case text
    case card
    case ask
    case choice
    case appConnect
    case connect
    case computer
    case voiceCall
    case meta
    case progress
    case steps
    case subagent
    case childBot
    case cloudAgent
    case skillDraft
    case chart
    case mcpApproval
    case emails
    case mailThread
    case finance
    case image
    case file
    case handoff
    case channelMessage
    case botMessageSent
    case botMessageReceived
    case unknown(String)

    public init(rawValue: String) {
      switch rawValue {
      case "text": self = .text
      case "card": self = .card
      case "ask": self = .ask
      case "choice": self = .choice
      case "app_connect": self = .appConnect
      case "connect": self = .connect
      case "computer": self = .computer
      case "voice_call": self = .voiceCall
      case "meta": self = .meta
      case "progress": self = .progress
      case "steps": self = .steps
      case "subagent": self = .subagent
      case "child_bot": self = .childBot
      case "cloud_agent": self = .cloudAgent
      case "skill_draft": self = .skillDraft
      case "chart": self = .chart
      case "mcp_approval": self = .mcpApproval
      case "emails": self = .emails
      case "mail_thread": self = .mailThread
      case "finance": self = .finance
      case "image": self = .image
      case "file": self = .file
      case "handoff": self = .handoff
      case "channel_message": self = .channelMessage
      case "bot_message_sent": self = .botMessageSent
      case "bot_message_received": self = .botMessageReceived
      default: self = .unknown(rawValue)
      }
    }

    public var rawValue: String {
      switch self {
      case .text: "text"
      case .card: "card"
      case .ask: "ask"
      case .choice: "choice"
      case .appConnect: "app_connect"
      case .connect: "connect"
      case .computer: "computer"
      case .voiceCall: "voice_call"
      case .meta: "meta"
      case .progress: "progress"
      case .steps: "steps"
      case .subagent: "subagent"
      case .childBot: "child_bot"
      case .cloudAgent: "cloud_agent"
      case .skillDraft: "skill_draft"
      case .chart: "chart"
      case .mcpApproval: "mcp_approval"
      case .emails: "emails"
      case .mailThread: "mail_thread"
      case .finance: "finance"
      case .image: "image"
      case .file: "file"
      case .handoff: "handoff"
      case .channelMessage: "channel_message"
      case .botMessageSent: "bot_message_sent"
      case .botMessageReceived: "bot_message_received"
      case .unknown(let rawValue): rawValue
      }
    }
  }

  public struct CardLine: Codable, Equatable, Sendable {
    public let k: String
    public let v: String
  }

  public let kind: Kind
  public let fields: [String: JSONValue]

  public var text: String? { fields["text"]?.stringValue }
  public var question: String? { fields["question"]?.stringValue }
  public var title: String? { fields["title"]?.stringValue }
  public var status: String? { fields["status"]?.stringValue }

  public var cardLines: [CardLine]? {
    try? fields["lines"]?.decode([CardLine].self)
  }

  public func field<Value: Decodable>(_ key: String, as type: Value.Type) throws -> Value? {
    guard let value = fields[key] else { return nil }
    return try value.decode(type)
  }

  public func decodePayload<Value: Decodable>(_ type: Value.Type) throws -> Value {
    var payload = fields
    payload["kind"] = .string(kind.rawValue)
    return try JSONValue.object(payload).decode(type)
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    let rawKind = try container.decode(String.self, forKey: DynamicCodingKey(stringValue: "kind")!)
    kind = Kind(rawValue: rawKind)
    var fields: [String: JSONValue] = [:]
    for key in container.allKeys where key.stringValue != "kind" {
      fields[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
    }
    self.fields = fields
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicCodingKey.self)
    try container.encode(kind.rawValue, forKey: DynamicCodingKey(stringValue: "kind")!)
    for (key, value) in fields {
      try container.encode(value, forKey: DynamicCodingKey(stringValue: key)!)
    }
  }
}

private struct DynamicCodingKey: CodingKey {
  let stringValue: String
  let intValue: Int? = nil

  init?(stringValue: String) {
    self.stringValue = stringValue
  }

  init?(intValue: Int) {
    return nil
  }
}
