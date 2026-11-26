import Foundation

public enum AIDataUse: String, Codable, Sendable, Equatable {
  case model, voice, memory
}

public struct AIRecipient: Codable, Sendable, Equatable {
  public var key: String
  public var name: String
  public var use: AIDataUse
  public var detail: String
  public var privacyURL: String?
  public var allowed: Bool

  public init(
    key: String, name: String, use: AIDataUse, detail: String = "", privacyURL: String? = nil,
    allowed: Bool
  ) {
    self.key = key
    self.name = name
    self.use = use
    self.detail = detail
    self.privacyURL = privacyURL
    self.allowed = allowed
  }

  enum CodingKeys: String, CodingKey {
    case key, name, use, detail, allowed
    case privacyURL = "privacyUrl"
  }
}

public struct AIConsentStatus: Codable, Sendable, Equatable {
  public var scope: String
  public var version: String
  public var recipients: [AIRecipient]
  public var privacyURL: String?

  public init(
    scope: String, version: String, recipients: [AIRecipient], privacyURL: String? = nil
  ) {
    self.scope = scope
    self.version = version
    self.recipients = recipients
    self.privacyURL = privacyURL
  }

  enum CodingKeys: String, CodingKey {
    case scope, version, recipients
    case privacyURL = "privacyUrl"
  }
}

public struct AIConsentGrant: Sendable, Equatable {
  public var scope: String
  public var version: String
  public var keys: [String]
}

public enum AIConsent {
  public static let required =
    "Review AI data sharing in Settings under Privacy and approvals before continuing."
  public static let privacyURL =
    "https://github.com/dennisonbertram/rakazo/blob/main/docs/ai-data-sharing-review.md"

  public static func disclosure(for use: AIDataUse) -> String {
    switch use {
    case .model:
      "Messages, chat history, bot instructions, memories, attachments, screenshots "
        + "and connected-app content are sent to run your bots, including routines."
    case .voice:
      "Your recordings are sent for transcription, and text you play is sent to generate speech."
    case .memory:
      "Conversation summaries, memories, searches and bot and Space IDs are sent to store and recall context."
    }
  }

  /// Only user actions that can start AI processing need a foreground disclosure.
  /// `routineActive` is the `active` field of a `routines/update` input, when present.
  public static func uses(forProcedure procedure: String, routineActive: Bool? = nil)
    -> [AIDataUse]
  {
    let path = procedure.replacingOccurrences(of: ".", with: "/")
    if path == "routines/update", routineActive == false { return [] }
    switch path {
    case "threads/send", "artifacts/create", "threads/followUp", "threads/react",
         "threads/answer", "routines/create", "routines/update", "routines/testRun":
      return [.model, .memory]
    case "voice/prepare", "voice/speak", "voice/transcribe":
      return [.voice]
    default:
      return []
    }
  }
}

/// A foreground check failed before the requested mutation was dispatched.
public struct AIConsentBlocked: LocalizedError {
  public let message: String
  /// Keeps an unreachable server recognizable behind the consent check.
  public let underlying: (any Error)?

  public init(_ message: String = AIConsent.required, underlying: (any Error)? = nil) {
    self.message = message
    self.underlying = underlying
  }

  public var errorDescription: String? {
    message
  }
}

struct AIConsentDeclined: LocalizedError {
  var errorDescription: String? {
    AIConsent.required
  }
}

/// Coalesces concurrent prompts and grants for one API server, account-space scope and recipient.
public actor AIConsentGate {
  private var pending: [String: Task<Void, any Error>] = [:]

  public init() {}

  public func ensure(
    uses: [AIDataUse],
    coalesceKey: String = "",
    status: @Sendable () async throws -> AIConsentStatus,
    prompt: @escaping @Sendable (AIRecipient, String?) async -> Bool,
    allow: @escaping @Sendable (AIConsentGrant) async throws -> Void
  ) async throws {
    if uses.isEmpty { return }
    do {
      let current = try await status()
      for recipient in current.recipients where !recipient.allowed && uses.contains(recipient.use) {
        let key = [coalesceKey, current.scope, current.version, recipient.key]
          .joined(separator: "\u{0}")
        let task: Task<Void, any Error>
        if let existing = pending[key] {
          task = existing
        } else {
          task = Task {
            guard await prompt(recipient, current.privacyURL) else { throw AIConsentDeclined() }
            try await allow(
              AIConsentGrant(
                scope: current.scope, version: current.version, keys: [recipient.key]
              )
            )
          }
          pending[key] = task
          Task { [weak self] in
            _ = await task.result
            await self?.finish(key)
          }
        }
        try await task.value
      }
    } catch {
      throw AIConsentBlocked(
        (error as? LocalizedError)?.errorDescription ?? AIConsent.required, underlying: error
      )
    }
  }

  private func finish(_ key: String) {
    pending[key] = nil
  }
}

public struct AIConsentTarget: Sendable, Equatable {
  public var botID: String?
  public var groupID: String?
  public var routineID: String?

  public init(botID: String? = nil, groupID: String? = nil, routineID: String? = nil) {
    self.botID = botID
    self.groupID = groupID
    self.routineID = routineID
  }

  /// A group wins over a bot; the routine travels with whichever is present.
  public static func resolve(botID: String?, groupID: String?, routineID: String?)
    -> AIConsentTarget
  {
    if let groupID { return AIConsentTarget(groupID: groupID, routineID: routineID) }
    if let botID { return AIConsentTarget(botID: botID, routineID: routineID) }
    return AIConsentTarget(routineID: routineID)
  }
}
