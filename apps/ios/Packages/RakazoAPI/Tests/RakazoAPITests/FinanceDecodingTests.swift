import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesFinanceOverview() throws {
  let overview = try decode(FinanceOverview.self, "finance-overview")
  #expect(overview.cashCents == 153_322_065)
  #expect(overview.monthlyBurnCents == 6_762_116)
  #expect(overview.runwayMonths == 22.7)
  #expect(overview.sources.count == 2)
  #expect(overview.isConnected)
  #expect(overview.upcoming.count == 3)
  #expect(overview.agentBotID != nil)
  #expect(overview.excludedNonUsdCount == 1)
}

@Test
func decodesFinanceAccountsWithOtherCurrency() throws {
  let accounts = try decode(FinanceAccounts.self, "finance-accounts")
  #expect(accounts.totalCashCents == 153_322_065)
  #expect(accounts.cash.count == 5)
  #expect(accounts.cards.last?.currency == "EUR")
}

@Test
func decodesFinanceBurnAndSpend() throws {
  let burn = try decode(FinanceBurn.self, "finance-burn")
  #expect(burn.series.count == 12)
  let spend = try decode(FinanceSpend.self, "finance-spend")
  #expect(spend.totalCents == 7_888_423)
  #expect(spend.categories.first?.label == "Payroll")
  #expect(spend.transactions.count == 3)
  #expect(spend.transactions[1].status == "pending")
}

@Test
func decodesFinanceTransactionWithoutAccount() throws {
  let detail = try decode(FinanceTransactionDetail.self, "finance-transaction")
  #expect(detail.transaction.counterparty == "Skyline Air (Mock)")
  #expect(detail.account == nil)
  #expect(detail.transaction.cardLastFour == "0001")
}
