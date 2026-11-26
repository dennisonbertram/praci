import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

private let enUS = Locale(identifier: "en_US")

@Test
func decodesLegalOverview() throws {
  let overview = try decode(LegalOverview.self, "legal-overview")
  #expect(overview.contracts.count == 3)
  #expect(overview.deadlines.count == 3)
  #expect(overview.counts.openDeadlines == 9)
  #expect(overview.contracts[0].valueCents == "310000")
  #expect(overview.deadlines[0].removalProposed == false)
  #expect(overview.isScanRunning)
}

@Test
func decodesConsentAndNoModelBlocker() throws {
  let consent = try decode(LegalConsent.self, "legal-consent")
  #expect(!consent.allowed)
  #expect(!consent.needsModel)
  #expect(consent.recipients.first?.name == "OpenRouter")
}

@Test
func dueSoonMatchesWebBoundary() {
  #expect(LegalDay.isDueSoon("2026-10-01", today: "2026-10-26"))
  #expect(LegalDay.isDueSoon("2026-11-02", today: "2026-10-26"))
  #expect(!LegalDay.isDueSoon("2026-11-03", today: "2026-10-26"))
  #expect(LegalDay.days(from: "2026-10-26", to: "2026-10-24") == -2)
}

@Test
func moneyKeepsEveryDigit() {
  #expect(legalMoney(cents: "1234567", currency: "USD", locale: enUS) == "$12,345.67")
  #expect(legalMoney(cents: "5000000", currency: "USD", locale: enUS) == "$50,000")
  #expect(legalMoney(cents: "123456789012345678", currency: "USD", locale: enUS) == "$1,234,567,890,123,456.78")
}

@Test
func groupsContractsByTypeThenNextDeadline() throws {
  let overview = try decode(LegalOverview.self, "legal-overview")
  let groups = overview.contracts.groupedByType()
  #expect(groups.map(\.type) == groups.map(\.type).sorted())
  #expect(groups.flatMap(\.contracts).count == 3)
}

@Test
func decodesCapTableAndEmptySnapshot() throws {
  let table = try decode(CapTableResult.self, "cap-table")
  let snapshot = try #require(table.snapshot)
  #expect(snapshot.holders.count == 5)
  #expect(snapshot.holders.sortedByOwnership().first?.percent == 40)
  #expect(snapshot.holders.sortedByOwnership().last?.percent == nil)
  let empty = try decode(CapTableResult.self, "cap-table-empty")
  #expect(empty.snapshot == nil)
}

@Test
func formatsPercentAndDollars() {
  #expect(capPercent(11.5, locale: enUS) == "11.5%")
  #expect(capPercent(40, locale: enUS) == "40%")
  #expect(capUSD(250000, locale: enUS) == "$250,000")
}
