import Foundation

/// `rpc_fundraising_overview.round`.
public struct FundraiseRound: Decodable, Sendable, Equatable, Identifiable {
  public let id: String
  public let name: String
  public let targetCents: Int
  public let capCents: Int
  public let closedAt: String?
}

/// `rpc_fundraising_overview.safes`.
public struct FundraisingSafe: Decodable, Sendable, Equatable, Identifiable {
  public let id: String
  public let source: String
  public let contactId: String?
  public let roundId: String?
  public let investorName: String
  public let investorEmail: String?
  public let amountCents: Int
  public let valuationType: String
  public let capCents: Int?
  public let discountPercent: Double?
  public let mfn: Bool
  public let proRata: Bool
  public let governingState: String?
  public let investmentDate: String?
  public let expiresAt: String?
  public let canceledAt: String?
  public let sentAt: String?
  public let signedByOwnerAt: String?
  public let signedByInvestorAt: String?
  public let paidAt: String?
  public let documentUrl: String?
  public let financeTransactionId: String?
  public let status: String
  public let createdAt: String
}

/// The subset of the overview's Contact contract used by the Fundraising pipeline.
public struct FundraisingProspect: Decodable, Sendable, Equatable, Identifiable {
  public struct Record: Decodable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let status: String
    public let nextCallAt: String?
    public let nextCallHasTime: Bool?
  }

  public let id: String
  public let name: String
  public let email: String?
  public let organization: String?
  public let kind: ContactKind
  public let notes: String?
  public let stage: String?
  public let checkSizeCents: Int?
  public let nextStep: String?
  public let mercurySentAt: String?
  public let pipelineRecord: Record?
}

/// `rpc_fundraising_overview` response.
public struct FundraisingOverview: Decodable, Sendable {
  public struct Mercury: Decodable, Sendable {
    public let status: String
    public let lastSyncedAt: String?
    public let unreadable: Int
  }

  public let mercury: Mercury
  public let round: FundraiseRound?
  public let pendingCents: Int
  public let signedCents: Int
  public let fundedCents: Int
  public let prospects: [FundraisingProspect]
  public let safes: [FundraisingSafe]
}

/// `rpc_fundraising_calls_log` input. `nextCall` is either the literal "keep" or a date update.
public struct FundraisingCallLogInput: Encodable, Sendable {
  public enum NextCall: Encodable, Sendable {
    case keep
    case set(at: String?)

    public func encode(to encoder: Encoder) throws {
      switch self {
      case .keep:
        var container = encoder.singleValueContainer()
        try container.encode("keep")
      case .set(let at):
        var container = encoder.container(keyedBy: NextCallKeys.self)
        try container.encode(at, forKey: .at)
        try container.encode(false, forKey: .hasTime)
      }
    }

    private enum NextCallKeys: String, CodingKey { case at, hasTime }
  }

  public let id: String
  public let outcome: String
  public let note: String?
  public let nextCall: NextCall

  public init(id: String, outcome: String, note: String?, nextCall: NextCall) {
    self.id = id
    self.outcome = outcome
    self.note = note
    self.nextCall = nextCall
  }
}

public struct FundraisingCallLogResult: Decodable, Sendable {
  public let eventId: String
  public let movedToMet: Bool
}

public struct FundraisingSafeMarkInput: Encodable, Sendable {
  public let id: String
  public let action: String
  public let at: String?

  public init(id: String, action: String, at: String?) {
    self.id = id
    self.action = action
    self.at = at
  }

  private enum CodingKeys: String, CodingKey { case id, action, at }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(action, forKey: .action)
    try container.encode(at, forKey: .at)
  }
}
