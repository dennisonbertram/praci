import Foundation
import Observation
import RakazoAPI
import RakazoCore
import UIKit
import UniformTypeIdentifiers

enum AttachmentLimits {
  static let maxBytes = 10 * 1024 * 1024
  static let maxCount = 4
  /// The types the server accepts (`packages/contracts/src/attachments.ts`).
  static let mimeTypes: Set<String> = [
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain",
    "text/markdown", "text/csv", "text/html", "application/json", "application/zip",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12", "text/tab-separated-values",
  ]
}

struct ReplyTarget: Equatable {
  var messageID: String
  var author: String
  var quote: String
}

/// The draft for one thread: text, attachments and the message being replied to.
@MainActor
@Observable
final class ComposerModel {
  let target: ThreadTarget
  var text = ""
  var attachments: [OutboxAttachment] = []
  var reply: ReplyTarget?
  var notice: String?
  var stopping = false

  init(target: ThreadTarget) { self.target = target }

  var originKey: String {
    switch target {
    case .bot(let id): "bot:\(id)"
    case .group(let id): "group:\(id)"
    }
  }

  var canSend: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty
  }

  var slotsLeft: Int { AttachmentLimits.maxCount - attachments.count }

  // MARK: Attachments

  /// Adds one picked file. HEIC and HEIF become JPEG; unsupported or oversize files show a notice.
  func add(data: Data, name: String, type: UTType?) {
    guard attachments.count < AttachmentLimits.maxCount else {
      notice = "4 files is the maximum"
      return
    }
    guard let prepared = Self.prepare(data: data, name: name, type: type) else {
      notice = "\(name) can’t be attached"
      return
    }
    guard prepared.data.count <= AttachmentLimits.maxBytes else {
      notice = "\(name) is over 10 MB. Choose a smaller file."
      return
    }
    attachments.append(prepared)
    notice = nil
  }

  nonisolated static func prepare(data: Data, name: String, type: UTType?) -> OutboxAttachment? {
    var data = data
    var name = name
    var mime = type?.preferredMIMEType ?? ""
    if let type, type.conforms(to: .heic) || type.conforms(to: .heif) || mime == "image/heic" {
      guard let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.85) else { return nil }
      data = jpeg
      mime = "image/jpeg"
      name = (name as NSString).deletingPathExtension + ".jpg"
    }
    guard AttachmentLimits.mimeTypes.contains(mime) else { return nil }
    return OutboxAttachment(id: UUID().uuidString, name: name, mimeType: mime, data: data)
  }

  // MARK: Sending

  func send(_ app: AppModel) {
    guard canSend else { return }
    var payload = SendPayload(
      originThreadKey: originKey,
      displayText: text.trimmingCharacters(in: .whitespacesAndNewlines),
      replyPreview: reply?.quote, replyTargetID: reply?.messageID,
      replyQuote: reply.map { String($0.quote.prefix(2000)) }.flatMap { $0.isEmpty ? nil : $0 },
      attachments: attachments)
    switch target {
    case .bot(let id): payload.botTarget = id
    case .group(let id): payload.groupTarget = id
    }
    SendQueue.shared.notices[originKey] = nil
    if let failure = SendQueue.shared.enqueue(payload, app) {
      notice = failure
      return
    }
    text = ""
    attachments = []
    reply = nil
    notice = nil
  }

  /// Ends the thread's open goal. The thread's `thread.goal.updated` event removes the goal line.
  func clearGoal(_ app: AppModel, _ model: ThreadModel) async {
    guard case .bot(let id) = target else { return }
    struct Input: Encodable, Sendable { var botId: String }
    if (try? await app.call("threads/clearGoal", input: Input(botId: id)) as JSONValue) == nil {
      notice = "Couldn’t clear the goal. Try again."
    } else if var snapshot = model.snapshot {
      snapshot.goal = nil
      model.state = .loaded(snapshot)
    }
  }

  /// Stops the active run. The slot returns to Stop on failure, so the run is still stoppable.
  func stop(_ app: AppModel) async {
    struct Input: Encodable, Sendable {
      var botId: String?
      var groupId: String?
    }
    stopping = true
    defer { stopping = false }
    var input = Input()
    switch target {
    case .bot(let id): input.botId = id
    case .group(let id): input.groupId = id
    }
    if (try? await app.call("threads/stop", input: input) as JSONValue) == nil {
      notice = "Couldn’t stop. Try again."
    }
  }
}
