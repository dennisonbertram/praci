import RakazoAPI
import SwiftUI

struct FinanceTransactionScreen: View {
  @Environment(AppModel.self) private var app
  let id: String
  /// The dashboard model, when this was opened from the dashboard. Pages push plain, so it is optional.
  var model: FinanceModel?
  /// The dashboard already knows the preference; a routed screen has none, so it reads it. Masked
  /// until then, so an amount the user hid never shows.
  var knownHidden: Bool?
  @State private var hidden = true
  @State private var state: Loadable<FinanceTransactionDetail> = .idle

  var body: some View {
    LoadableView(state: state, retry: { Task { await load() } }, content: { detail in
      List {
        Section {
          LabeledContent(
            "Amount",
            value: financeSignedMoney(
              detail.transaction.amountCents, currency: detail.transaction.currency,
              hidden: hidden, exact: true))
          LabeledContent("Date", value: financeDay(detail.transaction.postedAt))
          LabeledContent("Status", value: detail.transaction.status.capitalized)
          if let category = detail.transaction.category {
            LabeledContent("Category", value: category)
          }
          if let account = detail.account { LabeledContent("Account", value: account.name) }
          if let last = detail.transaction.cardLastFour {
            LabeledContent("Card", value: "•• \(last)")
          }
          if let holder = detail.transaction.cardholder {
            LabeledContent("Cardholder", value: holder)
          }
          if detail.vendorIsSubscription { LabeledContent("Subscription", value: "Yes") }
          LabeledContent("Receipt", value: detail.transaction.hasReceipt ? "Attached" : "None")
        }
        if let memo = detail.transaction.memo {
          Section("Memo") { Text(memo) }
        }
      }
      .navigationTitle(detail.vendorName ?? detail.transaction.counterparty)
    })
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
  }

  private func load() async {
    state = .loading
    if let knownHidden { hidden = knownHidden }
    else if let me: Me = try? await app.call("me") { hidden = me.hideAmounts }
    do {
      let detail: FinanceTransactionDetail =
        if let model { try await model.transaction(id, app) } else {
          try await app.call("finance/transaction", input: FinanceTransactionInput(id: id))
        }
      state = .loaded(detail)
    } catch {
      state = .failed(error.localizedDescription)
    }
  }
}
