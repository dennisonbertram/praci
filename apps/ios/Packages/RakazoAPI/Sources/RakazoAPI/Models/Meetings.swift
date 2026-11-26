import Foundation

/// `rpc_meetings_list` item.
public struct Meeting: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let title: String
  public let startedAt: Date
  public let endedAt: Date?
  public let provider: String

  /// "Praci", "Hex", "Granola", "Omi" or "Omi cloud"; an unknown source shows as its own id.
  public var sourceName: String {
    ["granola": "Granola", "omi": "Omi", "omi_cloud": "Omi cloud", "hex": "Hex", "praci": "Praci"][provider] ?? provider
  }

  /// Whole minutes from start to end, at least 1; nil while the end is unknown.
  public var minutes: Int? {
    endedAt.map { max(1, Int((($0.timeIntervalSince(startedAt)) / 60).rounded())) }
  }

  private enum CodingKeys: String, CodingKey { case id, title, startedAt, endedAt, provider }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    title = try c.decode(String.self, forKey: .title)
    startedAt = try c.decode(String.self, forKey: .startedAt).isoDate()
    endedAt = try c.decodeIfPresent(String.self, forKey: .endedAt)?.isoDate()
    provider = try c.decode(String.self, forKey: .provider)
  }
}

/// `rpc_meetings_list` output.
public struct MeetingsPage: Sendable, Decodable {
  public let items: [Meeting]
  public let nextCursor: String?
}

/// A to-do found in a meeting.
public struct MeetingTodo: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let text: String
  /// `yyyy-MM-dd`
  public let dueOn: String?
  public var doneAt: String?
}

/// `rpc_meetings_get` output.
public struct MeetingDetail: Sendable, Decodable {
  public let meeting: Meeting
  public let summary: String
  public let decisions: [String]
  public let followUps: [String]
  public var todos: [MeetingTodo]
  public let transcript: String?
  /// Part of a recording could not be transcribed.
  public let partial: Bool
  /// The server is still writing the summary (absent on older servers).
  public let summarizing: Bool

  private enum CodingKeys: String, CodingKey {
    case summary, decisions, followUps, todos, transcript, partial, summarizing
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    meeting = try Meeting(from: decoder)
    summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
    decisions = try c.decodeIfPresent([String].self, forKey: .decisions) ?? []
    followUps = try c.decodeIfPresent([String].self, forKey: .followUps) ?? []
    todos = try c.decodeIfPresent([MeetingTodo].self, forKey: .todos) ?? []
    transcript = try c.decodeIfPresent(String.self, forKey: .transcript)
    partial = try c.decodeIfPresent(Bool.self, forKey: .partial) ?? false
    summarizing = try c.decodeIfPresent(Bool.self, forKey: .summarizing) ?? false
  }
}

/// `rpc_meetingCaptures_start` output.
public struct CaptureStarted: Sendable, Decodable {
  public let captureId: String
}

/// `rpc_meetingCaptures_active` output (nil when there is none).
public struct ActiveCapture: Sendable, Hashable, Decodable {
  public enum Status: String, Sendable, Decodable { case recording, finishing }
  public let captureId: String
  public let title: String?
  public let engine: String
  public let tracks: [String]
  public let status: Status
  public let startedAt: Date

  private enum CodingKeys: String, CodingKey {
    case captureId, title, engine, tracks, status, startedAt
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    captureId = try c.decode(String.self, forKey: .captureId)
    title = try c.decodeIfPresent(String.self, forKey: .title)
    engine = try c.decode(String.self, forKey: .engine)
    tracks = try c.decode([String].self, forKey: .tracks)
    status = try c.decode(Status.self, forKey: .status)
    startedAt = try c.decode(String.self, forKey: .startedAt).isoDate()
  }
}

extension String {
  /// Parses an ISO 8601 timestamp with or without fractional seconds.
  fileprivate func isoDate() throws -> Date {
    let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    if let date = try? fractional.parse(self) { return date }
    if let date = try? Date.ISO8601FormatStyle().parse(self) { return date }
    throw DecodingError.dataCorrupted(
      .init(codingPath: [], debugDescription: "Invalid date: \(self)"))
  }
}
