import Foundation

enum ThreadTarget: Hashable, Sendable {
  case bot(String)
  case group(String)
}

enum Route: Hashable, Sendable {
  case thread(ThreadTarget)
  case inbox
  case inboxMessage(messageID: String)
  case computer(botID: String)
  case artifacts(botID: String)
  case artifact(artifactID: String)
  case agentPage(botID: String, pageID: String? = nil)
  case routines(botID: String)
  case routine(routineID: String)
  case botSettings(botID: String)
  case groupSettings(groupID: String)
  case finance
  case financeAccounts
  case financeAccount(id: String)
  case financeBurn
  case financeMonth(month: String)
  case financeRunway
  case financeCrypto
  case financeUpcoming
  case financeSubscriptions
  case financeSpend(period: String = "month", category: String? = nil)
  case financeCategory(slug: String, period: String? = nil, month: String? = nil)
  case financeRecurring(key: String)
  case financeVendor(key: String)
  case financeTransaction(id: String)
  case financeReceipt(id: String)
  case company
  case brex
  case gtm
  case calendar
  case contacts
  case contact(id: String)
  case board
  case ticket(id: String)
  case legal
  case fundraising
  case capTable
  case investors
  case investorUpdate(id: String)
  case dataRoom
  case scanner
  case dataRoomItem(itemID: String)
  case meetings
  case meeting(id: String)

  /// The Finance sub-page a `/app/finance/...` path names, mirroring the web route table.
  private static func financeSub(_ url: URLComponents?, _ name: String) -> Route? {
    // Percent-decode the argument: an agent writes a slug such as "Software%20%26%20SaaS", and the
    // server expects the decoded value it was given. A web path is /app/finance/<sub>/<arg> and a
    // custom-scheme path is /finance/<sub>/<arg>, so the argument follows the sub-page name
    // wherever it sits rather than at a fixed index.
    let segments = (url?.path.split(separator: "/") ?? []).map(String.init)
    let arg = segments.firstIndex(of: name).flatMap { index in
      segments.indices.contains(index + 1) ? segments[index + 1] : nil
    }?.removingPercentEncoding
    // A filtered link carries its window as a query: ?period=, ?cat=, ?month=. Dropping it would
    // open the default window and show different totals than the link was written for. The first
    // value wins, so a link repeating a parameter cannot trap the process.
    let query = Dictionary(
      (url?.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } },
      uniquingKeysWith: { first, _ in first })
    switch (name, arg) {
    case ("accounts", nil): return .financeAccounts
    case ("burn", nil): return .financeBurn
    case ("runway", nil): return .financeRunway
    case ("crypto", nil): return .financeCrypto
    case ("upcoming", nil): return .financeUpcoming
    case ("subscriptions", nil): return .financeSubscriptions
    case ("spend", nil):
      return .financeSpend(period: query["period"] ?? "month", category: query["cat"])
    case ("account", let id?): return .financeAccount(id: id)
    case ("month", let month?): return .financeMonth(month: month)
    case ("category", let slug?):
      return .financeCategory(
        slug: slug, period: query["period"], month: query["month"])
    case ("recurring", let key?): return .financeRecurring(key: key)
    case ("vendor", let key?): return .financeVendor(key: key)
    case ("transaction", let id?): return .financeTransaction(id: id)
    case ("receipt", let id?): return .financeReceipt(id: id)
    default: return nil
    }
  }

  /// A web path an agent wrote as a Markdown link, such as `/app/pages/<bot>/<page>`. Anything the app
  /// has no screen for returns nil, so the link does nothing.
  init?(appPath: String) {
    guard appPath.hasPrefix("/app/"), let url = URLComponents(string: appPath), url.host == nil
    else { return nil }
    let parts = url.path.split(separator: "/", omittingEmptySubsequences: false).dropFirst(2).map(String.init)
    switch parts.first {
    case "pages" where parts.count == 3 && !parts[1].isEmpty && !parts[2].isEmpty:
      self = .agentPage(botID: parts[1], pageID: parts[2])
    case "artifacts" where parts.count == 2 && !parts[1].isEmpty:
      self = .artifact(artifactID: parts[1])
    case "scanner" where parts.count == 1: self = .scanner
    case "finance" where parts.count >= 2 && !parts[1].isEmpty:
      // A sub-page may carry an argument: /app/finance/month/2026-10, /app/finance/vendor/<key>.
      guard parts.count <= 3, let route = Route.financeSub(url, parts[1]) else { return nil }
      self = route
    case "company" where parts.count <= 1: self = .company
    case "data-room" where parts.count == 1:
      if let id = url.queryItems?.first(where: { $0.name == "item" })?.value, !id.isEmpty {
        self = .dataRoomItem(itemID: id)
      } else {
        self = .dataRoom
      }
    default: return nil
    }
  }

  /// Accepts only `rakazo://open/...`; any other URL (including `rakazo://sign-in`) is ignored.
  init?(url: URL) {
    guard url.scheme == "rakazo", url.host() == "open" else { return nil }
    let parts = Array(url.pathComponents.dropFirst().filter { $0 != "/" })
    guard parts.count <= 3 else { return nil }
    // Keep the query: a filtered Finance link carries its window there.
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    switch (parts.first, parts.dropFirst().first, parts.dropFirst(2).first) {
    case ("inbox", nil, nil): self = .inbox
    case ("finance", nil, nil): self = .finance
    case ("finance", let sub?, nil):
      guard let route = Route.financeSub(components, sub) else { return nil }
      self = route
    case ("finance", let sub?, _):
      // A sub-page with an argument, such as /finance/month/2026-10 or /finance/vendor/<key>.
      guard let route = Route.financeSub(components, sub) else { return nil }
      self = route
    case ("company", nil, nil): self = .company
    case ("brex", nil, nil): self = .brex
    case ("gtm", nil, nil): self = .gtm
    case ("calendar", nil, nil): self = .calendar
    case ("contacts", nil, nil): self = .contacts
    case ("contacts", let id?, nil): self = .contact(id: id)
    case ("legal", nil, nil): self = .legal
    case ("fundraising", nil, nil): self = .fundraising
    case ("cap-table", nil, nil): self = .capTable
    case ("data-room", nil, nil): self = .dataRoom
    case ("scanner", nil, nil): self = .scanner
    case ("meetings", nil, nil): self = .meetings
    case ("meeting", let id?, nil): self = .meeting(id: id)
    case ("inbox", let id?, nil): self = .inboxMessage(messageID: id)
    case ("bot", let id?, nil): self = .thread(.bot(id))
    case ("group", let id?, nil): self = .thread(.group(id))
    case ("artifact", let id?, nil): self = .artifact(artifactID: id)
    case ("routine", let id?, nil): self = .routine(routineID: id)
    case ("bot", let id?, "computer"): self = .computer(botID: id)
    case ("bot", let id?, "artifacts"): self = .artifacts(botID: id)
    case ("bot", let id?, "page"): self = .agentPage(botID: id)
    case ("bot", let id?, "routines"): self = .routines(botID: id)
    case ("bot", let id?, "settings"): self = .botSettings(botID: id)
    case ("group", let id?, "settings"): self = .groupSettings(groupID: id)
    default: return nil
    }
  }
}
