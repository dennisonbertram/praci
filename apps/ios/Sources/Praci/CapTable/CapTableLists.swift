import RakazoAPI

func holdersSpec(_ holders: [CapHolder]) -> ListSpec<CapHolder> {
  let securities = Set(holders.compactMap(\.security)).sorted()
  return ListSpec(
    sorts: [
      ListSort(id: "ownership", title: String(localized: "Ownership")) { left, right in
        switch (left.percent, right.percent) {
        case let (l?, r?): return l > r
        case (_?, nil): return true
        default: return false
        }
      },
      ListSort(id: "shares", title: String(localized: "Shares")) { left, right in
        (left.shares ?? -1) > (right.shares ?? -1)
      },
      ListSort(id: "name", title: String(localized: "Name")) {
        $0.name.localizedStandardCompare($1.name) == .orderedAscending
      },
    ],
    filters: securities.count > 1
      ? [
        ListFilter(
          id: "security", title: String(localized: "Security"),
          options: securities.map { name in
            ListFilterOption(id: name, title: name) { $0.security == name }
          })
      ] : [],
    searchText: { [$0.name, $0.security, $0.organization].compactMap { $0 }.joined(separator: " ") })
}
