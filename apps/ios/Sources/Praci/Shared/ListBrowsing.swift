import SwiftUI

/// One way to order a list.
struct ListSort<Item>: Identifiable {
  let id: String
  let title: String
  let areInOrder: (Item, Item) -> Bool
}

/// One choice inside a filter group, such as "This week".
struct ListFilterOption<Item>: Identifiable {
  let id: String
  let title: String
  let matches: (Item) -> Bool
}

/// A set of mutually exclusive choices. Nothing picked means no filtering by this group.
struct ListFilter<Item>: Identifiable {
  let id: String
  let title: String
  let options: [ListFilterOption<Item>]
}

/// What a list can be searched, sorted and filtered by. The first sort is the default.
struct ListSpec<Item> {
  var sorts: [ListSort<Item>]
  var filters: [ListFilter<Item>] = []
  var searchText: (Item) -> String
}

/// The reader's current choices on a full list screen.
struct ListQuery {
  var search = ""
  var sortID: String?
  /// Filter group id to the picked option id.
  var picks: [String: String] = [:]
}

/// How many rows an inline section shows before it links to the full list.
let cappedRowLimit = 3

func cappedRows<Item>(_ items: [Item], limit: Int = cappedRowLimit) -> [Item] {
  Array(items.prefix(limit))
}

func exceedsCap<Item>(_ items: [Item], limit: Int = cappedRowLimit) -> Bool {
  items.count > limit
}

extension ListSpec {
  /// Search first, then every picked filter, then the chosen sort. Equal items keep their input order.
  func apply(_ items: [Item], _ query: ListQuery) -> [Item] {
    let needle = query.search.trimmingCharacters(in: .whitespaces)
    var rows = items
    if !needle.isEmpty {
      rows = rows.filter { searchText($0).localizedCaseInsensitiveContains(needle) }
    }
    for filter in filters {
      if let pick = query.picks[filter.id], let option = filter.options.first(where: { $0.id == pick }) {
        rows = rows.filter(option.matches)
      }
    }
    guard let sort = sorts.first(where: { $0.id == query.sortID }) ?? sorts.first else { return rows }
    return rows.enumerated().sorted { left, right in
      if sort.areInOrder(left.element, right.element) { return true }
      if sort.areInOrder(right.element, left.element) { return false }
      return left.offset < right.offset
    }.map(\.element)
  }
}

/// A section that shows its first rows and, when there are more than the cap, a "See all (N)" row
/// that pushes the full list. The section leads with the spec's first sort.
struct CappedSection<Item: Identifiable, Row: View>: View {
  let title: LocalizedStringKey
  let items: [Item]
  let spec: ListSpec<Item>
  @ViewBuilder let row: (Item) -> Row

  var body: some View {
    let ordered = spec.apply(items, ListQuery())
    Section(title) {
      ForEach(cappedRows(ordered)) { row($0) }
      if exceedsCap(ordered) {
        NavigationLink {
          FullListScreen(title: title, items: items, spec: spec, row: row)
        } label: {
          Text("See all (\(ordered.count))")
        }
        .accessibilityIdentifier("seeAll")
      }
    }
  }
}

/// The whole list with native search and filter and sort menus in the toolbar.
struct FullListScreen<Item: Identifiable, Row: View>: View {
  let title: LocalizedStringKey
  let items: [Item]
  let spec: ListSpec<Item>
  @ViewBuilder let row: (Item) -> Row
  @State private var query = ListQuery()

  var body: some View {
    let rows = spec.apply(items, query)
    List {
      if rows.isEmpty {
        ContentUnavailableView {
          Label("No matches", systemImage: "magnifyingglass")
        }
      } else {
        ForEach(rows) { row($0) }
      }
    }
    .accessibilityIdentifier("fullList")
    .navigationTitle(title)
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $query.search)
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        if !spec.filters.isEmpty { filterMenu }
        if spec.sorts.count > 1 { sortMenu }
      }
    }
  }

  private var sortMenu: some View {
    Menu {
      Picker("Sort", selection: Binding(
        get: { query.sortID ?? spec.sorts.first?.id ?? "" }, set: { query.sortID = $0 })
      ) {
        ForEach(spec.sorts) { Text($0.title).tag($0.id) }
      }
    } label: {
      Label("Sort", systemImage: "arrow.up.arrow.down")
    }
    .accessibilityIdentifier("listSort")
  }

  private var filterMenu: some View {
    Menu {
      ForEach(spec.filters) { filter in
        if spec.filters.count == 1 {
          filterPicker(filter)
        } else {
          Menu(filter.title) { filterPicker(filter) }
        }
      }
    } label: {
      Label("Filter", systemImage: query.picks.isEmpty
        ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
    }
    .accessibilityIdentifier("listFilter")
  }

  private func filterPicker(_ filter: ListFilter<Item>) -> some View {
    Picker(filter.title, selection: Binding(
      get: { query.picks[filter.id] ?? "" },
      set: { query.picks[filter.id] = $0.isEmpty ? nil : $0 })
    ) {
      Text("All").tag("")
      ForEach(filter.options) { Text($0.title).tag($0.id) }
    }
  }
}
