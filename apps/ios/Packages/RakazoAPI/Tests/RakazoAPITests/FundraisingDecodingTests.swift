import Foundation
import Testing

@testable import RakazoAPI

@Test("decodes a Fundraising overview fixture using the OpenAPI property names")
func decodesFundraisingOverviewFixture() throws {
  let json = #"""
  {
    "mercury":{"status":"not_connected","lastSyncedAt":null,"unreadable":0},
    "round":{"id":"round-placeholder","name":"Seed","targetCents":50000000,"capCents":400000000,"closedAt":null},
    "pendingCents":12500000,"signedCents":5000000,"fundedCents":2500000,
    "prospects":[{
      "id":"contact-placeholder","name":"Ada Lovelace","email":"ada@example.test",
      "organization":"Analytical Engines (Mock)","kind":"prospect","notes":null,
      "stage":"meeting","checkSizeCents":12500000,"nextStep":"Share the deck",
      "mercurySentAt":null,
      "pipelineRecord":{"id":"record-placeholder","name":"Analytical Engines",
        "status":"meeting_booked","nextCallAt":"2026-11-04T12:00:00.000Z","nextCallHasTime":false}
    }],
    "safes":[{
      "id":"safe-placeholder","source":"native","contactId":"contact-placeholder",
      "roundId":"round-placeholder","investorName":"Ada Lovelace","investorEmail":"ada@example.test",
      "amountCents":2500000,"valuationType":"post_money_cap","capCents":400000000,
      "discountPercent":null,"mfn":false,"proRata":false,"governingState":"Delaware",
      "investmentDate":null,"expiresAt":null,"canceledAt":null,"sentAt":"2026-10-01T12:00:00.000Z",
      "signedByOwnerAt":"2026-10-02T12:00:00.000Z","signedByInvestorAt":"2026-10-02T12:00:00.000Z",
      "paidAt":null,"documentUrl":null,"financeTransactionId":null,"status":"signed",
      "createdAt":"2026-10-01T12:00:00.000Z"
    }]
  }
  """#
  let overview = try JSONDecoder().decode(FundraisingOverview.self, from: Data(json.utf8))

  #expect(overview.round?.targetCents == 50_000_000)
  #expect(overview.pendingCents == 12_500_000)
  #expect(overview.signedCents == 5_000_000)
  #expect(overview.fundedCents == 2_500_000)
  #expect(overview.prospects.first?.pipelineRecord?.status == "meeting_booked")
  #expect(overview.prospects.first?.pipelineRecord?.nextCallHasTime == false)
  #expect(overview.safes.first?.source == "native")
  #expect(overview.safes.first?.signedByInvestorAt == "2026-10-02T12:00:00.000Z")
}

@Test("encodes call and SAFE actions with the verified RPC keys")
func encodesFundraisingActionInputs() throws {
  let call = FundraisingCallLogInput(
    id: "contact-placeholder", outcome: "spoke", note: "Good conversation",
    nextCall: .set(at: "2026-11-04T12:00:00.000Z"))
  let callObject = try #require(
    JSONSerialization.jsonObject(with: JSONEncoder().encode(call)) as? [String: Any])
  #expect(Set(callObject.keys) == Set(["id", "outcome", "note", "nextCall"]))
  let nextCall = try #require(callObject["nextCall"] as? [String: Any])
  #expect(Set(nextCall.keys) == Set(["at", "hasTime"]))
  #expect(nextCall["hasTime"] as? Bool == false)

  let mark = FundraisingSafeMarkInput(id: "safe-placeholder", action: "signed", at: nil)
  let markObject = try #require(
    JSONSerialization.jsonObject(with: JSONEncoder().encode(mark)) as? [String: Any])
  #expect(Set(markObject.keys) == Set(["id", "action", "at"]))
  #expect(markObject["at"] is NSNull)
}
