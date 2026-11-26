import Foundation

/// `rpc_notifications_glance`: page status counts and connection gates for the space sidebar.
public struct Glance: Decodable, Sendable, Equatable {
  public let financeRunwayMonths: Double?
  public let legalDueSoon: Int
  public let devinNeedsYou: Int
  public let devinConnected: Bool
  public let brexConnected: Bool
  public let gtmNeedsYou: Int
  public let dataRoomWaiting: Int
  public let hasTickets: Bool
  public let botKinds: [String: String]

  private enum CodingKeys: String, CodingKey {
    case financeRunwayMonths, legalDueSoon, devinNeedsYou, devinConnected, brexConnected
    case gtmNeedsYou, dataRoomWaiting, hasTickets, botKinds
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    financeRunwayMonths = try c.decodeIfPresent(Double.self, forKey: .financeRunwayMonths)
    legalDueSoon = try c.decodeIfPresent(Int.self, forKey: .legalDueSoon) ?? 0
    devinNeedsYou = try c.decodeIfPresent(Int.self, forKey: .devinNeedsYou) ?? 0
    devinConnected = try c.decodeIfPresent(Bool.self, forKey: .devinConnected) ?? false
    brexConnected = try c.decodeIfPresent(Bool.self, forKey: .brexConnected) ?? false
    gtmNeedsYou = try c.decodeIfPresent(Int.self, forKey: .gtmNeedsYou) ?? 0
    dataRoomWaiting = try c.decodeIfPresent(Int.self, forKey: .dataRoomWaiting) ?? 0
    hasTickets = try c.decodeIfPresent(Bool.self, forKey: .hasTickets) ?? false
    botKinds = try c.decodeIfPresent([String: String].self, forKey: .botKinds) ?? [:]
  }
}
