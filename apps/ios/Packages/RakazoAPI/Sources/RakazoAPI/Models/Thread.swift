import Foundation

// Hand-written, tolerant DTOs for `threads.get` and `threads.messages`, checked against
// openapi.json. Enum-like fields stay `String` so a new server value never fails decoding.
// Value types are `var` so the thread reducer in RakazoCore can fold events into a snapshot.

extension MessageBlock: Equatable {
  public static func == (lhs: MessageBlock, rhs: MessageBlock) -> Bool {
    lhs.kind == rhs.kind && lhs.fields == rhs.fields
  }

  public init(kind: Kind, fields: [String: JSONValue] = [:]) {
    self.kind = kind
    self.fields = fields
  }
}

public struct ReplyPreview: Codable, Equatable, Sendable {
  public struct Attachment: Codable, Equatable, Sendable {
    public var kind: String
    public var artifactId: String
    public var mimeType: String?
    public var name: String?

    public init(kind: String, artifactId: String, mimeType: String? = nil, name: String? = nil) {
      self.kind = kind
      self.artifactId = artifactId
      self.mimeType = mimeType
      self.name = name
    }
  }

  public var role: String
  public var botId: String?
  public var text: String
  public var attachment: Attachment?

  public init(role: String, botId: String? = nil, text: String, attachment: Attachment? = nil) {
    self.role = role
    self.botId = botId
    self.text = text
    self.attachment = attachment
  }
}

/// One row of a thread: a stored message, or a live `progress:`/`subagent:` row built from events.
public struct ThreadMessage: Codable, Equatable, Sendable, Identifiable {
  public var id: String
  public var threadId: String
  public var seq: Int
  public var role: String
  public var blocks: [MessageBlock]
  public var botId: String?
  public var replyToMessageId: String?
  public var replyQuote: String?
  public var replyPreview: ReplyPreview?
  public var runId: String?
  public var routineName: String?
  public var callId: String?
  public var createdAt: String

  public init(
    id: String,
    threadId: String = "",
    seq: Int = 0,
    role: String = "bot",
    blocks: [MessageBlock] = [],
    botId: String? = nil,
    replyToMessageId: String? = nil,
    replyQuote: String? = nil,
    replyPreview: ReplyPreview? = nil,
    runId: String? = nil,
    routineName: String? = nil,
    callId: String? = nil,
    createdAt: String = ""
  ) {
    self.id = id
    self.threadId = threadId
    self.seq = seq
    self.role = role
    self.blocks = blocks
    self.botId = botId
    self.replyToMessageId = replyToMessageId
    self.replyQuote = replyQuote
    self.replyPreview = replyPreview
    self.runId = runId
    self.routineName = routineName
    self.callId = callId
    self.createdAt = createdAt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    threadId = try container.decodeIfPresent(String.self, forKey: .threadId) ?? ""
    seq = try container.decodeIfPresent(Int.self, forKey: .seq) ?? 0
    role = try container.decodeIfPresent(String.self, forKey: .role) ?? "bot"
    blocks = try container.decodeIfPresent([MessageBlock].self, forKey: .blocks) ?? []
    botId = try container.decodeIfPresent(String.self, forKey: .botId)
    replyToMessageId = try container.decodeIfPresent(String.self, forKey: .replyToMessageId)
    replyQuote = try container.decodeIfPresent(String.self, forKey: .replyQuote)
    replyPreview = try? container.decodeIfPresent(ReplyPreview.self, forKey: .replyPreview)
    runId = try container.decodeIfPresent(String.self, forKey: .runId)
    routineName = try container.decodeIfPresent(String.self, forKey: .routineName)
    callId = try container.decodeIfPresent(String.self, forKey: .callId)
    createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
  }
}

public struct RunPhase: Codable, Equatable, Sendable {
  public var kind: String
  public var name: String?
  // swiftlint:disable:next identifier_name
  public var at: String
  public var since: String?
  public var count: Int?

  // swiftlint:disable:next identifier_name
  public init(kind: String, name: String? = nil, at: String, since: String? = nil, count: Int? = nil) {
    self.kind = kind
    self.name = name
    self.at = at
    self.since = since
    self.count = count
  }

  /// The phase kinds the server defines; anything else is ignored by the reducer.
  public static let knownKinds: Set<String> = [
    "computer_wait", "computer_start", "connecting", "model_wait", "thinking", "retrying",
  ]
}

public struct ThreadRun: Codable, Equatable, Sendable {
  public var id: String
  public var userId: String?
  public var botId: String
  public var threadId: String
  public var taskId: String?
  public var status: String
  public var trigger: String?
  public var routineId: String?
  public var modelProvider: String?
  public var modelId: String?
  public var error: String?
  public var phase: RunPhase?
  public var startedAt: String?
  public var completedAt: String?
  public var createdAt: String?

  public init(
    id: String,
    userId: String? = nil,
    botId: String,
    threadId: String,
    taskId: String? = nil,
    status: String,
    trigger: String? = nil,
    routineId: String? = nil,
    modelProvider: String? = nil,
    modelId: String? = nil,
    error: String? = nil,
    phase: RunPhase? = nil,
    startedAt: String? = nil,
    completedAt: String? = nil,
    createdAt: String? = nil
  ) {
    self.id = id
    self.userId = userId
    self.botId = botId
    self.threadId = threadId
    self.taskId = taskId
    self.status = status
    self.trigger = trigger
    self.routineId = routineId
    self.modelProvider = modelProvider
    self.modelId = modelId
    self.error = error
    self.phase = phase
    self.startedAt = startedAt
    self.completedAt = completedAt
    self.createdAt = createdAt
  }
}

public struct ThreadMember: Codable, Equatable, Sendable {
  public var botId: String
  public var name: String
  public var color: String?
  public var status: String?

  public init(botId: String, name: String, color: String? = nil, status: String? = nil) {
    self.botId = botId
    self.name = name
    self.color = color
    self.status = status
  }
}

public struct DelegatePendingAgent: Codable, Equatable, Sendable {
  public var messageId: String
  public var id: String
  public var name: String

  public init(messageId: String, id: String, name: String) {
    self.messageId = messageId
    self.id = id
    self.name = name
  }
}

public struct ThreadComputer: Codable, Equatable, Sendable {
  public var botId: String?
  public var mode: String?
  public var kind: String?
  public var state: String?
  public var controlHolder: String?
  public var controlBotId: String?
  public var takeoverRequested: Bool?
  public var screenAvailable: Bool?
  public var screenWidth: Int?
  public var screenHeight: Int?
  public var homeRevision: String?
  public var busyBotName: String?
  public var canUpdate: Bool?
  public var terminalAvailable: Bool?

  public init(
    botId: String? = nil,
    mode: String? = nil,
    kind: String? = nil,
    state: String? = nil,
    controlHolder: String? = nil,
    controlBotId: String? = nil,
    takeoverRequested: Bool? = nil,
    screenAvailable: Bool? = nil,
    screenWidth: Int? = nil,
    screenHeight: Int? = nil,
    homeRevision: String? = nil,
    busyBotName: String? = nil,
    canUpdate: Bool? = nil,
    terminalAvailable: Bool? = nil
  ) {
    self.botId = botId
    self.mode = mode
    self.kind = kind
    self.state = state
    self.controlHolder = controlHolder
    self.controlBotId = controlBotId
    self.takeoverRequested = takeoverRequested
    self.screenAvailable = screenAvailable
    self.screenWidth = screenWidth
    self.screenHeight = screenHeight
    self.homeRevision = homeRevision
    self.busyBotName = busyBotName
    self.canUpdate = canUpdate
    self.terminalAvailable = terminalAvailable
  }
}

/// The open goal (active or paused) of a bot's thread. Enum-like fields stay `String`.
public struct ThreadGoal: Codable, Equatable, Sendable {
  public var id: String
  public var text: String
  public var status: String
  public var stopReason: String?
  public var lastReason: String?
  public var continuations: Int?
  public var startedAt: String?

  public init(
    id: String, text: String, status: String = "active", stopReason: String? = nil,
    lastReason: String? = nil, continuations: Int? = nil, startedAt: String? = nil
  ) {
    self.id = id
    self.text = text
    self.status = status
    self.stopReason = stopReason
    self.lastReason = lastReason
    self.continuations = continuations
    self.startedAt = startedAt
  }
}

/// Output of `threads.get`. `cursor` is the highest event seq already folded in (-1 when none).
public struct ThreadSnapshot: Codable, Equatable, Sendable {
  public var threadId: String
  public var cursor: Int
  public var messages: [ThreadMessage]
  public var olderCursor: Int?
  public var lastReadSeq: Int?
  public var botId: String?
  public var groupId: String?
  public var groupName: String?
  public var members: [ThreadMember]?
  public var run: ThreadRun?
  public var activeRuns: [ThreadRun]?
  public var delegatePending: [String]?
  public var delegatePendingAgents: [DelegatePendingAgent]?
  public var computer: ThreadComputer?
  public var goal: ThreadGoal?

  public init(
    threadId: String,
    cursor: Int,
    messages: [ThreadMessage] = [],
    olderCursor: Int? = nil,
    lastReadSeq: Int? = nil,
    botId: String? = nil,
    groupId: String? = nil,
    groupName: String? = nil,
    members: [ThreadMember]? = nil,
    run: ThreadRun? = nil,
    activeRuns: [ThreadRun]? = nil,
    delegatePending: [String]? = nil,
    delegatePendingAgents: [DelegatePendingAgent]? = nil,
    computer: ThreadComputer? = nil,
    goal: ThreadGoal? = nil
  ) {
    self.threadId = threadId
    self.cursor = cursor
    self.messages = messages
    self.olderCursor = olderCursor
    self.lastReadSeq = lastReadSeq
    self.botId = botId
    self.groupId = groupId
    self.groupName = groupName
    self.members = members
    self.run = run
    self.activeRuns = activeRuns
    self.delegatePending = delegatePending
    self.delegatePendingAgents = delegatePendingAgents
    self.computer = computer
    self.goal = goal
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    threadId = try container.decode(String.self, forKey: .threadId)
    cursor = try container.decodeIfPresent(Int.self, forKey: .cursor) ?? -1
    messages = try container.decodeIfPresent([ThreadMessage].self, forKey: .messages) ?? []
    olderCursor = try container.decodeIfPresent(Int.self, forKey: .olderCursor)
    lastReadSeq = try container.decodeIfPresent(Int.self, forKey: .lastReadSeq)
    botId = try container.decodeIfPresent(String.self, forKey: .botId)
    groupId = try container.decodeIfPresent(String.self, forKey: .groupId)
    groupName = try container.decodeIfPresent(String.self, forKey: .groupName)
    members = try container.decodeIfPresent([ThreadMember].self, forKey: .members)
    run = try container.decodeIfPresent(ThreadRun.self, forKey: .run)
    activeRuns = try container.decodeIfPresent([ThreadRun].self, forKey: .activeRuns)
    delegatePending = try container.decodeIfPresent([String].self, forKey: .delegatePending)
    delegatePendingAgents = try container.decodeIfPresent(
      [DelegatePendingAgent].self, forKey: .delegatePendingAgents
    )
    computer = try container.decodeIfPresent(ThreadComputer.self, forKey: .computer)
    // A malformed goal must not hide the thread.
    goal = try? container.decodeIfPresent(ThreadGoal.self, forKey: .goal)
  }
}

/// Output of `threads.messages`: one older (or around-a-message) page.
public struct ThreadMessagePage: Codable, Equatable, Sendable {
  public var threadId: String
  public var messages: [ThreadMessage]
  public var olderCursor: Int?
  public var coveredThroughSeq: Int?

  public init(
    threadId: String,
    messages: [ThreadMessage] = [],
    olderCursor: Int? = nil,
    coveredThroughSeq: Int? = nil
  ) {
    self.threadId = threadId
    self.messages = messages
    self.olderCursor = olderCursor
    self.coveredThroughSeq = coveredThroughSeq
  }
}
