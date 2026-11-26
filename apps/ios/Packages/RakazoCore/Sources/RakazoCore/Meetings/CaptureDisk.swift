import CryptoKit
import Foundation

/// What this device knows about a recording it started. Stored as `record.json` next to its chunks.
public struct CaptureRecord: Codable, Sendable, Equatable {
  public var apiBase: String
  public var userId: String
  public var spaceId: String
  public var captureId: String
  public var title: String?
  public var startedAt: Date
  /// True once Stop was pressed; a record that is stopped only needs uploading and finishing.
  public var stopped: Bool
  /// Pieces the server refused or the app lost; sent with finish so the meeting shows as partial.
  public var lostChunks: Int
  /// The next chunk number for the microphone track.
  public var nextSeq: Int

  public init(
    apiBase: String, userId: String, spaceId: String, captureId: String, title: String? = nil,
    startedAt: Date, stopped: Bool = false, lostChunks: Int = 0, nextSeq: Int = 0
  ) {
    self.apiBase = apiBase
    self.userId = userId
    self.spaceId = spaceId
    self.captureId = captureId
    self.title = title
    self.startedAt = startedAt
    self.stopped = stopped
    self.lostChunks = lostChunks
    self.nextSeq = nextSeq
  }
}

/// A finished chunk file waiting for upload.
public struct StoredChunk: Sendable, Equatable {
  public var track: String
  public var seq: Int
  public var startMs: Int
  public var endMs: Int
  public var url: URL
}

public enum CaptureDiskError: Error, Equatable {
  case invalidCaptureID
  case storageUnavailable
}

/// Disk storage for recordings that are not uploaded yet. Folders are
/// `<root>/<sha256(apiBase|userID)>/<captureId>/`, so one user's sign-out can remove exactly their
/// own audio. The root is injected; the app passes `standardRoot()`.
public struct CaptureDisk: Sendable {
  public static let track = "microphone"
  public let root: URL

  public init(root: URL) {
    self.root = root
  }

  /// `MeetingCaptures` in Application Support: created, readable after first unlock (a background
  /// finish can still read it), and kept out of backups, like `OutboxDisk.standardRoot`.
  public static func standardRoot(support: URL? = nil) -> URL {
    let fileManager = FileManager.default
    let root = (support ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0])
      .appendingPathComponent("MeetingCaptures", isDirectory: true)
    try? fileManager.createDirectory(
      at: root, withIntermediateDirectories: true, attributes: protection)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var mutable = root
    try? mutable.setResourceValues(values)
    return root
  }

  private static var protection: [FileAttributeKey: Any] {
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
  }

  private var fileManager: FileManager { .default }

  public func userFolder(apiBase: String, userId: String) -> URL {
    let digest = SHA256.hash(data: Data("\(apiBase)|\(userId)".utf8))
    let name = digest.map { String(format: "%02x", $0) }.joined()
    return root.appendingPathComponent(name, isDirectory: true)
  }

  public func folder(for record: CaptureRecord) throws -> URL {
    guard record.captureId.range(of: "^[A-Za-z0-9_-]{1,100}$", options: .regularExpression) != nil
    else { throw CaptureDiskError.invalidCaptureID }
    return userFolder(apiBase: record.apiBase, userId: record.userId)
      .appendingPathComponent(record.captureId, isDirectory: true)
  }

  private func recordFile(_ record: CaptureRecord) throws -> URL {
    try folder(for: record).appendingPathComponent("record.json")
  }

  /// Creates the capture's folder if needed and writes `record.json` atomically.
  public func save(_ record: CaptureRecord) throws {
    do {
      try fileManager.createDirectory(
        at: folder(for: record), withIntermediateDirectories: true, attributes: Self.protection)
      let data = try JSONEncoder().encode(record)
      try data.write(
        to: recordFile(record), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    } catch let error as CaptureDiskError {
      throw error
    } catch {
      throw CaptureDiskError.storageUnavailable
    }
  }

  /// The records this user has on disk. Folders with an unreadable `record.json` are removed.
  public func records(apiBase: String, userId: String) -> [CaptureRecord] {
    let user = userFolder(apiBase: apiBase, userId: userId)
    let items = (try? fileManager.contentsOfDirectory(at: user, includingPropertiesForKeys: nil)) ?? []
    var found: [CaptureRecord] = []
    for item in items {
      guard let data = try? Data(contentsOf: item.appendingPathComponent("record.json")),
        let record = try? JSONDecoder().decode(CaptureRecord.self, from: data),
        record.apiBase == apiBase, record.userId == userId,
        record.captureId == item.lastPathComponent
      else {
        try? fileManager.removeItem(at: item)
        continue
      }
      found.append(record)
    }
    return found.sorted { $0.startedAt < $1.startedAt }
  }

  private func chunkName(seq: Int, startMs: Int, endMs: Int?, ext: String) -> String {
    let end = endMs.map { "-\($0)" } ?? ""
    return "\(Self.track)-\(seq)-\(startMs)\(end).\(ext)"
  }

  /// Where the writer puts a chunk while it is still being recorded.
  public func partURL(_ record: CaptureRecord, seq: Int, startMs: Int) throws -> URL {
    try folder(for: record).appendingPathComponent(
      chunkName(seq: seq, startMs: startMs, endMs: nil, ext: "part"))
  }

  /// Renames a closed `.part` file to its finished `.m4a` name, which carries the end time.
  @discardableResult
  public func finishChunk(_ record: CaptureRecord, seq: Int, startMs: Int, endMs: Int) throws -> URL {
    let part = try partURL(record, seq: seq, startMs: startMs)
    let target = try folder(for: record).appendingPathComponent(
      chunkName(seq: seq, startMs: startMs, endMs: endMs, ext: "m4a"))
    do {
      try? fileManager.removeItem(at: target)
      try fileManager.moveItem(at: part, to: target)
    } catch {
      throw CaptureDiskError.storageUnavailable
    }
    return target
  }

  /// The capture's finished chunks, oldest sequence number first.
  public func chunks(_ record: CaptureRecord) -> [StoredChunk] {
    guard let folder = try? folder(for: record),
      let items = try? fileManager.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
    else { return [] }
    return items.compactMap { url -> StoredChunk? in
      guard url.pathExtension == "m4a" else { return nil }
      let parts = url.deletingPathExtension().lastPathComponent.split(separator: "-")
      guard parts.count == 4, let seq = Int(parts[1]), let start = Int(parts[2]),
        let end = Int(parts[3])
      else { return nil }
      return StoredChunk(track: String(parts[0]), seq: seq, startMs: start, endMs: end, url: url)
    }.sorted { $0.seq < $1.seq }
  }

  public func removeChunk(_ chunk: StoredChunk) {
    try? fileManager.removeItem(at: chunk.url)
  }

  /// After a crash: each leftover `.part` file is audio that cannot be used. It is counted as a
  /// lost chunk (and `nextSeq` moves past it), the record is saved, and only then are the files
  /// deleted, so a failed save never loses the count. Returns the updated record.
  public func recover(_ record: CaptureRecord) throws -> CaptureRecord {
    var record = record
    let folder = try folder(for: record)
    let items = (try? fileManager.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    let leftovers = items.filter { $0.pathExtension == "part" }
    guard !leftovers.isEmpty else { return record }
    for url in leftovers {
      record.lostChunks += 1
      let parts = url.deletingPathExtension().lastPathComponent.split(separator: "-")
      if parts.count >= 2, let seq = Int(parts[1]) { record.nextSeq = max(record.nextSeq, seq + 1) }
    }
    try save(record)
    for url in leftovers { try? fileManager.removeItem(at: url) }
    return record
  }

  /// Forgets one capture: its record and every file.
  public func remove(_ record: CaptureRecord) {
    if let folder = try? folder(for: record) { try? fileManager.removeItem(at: folder) }
  }

  /// Sign-out and account deletion: everything this user left on the device.
  public func wipe(apiBase: String, userId: String) {
    try? fileManager.removeItem(at: userFolder(apiBase: apiBase, userId: userId))
  }
}
