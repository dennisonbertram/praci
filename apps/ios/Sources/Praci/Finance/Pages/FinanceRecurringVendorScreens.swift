import RakazoAPI
import RakazoUI
import SwiftUI

/// One recurring charge: how much, how often, and what it has cost so far.
struct FinanceRecurringScreen: View {
  let key: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceRecurringPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle(model.value?.recurring.name ?? "Recurring")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/recurring", input: FinanceRecurringInput(key: key))
  }

  @ViewBuilder
  private func content(_ page: FinanceRecurringPage, hidden: Bool) -> some View {
    let charge = page.recurring
    List {
      Section {
        VStack(alignment: .leading, spacing: 2) {
          Text(financeMoney(charge.amountCents, hidden: hidden))
            .font(.title2.monospacedDigit())
          Text("\(charge.cadenceTitle) · \(financeMoney(charge.monthlyCents, hidden: hidden)) a month")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .accessibilityIdentifier("recurringHeadline")
        LabeledContent("Next", value: CompanyDateText.day(charge.nextExpectedAt))
        LabeledContent("Last", value: CompanyDateText.day(charge.lastChargeAt))
        if charge.variable {
          LabeledContent("Charges", value: "\(charge.chargeCount), variable")
        } else {
          LabeledContent("Charges", value: String(charge.chargeCount))
        }
        if !charge.paidWith.isEmpty {
          LabeledContent("Paid with", value: charge.paidWith.map(\.title).joined(separator: ", "))
        }
      }
      if !page.pastCharges.isEmpty {
        Section("Past charges") {
          ForEach(page.pastCharges) { transaction in
            NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
              FinanceTransactionRow(transaction: transaction, hidden: hidden)
            }
            .accessibilityIdentifier("recurringChargeRow")
          }
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}

/// One vendor: what it costs on average, how that changed, and every charge.
struct FinanceVendorScreen: View {
  let key: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceVendorPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle(model.value?.name ?? "Vendor")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/vendor", input: FinanceVendorInput(key: key))
  }

  @ViewBuilder
  private func content(_ page: FinanceVendorPage, hidden: Bool) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 2) {
          Text(financeMoney(page.monthlyAvgCents, hidden: hidden))
            .font(.title2.monospacedDigit())
          Text(averageSubtitle(page)).font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityIdentifier("vendorAverage")
        if let change = page.changePct {
          LabeledContent("Change", value: change.formatted(
            .number.precision(.fractionLength(1)).sign(strategy: .always())) + "%")
        }
        LabeledContent("First seen", value: CompanyDateText.day(String(page.firstSeenAt.prefix(10))))
        if page.isSubscription {
          LabeledContent("Kind", value: "Subscription")
        }
        if !page.paidWith.isEmpty {
          LabeledContent("Paid with", value: page.paidWith.map(\.title).joined(separator: ", "))
        }
      }
      if !page.monthly.isEmpty {
        Section("By month") {
          ForEach(page.monthly) { month in
            HStack {
              Text(CompanyDateText.month(month.month)).font(.callout)
              Spacer()
              Text(financeMoney(month.cents, hidden: hidden))
                .font(.callout.monospacedDigit())
            }
          }
          if let current = page.currentMonth, current.cents > 0 {
            HStack {
              Text(CompanyDateText.month(current.month)).font(.callout)
              Text("so far").font(.caption2).foregroundStyle(.tertiary)
              Spacer()
              Text(financeMoney(current.cents, hidden: hidden))
                .font(.callout.monospacedDigit())
            }
          }
        }
      }
      Section("Charges") {
        if page.charges.isEmpty {
          Text("No charges yet").foregroundStyle(.secondary)
        }
        ForEach(page.charges) { transaction in
          NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
            FinanceTransactionRow(transaction: transaction, hidden: hidden)
          }
          .accessibilityIdentifier("vendorChargeRow")
        }
      }
    }
    .listStyle(.insetGrouped)
  }

  /// Says what the average covers, since a vendor can show a scaled figure rather than a mean.
  private func averageSubtitle(_ page: FinanceVendorPage) -> String {
    if let months = page.monthlyAvgMonths, months > 0 {
      return "Monthly average over \(months) \(months == 1 ? "month" : "months")"
    }
    return "Usual monthly charge"
  }
}

/// A receipt image for one transaction, fetched when opened.
struct FinanceReceiptScreen: View {
  let transactionID: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceReceipt>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { receipt in
      content(receipt)
    })
    .background(Color.token(.background))
    .navigationTitle("Receipt")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
  }

  private func load() async {
    await model.load(
      app, "finance/receiptUrl", input: FinanceReceiptInput(transactionId: transactionID))
  }

  @ViewBuilder
  private func content(_ receipt: FinanceReceipt) -> some View {
    if let url = URL(string: receipt.url), receipt.mimeType?.hasPrefix("image/") != false {
      ScrollView {
        AsyncImage(url: url) { phase in
          switch phase {
          case let .success(image):
            image.resizable().scaledToFit()
          case .failure:
            ContentUnavailableView(
              "Couldn’t load the receipt", systemImage: "doc",
              description: Text("Try opening it again from the transaction."))
          default:
            ProgressView().padding()
          }
        }
        .padding()
      }
      .accessibilityIdentifier("receiptImage")
    } else if let url = URL(string: receipt.url) {
      Link("Open receipt", destination: url).padding()
    } else {
      ContentUnavailableView(
        "No receipt to show", systemImage: "doc",
        description: Text("The vendor has not attached one."))
    }
  }
}
