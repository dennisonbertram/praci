import RakazoAPI

/// Sort and filter choices for deadlines. `latestFirst` makes the Done list lead with the most recent.
func deadlinesSpec(_ deadlines: [LegalDeadline], today: String, latestFirst: Bool = false)
  -> ListSpec<LegalDeadline>
{
  let soonest = ListSort<LegalDeadline>(id: "soonest", title: String(localized: "Due soonest")) {
    ($0.dueDate, $0.title) < ($1.dueDate, $1.title)
  }
  let latest = ListSort<LegalDeadline>(id: "latest", title: String(localized: "Due latest")) {
    ($0.dueDate, $0.title) > ($1.dueDate, $1.title)
  }
  func within(_ days: Int) -> (LegalDeadline) -> Bool {
    { (LegalDay.days(from: today, to: $0.dueDate) ?? Int.max) <= days }
  }
  func group(_ id: String, _ title: String, _ values: [String], _ match: @escaping (LegalDeadline, String) -> Bool)
    -> [ListFilter<LegalDeadline>]
  {
    values.count > 1
      ? [
        ListFilter(
          id: id, title: title,
          options: values.map { value in
            ListFilterOption(id: value, title: value.capitalized) { match($0, value) }
          })
      ] : []
  }
  return ListSpec(
    sorts: (latestFirst ? [latest, soonest] : [soonest, latest]) + [
      ListSort(id: "title", title: String(localized: "Title")) {
        $0.title.localizedStandardCompare($1.title) == .orderedAscending
      }
    ],
    filters: (latestFirst
      ? []
      : [
        ListFilter(
          id: "due", title: String(localized: "Due"),
          options: [
            ListFilterOption(id: "30", title: String(localized: "Within 30 days"), matches: within(30)),
            ListFilterOption(id: "90", title: String(localized: "Within 90 days"), matches: within(90)),
          ])
      ])
      + group("status", String(localized: "Status"), Set(deadlines.map(\.status)).sorted()) { $0.status == $1 }
      + group("kind", String(localized: "Kind"), Set(deadlines.map(\.kind)).sorted()) { $0.kind == $1 },
    searchText: { [$0.title, $0.contractTitle].compactMap { $0 }.joined(separator: " ") })
}
