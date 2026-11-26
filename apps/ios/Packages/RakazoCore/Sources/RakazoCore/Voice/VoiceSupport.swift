import Foundation
import RakazoAPI

/// `rpc_voice_status`. Every field is optional so a server that drops one still decodes.
public struct CallVoiceStatus: Decodable, Sendable, Equatable {
  public var configured: Bool?
  public var ready: Bool?
  public var transcribe: Bool?
  public var provider: String?
  public var transcriptionReady: Bool?

  public init(
    configured: Bool? = nil, ready: Bool? = nil, transcribe: Bool? = nil, provider: String? = nil,
    transcriptionReady: Bool? = nil
  ) {
    self.configured = configured
    self.ready = ready
    self.transcribe = transcribe
    self.provider = provider
    self.transcriptionReady = transcriptionReady
  }

  /// The provider can turn a recording into text, so a device that cannot listen still works.
  public var canTranscribe: Bool { transcribe == true && transcriptionReady != false }
  /// The provider can turn a reply into speech.
  public var canSpeak: Bool { ready == true }
}

/// `rpc_voice_prepare`: the reply split into pieces the hosted provider can render one by one.
public struct VoicePrepared: Decodable, Sendable, Equatable {
  public var ready: Bool
  public var utterances: [String]
}

/// Run statuses in which the bot is still working, so a half-written reply is never spoken.
private let activeRunStatuses: Set<String> = [
  "queued", "leased", "running", "waiting_input", "waiting_takeover",
]

public struct CallReply: Sendable, Equatable {
  public var messageID: String
  public var text: String
  public var runID: String?
}

/// Decides, snapshot by snapshot, which bot message the call speaks next.
public struct CallReplyTracker: Sendable {
  public let callID: String
  public private(set) var lastSeen: String?

  public init(callID: String, snapshot: ThreadSnapshot) {
    self.callID = callID
    lastSeen = latestSpokenCallReply(snapshot.messages, callID: callID)?.id
  }

  /// The newest reply inside this call's card, once its own run has settled.
  public mutating func next(in snapshot: ThreadSnapshot) -> CallReply? {
    guard let message = latestSpokenCallReply(snapshot.messages, callID: callID),
      message.id != lastSeen
    else { return nil }
    // Wait for the message's own run to settle so half-written blocks are never spoken; another
    // run still working says nothing about this one.
    let run = snapshot.run
    let fromAnotherRun = message.runId != nil && message.runId != run?.id
    if !fromAnotherRun, let run, activeRunStatuses.contains(run.status) { return nil }
    let text = message.blocks.filter { $0.kind == .text }.compactMap(\.text)
      .joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { return nil }
    lastSeen = message.id
    return CallReply(messageID: message.id, text: text, runID: message.runId)
  }
}

/// Ends a recorded turn once the speaker goes quiet (the fallback when the device cannot listen).
/// ponytail: fixed level threshold; swap for a voice-activity model if steady background noise
/// starts cutting people off mid-sentence.
public struct SilenceEndpointer: Sendable {
  public static let speechLevel: Float = -35
  public static let silenceHang = Duration.milliseconds(1_200)
  public static let poll = Duration.milliseconds(200)
  public static let maxClip = Duration.seconds(30)

  public private(set) var heardSpeech = false
  private var quiet = Duration.zero
  private var elapsed = Duration.zero

  public init() {}

  /// Feeds one meter reading (dB). True when the clip should stop.
  public mutating func feed(level: Float) -> Bool {
    elapsed += Self.poll
    if level > Self.speechLevel {
      heardSpeech = true
      quiet = .zero
    } else if heardSpeech {
      quiet += Self.poll
      if quiet >= Self.silenceHang { return true }
    }
    return elapsed >= Self.maxClip
  }
}
