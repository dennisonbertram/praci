import Observation
import RakazoAPI
import SwiftUI

private struct UpdateIDInput: Encodable, Sendable {
  let id: String
}

private struct InvestorUpdateActionInput: Encodable, Sendable {
  let id: String
  let contactIds: [String]
}

@MainActor
@Observable
private final class UpdateModel {
  let updateID: String
  let page = PageLoader<InvestorUpdate>()
  var state: Loadable<InvestorUpdate> { page.state }
  var refreshError: String? { page.refreshError }
  var actionError: String?

  init(updateID: String) { self.updateID = updateID }

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      try await app.call("investors/updates/get", input: UpdateIDInput(id: updateID))
    }
  }

  func retry(_ update: InvestorUpdate, contactID: String, app: AppModel) async {
    let failedContactIDs = retryableInvestorContactIDs(update.deliveries)
    guard update.status == .partlySent, failedContactIDs.contains(contactID) else { return }
    do {
      let _: InvestorUpdate = try await app.call(
        "investors/updates/retry",
        input: InvestorUpdateActionInput(id: update.id, contactIds: [contactID]))
      await load(app)
    } catch { actionError = error.localizedDescription }
  }

  func markDelivered(_ update: InvestorUpdate, contactID: String, app: AppModel) async {
    guard update.status != .sending,
      update.deliveries.contains(where: { $0.contactId == contactID && $0.state == .unknown })
    else { return }
    do {
      let _: InvestorUpdate = try await app.call(
        "investors/updates/markDelivered",
        input: InvestorUpdateActionInput(id: update.id, contactIds: [contactID]))
      await load(app)
    } catch { actionError = error.localizedDescription }
  }
}

struct UpdateScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model: UpdateModel
  let updateID: String

  init(updateID: String) {
    self.updateID = updateID
    _model = State(initialValue: UpdateModel(updateID: updateID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { update in
      List {
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        Section {
          VStack(alignment: .leading, spacing: 5) {
            Text(update.subject).font(.title3.weight(.semibold))
            Text("\(update.audience.displayName) · \(update.status.displayName)")
              .font(.subheadline)
              .foregroundStyle(Color.token(.mutedForeground))
            if let sentAt = update.sentAt {
              Text("\(update.status == .posted ? "Posted" : "Sent") \(day(sentAt))")
                .font(.subheadline)
                .foregroundStyle(Color.token(.mutedForeground))
            }
          }
          .padding(.vertical, 3)
        }
        Section("Update") {
          MarkdownView(text: update.body)
            .padding(.vertical, 4)
            .listRowSeparator(.hidden)
        }
        Section("Delivery") {
          if update.deliveries.isEmpty {
            Text("No delivery results")
              .foregroundStyle(Color.token(.mutedForeground))
          } else {
            ForEach(update.deliveries) { delivery in
              DeliveryRow(
                delivery: delivery,
                canRetry: update.status == .partlySent,
                canMarkDelivered: update.status != .sending)
              {
                let updateValue = update
                let contactID = delivery.contactId
                Task { await model.retry(updateValue, contactID: contactID, app: app) }
              } onMarkDelivered: {
                let updateValue = update
                let contactID = delivery.contactId
                Task { await model.markDelivered(updateValue, contactID: contactID, app: app) }
              }
            }
          }
        }
      }
      .listStyle(.insetGrouped)
    })
    .navigationTitle("Update")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .actionErrorAlert("Could not update investor information", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }
}

private struct DeliveryRow: View {
  let delivery: InvestorDelivery
  let canRetry: Bool
  let canMarkDelivered: Bool
  let onRetry: () -> Void
  let onMarkDelivered: () -> Void

  var body: some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text(delivery.name).font(.headline)
        Text(delivery.state.displayName)
          .font(.subheadline)
          .foregroundStyle(delivery.state == .failed ? Color.token(.destructive) : Color.token(.mutedForeground))
      }
      Spacer(minLength: 4)
      if delivery.state == .failed && canRetry {
        Button("Retry", action: onRetry)
          .buttonStyle(.bordered)
      } else if delivery.state == .unknown && canMarkDelivered {
        Button("Mark delivered", action: onMarkDelivered)
          .buttonStyle(.bordered)
      }
    }
    .accessibilityElement(children: .contain)
  }
}

private func day(_ value: String) -> String { investorDay(value) }
