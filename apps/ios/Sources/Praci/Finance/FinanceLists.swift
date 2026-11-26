import Foundation
import RakazoAPI

/// Search, sort and filter choices for the Finance lists. Everything here uses fields the server
/// returns; the lists are already loaded in full, so nothing is refetched.

private func distinct<Item>(_ items: [Item], _ value: (Item) -> String?) -> [String] {
  Array(Set(items.compactMap(value).filter { !$0.isEmpty })).sorted()
}

private func options<Item>(_ values: [String], _ match: @escaping (Item, String) -> Bool) -> [ListFilterOption<Item>] {
  values.map { value in ListFilterOption(id: value, title: value.capitalized) { match($0, value) } }
}

// MARK: Upcoming

func upcomingSpec(now: Date = Date()) -> ListSpec<FinanceUpcoming> {
  let today = LegalDay.today(now)
  func days(_ item: FinanceUpcoming) -> Int? { item.dates.first.flatMap { LegalDay.days(from: today, to: $0) } }
  return ListSpec(
    sorts: [
      ListSort(id: "date", title: String(localized: "Date")) { left, right in
        (left.dates.first ?? "9999") < (right.dates.first ?? "9999")
      },
      ListSort(id: "amount", title: String(localized: "Amount")) { $0.amountCents > $1.amountCents },
      ListSort(id: "name", title: String(localized: "Name")) {
        $0.name.localizedStandardCompare($1.name) == .orderedAscending
      },
    ],
    filters: [
      ListFilter(
        id: "when", title: String(localized: "When"),
        options: [
          ListFilterOption(id: "week", title: String(localized: "This week")) {
            (days($0) ?? -1) >= 0 && (days($0) ?? 99) <= 7
          },
          ListFilterOption(id: "month", title: String(localized: "This month")) {
            guard let date = $0.dates.first else { return false }
            return date.prefix(7) == today.prefix(7) && (days($0) ?? -1) >= 0
          },
        ])
    ],
    searchText: { $0.name })
}

// MARK: Accounts

/// USD accounts lead because they are the ones counted in cash; the largest balance comes first.
func accountsSpec(_ accounts: [FinanceAccount]) -> ListSpec<FinanceAccount> {
  ListSpec(
    sorts: [
      ListSort(id: "balance", title: String(localized: "Balance")) { left, right in
        if (left.currency == "USD") != (right.currency == "USD") { return left.currency == "USD" }
        return left.balanceCents > right.balanceCents
      },
      ListSort(id: "name", title: String(localized: "Name")) {
        $0.name.localizedStandardCompare($1.name) == .orderedAscending
      },
    ],
    filters: [
      ListFilter(
        id: "provider", title: String(localized: "Provider"),
        options: options(distinct(accounts, \.provider)) { $0.provider == $1 }),
      ListFilter(
        id: "kind", title: String(localized: "Type"),
        options: options(distinct(accounts, \.kind)) { $0.kind == $1 }),
    ].filter { $0.options.count > 1 },
    searchText: { "\($0.name) \($0.provider)" })
}

// MARK: Where it went

func categoriesSpec() -> ListSpec<FinanceCategory> {
  ListSpec(
    sorts: [
      ListSort(id: "amount", title: String(localized: "Amount")) { $0.cents > $1.cents },
      ListSort(id: "name", title: String(localized: "Name")) {
        $0.label.localizedStandardCompare($1.label) == .orderedAscending
      },
    ],
    searchText: { $0.label })
}

// MARK: Transactions

private let uncategorized = "__none"

func transactionsSpec(_ transactions: [FinanceTransaction]) -> ListSpec<FinanceTransaction> {
  let categoryOptions =
    distinct(transactions, \.category).map { name in
      ListFilterOption<FinanceTransaction>(id: name, title: name) { $0.category == name }
    }
    + (transactions.contains { $0.category == nil }
      ? [ListFilterOption(id: uncategorized, title: String(localized: "Uncategorized")) { $0.category == nil }]
      : [])
  return ListSpec(
    sorts: [
      ListSort(id: "newest", title: String(localized: "Newest")) { $0.postedAt > $1.postedAt },
      ListSort(id: "oldest", title: String(localized: "Oldest")) { $0.postedAt < $1.postedAt },
      ListSort(id: "amount", title: String(localized: "Amount")) { abs($0.amountCents) > abs($1.amountCents) },
    ],
    filters: [
      ListFilter(
        id: "direction", title: String(localized: "Direction"),
        options: [
          ListFilterOption(id: "in", title: String(localized: "Money in")) { $0.amountCents > 0 },
          ListFilterOption(id: "out", title: String(localized: "Money out")) { $0.amountCents <= 0 },
        ]),
      ListFilter(id: "category", title: String(localized: "Category"), options: categoryOptions),
      ListFilter(
        id: "source", title: String(localized: "Account"),
        options: options(distinct(transactions, \.provider)) { $0.provider == $1 }),
    ].filter { $0.options.count > 1 || $0.id == "direction" },
    searchText: { [$0.counterparty, $0.category, $0.memo, $0.cardholder].compactMap { $0 }.joined(separator: " ") })
}
