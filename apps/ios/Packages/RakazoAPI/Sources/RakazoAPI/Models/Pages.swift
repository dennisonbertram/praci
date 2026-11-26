import Foundation

/// `rpc_pages_get`: one of the agent's pages, or null when it has none.
public struct AgentPage: Sendable, Decodable, Equatable {
  public let id: String?
  public let botId: String
  public let title: String?
  public let content: String
  /// "blocks" (Markdown with live blocks) or "html".
  public let kind: String?
  public let revision: Int?
  public let updatedBy: String?
  public let updatedAt: String?
  /// One server-rendered SVG per chart fence, in document order.
  public let chartSvgs: [String]?

  public var isHTML: Bool {
    kind == "html"
  }

  public init(
    id: String? = nil, botId: String, title: String? = nil, content: String, kind: String? = nil,
    revision: Int? = nil, updatedBy: String? = nil, updatedAt: String? = nil,
    chartSvgs: [String]? = nil
  ) {
    self.id = id
    self.botId = botId
    self.title = title
    self.content = content
    self.kind = kind
    self.revision = revision
    self.updatedBy = updatedBy
    self.updatedAt = updatedAt
    self.chartSvgs = chartSvgs
  }
}

public struct PageGetInput: Encodable, Sendable {
  public let botId: String
  public let pageId: String?
  public let chartSvgs: Bool?
  public init(botId: String, pageId: String? = nil, chartSvgs: Bool? = nil) {
    self.botId = botId
    self.pageId = pageId
    self.chartSvgs = chartSvgs
  }
}

/// Input of `pages/list`, `pages/data`, `pages/refresh` and `pages/share`.
public struct PageRefInput: Encodable, Sendable {
  public let botId: String
  public let pageId: String?
  public init(botId: String, pageId: String? = nil) {
    self.botId = botId
    self.pageId = pageId
  }
}

/// `rpc_pages_list` entry.
public struct PageSummary: Sendable, Decodable, Equatable, Identifiable {
  public let id: String
  public let title: String
  public let kind: String?
  public let revision: Int
  public let updatedAt: String?
  public init(id: String, title: String, kind: String? = nil, revision: Int, updatedAt: String? = nil) {
    self.id = id
    self.title = title
    self.kind = kind
    self.revision = revision
    self.updatedAt = updatedAt
  }
}

/// What a live block shows: ok, failed, pending, paused, denied, missing or empty.
public struct PageLiveBlock: Sendable, Decodable, Equatable {
  public let status: String
  public let fetchedAt: String?
  public let error: String?
  /// Metric: the formatted value.
  public let text: String?
  /// Table: the rows to show.
  public let rows: [JSONValue]?
  public init(
    status: String, fetchedAt: String? = nil, error: String? = nil, text: String? = nil,
    rows: [JSONValue]? = nil
  ) {
    self.status = status
    self.fetchedAt = fetchedAt
    self.error = error
    self.text = text
    self.rows = rows
  }
}

/// `rpc_pages_data` and `rpc_pages_refresh`: live data for one page revision. Blocks pages carry
/// `blocks`; HTML pages carry `kind: "html"` and `sources`, kept as plain JSON because they go
/// to the page untouched.
public enum PageData: Sendable, Decodable, Equatable {
  case blocks(pageId: String, revision: Int, blocks: [PageLiveBlock])
  case html(pageId: String, revision: Int, sources: JSONValue)

  private enum Key: String, CodingKey { case kind, pageId, revision, blocks, sources }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Key.self)
    let pageId = try c.decode(String.self, forKey: .pageId)
    let revision = try c.decode(Int.self, forKey: .revision)
    if try c.decodeIfPresent(String.self, forKey: .kind) == "html" {
      self = try .html(pageId: pageId, revision: revision, sources: c.decode(JSONValue.self, forKey: .sources))
    } else {
      self = try .blocks(pageId: pageId, revision: revision, blocks: c.decode([PageLiveBlock].self, forKey: .blocks))
    }
  }
}

/// `rpc_pages_share`: a view-only link to a frozen copy. `artifactId` names the copy for Stop sharing.
public struct PageShare: Sendable, Decodable, Equatable, Identifiable {
  public let url: String
  public let expiresAt: String
  public let artifactId: String
  public var id: String {
    artifactId
  }

  public init(url: String, expiresAt: String, artifactId: String) {
    self.url = url
    self.expiresAt = expiresAt
    self.artifactId = artifactId
  }
}
