import Observation
import RakazoAPI
import SwiftUI

private struct AuditListInput: Encodable, Sendable {
  let includeDone: Bool
}

private struct InvestorsIndex: Sendable {
  let updates: [InvestorUpdate]
  let audits: [AuditRequest]
}

@MainActor
@Observable
private final class UpdatesModel {
  let page = PageLoader<InvestorsIndex>()
  var state: Loadable<InvestorsIndex> { page.state }
  var refreshError: String? { page.refreshError }
  var actionError: String?

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      async let updates: [InvestorUpdate] = app.call("investors/updates/list")
      async let audits: [AuditRequest] = app.call(
        "investors/audits/list", input: AuditListInput(includeDone: false))
      let result = try await InvestorsIndex(updates: updates, audits: audits)
      return result
    }
  }

  func closeAudit(_ audit: AuditRequest, status: String, app: AppModel) async {
    do {
      let _: AuditRequest = try await app.call(
        "investors/audits/update", input: AuditUpdateInput(id: audit.id, status: status))
      await load(app)
    } catch { actionError = error.localizedDescription }
  }
}

private struct AuditUpdateInput: Encodable, Sendable {
  let id: String
  let status: String
}

struct UpdatesScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = UpdatesModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { index in
      List {
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        updatesSection(index.updates)
        auditSection(index.audits)
      }
      .listStyle(.insetGrouped)
    })
    .navigationTitle("Investors")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .actionErrorAlert("Could not update investor information", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  @ViewBuilder
  private func updatesSection(_ updates: [InvestorUpdate]) -> some View {
    Section("Updates") {
      if updates.isEmpty {
        Text("No updates")
          .foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(updates) { update in
          NavigationLink(value: Route.investorUpdate(id: update.id)) {
            UpdateRow(update: update)
          }
          .accessibilityIdentifier("investorUpdate-\(update.id)")
        }
      }
    }
  }

  @ViewBuilder
  private func auditSection(_ audits: [AuditRequest]) -> some View {
    Section("Audit requests") {
      if audits.isEmpty {
        Text("No audit requests")
          .foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(audits) { audit in
          AuditRow(audit: audit) { status in
            let selectedAudit = audit
            Task { await model.closeAudit(selectedAudit, status: status, app: app) }
          }
        }
      }
    }
  }
}

private struct UpdateRow: View {
  let update: InvestorUpdate

  private var dateLine: String {
    if update.status == .partlySent {
      let summary = investorDeliveryProblemSummary(update.deliveries)
      return summary.isEmpty ? update.period : summary
    }
    if update.status == .draft { return "Drafted \(day(update.createdAt))" }
    if update.status == .posted, let sentAt = update.sentAt { return "Posted \(day(sentAt))" }
    if let sentAt = update.sentAt { return "Sent \(day(sentAt))" }
    return update.period
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack {
        Text(update.subject).font(.headline).lineLimit(1)
        Spacer(minLength: 6)
        Text(update.status.displayName)
          .font(.caption.weight(.medium))
          .foregroundStyle(
            update.status == .partlySent
              ? Color.token(.destructive) : Color.token(.mutedForeground))
      }
      HStack(spacing: 5) {
        Text(update.audience.displayName)
        Text("·")
        Text(dateLine)
          .lineLimit(1)
      }
      .font(.subheadline)
      .foregroundStyle(Color.token(.mutedForeground))
    }
    .padding(.vertical, 3)
    .accessibilityElement(children: .combine)
  }
}

private func day(_ value: String) -> String { investorDay(value) }
