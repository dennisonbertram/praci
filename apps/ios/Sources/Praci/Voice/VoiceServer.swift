import Foundation
import RakazoAPI
import RakazoCore

/// What the call needs from the server: voice status, hosted speech and transcription, and the
/// bot thread's send, end-call and live feed. `/api/voice/*` are plain HTTP routes, not RPCs.
@MainActor
struct VoiceServer {
  let app: AppModel

  /// Key W4-B's Voice settings writes: speak and listen on this device only.
  static let useDeviceVoiceKey = "voice.useDeviceVoice"
  static var useDeviceVoice: Bool { UserDefaults.standard.bool(forKey: useDeviceVoiceKey) }

  private struct VoiceError: LocalizedError { var errorDescription: String? }
  private struct PrepareInput: Encodable, Sendable { var text: String; var botId: String }
  private struct SendInput: Encodable, Sendable {
    var botId: String
    var text: String
    var clientNonce: String
  }
  private struct SendResult: Decodable, Sendable { var runId: String? }
  private struct EndInput: Encodable, Sendable { var botId: String; var callId: String }
  private struct Ack: Decodable, Sendable {}
  private struct SpeakBody: Encodable { var text: String; var botId: String }
  private struct TranscribeBody: Encodable {
    var audioBase64: String
    var mimeType: String
    var language: String
  }
  private struct TranscribeResult: Decodable { var text: String? }
  private struct ErrorBody: Decodable { var error: String? }

  func status() async throws -> CallVoiceStatus { try await app.call("voice/status") }

  func prepare(text: String, botID: String) async throws -> VoicePrepared {
    try await app.consent.ensure(procedure: "voice/prepare", app: app)
    return try await app.call("voice/prepare", input: PrepareInput(text: text, botId: botID))
  }

  /// One MP3 clip for a piece of a reply.
  func speakClip(_ text: String, botID: String) async throws -> Data {
    try await post("/api/voice/speak", SpeakBody(text: text, botId: botID), timeout: 70).body
  }

  func transcribe(_ clip: CallClip) async throws -> String {
    try await app.consent.ensure(procedure: "voice/transcribe", app: app)
    let body = TranscribeBody(
      audioBase64: clip.data.base64EncodedString(), mimeType: clip.mimeType,
      language: VoiceAudio.language)
    let response = try await post("/api/voice/transcribe", body, timeout: 70)
    return (try? JSONDecoder().decode(TranscribeResult.self, from: response.body))?.text ?? ""
  }

  func send(botID: String, text: String, nonce: String) async throws -> String? {
    try await app.consent.ensure(procedure: "threads/send", app: app)
    let result: SendResult = try await app.call(
      "threads/send", input: SendInput(botId: botID, text: text, clientNonce: nonce), timeout: 20)
    return result.runId
  }

  func endCall(botID: String, callID: String) async throws {
    let _: Ack = try await app.call(
      "threads/endCall", input: EndInput(botId: botID, callId: callID))
  }

  /// Follows the bot's thread and reports each reply inside this call, and the bot hanging up.
  func watch(
    botID: String, callID: String, onReply: @escaping @MainActor (CallReply) -> Void,
    onEnded: @escaping @MainActor (CallEnded) -> Void
  ) -> Task<Void, Never> {
    let feed = CallFeed(app: app, botID: botID, callID: callID, onReply: onReply, onEnded: onEnded)
    return Task { await feed.run() }
  }

  private func post<Body: Encodable>(_ path: String, _ body: Body, timeout: TimeInterval)
    async throws -> HTTPResponse
  {
    let client = app.authentication.client
    let sent = try await client.authorized(
      path: path, method: "POST", body: JSONEncoder().encode(body),
      contentType: "application/json", spaceID: app.spaceID, timeout: timeout)
    let response = try await URLSessionHTTPTransport().send(
      sent.request, maximumResponseBytes: 16 * 1_024 * 1_024)
    guard (200..<300).contains(response.statusCode) else {
      if response.statusCode == 401 {
        _ = await client.handleUnauthorized(generation: sent.generation, hadSpace: sent.hadSpace)
      }
      let message = (try? JSONDecoder().decode(ErrorBody.self, from: response.body))?.error
      throw VoiceError(errorDescription: message ?? "The voice request failed.")
    }
    return response
  }
}

private struct FeedInput: Encodable, Sendable {
  var botId: String
  var cursor: Int?
}

/// The live thread behind one call: a snapshot folded forward by events, as the thread screen does.
@MainActor
private final class CallFeed {
  let app: AppModel
  let botID: String
  let callID: String
  let onReply: @MainActor (CallReply) -> Void
  let onEnded: @MainActor (CallEnded) -> Void
  var snapshot: ThreadSnapshot?
  var tracker: CallReplyTracker?

  init(
    app: AppModel, botID: String, callID: String, onReply: @escaping @MainActor (CallReply) -> Void,
    onEnded: @escaping @MainActor (CallEnded) -> Void
  ) {
    self.app = app
    self.botID = botID
    self.callID = callID
    self.onReply = onReply
    self.onEnded = onEnded
  }

  func load() async {
    guard let fresh: ThreadSnapshot = try? await app.call(
      "threads/get", input: FeedInput(botId: botID))
    else { return }
    if let old = snapshot, old.cursor > fresh.cursor { return }
    snapshot = fresh
    if tracker == nil { tracker = CallReplyTracker(callID: callID, snapshot: fresh) }
  }

  func run() async {
    // A failed first load is retried by the stream's resync, so it does not end the feed.
    await load()
    let botID = botID
    let stream = EventStream<ProductEvent>(
      auth: app.authentication.client, procedure: "threads/subscribe", spaceID: app.spaceID,
      input: { FeedInput(botId: botID, cursor: $0) }, resync: { [self] in await load() })
    do {
      for try await event in stream.events(after: snapshot?.cursor ?? 0) { handle(event) }
    } catch {
      // The stream ends for good only on a rejected session; the app model handles that on its next call.
    }
  }

  private func handle(_ event: ProductEvent) {
    if event.type == "thread.call.ended" {
      onEnded(
        CallEnded(
          callID: event.payload["callId"]?.stringValue,
          farewell: event.payload["farewell"]?.stringValue))
      return
    }
    guard let current = snapshot, isThreadSnapshotEvent(event), event.seq > current.cursor,
      let next = reduceThreadSnapshot(current, event)
    else { return }
    snapshot = next
    if var live = tracker, let reply = live.next(in: next) {
      tracker = live
      onReply(reply)
    }
  }
}
