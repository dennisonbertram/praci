import Foundation

public enum OutboxLimits {
  public static let maxEntries = 20
  public static let maxBytes = 50 * 1024 * 1024
}

public enum SendState: String, Codable, Sendable, Equatable {
  case queued, pending, failed, refused
}

/// Where a failed send goes next. `pausesQueue` stops the ordered drain (offline or rate limited).
public struct SendOutcome: Sendable, Equatable {
  public var state: SendState
  public var pausesQueue: Bool

  /// `unreachable` is a network failure with no HTTP status. 408, 425 and 429 go back to queued
  /// and pause the queue; other 4xx responses are refused (retrying cannot help); the rest fail.
  public static func classify(status: Int?, unreachable: Bool) -> SendOutcome {
    if unreachable { return SendOutcome(state: .queued, pausesQueue: true) }
    guard let status else { return SendOutcome(state: .failed, pausesQueue: false) }
    if [408, 425, 429].contains(status) { return SendOutcome(state: .queued, pausesQueue: true) }
    if (400 ..< 500).contains(status) { return SendOutcome(state: .refused, pausesQueue: false) }
    return SendOutcome(state: .failed, pausesQueue: false)
  }
}

public struct OutboxAttachment: Codable, Sendable, Equatable {
  public var id: String
  public var name: String
  public var mimeType: String
  /// Held in memory only until `admit` moves it to disk; never encoded into the metadata file.
  public var data: Data
  /// A file URL for a stored image, set by `admit` and `load`; never encoded.
  public var previewURL: URL?

  public init(id: String, name: String, mimeType: String, data: Data, previewURL: URL? = nil) {
    self.id = id
    self.name = name
    self.mimeType = mimeType
    self.data = data
    self.previewURL = previewURL
  }

  enum CodingKeys: String, CodingKey { case id, name, mimeType }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    try self.init(
      id: container.decode(String.self, forKey: .id), name: container.decode(String.self, forKey: .name),
      mimeType: container.decode(String.self, forKey: .mimeType), data: Data()
    )
  }
}

/// A plain message send. It has no field for a secret-ask answer, so one can never reach disk.
public struct SendPayload: Codable, Sendable, Equatable {
  public var originThreadKey: String
  public var displayText: String
  public var replyPreview: String?
  public var botTarget: String?
  public var groupTarget: String?
  public var reroutedToGroup: Bool
  public var routineIDs: [String]
  public var mentions: [[String: String]]
  public var replyTargetID: String?
  public var replyQuote: String?
  public var attachments: [OutboxAttachment]

  public init(
    originThreadKey: String, displayText: String, replyPreview: String? = nil,
    botTarget: String? = nil, groupTarget: String? = nil, reroutedToGroup: Bool = false,
    routineIDs: [String] = [], mentions: [[String: String]] = [], replyTargetID: String? = nil,
    replyQuote: String? = nil, attachments: [OutboxAttachment] = []
  ) {
    self.originThreadKey = originThreadKey
    self.displayText = displayText
    self.replyPreview = replyPreview
    self.botTarget = botTarget
    self.groupTarget = groupTarget
    self.reroutedToGroup = reroutedToGroup
    self.routineIDs = routineIDs
    self.mentions = mentions
    self.replyTargetID = replyTargetID
    self.replyQuote = replyQuote
    self.attachments = attachments
  }
}

public struct OutboxScope: Sendable, Equatable {
  public var apiBase: String
  public var userID: String
  public var cacheSession: String
  public var spaceID: String?

  public init(apiBase: String, userID: String, cacheSession: String, spaceID: String?) {
    self.apiBase = apiBase
    self.userID = userID
    self.cacheSession = cacheSession
    self.spaceID = spaceID
  }
}

public struct SendAttempt: Codable, Sendable, Equatable {
  public var clientNonce: String
  public var state: SendState
  public var payload: SendPayload
  /// Attachment id to uploaded artifact id, kept so a retry does not upload twice.
  public var artifactIDs: [String: String]
  public var scope: OutboxScope
  public var acceptedSeq: Int?
  public var error: String?
  /// The signed-in session the attempt began in. Not persisted: `load` assigns the new one.
  public var session: Int

  public init(
    clientNonce: String, state: SendState = .queued, payload: SendPayload, scope: OutboxScope,
    session: Int, artifactIDs: [String: String] = [:]
  ) {
    self.clientNonce = clientNonce
    self.state = state
    self.payload = payload
    self.artifactIDs = artifactIDs
    self.scope = scope
    self.session = session
  }

  enum CodingKeys: String, CodingKey {
    case clientNonce, state, payload, artifactIDs, apiBase, userID, cacheSession, spaceID
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    try self.init(
      clientNonce: container.decode(String.self, forKey: .clientNonce),
      state: container.decode(SendState.self, forKey: .state),
      payload: container.decode(SendPayload.self, forKey: .payload),
      scope: OutboxScope(
        apiBase: container.decode(String.self, forKey: .apiBase),
        userID: container.decode(String.self, forKey: .userID),
        cacheSession: container.decode(String.self, forKey: .cacheSession),
        spaceID: container.decodeIfPresent(String.self, forKey: .spaceID)
      ),
      session: 0, artifactIDs: container.decode([String: String].self, forKey: .artifactIDs)
    )
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(clientNonce, forKey: .clientNonce)
    // A send that was in flight when the app stopped is retried with the same nonce.
    try container.encode(state == .pending ? .queued : state, forKey: .state)
    try container.encode(payload, forKey: .payload)
    try container.encode(artifactIDs, forKey: .artifactIDs)
    try container.encode(scope.apiBase, forKey: .apiBase)
    try container.encode(scope.userID, forKey: .userID)
    try container.encode(scope.cacheSession, forKey: .cacheSession)
    try container.encode(scope.spaceID, forKey: .spaceID)
  }
}

public enum OutboxError: Error, Equatable {
  case storageUnavailable
  case attachmentUnavailable
}

/// Disk storage for unsent messages. The directory is injected; the app passes a caches
/// subdirectory of Application Support (see `standardRoot`), which iOS does not evict.
public struct OutboxDisk: Sendable {
  public let root: URL
  private var metadata: URL {
    root.appendingPathComponent("sends-v4.json")
  }

  public init(directory: URL) {
    root = directory
  }

  private func folder(_ nonce: String) -> URL {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-_")
    let name = nonce.addingPercentEncoding(withAllowedCharacters: allowed) ?? nonce
    return root.appendingPathComponent(name, isDirectory: true)
  }

  private func attachmentFile(_ nonce: String, _ index: Int) -> URL {
    folder(nonce).appendingPathComponent("\(index)")
  }

  private func exists(_ url: URL) -> Bool {
    FileManager.default.fileExists(atPath: url.path)
  }

  private func diskBytes(_ url: URL) -> Int {
    guard
      let walker = FileManager.default.enumerator(
        at: url, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey]
      )
    else { return 0 }
    var total = 0
    for case let item as URL in walker {
      let values = try? item.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
      if values?.isRegularFile == true { total += values?.fileSize ?? 0 }
    }
    return total
  }

  private func encoded(_ attempts: [SendAttempt]) throws -> Data {
    try JSONEncoder().encode(Array(attempts.prefix(OutboxLimits.maxEntries)))
  }

  /// Moves the attachment bytes to disk. Returns false when the nonce already has files on disk
  /// or the 50 MB budget would be exceeded; throws if the disk cannot be written.
  public func admit(_ attempt: inout SendAttempt) throws -> Bool {
    if exists(folder(attempt.clientNonce)) { return false }
    let bytes = attempt.payload.attachments.reduce(0) { $0 + $1.data.count }
    let entry = (try? encoded([attempt]).count) ?? 0
    if diskBytes(root) + bytes + entry > OutboxLimits.maxBytes { return false }
    do {
      try FileManager.default.createDirectory(
        at: folder(attempt.clientNonce), withIntermediateDirectories: true, attributes: Self.protection
      )
      for index in attempt.payload.attachments.indices {
        let target = attachmentFile(attempt.clientNonce, index)
        try attempt.payload.attachments[index].data.write(to: target, options: Self.writeOptions)
        let isImage = attempt.payload.attachments[index].mimeType.hasPrefix("image/")
        attempt.payload.attachments[index].previewURL = isImage ? target : nil
        attempt.payload.attachments[index].data = Data()
      }
      return true
    } catch {
      forget(attempt)
      throw OutboxError.storageUnavailable
    }
  }

  /// Rewrites the metadata file atomically. Throws when it cannot be written, so a caller never
  /// treats a message as kept when a restart would lose it. Holds at most `maxEntries` entries.
  public func save(_ attempts: [SendAttempt]) throws {
    guard attempts.count <= OutboxLimits.maxEntries else { throw OutboxError.storageUnavailable }
    do {
      try FileManager.default.createDirectory(
        at: root, withIntermediateDirectories: true, attributes: Self.protection)
      let data = try encoded(attempts)
      let existing = exists(metadata) ? diskBytes(metadata) : 0
      if diskBytes(root) - existing + data.count > OutboxLimits.maxBytes {
        throw OutboxError.storageUnavailable
      }
      try data.write(to: metadata, options: Self.writeOptions)
    } catch {
      throw OutboxError.storageUnavailable
    }
  }

  // Readable after the first unlock so a background drain can still send.
  private static var protection: [FileAttributeKey: Any] {
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
  }

  private static var writeOptions: Data.WritingOptions {
    [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
  }

  /// The outbox folder in Application Support (iOS never evicts it, unlike Caches): created,
  /// kept out of backups, and filled once from the old Caches location.
  public static func standardRoot(
    support: URL? = nil, legacy: URL? = nil
  ) -> URL {
    let fileManager = FileManager.default
    let root = (support ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0])
      .appendingPathComponent("outbox", isDirectory: true)
    let old = legacy ?? fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("outbox", isDirectory: true)
    try? fileManager.createDirectory(
      at: root, withIntermediateDirectories: true, attributes: protection)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var mutable = root
    try? mutable.setResourceValues(values)
    migrate(from: old, to: root)
    return root
  }

  /// Moves each scope folder out of the old location, keeping any that already exist in `root`.
  public static func migrate(from old: URL, to root: URL) {
    let fileManager = FileManager.default
    guard let items = try? fileManager.contentsOfDirectory(at: old, includingPropertiesForKeys: nil)
    else { return }
    for item in items {
      let target = root.appendingPathComponent(item.lastPathComponent)
      if fileManager.fileExists(atPath: target.path) { continue }
      try? fileManager.moveItem(at: item, to: target)
    }
    try? fileManager.removeItem(at: old)
  }

  /// Returns stored sends for `scope` as queued/failed/refused attempts in `session`, and deletes
  /// attachment folders that no returned attempt owns. Corrupt or oversized storage is wiped.
  public func load(session: Int, scope: OutboxScope) -> [SendAttempt] {
    guard exists(metadata), diskBytes(root) <= OutboxLimits.maxBytes,
          let data = try? Data(contentsOf: metadata),
          let entries = try? JSONDecoder().decode([Lossy<SendAttempt>].self, from: data)
    else {
      clear()
      return []
    }
    let loaded = entries.prefix(OutboxLimits.maxEntries).compactMap(\.value).filter {
      $0.scope == scope && $0.state != .pending
        && $0.clientNonce.range(of: "^[A-Za-z0-9_-]{1,200}$", options: .regularExpression) != nil
    }.map { entry -> SendAttempt in
      var entry = entry
      entry.session = session
      for index in entry.payload.attachments.indices
        where entry.payload.attachments[index].mimeType.hasPrefix("image/")
      {
        entry.payload.attachments[index].previewURL = attachmentFile(entry.clientNonce, index)
      }
      return entry
    }
    let keep = Set([metadata.standardizedFileURL] + loaded.map { folder($0.clientNonce).standardizedFileURL })
    let items = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
    for item in items where !keep.contains(item.standardizedFileURL) {
      try? FileManager.default.removeItem(at: item)
    }
    return loaded
  }

  /// Reads stored bytes back into attachments the server does not already have.
  public func hydrate(_ attempt: inout SendAttempt) throws {
    for index in attempt.payload.attachments.indices {
      let attachment = attempt.payload.attachments[index]
      if !attachment.data.isEmpty || attempt.artifactIDs[attachment.id] != nil { continue }
      guard let data = try? Data(contentsOf: attachmentFile(attempt.clientNonce, index)) else {
        throw OutboxError.attachmentUnavailable
      }
      attempt.payload.attachments[index].data = data
    }
  }

  public func forget(_ attempt: SendAttempt) {
    try? FileManager.default.removeItem(at: folder(attempt.clientNonce))
  }

  public func clear() {
    try? FileManager.default.removeItem(at: root)
  }
}

/// Decodes to nil instead of failing the whole array when one stored entry is invalid.
private struct Lossy<T: Decodable>: Decodable {
  let value: T?
  init(from decoder: any Decoder) throws {
    value = try? T(from: decoder)
  }
}
