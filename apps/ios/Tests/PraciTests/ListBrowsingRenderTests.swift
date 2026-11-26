import Foundation
import RakazoAPI
import SwiftUI
import Testing
import UIKit

@testable import Praci

/// Hosts a view in a real window and saves a PNG when `VISUAL_SHOTS` names a folder. Invented data only.
@MainActor
private func snapshot<V: View>(_ view: V, name: String, large: Bool = false) async {
  guard let folder = ProcessInfo.processInfo.environment["VISUAL_SHOTS"] else { return }
  let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
  let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow()
  window.frame = CGRect(x: 0, y: 0, width: 402, height: 874)
  window.rootViewController = UIHostingController(
    rootView: view.environment(\.dynamicTypeSize, large ? .accessibility3 : .large))
  window.makeKeyAndVisible()
  try? await Task.sleep(for: .milliseconds(800))
  let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
    window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
  }
  try? FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
  try? image.pngData()?.write(to: URL(fileURLWithPath: folder).appendingPathComponent("\(name).png"))
  window.isHidden = true
}

private func decode<T: Decodable>(_ json: String) throws -> T {
  try JSONDecoder().decode(T.self, from: Data(json.utf8))
}

private func fixtureTransactions() throws -> [FinanceTransaction] {
  let rows: [(String, String, Int, String?)] = [
    ("Northwind Cloud", "2026-11-03", -184_000, "Software"), ("Acme Payments", "2026-11-03", 960_000, nil),
    ("Harbor Air", "2026-11-02", -62_300, "Travel"), ("Lumen Legal", "2026-11-01", -250_000, "Legal"),
    ("Pine Cafe", "2026-10-31", -4_200, "Meals"), ("Orbit Insurance", "2026-10-30", -41_000, "Insurance"),
    ("Delta Supplies", "2026-10-29", -12_800, "Office"),
  ]
  return try rows.enumerated().map { index, row in
    let category = row.3.map { "\"\($0)\"" } ?? "null"
    return try decode(
      #"{"id":"t\#(index)","provider":"\#(index % 3 == 0 ? "brex" : "mercury")","postedAt":"\#(row.1)T10:00:00.000Z","amountCents":\#(row.2),"counterparty":"\#(row.0)","category":\#(category)}"#)
  }
}

private struct FixtureFinance: View {
  let hidden: Bool
  let transactions: [FinanceTransaction]
  let upcoming: [FinanceUpcoming]
  let accounts: [FinanceAccount]
  let categories: [FinanceCategory]

  var body: some View {
    NavigationStack {
      List {
        CappedSection(title: "Upcoming", items: upcoming, spec: upcomingSpec()) { item in
          LabeledContent {
            Text(financeMoney(item.amountCents, hidden: hidden))
          } label: {
            Text(item.name)
            if let date = item.dates.first { Text(financeDay(date)) }
          }
        }
        CappedSection(title: "Accounts", items: accounts, spec: accountsSpec(accounts)) { account in
          LabeledContent(account.name) { Text(financeMoney(account.balanceCents, hidden: hidden)) }
        }
        CappedSection(title: "Where it went", items: categories, spec: categoriesSpec()) { category in
          LabeledContent(category.label, value: financeMoney(category.cents, hidden: hidden))
        }
        CappedSection(
          title: "Transactions", items: transactions, spec: transactionsSpec(transactions)
        ) { transaction in
          LabeledContent(
            transaction.counterparty,
            value: financeSignedMoney(transaction.amountCents, currency: "USD", hidden: hidden))
        }
      }
      .navigationTitle("Finance")
      .navigationBarTitleDisplayMode(.inline)
    }
  }
}

@Test @MainActor func renderCappedAndFullLists() async throws {
  let transactions = try fixtureTransactions()
  let upcoming: [FinanceUpcoming] = try decode("""
    [{"key":"a","name":"Cloud hosting","dates":["2026-11-06"],"amountCents":120000},
     {"key":"b","name":"Payroll","dates":["2026-11-28"],"amountCents":900000},
     {"key":"c","name":"Insurance","dates":["2026-12-10"],"amountCents":40000},
     {"key":"d","name":"Office rent","dates":["2026-12-01"],"amountCents":300000},
     {"key":"e","name":"Design tools","dates":["2026-11-09"],"amountCents":8000}]
    """)
  let accounts: [FinanceAccount] = try decode("""
    [{"id":"1","provider":"mercury","name":"Operating","kind":"checking","balanceCents":4200000,"currency":"USD"},
     {"id":"2","provider":"mercury","name":"Savings","kind":"savings","balanceCents":9100000,"currency":"USD"},
     {"id":"3","provider":"brex","name":"Brex Cash","kind":"checking","balanceCents":1500000,"currency":"USD"},
     {"id":"4","provider":"brex","name":"Corporate Card","kind":"credit","balanceCents":-310000,"currency":"USD"},
     {"id":"5","provider":"mercury","name":"Euro account","kind":"checking","balanceCents":500000,"currency":"EUR"}]
    """)
  let categories: [FinanceCategory] = try decode("""
    [{"key":"software","label":"Software","cents":184000},{"key":"legal","label":"Legal","cents":250000},
     {"key":"travel","label":"Travel","cents":62300},{"key":"meals","label":"Meals","cents":4200},
     {"key":"office","label":"Office","cents":12800}]
    """)
  func page(hidden: Bool) -> FixtureFinance {
    FixtureFinance(hidden: hidden, transactions: transactions, upcoming: upcoming, accounts: accounts, categories: categories)
  }
  await snapshot(page(hidden: false), name: "finance-capped")
  await snapshot(page(hidden: true), name: "finance-capped-hidden")
  await snapshot(page(hidden: false), name: "finance-capped-large", large: true)
  await snapshot(
    NavigationStack {
      FullListScreen(title: "Transactions", items: transactions, spec: transactionsSpec(transactions)) { t in
        LabeledContent(t.counterparty, value: financeSignedMoney(t.amountCents, currency: "USD", hidden: false))
      }
    }, name: "transactions-full")
  await snapshot(
    NavigationStack {
      FullListScreen(title: "Transactions", items: transactions, spec: transactionsSpec(transactions)) { t in
        LabeledContent(t.counterparty, value: financeSignedMoney(t.amountCents, currency: "USD", hidden: true))
      }
    }, name: "transactions-full-hidden")
}
