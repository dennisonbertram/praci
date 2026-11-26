// swiftlint:disable identifier_name
import Foundation

// Inbox list models. Hand-written and tolerant: missing or null fields fall back to empty values and
// unknown strings are kept as they are. Shapes checked against openapi.json (rpc_inbox_list, rpc_inbox_refresh,
// rpc_inbox_moveMany, rpc_inbox_actions_undo) and recorded from the demo.

/// rpc_inbox_list
public struct InboxList: Decodable, Sendable {
  public var accounts: [InboxAccount]
  public var agent: InboxAgent?
  public var rows: [InboxRow]
  public var syncedAt: String?
  public var failedAccounts: [String]
  public var reconnectAccounts: [String]
  public var rateLimitedAccounts: [String]
  /// True when mail triage (the Inbox agent sorting mail) is on. Without it rows carry no triage fields.
  public var enabled: Bool
  public var triageBlocked: InboxTriageBlocked?
  public var triagePending: Bool
  public var nextPageToken: String?

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    accounts = try c.decodeIfPresent([InboxAccount].self, forKey: .accounts) ?? []
    agent = try? c.decodeIfPresent(InboxAgent.self, forKey: .agent)
    rows = try c.decodeIfPresent([InboxRow].self, forKey: .rows) ?? []
    syncedAt = try? c.decodeIfPresent(String.self, forKey: .syncedAt)
    failedAccounts = try c.decodeIfPresent([String].self, forKey: .failedAccounts) ?? []
    reconnectAccounts = try c.decodeIfPresent([String].self, forKey: .reconnectAccounts) ?? []
    rateLimitedAccounts = try c.decodeIfPresent([String].self, forKey: .rateLimitedAccounts) ?? []
    enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
    triageBlocked = try? c.decodeIfPresent(InboxTriageBlocked.self, forKey: .triageBlocked)
    triagePending = try c.decodeIfPresent(Bool.self, forKey: .triagePending) ?? false
    nextPageToken = try? c.decodeIfPresent(String.self, forKey: .nextPageToken)
  }

  private enum CodingKeys: String, CodingKey {
    case accounts, agent, rows, syncedAt, failedAccounts, reconnectAccounts, rateLimitedAccounts
    case enabled, triageBlocked, triagePending, nextPageToken
  }
}

public struct InboxAccount: Decodable, Sendable, Identifiable, Hashable {
  public var connectionId: String
  public var label: String
  public var address: String?
  public var id: String { connectionId }
}

public struct InboxAgent: Decodable, Sendable, Hashable {
  public var botId: String
  public var name: String
}

public struct InboxTriageBlocked: Decodable, Sendable, Hashable {
  /// `no_model` or `needs_consent`.
  public var reason: String
}

public struct InboxRow: Decodable, Sendable, Identifiable, Hashable {
  public var id: String
  public var connectionId: String
  public var threadId: String
  public var from: String
  public var subject: String
  public var snippet: String
  public var receivedAt: String
  public var unread: Bool
  public var inInbox: Bool
  public var needsReply: Bool?
  public var priority: String?
  public var reason: String?
  public var category: String?
  public var feedback: String?
  public var fromSelf: Bool
  public var pile: String?
  public var fromAddress: String?

  public init(
    id: String, connectionId: String = "", threadId: String = "", from: String = "",
    subject: String = "", snippet: String = "", receivedAt: String, unread: Bool = false,
    inInbox: Bool = true, needsReply: Bool? = nil, priority: String? = nil, reason: String? = nil,
    category: String? = nil, feedback: String? = nil, fromSelf: Bool = false, pile: String? = nil,
    fromAddress: String? = nil
  ) {
    self.id = id
    self.connectionId = connectionId
    self.threadId = threadId
    self.from = from
    self.subject = subject
    self.snippet = snippet
    self.receivedAt = receivedAt
    self.unread = unread
    self.inInbox = inInbox
    self.needsReply = needsReply
    self.priority = priority
    self.reason = reason
    self.category = category
    self.feedback = feedback
    self.fromSelf = fromSelf
    self.pile = pile
    self.fromAddress = fromAddress
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    connectionId = try c.decodeIfPresent(String.self, forKey: .connectionId) ?? ""
    threadId = try c.decodeIfPresent(String.self, forKey: .threadId) ?? ""
    from = try c.decodeIfPresent(String.self, forKey: .from) ?? ""
    subject = try c.decodeIfPresent(String.self, forKey: .subject) ?? ""
    snippet = try c.decodeIfPresent(String.self, forKey: .snippet) ?? ""
    receivedAt = try c.decodeIfPresent(String.self, forKey: .receivedAt) ?? ""
    unread = try c.decodeIfPresent(Bool.self, forKey: .unread) ?? false
    inInbox = try c.decodeIfPresent(Bool.self, forKey: .inInbox) ?? true
    needsReply = try? c.decodeIfPresent(Bool.self, forKey: .needsReply)
    priority = try? c.decodeIfPresent(String.self, forKey: .priority)
    reason = try? c.decodeIfPresent(String.self, forKey: .reason)
    category = try? c.decodeIfPresent(String.self, forKey: .category)
    feedback = try? c.decodeIfPresent(String.self, forKey: .feedback)
    fromSelf = try c.decodeIfPresent(Bool.self, forKey: .fromSelf) ?? false
    pile = try? c.decodeIfPresent(String.self, forKey: .pile)
    fromAddress = try? c.decodeIfPresent(String.self, forKey: .fromAddress)
  }

  private enum CodingKeys: String, CodingKey {
    case id, connectionId, threadId, from, subject, snippet, receivedAt, unread, inInbox
    case needsReply, priority, reason, category, feedback, fromSelf, pile
    case fromAddress
  }
}

/// rpc_inbox_refresh
public struct InboxRefresh: Decodable, Sendable {
  public var ok: Bool
  public var syncing: Bool?
  public var syncedAt: String?
  public var failedAccounts: [String]

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    ok = try c.decodeIfPresent(Bool.self, forKey: .ok) ?? true
    syncing = try? c.decodeIfPresent(Bool.self, forKey: .syncing)
    syncedAt = try? c.decodeIfPresent(String.self, forKey: .syncedAt)
    failedAccounts = try c.decodeIfPresent([String].self, forKey: .failedAccounts) ?? []
  }

  private enum CodingKeys: String, CodingKey { case ok, syncing, syncedAt, failedAccounts }
}

/// rpc_inbox_moveMany (spam, notSpam, trash). `batchId` undoes the whole call.
public struct InboxMoveResult: Decodable, Sendable {
  public struct Failure: Decodable, Sendable, Hashable {
    public var messageId: String
    public var reason: String
  }

  public var done: [String]
  public var failed: [Failure]
  public var batchId: String
}

/// rpc_inbox_actions_undo
public struct InboxUndoResult: Decodable, Sendable {
  public var restored: Int
  public var failed: Int
}

// MARK: - Grouping and labels (ports of packages/core inbox-groups.ts and inbox-label.ts)

public struct InboxGroups: Sendable {
  public var needsReply: [InboxRow]
  public var today: [InboxRow]
  public var earlier: [InboxRow]
}

/// Needs reply (any date, newest first), then Today and Earlier split at the viewer's local midnight.
public func groupInbox(_ rows: [InboxRow], now: Date, calendar: Calendar = .current) -> InboxGroups {
  let midnight = calendar.startOfDay(for: now)
  var groups = InboxGroups(needsReply: [], today: [], earlier: [])
  for row in rows {
    let received = InboxRow.parseDate(row.receivedAt) ?? .distantPast
    if row.needsReply == true {
      groups.needsReply.append(row)
    } else if received >= midnight {
      groups.today.append(row)
    } else {
      groups.earlier.append(row)
    }
  }
  groups.needsReply.sort {
    (InboxRow.parseDate($0.receivedAt) ?? .distantPast)
      > (InboxRow.parseDate($1.receivedAt) ?? .distantPast)
  }
  return groups
}

public enum InboxLabel: Sendable, Equatable {
  case attention, newsletter, spam, junk
}

/// The one small label a row shows. Spam and Junk win over Needs attention, which wins over Newsletter;
/// an untriaged row (no category) has none; suspicious mail keeps only its warning icon.
public func inboxLabel(for row: InboxRow) -> InboxLabel? {
  guard let category = row.category else { return nil }
  switch category {
  case "spam": return .spam
  case "bulk", "scam": return .junk
  case "suspicious": return nil
  default: break
  }
  if row.feedback != "noise", !row.fromSelf,
    row.needsReply == true || row.priority == "critical" || row.priority == "important"
      || category == "action"
  {
    return .attention
  }
  return category == "newsletter" ? .newsletter : nil
}

public enum InboxTimeStyle: Sendable, Equatable {
  case time, weekday, monthDay
}

/// Today shows the clock, the past six days the weekday, anything older the month and day.
public func inboxTimeStyle(of date: Date, now: Date, calendar: Calendar = .current) -> InboxTimeStyle {
  let days =
    calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now))
    .day ?? 0
  if days <= 0 { return .time }
  return days < 7 ? .weekday : .monthDay
}

extension InboxRow {
  public var isSuspicious: Bool { category == "suspicious" }

  /// The line under the subject: the model's reason, else the snippet, on one line.
  public var summary: String {
    let reasonText = reason?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let text = reasonText.isEmpty ? snippet : reasonText
    return text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
  }

  public var date: Date? { Self.parseDate(receivedAt) }

  /// ISO 8601 with or without fractional seconds.
  public static func parseDate(_ value: String) -> Date? {
    let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    return (try? Date(value, strategy: fractional)) ?? (try? Date(value, strategy: .iso8601))
  }
}
