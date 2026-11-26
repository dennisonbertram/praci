import Foundation

// Hand-written, tolerant views over the blocks that wait on, or record, a decision, plus the
// inputs of `threads.answer`, `mcp.assignments.{approve,dismiss}` and `onboarding.{choose,dismissFocus}`.
// Shapes follow `MessageBlock` in packages/contracts/src/events.ts. Status and outcome strings stay
// `String`, so a value the server adds later never fails decoding.

/// One answer button of an `ask` block.
public struct AskAction: Decodable, Equatable, Sendable {
  public let id: String
  public let label: String
  /// Set on a money or space request that the answer creates or cancels.
  public let outcome: String?
}

/// The mail an approval would draft or send (`MailApprovalSchema`).
public struct MailApproval: Decodable, Equatable, Sendable {
  public let tool: String
  public let account: String?
  // swiftlint:disable identifier_name
  public let to: [String]
  public let cc: [String]
  // swiftlint:enable identifier_name
  public let bcc: [String]
  public let subject: String
  public let body: String
  public let reply: Bool
  public let locked: Bool
  /// Set once the person acted on the card: "sent", "saved", "unknown" or "failed".
  public let outcome: String?

  private enum CodingKeys: String, CodingKey {
    // swiftlint:disable:next identifier_name
    case tool, account, to, cc, bcc, subject, body, reply, locked, outcome
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    tool = try container.decodeIfPresent(String.self, forKey: .tool) ?? "mail_send"
    account = try container.decodeIfPresent(String.self, forKey: .account)
    to = try container.decodeIfPresent([String].self, forKey: .to) ?? []
    cc = try container.decodeIfPresent([String].self, forKey: .cc) ?? []
    bcc = try container.decodeIfPresent([String].self, forKey: .bcc) ?? []
    subject = try container.decodeIfPresent(String.self, forKey: .subject) ?? ""
    body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
    reply = try container.decodeIfPresent(Bool.self, forKey: .reply) ?? false
    locked = try container.decodeIfPresent(Bool.self, forKey: .locked) ?? false
    outcome = try container.decodeIfPresent(String.self, forKey: .outcome)
  }

  /// "Re: subject" for a reply, the subject otherwise.
  public var title: String {
    guard reply, !subject.lowercased().hasPrefix("re:") else { return subject }
    return "Re: \(subject)"
  }

  public var isDraftTool: Bool { tool == "mail_draft" }
  /// Sending needs a recipient, unless the card sends an already saved draft.
  public var canSend: Bool { !to.isEmpty || locked }
}

/// A secret request's destination (`credential` on an `ask` block).
public struct SecretCredential: Decodable, Equatable, Sendable {
  public let name: String
  public let origin: String
  public let authType: String

  private enum CodingKeys: String, CodingKey { case name, origin, auth }
  private struct Auth: Decodable { let type: String? }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    origin = try container.decodeIfPresent(String.self, forKey: .origin) ?? ""
    authType = try container.decodeIfPresent(Auth.self, forKey: .auth)?.type ?? ""
  }
}

/// How a decided ask reads once answered. The app maps each case to localized text.
public enum AskOutcome: Equatable, Sendable {
  case allowedOnce, alwaysAllowed, alwaysAllowedForRoutine, alwaysAllowedForSites, denied, approved
  case approvedWaiting(String)
  case allowed, notNow, shared, notShared
  case created, cancelled
  case superseded, expired, stopped, skipped
  case saved
  case answered(String?)
}

public struct AskBlock: Decodable, Equatable, Sendable {
  public let text: String
  public let approvalReason: String?
  public let approvalEffectId: String?
  public let toolId: String?
  public let detail: String?
  /// Raw tool arguments: shown behind a "Details" disclosure instead of open on the card.
  public let detailFolded: Bool
  public let waitsFor: String?
  public let mail: MailApproval?
  public let share: Bool
  public let isConsent: Bool
  public let input: String?
  public let purpose: String?
  public let credential: SecretCredential?
  public let site: String?
  public let status: String?
  public let answer: String?
  public let actions: [AskAction]

  private enum CodingKeys: String, CodingKey {
    case text, approvalReason, approvalEffectId, toolId, detail, detailFolded, waitsFor, mail, share, consent
    case input, purpose, credential, site, status, answer, actions
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    text = try container.decodeIfPresent(String.self, forKey: .text) ?? ""
    approvalReason = try container.decodeIfPresent(String.self, forKey: .approvalReason)
    approvalEffectId = try container.decodeIfPresent(String.self, forKey: .approvalEffectId)
    toolId = try container.decodeIfPresent(String.self, forKey: .toolId)
    detail = try container.decodeIfPresent(String.self, forKey: .detail)
    detailFolded = try container.decodeIfPresent(Bool.self, forKey: .detailFolded) ?? false
    waitsFor = try container.decodeIfPresent(String.self, forKey: .waitsFor)
    mail = try? container.decodeIfPresent(MailApproval.self, forKey: .mail)
    share = try container.decodeIfPresent(Bool.self, forKey: .share) ?? false
    isConsent = try container.contains(.consent) && !container.decodeNil(forKey: .consent)
    input = try container.decodeIfPresent(String.self, forKey: .input)
    purpose = try container.decodeIfPresent(String.self, forKey: .purpose)
    credential = try? container.decodeIfPresent(SecretCredential.self, forKey: .credential)
    site = try container.decodeIfPresent(String.self, forKey: .site)
    status = try container.decodeIfPresent(String.self, forKey: .status)
    answer = try container.decodeIfPresent(String.self, forKey: .answer)
    actions = (try? container.decodeIfPresent([AskAction].self, forKey: .actions)) ?? []
  }

  public var isAnswered: Bool { status == "answered" }
  /// A tool, mail, share or consent request: allow, optionally always, deny.
  public var isApproval: Bool {
    guard approvalEffectId != nil, !actions.isEmpty else { return false }
    let ids = Set(actions.map(\.id))
    return ids.contains("allow") && ids.contains("deny")
      && ids.isSubset(of: ["allow", "always", "always_bot_sites", "always_routine", "deny"])
  }
  public var isSecret: Bool { input == "secret" && approvalEffectId == nil }
  public var isLogin: Bool { isSecret && credential?.authType == "login" }
  public var isMail: Bool { mail != nil && isApproval }

  /// What an answered card says; nil while pending.
  public var outcome: AskOutcome? {
    guard isAnswered else { return nil }
    if isSecret { return .saved }
    guard let answer, !answer.isEmpty else { return .answered(nil) }
    if !isApproval { return .answered(actions.first { $0.id == answer }?.label) }
    switch answer {
    case "superseded": return .superseded
    case "expired": return .expired
    case "stopped": return .stopped
    case "skipped": return .skipped
    default: break
    }
    if share { return answer == "allow" ? .shared : .notShared }
    if isConsent { return answer == "allow" ? .allowed : .notNow }
    switch actions.first(where: { $0.id == answer })?.outcome {
    case "created": return .created
    case "cancelled": return .cancelled
    default: break
    }
    switch answer {
    case "allow": return waitsFor.map(AskOutcome.approvedWaiting) ?? .allowedOnce
    case "always": return .alwaysAllowed
    case "always_bot_sites": return .alwaysAllowedForSites
    case "always_routine": return .alwaysAllowedForRoutine
    case "deny": return .denied
    default: return .answered(actions.first { $0.id == answer }?.label ?? answer)
    }
  }
}

public struct ChoiceBlock: Decodable, Equatable, Sendable {
  public struct Option: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let letter: String
    public let label: String
  }

  public static let dismissedAnswerID = "_dismissed"

  public let question: String
  public let subtitle: String?
  public let options: [Option]
  public let answerID: String?

  private enum CodingKeys: String, CodingKey { case question, subtitle, options, answerId }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    question = try container.decodeIfPresent(String.self, forKey: .question) ?? ""
    subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
    options = (try? container.decodeIfPresent([Option].self, forKey: .options)) ?? []
    answerID = try container.decodeIfPresent(String.self, forKey: .answerId)
  }

  public var isDismissed: Bool { answerID == Self.dismissedAnswerID }
  /// All options until answered, then only the picked one.
  public var shownOptions: [Option] {
    guard let answerID else { return options }
    return options.filter { $0.id == answerID }
  }
}

/// `mcp_approval`: an agent-created MCP server waiting for the person's decision.
public struct McpApprovalBlock: Decodable, Equatable, Sendable {
  public let name: String
  public let serverId: String
  public let transport: String?
  public let endpoint: String?
  public let needsOAuth: Bool
  public let status: String

  private enum CodingKeys: String, CodingKey {
    case name, serverId, transport, endpoint, needsOAuth, status
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    serverId = try container.decode(String.self, forKey: .serverId)
    transport = try container.decodeIfPresent(String.self, forKey: .transport)
    endpoint = try container.decodeIfPresent(String.self, forKey: .endpoint)
    needsOAuth = try container.decodeIfPresent(Bool.self, forKey: .needsOAuth) ?? false
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
  }

  public var summary: String { endpoint ?? "stdio · \(transport ?? "")" }
}

/// `app_connect` and `connect`: an app the agent needs authorized.
public struct ConnectBlock: Decodable, Equatable, Sendable {
  public let name: String
  public let description: String?
  public let status: String

  private enum CodingKeys: String, CodingKey { case name, description, status }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    description = try container.decodeIfPresent(String.self, forKey: .description)
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
  }

  public var isConnected: Bool { status == "connected" }
}

// MARK: Answerability

/// The one message whose ask can be answered now: the newest unanswered ask that belongs to a
/// run that is waiting for input. Older pending cards read "No longer active".
public func answerableAskMessageID(
  messages: [ThreadMessage], run: ThreadRun?, activeRuns: [ThreadRun]?
) -> String? {
  let runs = activeRuns ?? run.map { [$0] } ?? []
  let waiting = Set(runs.filter { $0.status == "waiting_input" }.map(\.id))
  return messages.last { message in
    guard let runId = message.runId, waiting.contains(runId) else { return false }
    return message.blocks.contains { $0.kind == .ask && $0.status != "answered" }
  }?.id
}

// MARK: Request inputs

/// What a person may change on a mail card here: only whether to send now. Editing is done by
/// telling the agent, so there is no edit screen.
public struct MailAnswerEdits: Encodable, Equatable, Sendable {
  public var send: Bool
  public init(send: Bool) { self.send = send }
}

/// `rpc_threads_answer` input. `username` and `answer` can carry a secret: never log this value.
public struct ThreadAnswerInput: Encodable, Equatable, Sendable {
  public var botId: String?
  public var groupId: String?
  public var runId: String
  public var messageId: String
  public var answer: String
  public var username: String?
  public var mail: MailAnswerEdits?

  public init(
    botId: String? = nil, groupId: String? = nil, runId: String, messageId: String, answer: String,
    username: String? = nil, mail: MailAnswerEdits? = nil
  ) {
    self.botId = botId
    self.groupId = groupId
    self.runId = runId
    self.messageId = messageId
    self.answer = answer
    self.username = username
    self.mail = mail
  }
}

/// `rpc_mcp_assignments_approve` and `_dismiss` input.
public struct McpAssignmentInput: Encodable, Equatable, Sendable {
  public var botId: String
  public var serverId: String
  public var threadId: String?
  public init(botId: String, serverId: String, threadId: String? = nil) {
    self.botId = botId
    self.serverId = serverId
    self.threadId = threadId
  }
}

/// `rpc_onboarding_choose` input.
public struct OnboardingChooseInput: Encodable, Equatable, Sendable {
  public var botId: String
  public var optionId: String
  public init(botId: String, optionId: String) {
    self.botId = botId
    self.optionId = optionId
  }
}

/// `rpc_onboarding_dismissFocus` input.
public struct OnboardingDismissInput: Encodable, Equatable, Sendable {
  public var botId: String
  public init(botId: String) { self.botId = botId }
}
