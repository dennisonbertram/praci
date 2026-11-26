// The mail models and the cleanup runner share one file.
// swiftlint:disable file_length
import Foundation

// Mail message, compose, to-do and cleanup models. Hand-written and tolerant: missing or null fields fall
// back to empty values. Shapes checked against openapi.json (rpc_inbox_get, rpc_inbox_compose_*,
// rpc_inbox_todos_*, rpc_inbox_cleanup_*, rpc_inbox_unsubscribe, rpc_inbox_askAgent) and recorded from the demo.
// Inbox list types live in Inbox.swift.

public struct MailAttachment: Decodable, Sendable, Identifiable, Hashable {
  public var id: String
  public var filename: String
  public var mimeType: String
  public var size: Int

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    filename = try container.decodeIfPresent(String.self, forKey: .filename) ?? ""
    mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType) ?? ""
    size = try container.decodeIfPresent(Int.self, forKey: .size) ?? 0
  }

  private enum CodingKeys: String, CodingKey { case id, filename, mimeType, size }
}

/// One earlier or later message of the conversation (no body).
public struct MailThreadEntry: Decodable, Sendable, Identifiable, Hashable {
  public var id: String
  public var from: String
  public var receivedAt: String
  public var snippet: String
  public var fromSelf: Bool

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    from = try container.decodeIfPresent(String.self, forKey: .from) ?? ""
    receivedAt = try container.decodeIfPresent(String.self, forKey: .receivedAt) ?? ""
    snippet = try container.decodeIfPresent(String.self, forKey: .snippet) ?? ""
    fromSelf = try container.decodeIfPresent(Bool.self, forKey: .fromSelf) ?? false
  }

  private enum CodingKeys: String, CodingKey { case id, from, receivedAt, snippet, fromSelf }
}

/// rpc_inbox_get. The server sends no message id back; the screen already has it.
public struct MailMessage: Decodable, Sendable {
  public var from: String
  public var fromSelf: Bool
  // swiftlint:disable:next identifier_name
  public var to: String
  // swiftlint:disable:next identifier_name
  public var cc: String
  public var replyAllDiffers: Bool
  public var date: String
  public var subject: String
  public var html: String?
  public var text: String?
  public var attachments: [MailAttachment]
  public var unread: Bool
  public var inInbox: Bool
  public var thread: [MailThreadEntry]
  public var later: [MailThreadEntry]

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    from = try container.decodeIfPresent(String.self, forKey: .from) ?? ""
    fromSelf = try container.decodeIfPresent(Bool.self, forKey: .fromSelf) ?? false
    to = try container.decodeIfPresent(String.self, forKey: .to) ?? ""
    cc = try container.decodeIfPresent(String.self, forKey: .cc) ?? ""
    replyAllDiffers = try container.decodeIfPresent(Bool.self, forKey: .replyAllDiffers) ?? false
    date = try container.decodeIfPresent(String.self, forKey: .date) ?? ""
    subject = try container.decodeIfPresent(String.self, forKey: .subject) ?? ""
    html = try? container.decodeIfPresent(String.self, forKey: .html)
    text = try? container.decodeIfPresent(String.self, forKey: .text)
    attachments = try container.decodeIfPresent([MailAttachment].self, forKey: .attachments) ?? []
    unread = try container.decodeIfPresent(Bool.self, forKey: .unread) ?? false
    inInbox = try container.decodeIfPresent(Bool.self, forKey: .inInbox) ?? true
    thread = try container.decodeIfPresent([MailThreadEntry].self, forKey: .thread) ?? []
    later = try container.decodeIfPresent([MailThreadEntry].self, forKey: .later) ?? []
  }

  private enum CodingKeys: String, CodingKey {
    // swiftlint:disable:next identifier_name
    case from, fromSelf, to, cc, replyAllDiffers, date, subject, html, text, attachments
    case unread, inInbox, thread, later
  }
}

// MARK: - Compose

public struct MailAccount: Decodable, Sendable, Identifiable, Hashable {
  public var connectionId: String
  public var label: String
  public var address: String?
  /// `ready`, `needs_permission` or `unsupported`.
  public var senderRules: String?
  public var id: String { connectionId }

  public init(connectionId: String, label: String, address: String? = nil, senderRules: String? = nil) {
    self.connectionId = connectionId
    self.label = label
    self.address = address
    self.senderRules = senderRules
  }
}

public struct MailLeftOutAttachment: Decodable, Sendable, Hashable {
  public var filename: String
  public var size: Int
}

/// rpc_inbox_compose_prefill
public struct ComposePrefill: Decodable, Sendable {
  public var connectionId: String
  public var account: MailAccount?
  // swiftlint:disable:next identifier_name
  public var to: String
  // swiftlint:disable:next identifier_name
  public var cc: String
  public var subject: String
  public var body: String
  public var quotedHtml: String?
  public var replyToMessageId: String?
  public var attachments: [MailAttachment]
  public var attachmentsTooLarge: Bool
  public var attachmentsLeftOut: [MailLeftOutAttachment]
  public var quoteUnavailable: Bool

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    connectionId = try container.decodeIfPresent(String.self, forKey: .connectionId) ?? ""
    account = try? container.decodeIfPresent(MailAccount.self, forKey: .account)
    to = try container.decodeIfPresent(String.self, forKey: .to) ?? ""
    cc = try container.decodeIfPresent(String.self, forKey: .cc) ?? ""
    subject = try container.decodeIfPresent(String.self, forKey: .subject) ?? ""
    body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
    quotedHtml = try? container.decodeIfPresent(String.self, forKey: .quotedHtml)
    replyToMessageId = try? container.decodeIfPresent(String.self, forKey: .replyToMessageId)
    attachments = try container.decodeIfPresent([MailAttachment].self, forKey: .attachments) ?? []
    attachmentsTooLarge = try container.decodeIfPresent(Bool.self, forKey: .attachmentsTooLarge) ?? false
    attachmentsLeftOut =
      try container.decodeIfPresent([MailLeftOutAttachment].self, forKey: .attachmentsLeftOut) ?? []
    quoteUnavailable = try container.decodeIfPresent(Bool.self, forKey: .quoteUnavailable) ?? false
  }

  private enum CodingKeys: String, CodingKey {
    // swiftlint:disable:next identifier_name
    case connectionId, account, to, cc, subject, body, quotedHtml, replyToMessageId, attachments
    case attachmentsTooLarge, attachmentsLeftOut, quoteUnavailable
  }
}

/// rpc_inbox_compose_send and rpc_inbox_compose_draftSave. `unknown` is a real server outcome: the
/// message may have gone out, so the caller must never send again on its own.
public enum ComposeOutcome: Sendable, Equatable {
  case saved, sent, unknown, reconnect, disabled
  case failed(reason: String?)
  case unrecognized(String)
}

public struct ComposeResult: Decodable, Sendable {
  public var outcome: ComposeOutcome

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let status = try container.decodeIfPresent(String.self, forKey: .status) ?? ""
    let reason = try? container.decodeIfPresent(String.self, forKey: .reason)
    switch status {
    case "saved": outcome = .saved
    case "sent": outcome = .sent
    case "unknown": outcome = .unknown
    case "reconnect": outcome = .reconnect
    case "disabled": outcome = .disabled
    case "failed": outcome = .failed(reason: reason)
    default: outcome = .unrecognized(status)
    }
  }

  private enum CodingKeys: String, CodingKey { case status, reason }
}

// MARK: - Addresses

public struct MailAddress: Sendable, Equatable {
  public var name: String?
  public var address: String

  public var display: String { name.map { $0.isEmpty ? address : $0 } ?? address }
}

public enum MailAddresses {
  /// Splits "A <a@x.test>, b@y.test" at commas outside quotes and angle brackets.
  public static func split(_ list: String) -> [String] {
    var parts: [String] = []
    var current = ""
    var quoted = false
    var angle = false
    for char in list {
      switch char {
      case "\"": quoted.toggle()
      case "<" where !quoted: angle = true
      case ">" where !quoted: angle = false
      default: break
      }
      if (char == "," || char == ";") && !quoted && !angle {
        parts.append(current)
        current = ""
      } else {
        current.append(char)
      }
    }
    parts.append(current)
    return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
  }

  /// "Name <a@x.test>" or "a@x.test"; nil when no usable address is present.
  public static func parse(_ value: String) -> MailAddress? {
    let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if let open = text.lastIndex(of: "<"), let close = text.lastIndex(of: ">"), open < close {
      let address = String(text[text.index(after: open)..<close]).trimmingCharacters(in: .whitespaces)
      guard isValid(address) else { return nil }
      let name = String(text[..<open]).trimmingCharacters(in: CharacterSet(charactersIn: " \"\t"))
      return MailAddress(name: name.isEmpty ? nil : name, address: address)
    }
    return isValid(text) ? MailAddress(name: nil, address: text) : nil
  }

  /// One local part, one `@`, a dotted domain, no spaces or angle brackets.
  public static func isValid(_ address: String) -> Bool {
    let bad = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "<>,;\""))
    guard address.rangeOfCharacter(from: bad) == nil else { return false }
    let parts = address.split(separator: "@", omittingEmptySubsequences: false)
    guard parts.count == 2, !parts[0].isEmpty else { return false }
    let domain = parts[1].split(separator: ".", omittingEmptySubsequences: false)
    return domain.count >= 2 && domain.allSatisfy { !$0.isEmpty }
  }

  /// The addresses of a recipient field that do not parse (empty when the field is valid or blank).
  public static func invalid(in list: String) -> [String] {
    split(list).filter { parse($0) == nil }
  }

  /// The sender address of a "Name <a@x.test>" header, for the unsubscribe call.
  public static func sender(of header: String) -> MailAddress? { parse(header) }
}

// MARK: - To-dos

/// rpc_inbox_todos_list item and rpc_inbox_todos_setDone result.
public struct MailTodo: Decodable, Sendable, Identifiable, Hashable {
  public var id: String
  public var connectionId: String?
  public var meetingId: String?
  public var messageId: String?
  public var text: String
  public var detail: String?
  public var from: String?
  public var priority: String?
  public var dueOn: String?
  public var doneAt: String?

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    connectionId = try? container.decodeIfPresent(String.self, forKey: .connectionId)
    meetingId = try? container.decodeIfPresent(String.self, forKey: .meetingId)
    messageId = try? container.decodeIfPresent(String.self, forKey: .messageId)
    text = try container.decodeIfPresent(String.self, forKey: .text) ?? ""
    detail = try? container.decodeIfPresent(String.self, forKey: .detail)
    from = try? container.decodeIfPresent(String.self, forKey: .from)
    priority = try? container.decodeIfPresent(String.self, forKey: .priority)
    dueOn = try? container.decodeIfPresent(String.self, forKey: .dueOn)
    doneAt = try? container.decodeIfPresent(String.self, forKey: .doneAt)
  }

  private enum CodingKeys: String, CodingKey {
    case id, connectionId, meetingId, messageId, text, detail, from, priority, dueOn, doneAt
  }
}

/// rpc_inbox_todos_list
public struct MailTodoList: Decodable, Sendable {
  public var enabled: Bool
  public var todos: [MailTodo]

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
    todos = try container.decodeIfPresent([MailTodo].self, forKey: .todos) ?? []
  }

  private enum CodingKeys: String, CodingKey { case enabled, todos }
}

// MARK: - Cleanup

public enum CleanupKind: String, Sendable, Codable, CaseIterable {
  case archive, unsubscribe, spam
  case skipInbox = "skip_inbox"
}

/// rpc_inbox_cleanup_list sender.
public struct CleanupSender: Decodable, Sendable, Identifiable, Hashable {
  public var connectionId: String
  public var address: String
  public var name: String
  public var messageCount: Int
  public var readCount: Int
  public var lastReceivedAt: String?
  public var inboxThreads: Int
  public var preselected: Bool
  public var spamLike: Bool
  /// `one_click`, `link`, `mailto`, `refused` or `none`.
  public var unsubscribe: String
  public var skipInbox: Bool
  public var unsubscribeStatus: String?
  public var learnedPile: String?

  public var id: String { Self.key(connectionId, address) }

  public static func key(_ connectionId: String, _ address: String) -> String {
    "\(connectionId):\(address.lowercased())"
  }

  public var canUnsubscribe: Bool { ["one_click", "link", "mailto"].contains(unsubscribe) }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    connectionId = try container.decode(String.self, forKey: .connectionId)
    address = try container.decode(String.self, forKey: .address)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount) ?? 0
    readCount = try container.decodeIfPresent(Int.self, forKey: .readCount) ?? 0
    lastReceivedAt = try? container.decodeIfPresent(String.self, forKey: .lastReceivedAt)
    inboxThreads = try container.decodeIfPresent(Int.self, forKey: .inboxThreads) ?? 0
    preselected = try container.decodeIfPresent(Bool.self, forKey: .preselected) ?? false
    spamLike = try container.decodeIfPresent(Bool.self, forKey: .spamLike) ?? false
    unsubscribe = try container.decodeIfPresent(String.self, forKey: .unsubscribe) ?? "none"
    skipInbox = try container.decodeIfPresent(Bool.self, forKey: .skipInbox) ?? false
    unsubscribeStatus = try? container.decodeIfPresent(String.self, forKey: .unsubscribeStatus)
    learnedPile = try? container.decodeIfPresent(String.self, forKey: .learnedPile)
  }

  public init(
    connectionId: String, address: String, name: String = "", messageCount: Int = 0, readCount: Int = 0,
    inboxThreads: Int = 0, spamLike: Bool = false, unsubscribe: String = "none"
  ) {
    self.connectionId = connectionId
    self.address = address
    self.name = name
    self.messageCount = messageCount
    self.readCount = readCount
    self.inboxThreads = inboxThreads
    self.preselected = false
    self.spamLike = spamLike
    self.unsubscribe = unsubscribe
    self.skipInbox = false
  }

  private enum CodingKeys: String, CodingKey {
    case connectionId, address, name, messageCount, readCount, lastReceivedAt, inboxThreads
    case preselected, spamLike, unsubscribe, skipInbox, unsubscribeStatus, learnedPile
  }
}

/// rpc_inbox_cleanup_list
public struct CleanupList: Decodable, Sendable {
  public var accounts: [MailAccount]
  public var senders: [CleanupSender]
  public var syncedAt: String?

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    accounts = try container.decodeIfPresent([MailAccount].self, forKey: .accounts) ?? []
    senders = try container.decodeIfPresent([CleanupSender].self, forKey: .senders) ?? []
    syncedAt = try? container.decodeIfPresent(String.self, forKey: .syncedAt)
  }

  private enum CodingKeys: String, CodingKey { case accounts, senders, syncedAt }
}

/// rpc_inbox_cleanup_archive. Call again with the same `batchId` until `remaining` is 0.
public struct CleanupArchiveResult: Decodable, Sendable {
  public var batchId: String
  public var done: Int
  public var failed: Int
  public var remaining: Int
}

/// rpc_inbox_unsubscribe
public struct UnsubscribeResult: Decodable, Sendable {
  /// `done`, `opened`, `sent`, `unknown`, `failed`, `refused`, `needs_confirmation`, `disabled`, `unavailable`.
  public var status: String
  public var openUrl: String?
  public var mailTo: String?

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? ""
    openUrl = try? container.decodeIfPresent(String.self, forKey: .openUrl)
    mailTo = try? container.decodeIfPresent(String.self, forKey: .mailTo)
  }

  public init(status: String, openUrl: String? = nil, mailTo: String? = nil) {
    self.status = status
    self.openUrl = openUrl
    self.mailTo = mailTo
  }

  private enum CodingKeys: String, CodingKey { case status, openUrl, mailTo }
}

/// The part of the bot rpc_inbox_askAgent returns that the app needs: which thread to open.
public struct AskAgentResult: Decodable, Sendable {
  public var id: String
  public var threadId: String?
  public var name: String?
}

// MARK: - Cleanup logic (port of packages/core mail-cleanup.ts and mail-cleanup-run.ts)

public enum CleanupLogic {
  /// Most unopened mail first, then the larger sender, then address.
  public static func rank(_ senders: [CleanupSender]) -> [CleanupSender] {
    senders.sorted {
      let unreadA = $0.messageCount - $0.readCount
      let unreadB = $1.messageCount - $1.readCount
      if unreadA != unreadB { return unreadA > unreadB }
      if $0.messageCount != $1.messageCount { return $0.messageCount > $1.messageCount }
      return $0.address.localizedCompare($1.address) == .orderedAscending
    }
  }

  /// The selected senders a choice applies to: skip inbox leaves out spam-like senders, unsubscribe
  /// leaves out senders with no way to.
  public static func targets(
    _ kind: CleanupKind, senders: [CleanupSender], selected: Set<String>
  ) -> [CleanupSender] {
    senders.filter {
      guard selected.contains($0.id) else { return false }
      switch kind {
      case .skipInbox: return !$0.spamLike
      case .unsubscribe: return $0.canUnsubscribe
      default: return true
      }
    }
  }

  /// Conversations a choice would touch: the senders' inbox threads.
  public static func threadCount(_ senders: [CleanupSender]) -> Int {
    senders.reduce(0) { $0 + $1.inboxThreads }
  }

  public struct Failure: Sendable, Equatable {
    // swiftlint:disable:next nesting
    public enum Reason: Sendable, Equatable {
      case archive, unsubscribe, refused, disabled, unavailable, unknown, error(String)
    }
    public var sender: CleanupSender
    public var reason: Reason
    public var openUrl: String?
  }

  public struct RunResult: Sendable {
    public var batchIds: [String] = []
    public var done = 0
    public var failed: [Failure] = []
    public var openLinks: [(sender: CleanupSender, url: String)] = []
    /// Senders whose unsubscribe email waits for the user's OK.
    public var confirm: [(sender: CleanupSender, mailTo: String)] = []
  }

  public struct Api: Sendable {
    public var archive:
      @Sendable (_ kind: CleanupKind, _ sender: CleanupSender, _ batchId: String?) async throws
        -> CleanupArchiveResult
    public var unsubscribe:
      @Sendable (_ sender: CleanupSender, _ confirmMailto: Bool) async throws -> UnsubscribeResult

    public init(
      archive: @escaping @Sendable (CleanupKind, CleanupSender, String?) async throws
        -> CleanupArchiveResult,
      unsubscribe: @escaping @Sendable (CleanupSender, Bool) async throws -> UnsubscribeResult
    ) {
      self.archive = archive
      self.unsubscribe = unsubscribe
    }
  }

  /// Records an unsubscribe step in `result`. Returns true when the sender's mail must not be archived.
  private static func applyUnsubscribe(
    _ step: UnsubscribeResult, sender: CleanupSender, to result: inout RunResult
  ) -> Bool {
    func fail(_ reason: Failure.Reason, openUrl: String? = nil) -> Bool {
      result.failed.append(Failure(sender: sender, reason: reason, openUrl: openUrl))
      return true
    }
    switch step.status {
    case "needs_confirmation":
      result.confirm.append((sender, step.mailTo ?? sender.address))
      return true
    case "failed": return fail(.unsubscribe, openUrl: step.openUrl)
    case "refused": return fail(.refused)
    case "disabled": return fail(.disabled)
    case "unavailable": return fail(.unavailable)
    case "unknown": return fail(.unknown)
    case "opened":
      if let url = step.openUrl { result.openLinks.append((sender, url)) }
      return false
    default: return false
    }
  }

  /// A cleanup of one sender is at most this many pages of 50 conversations.
  static let maxPages = 200

  /// Applies one choice to each sender in turn. Unsubscribe goes first and the sender's mail is
  /// archived only after a step that took effect; mailto senders wait for `confirmMailto`. An
  /// unsubscribe whose result is `unknown` is reported and never retried. One sender's failure never
  /// stops the others.
  public static func run(
    _ kind: CleanupKind, senders: [CleanupSender], api: Api, confirmMailto: Bool = false
  ) async -> RunResult {
    var result = RunResult()
    for sender in senders {
      do {
        if kind == .unsubscribe {
          let step = try await api.unsubscribe(sender, confirmMailto)
          if applyUnsubscribe(step, sender: sender, to: &result) { continue }
        }
        var batchId: String?
        var last: CleanupArchiveResult?
        var changed = 0
        for _ in 0..<maxPages {
          let page = try await api.archive(kind, sender, batchId)
          last = page
          batchId = page.batchId
          result.done += page.done
          changed += page.done
          if page.remaining == 0 || page.done == 0 { break }
        }
        // A batch that changed nothing wrote no log row, so there is nothing to undo.
        if let batchId, changed > 0 { result.batchIds.append(batchId) }
        if let last, last.remaining > 0 { result.failed.append(Failure(sender: sender, reason: .archive)) }
      } catch {
        result.failed.append(Failure(sender: sender, reason: .error(error.localizedDescription)))
      }
    }
    return result
  }
}
