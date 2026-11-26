import Foundation

/// `rpc_gtm_overview` scratchpad item. Fields and enum strings follow the shared ScratchpadItem
/// contract; channel and category stay strings so newer server values remain readable.
public struct GtmItem: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let botId: String
  public let title: String
  public let status: String
  public let notes: String
  public let createdAt: String
  public let updatedAt: String
  public let category: String?
  public let channel: String?
  public let target: String?
  public let scheduledFor: String?
  public let proof: String?

  private enum CodingKeys: String, CodingKey {
    case id, botId, title, status, notes, createdAt, updatedAt, category, channel, target
    case scheduledFor, proof
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    botId = try c.decode(String.self, forKey: .botId)
    title = try c.decode(String.self, forKey: .title)
    status = try c.decode(String.self, forKey: .status)
    notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
    createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    updatedAt = try c.decode(String.self, forKey: .updatedAt)
    category = try c.decodeIfPresent(String.self, forKey: .category)
    channel = try c.decodeIfPresent(String.self, forKey: .channel)
    target = try c.decodeIfPresent(String.self, forKey: .target)
    scheduledFor = try c.decodeIfPresent(String.self, forKey: .scheduledFor)
    proof = try c.decodeIfPresent(String.self, forKey: .proof)
  }
}

/// `rpc_gtm_overview` response. Only the groups needed by the native needs-you slice are retained.
public struct GtmOverview: Sendable, Decodable {
  public struct Groups: Sendable, Decodable {
    public let needsYou: [GtmItem]
    public let inProgress: [GtmItem]
    public let drafts: [GtmItem]

    private enum CodingKeys: String, CodingKey { case needsYou = "needs_you", inProgress = "in_progress", drafts }
  }

  public struct Counts: Sendable, Decodable {
    public let needsYou: Int
    private enum CodingKeys: String, CodingKey { case needsYou = "needs_you" }
  }

  public let groups: Groups
  public let counts: Counts
}

/// Minimal `rpc_bots_list` projection used to find the per-user GTM agent before bootstrapping it.
public struct GtmAgentProbe: Sendable, Decodable {
  public let spawnKey: String?
  public let archivedAt: String?
}

/// `rpc_scratchpad_update` input fields used by GTM needs-you actions.
public struct ScratchpadUpdateInput: Encodable, Sendable {
  public let itemId: String
  public let status: String
  public let updatedAt: String

  public init(itemId: String, status: String, updatedAt: String) {
    self.itemId = itemId
    self.status = status
    self.updatedAt = updatedAt
  }
}

public struct ScratchpadRemoveInput: Encodable, Sendable {
  public let itemId: String
  public init(itemId: String) { self.itemId = itemId }
}
