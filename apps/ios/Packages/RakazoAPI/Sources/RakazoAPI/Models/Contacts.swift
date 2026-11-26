import Foundation

/// `rpc_contacts_list` and `rpc_contacts_detail` contact kind.
public enum ContactKind: Sendable, Hashable, Decodable {
  case investor, auditor, board, customer, vendor, partner, advisor, legal, prospect, other
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    let raw = try container.decode(String.self)
    switch raw {
    case "investor": self = .investor
    case "auditor": self = .auditor
    case "board": self = .board
    case "customer": self = .customer
    case "vendor": self = .vendor
    case "partner": self = .partner
    case "advisor": self = .advisor
    case "legal": self = .legal
    case "prospect": self = .prospect
    case "other": self = .other
    default: self = .unknown(raw)
    }
  }

  public var displayName: String {
    switch self {
    case .investor: String(localized: "Investor")
    case .auditor: String(localized: "Auditor")
    case .board: String(localized: "Board")
    case .customer: String(localized: "Customer")
    case .vendor: String(localized: "Vendor")
    case .partner: String(localized: "Partner")
    case .advisor: String(localized: "Advisor")
    case .legal: String(localized: "Legal")
    case .prospect: String(localized: "Prospect")
    case .other: String(localized: "Other")
    case .unknown(let value): value
    }
  }

  /// The contract value for contact save inputs. Unknown kinds are display-only.
  public var apiValue: String {
    switch self {
    case .investor: "investor"
    case .auditor: "auditor"
    case .board: "board"
    case .customer: "customer"
    case .vendor: "vendor"
    case .partner: "partner"
    case .advisor: "advisor"
    case .legal: "legal"
    case .prospect: "prospect"
    case .other: "other"
    case .unknown(let value): value
    }
  }

  public static let editableCases: [ContactKind] = [
    .investor, .auditor, .board, .customer, .vendor, .partner, .advisor, .legal, .prospect, .other,
  ]
}

/// Fields accepted by `rpc_contacts_save` for the native Contacts form.
public struct ContactSaveInput: Encodable, Sendable {
  public let id: String?
  public let name: String
  public let email: String?
  public let organization: String?
  public let kind: ContactKind
  public let notes: String?

  public init(
    id: String? = nil, name: String, email: String?, organization: String?,
    kind: ContactKind, notes: String?
  ) {
    self.id = id
    self.name = name
    self.email = email
    self.organization = organization
    self.kind = kind
    self.notes = notes
  }

  private enum CodingKeys: String, CodingKey {
    case id, name, email, organization, kind, notes
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encodeIfPresent(id, forKey: .id)
    try container.encode(name, forKey: .name)
    try container.encode(email, forKey: .email)
    try container.encode(organization, forKey: .organization)
    try container.encode(kind.apiValue, forKey: .kind)
    try container.encode(notes, forKey: .notes)
  }
}

/// `rpc_contacts_linked` response, describing related data affected by contact deletion.
public struct ContactLinked: Sendable, Hashable, Decodable {
  public let portal: Bool
  public let documents: [String]
  public let safes: Int
}

/// `rpc_contacts_list` and the `contact` field of `rpc_contacts_detail`.
public struct Contact: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
  public let email: String?
  public let organization: String?
  public let kind: ContactKind
  public let notes: String?
  public let addedBy: ContactAddedBy?

  public func matchesSearch(_ query: String) -> Bool {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !needle.isEmpty else { return true }
    return [name, email ?? "", organization ?? "", notes ?? "", kind.displayName]
      .contains { $0.localizedCaseInsensitiveContains(needle) }
  }
}

public struct ContactAddedBy: Sendable, Hashable, Decodable {
  public let id: String
  public let name: String
}

/// `rpc_contacts_detail` related mail thread.
public struct ContactMail: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let subject: String
  public let from: String
  public let snippet: String
  public let receivedAt: String
}

/// `rpc_contacts_detail` related meeting.
public struct ContactMeeting: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let title: String
  public let startedAt: String
}

/// `rpc_contacts_detail` related Data room document.
public struct ContactDocument: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
}

/// `rpc_contacts_detail` related SAFE; this slice displays it without a destination.
public struct ContactSafe: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let amountCents: Int
  public let status: String
}

/// `rpc_contacts_detail` response.
public struct ContactDetail: Sendable, Decodable {
  public var contact: Contact
  public let mail: [ContactMail]
  public let meetings: [ContactMeeting]
  public let documents: [ContactDocument]
  public let safes: [ContactSafe]
}
