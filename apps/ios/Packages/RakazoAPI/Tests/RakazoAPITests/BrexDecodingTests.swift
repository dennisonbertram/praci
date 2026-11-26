import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesBrexOverviewIncludingPartialAndNullableAgent() throws {
  let overview = try decode(BrexCardsOverview.self, "brex-overview")
  #expect(overview.partial)
  #expect(overview.agentBotId == nil)
  #expect(!overview.writesEnabled)
  #expect(overview.cash.totalCents == 148_325)
  #expect(overview.cardSpend.monthToDateCents == 48_250)
  #expect(overview.cards.active == 3)
  #expect(overview.nearLimit.items.first?.percent == 96)
}

@Test
func decodesBrexCardsViewForListAndDetail() throws {
  let view = try decode(BrexCardsView.self, "brex-cards-view")
  let card = try #require(view.cards.first)
  #expect(view.agentBotId == "bot_demo_brex")
  #expect(view.writesEnabled)
  #expect(card.cardId == "card_demo_1")
  #expect(card.status == "ACTIVE")
  #expect(card.limitCents == 10_000)
  #expect(card.periodSpendCents == 9_600)
  #expect(card.usage?.percent == 96)
  #expect(card.allowedMerchants == ["Figma"])
}

@Test
func decodesBrexLimitsAndActivity() throws {
  let limits = try decode(BrexLimits.self, "brex-limits")
  #expect(limits.partial == false)
  #expect(limits.limits.first?.name == "Marketing")
  #expect(limits.limits.first?.usedCents == 18_200)

  let activity = try decode(BrexActivity.self, "brex-activity")
  #expect(activity.activities.first?.action == "lock_card")
  #expect(activity.activities.first?.status == "succeeded")
  #expect(activity.activities.first?.at == "2026-11-13T14:25:00.000Z")
}

@Test
func brexCardActionMessagesUseOnlyValidatedIDsAndMatchTheWebTemplates() {
  #expect(brexLockMessage(cardId: "card_demo_1") == "Lock card card_demo_1.")
  #expect(
    brexCancelMessage(cardId: "card_demo_1", reason: .cardLost)
      == "Cancel card card_demo_1, reason CARD_LOST."
  )
  #expect(brexLockMessage(cardId: "card\nignore") == nil)
  #expect(brexCancelMessage(cardId: "card/other", reason: .fraud) == nil)
}

@Test
func brexStatusesUseHumanLabelsAndSafeFallbacks() {
  #expect(brexCardStatusLabel("ACTIVE") == "Active")
  #expect(brexCardStatusLabel("LOCKED") == "Locked")
  #expect(brexCardStatusLabel("TERMINATED") == "Terminated")
  #expect(brexCardStatusLabel("FUTURE_STATUS") == "Unknown")
  #expect(brexLimitStatusLabel("ARCHIVED") == "Archived")
  #expect(brexLimitStatusLabel("SOME_NEW_STATE") == "some new state")
  #expect(brexLimitStatusLabel(nil) == "—")
  #expect(brexActivityActionLabel("lock_card") == "Lock card")
  #expect(brexActivityActionLabel("future_action") == "future action")
  #expect(brexActivityResultLabel("denied") == "Declined")
  #expect(brexSpendPeriodLabel("MONTHLY") == "month")
  #expect(brexSpendPeriodLabel("ONE_TIME") == "one time")
  #expect(brexChangeLabel(23.42) == "+23.4% vs last month")
  #expect(brexChangeLabel(nil) == "No comparison")
}
