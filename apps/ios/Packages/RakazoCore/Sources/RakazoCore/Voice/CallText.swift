import Foundation
import RakazoAPI

// Ports of packages/core/src/{echo,barge-in,farewell,call-nonce}.ts and the call parts of
// voice-chat-groups.ts. They decide what the microphone heard and which call a message belongs to.

// MARK: Echo

private let maxEchoWords = 12
private let minEchoWords = 3
public let echoMatchRatio = 0.6
private let contractions = ["m": "am", "re": "are", "s": "is", "ll": "will", "ve": "have", "d": "would"]

/// Dictation writes out what speech contracts, so "I'm" must compare equal to "I am".
private func echoWords(_ text: String) -> [String] {
  var value = text.lowercased()
  value = value.replacing(/n['’]t\b/, with: " not")
  value = value.replacing(/['’](m|re|s|ll|ve|d)\b/) { " " + (contractions[String($0.output.1)] ?? "") }
  value = value.replacing(/[^\p{L}\p{N}\s]+/, with: " ")
  return value.split(whereSeparator: \.isWhitespace).map(String.init)
}

/// True when a transcript is the microphone catching the reply that just played. `threshold` is
/// the share of heard words that must match; lower it while audio is still playing.
/// ponytail: in-order word overlap, no acoustics; it can drop a short real turn that quotes the reply.
public func isEchoOfSpeech(_ heard: String, spoken: String, threshold: Double = echoMatchRatio)
  -> Bool
{
  let heardWords = echoWords(heard)
  let spokenWords = echoWords(spoken)
  if heardWords.count > maxEchoWords || spokenWords.isEmpty { return false }
  if heardWords.count == 2 {
    return spokenWords.indices.contains { index in
      spokenWords[index] == heardWords[0] && index + 1 < spokenWords.count
        && spokenWords[index + 1] == heardWords[1]
    }
  }
  var cursor = 0
  var matched = 0
  for word in heardWords {
    guard let found = spokenWords[cursor...].firstIndex(of: word) else { continue }
    matched += 1
    cursor = found + 1
  }
  if matched < minEchoWords { return false }
  return Double(matched) / Double(heardWords.count) >= threshold
}

/// Every line the speaker played in the last 15 seconds (at most 16), matched as one joined line.
public struct SpokenMemory: Sendable {
  public static let window: TimeInterval = 15
  private static let maxEntries = 16
  private var entries: [(text: String, at: TimeInterval)] = []

  public init() {}

  public mutating func remember(_ text: String, now: TimeInterval = Date().timeIntervalSince1970) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return }
    entries.append((trimmed, now))
    prune(now)
  }

  public mutating func clear() { entries = [] }

  public func isEcho(
    _ heard: String, threshold: Double = echoMatchRatio,
    now: TimeInterval = Date().timeIntervalSince1970
  ) -> Bool {
    let recent = entries.filter { $0.at >= now - Self.window }.suffix(Self.maxEntries)
    return isEchoOfSpeech(heard, spoken: recent.map(\.text).joined(separator: ". "), threshold: threshold)
  }

  private mutating func prune(_ now: TimeInterval) {
    let cutoff = now - Self.window
    entries = Array(entries.filter { $0.at >= cutoff }.suffix(Self.maxEntries))
  }
}

// MARK: Barge-in

/// Lower echo match while audio plays: most of what the microphone hears is the speaker.
private let playbackEchoRatio = 0.4
private let interruptWords: Set<String> = ["stop", "wait", "hold on", "pause", "no"]

/// How long an interim phrase must stand before it cuts playback.
public let interimBargeInDelay = Duration.milliseconds(300)

private func cleanWords(_ text: String) -> String {
  text.lowercased().replacing(/[^\p{L}\p{N}\s]+/, with: " ")
    .split(whereSeparator: \.isWhitespace).joined(separator: " ")
}

/// A sentence, or one interruption word, that is not the reply leaking back into the microphone.
public func isCallBargeIn(_ text: String, memory: SpokenMemory) -> Bool {
  if memory.isEcho(text, threshold: playbackEchoRatio) { return false }
  let cleaned = cleanWords(text)
  return cleaned.contains(" ") || interruptWords.contains(cleaned)
}

/// An interim is revised word by word, so one stray word never cuts playback.
public func isInterimCallBargeIn(_ text: String, memory: SpokenMemory) -> Bool {
  cleanWords(text).contains(" ") && !memory.isEcho(text, threshold: playbackEchoRatio)
}

// MARK: Farewell

private let farewellFiller = [
  "thank you", "for today", "for now", "alright", "perfect", "thanks", "great", "okay", "cool",
  "bye", "ok",
]
private let farewellClosing = [
  "that'll be all", "that will be all", "that's all for now", "that's everything", "that's all",
  "that's it", "talk to you later", "catch you later", "talk later", "goodbye", "good bye",
  "see you", "see ya", "end the call", "end call", "hang up", "i'm done", "we're done",
  "nothing else", "bye",
]
private let farewellPattern: String = {
  let filler = farewellFiller.joined(separator: "|")
  return "^(?:(?:\(filler)) )*(?:\(farewellClosing.joined(separator: "|")))(?: (?:\(filler)))*$"
}()

/// True when the whole utterance is the caller saying goodbye, not a sentence mentioning one.
public func isFarewell(_ text: String) -> Bool {
  var value = text.lowercased().replacing(/[‘’]/, with: "'")
  value = value.replacing(/[^a-z0-9'\s]+/, with: " ")
  let words = value.split(whereSeparator: \.isWhitespace)
  if words.isEmpty || words.count > 8 { return false }
  // The pattern is built from constants above, so it always compiles.
  guard let regex = try? Regex(farewellPattern) else { return false }
  return words.joined(separator: " ").wholeMatch(of: regex) != nil
}

// MARK: Call nonce

public enum CallNonce {
  public static let prefix = "call:"

  /// `call:<callID>:<unique>`; the server and every client group one call's exchange by it.
  public static func make(callID: String) -> String? {
    callID.contains(":") ? nil : "\(prefix)\(callID):\(UUID().uuidString.lowercased())"
  }

  public static func isCall(_ nonce: String?) -> Bool { nonce?.hasPrefix(prefix) == true }

  public static func callID(from nonce: String?) -> String? {
    guard let nonce, isCall(nonce) else { return nil }
    let rest = nonce.dropFirst(prefix.count)
    guard let colon = rest.lastIndex(of: ":") else { return nil }
    let id = rest[..<colon]
    return id.isEmpty ? nil : String(id)
  }
}

// MARK: Which reply to speak

private func isCallMarker(_ message: ThreadMessage) -> Bool {
  message.role == "bot" && message.blocks.first?.kind == .voiceCall
}

/// Newest bot turn still inside this call's open card. Typed turns and the wrap-up sit outside.
public func latestSpokenCallReply(_ messages: [ThreadMessage], callID: String) -> ThreadMessage? {
  var open: [ThreadMessage] = []
  var openCallID: String?
  var openRunIDs: Set<String> = []
  var marked = false
  var latest: [ThreadMessage]?
  func close() {
    if openCallID == callID { latest = marked ? nil : open }
    open = []
    openCallID = nil
    marked = false
  }
  for message in messages {
    if openCallID != nil {
      let joinsByRun = message.role == "bot" && message.runId.map(openRunIDs.contains) == true
      if message.callId == openCallID || joinsByRun {
        open.append(message)
        if isCallMarker(message) { marked = true; close(); continue }
        if message.callId == openCallID, let run = message.runId { openRunIDs.insert(run) }
        continue
      }
      close()
    }
    if let id = message.callId {
      openCallID = id
      open = [message]
      openRunIDs = message.runId.map { [$0] } ?? []
    }
  }
  if openCallID != nil { close() }
  return latest?.last { $0.role == "bot" }
}
