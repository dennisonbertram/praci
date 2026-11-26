import Foundation
import RakazoAPI
import Testing

@testable import Praci

@Test
func approvalIsAlwaysHiddenForEmailAndPublicPosts() throws {
  func item(_ category: String, channel: String? = nil) throws -> GtmItem {
    let channelJSON = channel.map { "\"\($0)\"" } ?? "null"
    let json = #"{"id":"item-demo","botId":"bot-demo","title":"Invented item","status":"parked","notes":"","createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-02T00:00:00Z","category":"\#(category)","channel":\#(channelJSON),"target":null,"scheduledFor":null,"proof":null}"#
    return try JSONDecoder().decode(GtmItem.self, from: Data(json.utf8))
  }

  #expect(!gtmCanApprove(try item("outbound_email")))
  #expect(!gtmCanApprove(try item("public_post")))
  #expect(!gtmCanApprove(try item("draft")))
  #expect(!gtmCanApprove(try item("draft", channel: "email")))
  #expect(!gtmCanApprove(try item("draft", channel: "linkedin")))
  #expect(gtmCanApprove(try item("create_account")))
}

@Test @MainActor
func gtmAgentBootstrapDecisionCreatesOnlyWhenAgentIsMissing() {
  #expect(GtmModel.shouldCreateAgent(hasAgent: false))
  #expect(!GtmModel.shouldCreateAgent(hasAgent: true))
}
