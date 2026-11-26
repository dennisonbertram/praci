import Foundation
import RakazoAPI
import Testing

@testable import Praci

private func decode<T: Decodable>(_ json: String) throws -> T {
  try JSONDecoder().decode(T.self, from: Data(json.utf8))
}

private struct Row: Identifiable {
  let id: String
  let n: Int
  let tag: String
}

private func makeRowSpec() -> ListSpec<Row> {
  ListSpec<Row>(
  sorts: [
    ListSort(id: "high", title: "High") { $0.n > $1.n },
    ListSort(id: "low", title: "Low") { $0.n < $1.n },
  ],
  filters: [
    ListFilter(
      id: "tag", title: "Tag",
      options: [ListFilterOption(id: "a", title: "A") { $0.tag == "a" }])
  ],
  searchText: { $0.id })
}

private func makeRows() -> [Row] {
  [Row(id: "alpha", n: 2, tag: "a"), Row(id: "beta", n: 5, tag: "b"), Row(id: "gamma", n: 2, tag: "a")]
}

@Test func capShowsThreeRowsAndOnlyOverflowsPastThree() {
  #expect(cappedRows([1, 2, 3, 4, 5]) == [1, 2, 3])
  #expect(cappedRows([1, 2]) == [1, 2])
  #expect(exceedsCap([1, 2, 3]) == false)
  #expect(exceedsCap([1, 2, 3, 4]) == true)
}

@Test func sortUsesTheChosenOrderAndKeepsTiesInInputOrder() {
  let rowSpec = makeRowSpec(), rows = makeRows()
  #expect(rowSpec.apply(rows, ListQuery()).map(\.id) == ["beta", "alpha", "gamma"])
  #expect(rowSpec.apply(rows, ListQuery(sortID: "low")).map(\.id) == ["alpha", "gamma", "beta"])
  #expect(rowSpec.apply(rows, ListQuery(sortID: "unknown")).map(\.id) == ["beta", "alpha", "gamma"])
}

@Test func searchAndFiltersNarrowTogether() {
  let rowSpec = makeRowSpec(), rows = makeRows()
  #expect(rowSpec.apply(rows, ListQuery(search: " ALP ")).map(\.id) == ["alpha"])
  #expect(rowSpec.apply(rows, ListQuery(picks: ["tag": "a"])).map(\.id) == ["alpha", "gamma"])
  #expect(rowSpec.apply(rows, ListQuery(search: "beta", picks: ["tag": "a"])).isEmpty)
  #expect(rowSpec.apply(rows, ListQuery(picks: ["tag": "gone"])).count == 3)
}

private func makeUpcoming() throws -> [FinanceUpcoming] {
  try decode("""
  [{"key":"a","name":"Cloud hosting","dates":["2026-11-06"],"amountCents":120000},
   {"key":"b","name":"Payroll","dates":["2026-11-28"],"amountCents":900000},
   {"key":"c","name":"Insurance","dates":["2026-12-10"],"amountCents":40000},
   {"key":"d","name":"Office","dates":[],"amountCents":5000}]
  """)
}

@Test func upcomingSortsByDateAndAmountAndFiltersByWindow() throws {
  let now = try #require(ISO8601DateFormatter().date(from: "2026-11-04T12:00:00Z"))
  let spec = upcomingSpec(now: now), upcoming = try makeUpcoming()
  #expect(spec.apply(upcoming, ListQuery()).map(\.key) == ["a", "b", "c", "d"])
  #expect(spec.apply(upcoming, ListQuery(sortID: "amount")).map(\.key) == ["b", "a", "c", "d"])
  #expect(spec.apply(upcoming, ListQuery(picks: ["when": "week"])).map(\.key) == ["a"])
  #expect(spec.apply(upcoming, ListQuery(picks: ["when": "month"])).map(\.key) == ["a", "b"])
  #expect(spec.apply(upcoming, ListQuery(search: "pay")).map(\.key) == ["b"])
}

private func account(_ id: String, _ provider: String, _ cents: Int, _ currency: String = "USD") throws -> FinanceAccount {
  try decode(
    #"{"id":"\#(id)","provider":"\#(provider)","name":"\#(id)","kind":"checking","balanceCents":\#(cents),"currency":"\#(currency)"}"#)
}

@Test func accountsLeadWithTheLargestCountedBalance() throws {
  let list = [
    try account("small", "mercury", 100), try account("euro", "mercury", 9_000_000, "EUR"),
    try account("big", "brex", 5_000), try account("mid", "mercury", 2_000),
  ]
  let spec = accountsSpec(list)
  #expect(spec.apply(list, ListQuery()).map(\.id) == ["big", "mid", "small", "euro"])
  #expect(spec.apply(list, ListQuery(picks: ["provider": "brex"])).map(\.id) == ["big"])
  // One account type only, so the type filter is not offered.
  #expect(spec.filters.map(\.id) == ["provider"])
}

private func txn(_ id: String, _ day: String, _ cents: Int, _ category: String?, _ provider: String = "mercury") throws
  -> FinanceTransaction
{
  let cat = category.map { "\"\($0)\"" } ?? "null"
  return try decode(
    #"{"id":"\#(id)","provider":"\#(provider)","postedAt":"\#(day)T10:00:00.000Z","amountCents":\#(cents),"counterparty":"Vendor \#(id)","category":\#(cat)}"#)
}

@Test func transactionsFilterByDirectionCategoryAndSource() throws {
  let list = [
    try txn("1", "2026-11-01", -2_000, "Software"), try txn("2", "2026-11-03", 50_000, nil),
    try txn("3", "2026-11-02", -90_000, "Travel", "brex"),
  ]
  let spec = transactionsSpec(list)
  #expect(spec.apply(list, ListQuery()).map(\.id) == ["2", "3", "1"])
  #expect(spec.apply(list, ListQuery(sortID: "amount")).map(\.id) == ["3", "2", "1"])
  #expect(spec.apply(list, ListQuery(picks: ["direction": "in"])).map(\.id) == ["2"])
  #expect(spec.apply(list, ListQuery(picks: ["direction": "out"])).map(\.id) == ["3", "1"])
  #expect(spec.apply(list, ListQuery(picks: ["category": "Travel"])).map(\.id) == ["3"])
  #expect(spec.apply(list, ListQuery(picks: ["category": "__none"])).map(\.id) == ["2"])
  #expect(spec.apply(list, ListQuery(picks: ["source": "brex"])).map(\.id) == ["3"])
  #expect(spec.apply(list, ListQuery(search: "vendor 1")).map(\.id) == ["1"])
}

@Test func deadlinesFilterByWindowAndSortBothWays() throws {
  func deadline(_ id: String, _ due: String, _ kind: String) throws -> LegalDeadline {
    try decode(#"{"id":"\#(id)","title":"T\#(id)","dueDate":"\#(due)","kind":"\#(kind)","status":"open"}"#)
  }
  let list = [
    try deadline("1", "2026-12-20", "renewal"), try deadline("2", "2027-03-01", "notice"),
    try deadline("3", "2026-11-30", "renewal"),
  ]
  let spec = deadlinesSpec(list, today: "2026-11-04")
  #expect(spec.apply(list, ListQuery()).map(\.id) == ["3", "1", "2"])
  #expect(spec.apply(list, ListQuery(sortID: "latest")).map(\.id) == ["2", "1", "3"])
  #expect(spec.apply(list, ListQuery(picks: ["due": "30"])).map(\.id) == ["3"])
  #expect(spec.apply(list, ListQuery(picks: ["kind": "notice"])).map(\.id) == ["2"])
  #expect(deadlinesSpec(list, today: "2026-11-04", latestFirst: true).apply(list, ListQuery()).map(\.id) == ["2", "1", "3"])
}

@Test func holdersSortByOwnershipSharesAndFilterBySecurity() throws {
  let list: [CapHolder] = try decode("""
    [{"name":"Founder","security":"Common","shares":600,"percent":60},
     {"name":"Fund","security":"Series A","shares":300,"percent":30},
     {"name":"Pool","security":"Options"}]
    """)
  let spec = holdersSpec(list)
  #expect(spec.apply(list, ListQuery()).map(\.name) == ["Founder", "Fund", "Pool"])
  #expect(spec.apply(Array(list.reversed()), ListQuery(sortID: "name")).map(\.name) == ["Founder", "Fund", "Pool"])
  #expect(spec.apply(list, ListQuery(picks: ["security": "Series A"])).map(\.name) == ["Fund"])
}
