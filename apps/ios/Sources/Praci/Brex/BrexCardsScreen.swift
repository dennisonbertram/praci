import RakazoAPI
import SwiftUI

struct BrexCardsScreen: View {
  @Environment(AppModel.self) private var app
  let data: BrexCardsView
  let model: BrexModel

  var body: some View {
    Section("Cards") {
      if data.partial { Text("Partial results").foregroundStyle(Color.token(.mutedForeground)) }
      if data.cards.isEmpty {
        Text("No cards").foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(data.cards) { card in
          NavigationLink {
            BrexCardDetailScreen(
              card: card, canChange: data.writesEnabled && data.agentBotId != nil,
              agentBotId: data.agentBotId, model: model)
          } label: {
            BrexCardRow(card: card, hidden: app.hideAmounts)
          }
          .accessibilityIdentifier("brexCard-\(card.cardId)")
        }
      }
    }
  }
}

private struct BrexCardRow: View {
  let card: BrexCardView
  let hidden: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack {
        Text(card.name).font(.headline).lineLimit(1)
        Spacer(minLength: 6)
        Text(brexCardStatusLabel(card.status))
          .font(.subheadline)
          .foregroundStyle(statusColor)
      }
      Text("•••• \(card.lastFour)")
        .font(.subheadline)
        .foregroundStyle(Color.token(.mutedForeground))
      Text(spendSummary)
        .font(.subheadline)
        .foregroundStyle(Color.token(.mutedForeground))
    }
    .padding(.vertical, 3)
    .accessibilityElement(children: .combine)
  }

  private var statusColor: Color {
    switch card.status.uppercased() {
    case "ACTIVE": Color.token(.success)
    case "LOCKED": Color.token(.warning)
    default: Color.token(.mutedForeground)
    }
  }

  private var spendSummary: String {
    let currency = card.currency ?? "USD"
    let spent = financeMoney(card.periodSpendCents, currency: currency, hidden: hidden)
    guard let limit = card.limitCents else { return "\(spent) spent" }
    let limitText = financeMoney(limit, currency: currency, hidden: hidden)
    return "\(spent) of \(limitText) · \(brexSpendPeriodLabel(card.duration))"
  }
}

private struct BrexCardDetailScreen: View {
  @Environment(AppModel.self) private var app
  @State private var cancelRequest: BrexCancelRequest?
  @State private var modelReason: BrexCancelReason = .other

  let card: BrexCardView
  let canChange: Bool
  let agentBotId: String?
  let model: BrexModel

  var body: some View {
    List {
      Section {
        LabeledContent("Status", value: brexCardStatusLabel(card.status))
        LabeledContent("Last four", value: "•••• \(card.lastFour)")
        LabeledContent("Owner", value: card.ownerName ?? card.ownerUserId ?? "—")
        LabeledContent(
          "Vendor",
          value: card.allowedMerchants.isEmpty ? "Any merchant" : card.allowedMerchants.joined(separator: ", "))
        LabeledContent("Limit", value: limitText)
        LabeledContent("Spend", value: spendText)
        if let lockAfterDate = card.lockAfterDate {
          LabeledContent("Locks after", value: financeDay(lockAfterDate))
        }
      }

      if canChange, let agentBotId, isUsableBrexCardID(card.cardId), card.status.uppercased() != "TERMINATED" {
        Section("Actions") {
          if card.status.uppercased() != "LOCKED" {
            Button("Lock", systemImage: "lock") {
              let selectedCard = card
              let message = brexLockMessage(cardId: selectedCard.cardId)
              guard let message else { return }
              Task { await model.send(message, botID: agentBotId, app: app) }
            }
            .disabled(model.isSending)
          }
          Button("Cancel card", systemImage: "xmark.circle", role: .destructive) {
            let selectedCard = card
            modelReason = .other
            cancelRequest = BrexCancelRequest(card: selectedCard)
          }
          .disabled(model.isSending)
        }
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle(card.name)
    .navigationBarTitleDisplayMode(.inline)
    .sheet(item: $cancelRequest) { request in
      NavigationStack {
        Form {
          Picker("Reason", selection: $modelReason) {
            ForEach(BrexCancelReason.allCases, id: \.self) { reason in
              Text(reason.rawValue).tag(reason)
            }
          }
          Button("Cancel card", role: .destructive) {
            let selectedCard = request.card
            let selectedReason = modelReason
            guard let message = brexCancelMessage(cardId: selectedCard.cardId, reason: selectedReason),
              let agentBotId
            else { return }
            cancelRequest = nil
            Task { await model.send(message, botID: agentBotId, app: app) }
          }
          .disabled(model.isSending)
        }
        .navigationTitle("Cancel card")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Close") { cancelRequest = nil }
          }
        }
      }
      .presentationDetents([.medium, .large])
    }
    .actionErrorAlert("Could not send to Brex", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private var limitText: String {
    guard let amount = card.limitCents else { return "No limit" }
    let currency = card.currency ?? "USD"
    let formatted = financeMoney(amount, currency: currency, hidden: app.hideAmounts)
    let period = brexSpendPeriodLabel(card.duration)
    return "\(formatted) \(period)"
  }

  private var spendText: String {
    let currency = card.currency ?? "USD"
    let spent = financeMoney(card.periodSpendCents, currency: currency, hidden: app.hideAmounts)
    let period = brexSpendPeriodLabel(card.duration)
    guard let limit = card.limitCents else { return "\(spent) · \(period)" }
    let limitAmount = financeMoney(limit, currency: currency, hidden: app.hideAmounts)
    return "\(spent) of \(limitAmount) · \(period)"
  }
}

private struct BrexCancelRequest: Identifiable {
  let card: BrexCardView
  var id: String { card.cardId }
}
