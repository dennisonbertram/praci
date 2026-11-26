import Foundation

/// What a fact in the company map is about.
public enum CompanyEntityKind: String, CaseIterable, Sendable {
  case company, person, organisation, matter, project, product

  public var title: String {
    switch self {
    case .company: "Company"
    case .person: "Person"
    case .organisation: "Organisation"
    case .matter: "Matter"
    case .project: "Project"
    case .product: "Product"
    }
  }

  /// An unknown value from a newer server reads as Organisation rather than failing the page.
  public init(serverValue: String) {
    self = CompanyEntityKind(rawValue: serverValue) ?? .organisation
  }
}

/// Whether a fact has been accepted, is still a guess, or was thrown away.
public enum CompanyStatus: String, Sendable {
  case suggested, confirmed, rejected

  public var title: String {
    switch self {
    case .suggested: "Suggested"
    case .confirmed: "Confirmed"
    case .rejected: "Rejected"
    }
  }

  public init(serverValue: String) {
    self = CompanyStatus(rawValue: serverValue) ?? .suggested
  }
}

/// A partially known date: a year alone, a quarter, a month or an exact day.
public struct CompanyPartialDate: Sendable, Hashable, Decodable {
  public let date: String
  public let precision: String

  private enum CodingKeys: String, CodingKey { case date, precision }

  public init(date: String, precision: String) {
    self.date = date
    self.precision = precision
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    date = (try? container.decode(String.self, forKey: .date)) ?? ""
    precision = (try? container.decode(String.self, forKey: .precision)) ?? "day"
  }

  /// The date as the interface shows it, at the precision actually known.
  public var display: String {
    switch precision {
    case "year": String(date.prefix(4))
    case "quarter":
      {
        let parts = date.split(separator: "-")
        guard parts.count >= 2, let month = Int(parts[1]) else { return date }
        return "Q\((month - 1) / 3 + 1) \(parts[0])"
      }()
    case "month": CompanyDateText.month(date)
    default: CompanyDateText.day(date)
    }
  }
}

/// Formatting shared by the company rows.
public enum CompanyDateText {
  /// A `YYYY-MM-DD` date as "2 Sep 2026". The server stores calendar dates, not instants, so they
  /// are formatted in UTC; formatting in the device's zone would shift them by a day.
  public static func day(_ iso: String) -> String {
    guard let date = CompanyDate.parse(iso) else { return iso }
    return date.formatted(
      Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: TimeZone(secondsFromGMT: 0)!))
  }

  /// A `YYYY-MM` date as "Sep 2026".
  public static func month(_ iso: String) -> String {
    guard let date = CompanyDate.parse(iso) else { return iso }
    return date.formatted(
      Date.FormatStyle(timeZone: TimeZone(secondsFromGMT: 0)!).month(.abbreviated).year())
  }
}

/// Date parsing shared by the company screens; the server sends calendar dates, not instants.
public enum CompanyDate {
  static let dayFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  static let monthFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM"
    return formatter
  }()

  /// Tries a full day first, then a month, so both precisions parse.
  public static func parse(_ iso: String) -> Date? {
    dayFormatter.date(from: iso) ?? monthFormatter.date(from: String(iso.prefix(7)))
  }

  /// Today as `YYYY-MM-DD`, the form the server compares against.
  public static func today() -> String {
    dayFormatter.string(from: Date())
  }
}

/// One thing the company map knows about: a company, a person, an organisation, and so on.
public struct CompanyEntity: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let kind: CompanyEntityKind
  public let displayName: String
  public let normalizedName: String
  /// Kind-specific fields the server validates separately; the list only needs a subtitle.
  public let attrs: [String: CompanyAttribute]
  public let confidence: Double
  public let status: CompanyStatus
  public let visibility: String
  public let confirmedAt: String?
  public let identities: [CompanyIdentity]
  public let evidence: [CompanyEvidence]
  public let edges: [CompanyEdge]
  public let events: [CompanyEvent]

  private enum CodingKeys: String, CodingKey {
    case id, kind, displayName, normalizedName, attrs, confidence, status, visibility, confirmedAt
    case identities, evidence, edges, events
  }

  public init(
    id: String, kind: CompanyEntityKind, displayName: String, normalizedName: String,
    attrs: [String: CompanyAttribute] = [:], confidence: Double = 1, status: CompanyStatus,
    visibility: String = "private", confirmedAt: String? = nil,
    identities: [CompanyIdentity] = [], evidence: [CompanyEvidence] = [],
    edges: [CompanyEdge] = [], events: [CompanyEvent] = []
  ) {
    self.id = id
    self.kind = kind
    self.displayName = displayName
    self.normalizedName = normalizedName
    self.attrs = attrs
    self.confidence = confidence
    self.status = status
    self.visibility = visibility
    self.confirmedAt = confirmedAt
    self.identities = identities
    self.evidence = evidence
    self.edges = edges
    self.events = events
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    kind = CompanyEntityKind(serverValue: container.decodeLossyString(.kind) ?? "")
    displayName = try container.decode(String.self, forKey: .displayName)
    normalizedName = container.decodeLossyString(.normalizedName) ?? displayName.lowercased()
    attrs = (try? container.decode([String: CompanyAttribute].self, forKey: .attrs)) ?? [:]
    confidence = container.decodeLossyDouble(.confidence) ?? 1
    status = CompanyStatus(serverValue: container.decodeLossyString(.status) ?? "")
    visibility = container.decodeLossyString(.visibility) ?? "private"
    confirmedAt = try? container.decodeIfPresent(String.self, forKey: .confirmedAt)
    identities = (try? container.decode([CompanyIdentity].self, forKey: .identities)) ?? []
    evidence = (try? container.decode([CompanyEvidence].self, forKey: .evidence)) ?? []
    edges = (try? container.decode([CompanyEdge].self, forKey: .edges)) ?? []
    events = (try? container.decode([CompanyEvent].self, forKey: .events)) ?? []
  }

  /// The one-line subtitle a row shows: the kind-specific description, then the first identity.
  public var subtitle: String? {
    for key in ["description", "legalName", "headquarters"] {
      if case let .text(value)? = attrs[key], !value.isEmpty { return value }
    }
    // An organisation's type reads as a noun ("Investor"), not the raw enum value ("investor").
    if case let .text(value)? = attrs["type"], !value.isEmpty { return value.capitalized }
    if case let .text(value)? = attrs["website"], !value.isEmpty { return value }
    return identities.first?.identityValue
  }

  /// The identities as one line, e.g. "maya@example.test".
  public var identityLine: String? {
    identities.isEmpty ? nil : identities.map(\.identityValue).joined(separator: ", ")
  }
}

/// An `attrs` value, which the server types by entity kind but which is loose JSON at the wire.
public enum CompanyAttribute: Sendable, Hashable, Decodable {
  case text(String)
  case number(Double)
  case flag(Bool)
  case other

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let value = try? container.decode(String.self) { self = .text(value) }
    else if let value = try? container.decode(Bool.self) { self = .flag(value) }
    else if let value = try? container.decode(Double.self) { self = .number(value) }
    else { self = .other }
  }
}

/// A handle the server uses to recognise this entity again: a domain, an email, a name.
public struct CompanyIdentity: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let identityType: String
  public let identityValue: String

  private enum CodingKeys: String, CodingKey { case id, identityType, identityValue }

  public init(id: String, identityType: String, identityValue: String) {
    self.id = id
    self.identityType = identityType
    self.identityValue = identityValue
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let value = container.decodeLossyString(.identityValue) ?? ""
    identityValue = value
    id = container.decodeLossyString(.id) ?? "\(value)-identity"
    identityType = container.decodeLossyString(.identityType) ?? "name"
  }
}

/// The quote and source a fact was read from.
public struct CompanyEvidence: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let factKind: String
  public let factId: String
  public let stance: String
  public let sourceKind: String
  public let quote: String
  public let sourceUrl: String?
  public let confidence: Double
  public let extractedAt: String?

  private enum CodingKeys: String, CodingKey {
    case id, factKind, factId, stance, sourceKind, quote, sourceUrl, confidence, extractedAt
  }

  public init(
    id: String, factKind: String, factId: String, stance: String, sourceKind: String,
    quote: String, sourceUrl: String? = nil, confidence: Double = 1, extractedAt: String? = nil
  ) {
    self.id = id
    self.factKind = factKind
    self.factId = factId
    self.stance = stance
    self.sourceKind = sourceKind
    self.quote = quote
    self.sourceUrl = sourceUrl
    self.confidence = confidence
    self.extractedAt = extractedAt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = container.decodeLossyString(.id) ?? UUID().uuidString
    factKind = container.decodeLossyString(.factKind) ?? "entity"
    factId = container.decodeLossyString(.factId) ?? ""
    stance = container.decodeLossyString(.stance) ?? "supports"
    sourceKind = container.decodeLossyString(.sourceKind) ?? "manual"
    quote = container.decodeLossyString(.quote) ?? ""
    sourceUrl = try? container.decodeIfPresent(String.self, forKey: .sourceUrl)
    confidence = container.decodeLossyDouble(.confidence) ?? 1
    extractedAt = try? container.decodeIfPresent(String.self, forKey: .extractedAt)
  }

  /// The source name the interface shows, e.g. "Data room".
  public var sourceTitle: String {
    sourceKind.replacingOccurrences(of: "_", with: " ").capitalized
  }
}

/// A relationship between two entities, such as "Maya Chen founded Northwind Robotics".
public struct CompanyEdge: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let fromId: String
  public let toId: String
  public let relation: String
  public let startsOn: CompanyPartialDate?
  public let endsOn: CompanyPartialDate?
  public let role: String?
  public let confidence: Double
  public let status: CompanyStatus
  public let visibility: String
  public let evidence: [CompanyEvidence]

  private enum CodingKeys: String, CodingKey {
    case id, fromId, toId, relation, startsOn, endsOn, role, confidence, status, visibility, evidence
  }

  public init(
    id: String, fromId: String, toId: String, relation: String,
    startsOn: CompanyPartialDate? = nil, endsOn: CompanyPartialDate? = nil, role: String? = nil,
    confidence: Double = 1, status: CompanyStatus = .confirmed, visibility: String = "private",
    evidence: [CompanyEvidence] = []
  ) {
    self.id = id
    self.fromId = fromId
    self.toId = toId
    self.relation = relation
    self.startsOn = startsOn
    self.endsOn = endsOn
    self.role = role
    self.confidence = confidence
    self.status = status
    self.visibility = visibility
    self.evidence = evidence
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    fromId = container.decodeLossyString(.fromId) ?? ""
    toId = container.decodeLossyString(.toId) ?? ""
    relation = container.decodeLossyString(.relation) ?? "part_of"
    startsOn = try? container.decodeIfPresent(CompanyPartialDate.self, forKey: .startsOn)
    endsOn = try? container.decodeIfPresent(CompanyPartialDate.self, forKey: .endsOn)
    role = try? container.decodeIfPresent(String.self, forKey: .role)
    confidence = container.decodeLossyDouble(.confidence) ?? 1
    status = CompanyStatus(serverValue: container.decodeLossyString(.status) ?? "")
    visibility = container.decodeLossyString(.visibility) ?? "private"
    evidence = (try? container.decode([CompanyEvidence].self, forKey: .evidence)) ?? []
  }

  /// The relationship as words, e.g. "Works at".
  public var relationTitle: String {
    relation.replacingOccurrences(of: "_", with: " ").capitalized
  }

  /// Whether the relationship has already ended, which files it under Past.
  public var hasEnded: Bool {
    guard let endsOn, let date = CompanyDate.parse(endsOn.date) else { return false }
    return date < Date()
  }
}

/// Something that happened, such as a funding round or a hire.
public struct CompanyEvent: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let stream: String
  public let kind: String
  public let title: String
  public let occursOn: CompanyPartialDate?
  public let endsOn: CompanyPartialDate?
  public let amountCents: Int?
  public let currency: String?
  public let entityIds: [String]
  public let confidence: Double
  public let status: CompanyStatus
  public let visibility: String
  public let evidence: [CompanyEvidence]

  private enum CodingKeys: String, CodingKey {
    case id, stream, kind, title, occursOn, endsOn, amountCents, currency, entityIds, confidence
    case status, visibility, evidence
  }

  public init(
    id: String, stream: String, kind: String, title: String,
    occursOn: CompanyPartialDate? = nil, endsOn: CompanyPartialDate? = nil,
    amountCents: Int? = nil, currency: String? = nil,
    entityIds: [String] = [], confidence: Double = 1, status: CompanyStatus = .confirmed,
    visibility: String = "private", evidence: [CompanyEvidence] = []
  ) {
    self.id = id
    self.stream = stream
    self.kind = kind
    self.title = title
    self.occursOn = occursOn
    self.endsOn = endsOn
    self.amountCents = amountCents
    self.currency = currency
    self.entityIds = entityIds
    self.confidence = confidence
    self.status = status
    self.visibility = visibility
    self.evidence = evidence
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    stream = container.decodeLossyString(.stream) ?? "company"
    kind = container.decodeLossyString(.kind) ?? "other"
    title = container.decodeLossyString(.title) ?? ""
    occursOn = try? container.decodeIfPresent(CompanyPartialDate.self, forKey: .occursOn)
    endsOn = try? container.decodeIfPresent(CompanyPartialDate.self, forKey: .endsOn)
    amountCents = try? container.decodeIfPresent(Int.self, forKey: .amountCents)
    currency = try? container.decodeIfPresent(String.self, forKey: .currency)
    entityIds = (try? container.decode([String].self, forKey: .entityIds)) ?? []
    confidence = container.decodeLossyDouble(.confidence) ?? 1
    status = CompanyStatus(serverValue: container.decodeLossyString(.status) ?? "")
    visibility = container.decodeLossyString(.visibility) ?? "private"
    evidence = (try? container.decode([CompanyEvidence].self, forKey: .evidence)) ?? []
  }

  /// The stream as words, e.g. "Funding".
  public var streamTitle: String { stream.capitalized }
}

/// The whole reconstruction: every visible fact, plus the last import's state.
public struct CompanyPage: Sendable, Decodable {
  public let entities: [CompanyEntity]
  public let edges: [CompanyEdge]
  public let events: [CompanyEvent]
  public let latestRun: CompanyImportRun?

  private enum CodingKeys: String, CodingKey { case entities, edges, events, latestRun }

  public init(
    entities: [CompanyEntity] = [], edges: [CompanyEdge] = [], events: [CompanyEvent] = [],
    latestRun: CompanyImportRun? = nil
  ) {
    self.entities = entities
    self.edges = edges
    self.events = events
    self.latestRun = latestRun
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    entities = (try? container.decode([CompanyEntity].self, forKey: .entities)) ?? []
    edges = (try? container.decode([CompanyEdge].self, forKey: .edges)) ?? []
    events = (try? container.decode([CompanyEvent].self, forKey: .events)) ?? []
    latestRun = try? container.decodeIfPresent(CompanyImportRun.self, forKey: .latestRun)
  }

  /// Nothing has been reconstructed yet, which is the page's empty state.
  public var isEmpty: Bool { entities.isEmpty && events.isEmpty }

  /// The entity the page treats as the business itself, if one has been confirmed.
  public var profile: CompanyEntity? { entities.first { $0.kind == .company } }

  /// Everyone who is not the company, the organisation account, or a product.
  public var people: [CompanyEntity] { entities.filter { $0.kind == .person } }

  public var organisations: [CompanyEntity] { entities.filter { $0.kind == .organisation } }

  /// Facts still waiting for an answer, which drive the Review tab's count.
  public var pending: [CompanyEntity] {
    entities.filter { $0.status == .suggested }
  }

  /// The entity name for an id, falling back to the id so a dangling edge still renders.
  public func name(of id: String) -> String {
    entities.first { $0.id == id }?.displayName ?? id
  }
}

/// The last import run, so the page can say whether one is in progress.
public struct CompanyImportRun: Sendable, Hashable, Decodable {
  public let id: String
  public let status: String

  private enum CodingKeys: String, CodingKey { case id, status }

  public init(id: String, status: String) {
    self.id = id
    self.status = status
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = container.decodeLossyString(.id) ?? ""
    status = container.decodeLossyString(.status) ?? "queued"
  }

  public var isRunning: Bool { status == "queued" || status == "running" }
}

// MARK: - Inputs

/// A request for one fact, used by `company/fact` and the confirm/reject/review calls.
public struct CompanyFactInput: Encodable, Sendable {
  public let kind: String
  public let id: String

  public init(kind: String, id: String) {
    self.kind = kind
    self.id = id
  }
}

/// The month the company calendar asks for, as `YYYY-MM`.
public struct CompanyCalendarInput: Encodable, Sendable {
  public let month: String

  public init(month: String) {
    self.month = month
  }
}

/// A person the page should forget, used by `company/excludePerson`.
public struct CompanyExcludePersonInput: Encodable, Sendable {
  public let entityId: String

  public init(entityId: String) {
    self.entityId = entityId
  }
}

/// How much of the map other people in the space can see.
public struct CompanyVisibilityInput: Encodable, Sendable {
  public let kind: String
  public let id: String
  public let visibility: String

  public init(kind: String, id: String, visibility: String) {
    self.kind = kind
    self.id = id
    self.visibility = visibility
  }
}

/// A candidate the review queue should merge into an existing entity.
public struct CompanyResolveCandidateInput: Encodable, Sendable {
  public let entityId: String
  public let targetId: String

  public init(entityId: String, targetId: String) {
    self.entityId = entityId
    self.targetId = targetId
  }
}

// MARK: - Decoding helpers

extension KeyedDecodingContainer {
  /// A string that tolerates a number or a missing key, for ids and enum-like fields.
  func decodeLossyString(_ key: Key) -> String? {
    if let value = try? decodeIfPresent(String.self, forKey: key) { return value }
    if let value = try? decodeIfPresent(Int.self, forKey: key) { return String(value) }
    return nil
  }

  func decodeLossyDouble(_ key: Key) -> Double? {
    if let value = try? decodeIfPresent(Double.self, forKey: key) { return value }
    if let value = try? decodeIfPresent(Int.self, forKey: key) { return Double(value) }
    return nil
  }
}
