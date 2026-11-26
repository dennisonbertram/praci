import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesNotificationsGlance() throws {
  let response = try JSONDecoder().decode(
    RPCEnvelope<Glance>.self, from: loadFixture(named: "notifications-glance")).json
  #expect(response.financeRunwayMonths == 12.5)
  #expect(response.legalDueSoon == 2)
  #expect(response.brexConnected == false)
  #expect(response.devinConnected)
  #expect(response.gtmNeedsYou == 3)
  #expect(response.dataRoomWaiting == 4)
  #expect(response.hasTickets)
  #expect(response.botKinds["bot-placeholder"] == "needs_input")
}
