import Foundation

/// How the app previews a file, chosen from its MIME type and name.
public enum ArtifactKind: Sendable, Hashable {
  case html, markdown, pdf, image, text, other

  public init(mimeType: String, name: String) {
    let mime = mimeType.lowercased()
    let ext = (name as NSString).pathExtension.lowercased()
    if mime == "text/html" || ext == "html" || ext == "htm" {
      self = .html
    } else if mime == "text/markdown" || ext == "md" || ext == "markdown" {
      self = .markdown
    } else if mime == "application/pdf" || ext == "pdf" {
      self = .pdf
    } else if mime.hasPrefix("image/") && mime != "image/svg+xml" {
      self = .image
    } else if mime.hasPrefix("text/") || mime == "application/json" {
      self = .text
    } else {
      self = .other
    }
  }

  /// Short label for list rows.
  public var label: String {
    switch self {
    case .html: "HTML"
    case .markdown: "Markdown"
    case .pdf: "PDF"
    case .image: "Image"
    case .text: "Text"
    case .other: "File"
    }
  }
}

/// An artifact in a list: the items of `rpc_artifacts_listSpace`.
public struct ArtifactSummary: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let botId: String?
  public let groupId: String?
  public let runId: String?
  public let name: String
  public let description: String?
  public let mimeType: String
  public let size: Int
  public let version: Int
  public let createdAt: String
  /// Only `listSpace` sends it.
  public let versionCount: Int?

  public var kind: ArtifactKind { ArtifactKind(mimeType: mimeType, name: name) }

  /// The name without a file extension the user already sees in the row's kind label.
  public var title: String {
    kind == .other ? name : (name as NSString).deletingPathExtension
  }

  public init(
    id: String, botId: String? = nil, groupId: String? = nil, runId: String? = nil, name: String,
    description: String? = nil, mimeType: String, size: Int = 0, version: Int = 1,
    createdAt: String = "", versionCount: Int? = nil
  ) {
    self.id = id
    self.botId = botId
    self.groupId = groupId
    self.runId = runId
    self.name = name
    self.description = description
    self.mimeType = mimeType
    self.size = size
    self.version = version
    self.createdAt = createdAt
    self.versionCount = versionCount
  }

  enum CodingKeys: String, CodingKey {
    case id, botId, groupId, runId, name, description, mimeType, size, version, createdAt,
      versionCount
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    botId = try container.decodeIfPresent(String.self, forKey: .botId)
    groupId = try container.decodeIfPresent(String.self, forKey: .groupId)
    runId = try container.decodeIfPresent(String.self, forKey: .runId)
    name = try container.decode(String.self, forKey: .name)
    description = try container.decodeIfPresent(String.self, forKey: .description)
    mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType) ?? "application/octet-stream"
    size = try container.decodeIfPresent(Int.self, forKey: .size) ?? 0
    version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
    createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    versionCount = try container.decodeIfPresent(Int.self, forKey: .versionCount)
  }
}

/// `rpc_artifacts_listSpace`: one page of the latest version of each artifact.
public struct ArtifactPage: Sendable, Decodable {
  public let items: [ArtifactSummary]
  public let nextCursor: String?
}

/// `rpc_artifacts_getById`: an artifact with its bytes.
public struct ArtifactDetail: Sendable, Decodable {
  public let summary: ArtifactSummary
  public let contentBase64: String

  public init(from decoder: Decoder) throws {
    summary = try ArtifactSummary(from: decoder)
    contentBase64 = try decoder.container(keyedBy: ContentKey.self)
      .decodeIfPresent(String.self, forKey: .contentBase64) ?? ""
  }

  private enum ContentKey: String, CodingKey { case contentBase64 }

  /// The decoded file, or nil if the base64 is not valid.
  public var data: Data? { Data(base64Encoded: contentBase64) }
  public var text: String? { data.flatMap { String(data: $0, encoding: .utf8) } }
}

/// One entry of `rpc_artifacts_listVersions`, newest first.
public struct ArtifactVersion: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let version: Int
  public let name: String
  public let createdAt: String
}

public struct ArtifactsListInput: Encodable, Sendable {
  public let botId: String
  public let cursor: String?
  public let limit: Int
  public init(botId: String, cursor: String? = nil, limit: Int = 60) {
    self.botId = botId
    self.cursor = cursor
    self.limit = limit
  }
}

public struct ArtifactIDInput: Encodable, Sendable {
  public let artifactId: String
  public init(artifactId: String) { self.artifactId = artifactId }
}

public struct ArtifactFamilyInput: Encodable, Sendable {
  public let familyId: String
  public init(familyId: String) { self.familyId = familyId }
}
