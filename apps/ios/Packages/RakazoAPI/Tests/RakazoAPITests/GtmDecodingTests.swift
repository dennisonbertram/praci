import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesGtmOverviewAndScratchpadFieldsFromOpenAPIShape() throws {
  let json = #"""
    {
      "groups": {
        "needs_you": [{
          "id": "item-demo", "botId": "bot-demo", "title": "Review launch copy",
          "status": "parked", "notes": "Short invented sample", "createdAt": "2026-11-01T00:00:00Z",
          "updatedAt": "2026-11-02T00:00:00Z", "category": "create_account",
          "channel": "directory", "target": "example.test", "scheduledFor": "2026-11-20T15:30:00Z",
          "proof": null, "approvedAt": null, "approvedBy": null, "dueAt": null,
          "waitingOn": null, "resolvedReason": null, "mailMessageId": null
        }],
        "in_progress": [], "drafts": [], "done": []
      },
      "counts": { "needs_you": 1, "in_progress": 0, "drafts": 0, "done": 0 }
    }
    """#
  let overview = try JSONDecoder().decode(GtmOverview.self, from: Data(json.utf8))
  #expect(overview.counts.needsYou == 1)
  #expect(overview.groups.needsYou.first?.updatedAt == "2026-11-02T00:00:00Z")
  #expect(overview.groups.needsYou.first?.scheduledFor == "2026-11-20T15:30:00Z")
  #expect(overview.groups.needsYou.first?.channel == "directory")
}

@Test
func decodesGtmAgentProbeFromBotListFields() throws {
  let json = #"{"spawnKey":"gtm-agent:user-demo","archivedAt":null}"#
  let agent = try JSONDecoder().decode(GtmAgentProbe.self, from: Data(json.utf8))
  #expect(agent.spawnKey == "gtm-agent:user-demo")
  #expect(agent.archivedAt == nil)
}
