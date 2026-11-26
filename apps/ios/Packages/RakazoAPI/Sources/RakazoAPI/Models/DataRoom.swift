import Foundation

/// A folder from `rpc_dataRoom_folders` (the whole tree, flat) or `rpc_dataRoom_folderCreate`.
public struct DataRoomFolder: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let name: String
  public let parentId: String?
  /// Items directly in the folder; only the folder list carries it.
  public let itemCount: Int?

  public init(id: String, name: String, parentId: String? = nil, itemCount: Int? = nil) {
    self.id = id
    self.name = name
    self.parentId = parentId
    self.itemCount = itemCount
  }
}

/// A file from `rpc_dataRoom_items_list`, `rpc_dataRoom_item`, a search hit or an upload.
public struct DataRoomItem: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let name: String
  public let mimeType: String
  public let size: Int
  public let folderId: String?
  public let source: String
  /// `ready` and `failed` are final; any other value means the server is still reading the file.
  public let status: String
  public let error: String?
  public let notIndexed: Bool
  public let docType: String?
  public let createdAt: String
  public let hasThumbnail: Bool
  public let previewText: String?

  public var isFailed: Bool { status == "failed" }
  public var isProcessing: Bool { status != "ready" && status != "failed" }

  private enum CodingKeys: String, CodingKey {
    case id, name, mimeType, size, folderId, source, status, error, notIndexed, facets
    case createdAt, hasThumbnail, previewText
  }

  private struct Facets: Decodable { let docType: String? }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    name = try container.decode(String.self, forKey: .name)
    mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType) ?? ""
    size = try container.decodeIfPresent(Int.self, forKey: .size) ?? 0
    folderId = try container.decodeIfPresent(String.self, forKey: .folderId)
    source = try container.decodeIfPresent(String.self, forKey: .source) ?? "upload"
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "ready"
    error = try container.decodeIfPresent(String.self, forKey: .error)
    notIndexed = try container.decodeIfPresent(Bool.self, forKey: .notIndexed) ?? false
    docType = try container.decodeIfPresent(Facets.self, forKey: .facets)?.docType
    createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    hasThumbnail = try container.decodeIfPresent(Bool.self, forKey: .hasThumbnail) ?? false
    previewText = try container.decodeIfPresent(String.self, forKey: .previewText)
  }
}

/// `rpc_dataRoom_items_list` result; pass `nextCursor` back for the next page.
public struct DataRoomItemsPage: Sendable, Decodable {
  public let items: [DataRoomItem]
  public let nextCursor: String?
}

/// One hit of `rpc_dataRoom_search`. `snippet` carries U+0001/U+0002 highlight markers.
public struct DataRoomSearchHit: Sendable, Hashable, Decodable, Identifiable {
  public let item: DataRoomItem
  public let snippet: String?
  public var id: String { item.id }
}

public struct DataRoomSearchPage: Sendable, Decodable {
  public let results: [DataRoomSearchHit]
  public let nextCursor: String?
}

/// `rpc_dataRoom_consent` and `rpc_dataRoom_consentGrant` result.
public struct DataRoomConsent: Sendable, Hashable, Decodable {
  public struct Recipient: Sendable, Hashable, Decodable {
    public let name: String
    public let detail: String?
  }

  public let key: String
  public let version: String
  public let allowed: Bool
  public let disclosure: String
  public let recipients: [Recipient]
  public let spaceId: String?
}

/// The upload route answers 201 or 200 with `item` (200 adds `duplicate: true`), or 202 with
/// `importId` for a zip that is unpacked in the background.
public struct DataRoomUploadResult: Sendable, Decodable {
  public let item: DataRoomItem?
  public let duplicate: Bool
  public let importId: String?

  private enum CodingKeys: String, CodingKey { case item, duplicate, importId }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    item = try container.decodeIfPresent(DataRoomItem.self, forKey: .item)
    duplicate = try container.decodeIfPresent(Bool.self, forKey: .duplicate) ?? false
    importId = try container.decodeIfPresent(String.self, forKey: .importId)
  }
}

public struct DataRoomOK: Sendable, Decodable {
  // swiftlint:disable:next identifier_name
  public let ok: Bool  // wire-format field name
}

// MARK: Inputs

public struct DataRoomItemsListInput: Sendable, Encodable {
  public var folderId: String?
  public var source: String?
  public var status: String?
  public var limit: Int
  public var cursor: String?

  public init(folderId: String? = nil, source: String? = nil, status: String? = nil, limit: Int = 50, cursor: String? = nil)
  {
    self.folderId = folderId
    self.source = source
    self.status = status
    self.limit = limit
    self.cursor = cursor
  }
}

public struct DataRoomSearchInput: Sendable, Encodable {
  public struct Filters: Sendable, Encodable {
    public var folderId: String?
    public var source: String?
    public var status: String?
    public init(folderId: String? = nil, source: String? = nil, status: String? = nil) {
      self.folderId = folderId
      self.source = source
      self.status = status
    }
  }

  public var query: String
  public var filters: Filters?
  public var limit: Int
  public var cursor: String?

  public init(query: String, filters: Filters? = nil, limit: Int = 25, cursor: String? = nil) {
    self.query = query
    self.filters = filters
    self.limit = limit
    self.cursor = cursor
  }
}

public struct DataRoomIDInput: Sendable, Encodable {
  public let id: String
  public init(id: String) { self.id = id }
}

public struct DataRoomFolderCreateInput: Sendable, Encodable {
  public let name: String
  public let parentId: String?
  public init(name: String, parentId: String? = nil) {
    self.name = name
    self.parentId = parentId
  }
}

public struct DataRoomConsentGrantInput: Sendable, Encodable {
  public let key: String
  public let version: String
  public let spaceId: String?
  public init(key: String, version: String, spaceId: String?) {
    self.key = key
    self.version = version
    self.spaceId = spaceId
  }
}

// MARK: Highlights

public enum DataRoomHighlight {
  public struct Run: Sendable, Hashable {
    public let text: String
    public let isMatch: Bool
  }

  /// Splits a snippet at the server's U+0001 (match start) and U+0002 (match end) markers.
  /// Stray markers are dropped, so a raw marker never reaches the screen.
  public static func runs(_ snippet: String) -> [Run] {
    var runs: [Run] = []
    var current = ""
    var inMatch = false
    func flush() {
      if !current.isEmpty { runs.append(Run(text: current, isMatch: inMatch)) }
      current = ""
    }
    for character in snippet.unicodeScalars {
      switch character {
      case "\u{1}":
        flush()
        inMatch = true
      case "\u{2}":
        flush()
        inMatch = false
      default:
        current.unicodeScalars.append(character)
      }
    }
    flush()
    return runs
  }
}
