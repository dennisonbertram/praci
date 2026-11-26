import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesInvestorUpdatesAndAllServerStatusesAndDeliveryStates() throws {
  let updates = try JSONDecoder().decode(
    [InvestorUpdate].self, from: loadFixture(named: "investor-updates"))
  #expect(updates.map(\.status.displayName) == ["Draft", "Sending", "Sent", "Partly sent", "Posted"])
  #expect(updates[0].body == "Draft body")
  #expect(updates[1].audience == .board)
  #expect(updates[3].deliveries.map(\.state) == [.failed, .unknown])
  #expect(updates[3].deliveries[1].state.displayName == "Unknown — check Sent mail")
  #expect(updates[3].deliveries.map(\.contactId) == ["contact-a", "contact-b"])
}

@Test
func decodesAuditRequestsIncludingNullableDatesAndClosedStatus() throws {
  let audits = try JSONDecoder().decode(
    [AuditRequest].self, from: loadFixture(named: "investor-audits"))
  #expect(audits.map(\.status) == [.open, .drafted, .done, .dismissed])
  #expect(audits[0].fund == "Example Growth Fund I")
  #expect(audits[0].dueDate == "2026-12-01")
  #expect(audits[1].asOf == nil && audits[1].dueDate == nil)
  #expect(audits[1].senderKnown == false)
}

@Test
func matchesWebStatusAndPartlySentDeliverySummary() throws {
  let updates = try JSONDecoder().decode(
    [InvestorUpdate].self, from: loadFixture(named: "investor-updates"))
  #expect(
    investorDeliveryProblemSummary(updates[3].deliveries)
      == "Avery Example failed · Blair Example: delivery unknown")
  #expect(retryableInvestorContactIDs(updates[3].deliveries) == ["contact-a"])
  #expect(investorDeliveryProblemSummary(updates[0].deliveries).isEmpty)
}
