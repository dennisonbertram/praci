import Foundation
import RakazoAPI
import SwiftUI

struct BrexScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = BrexModel()

  var body: some View {
    Group {
      if model.unavailable {
        ContentUnavailableView {
          Label("Brex isn't connected.", systemImage: "creditcard")
        } description: {
          Text("Connect to see cards, spending and limits.")
        } actions: {
          Button("Try again") { Task { await model.load(app) } }
        }
      } else {
        LoadableView(state: model.state, retry: { Task { await model.load(app) } }) { data in
          content(data)
        }
      }
    }
    .navigationTitle("Brex")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .actionErrorAlert("Could not send to Brex", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private func content(_ data: BrexPageData) -> some View {
    List {
      RefreshErrorSection(message: model.refreshError) { await model.load(app) }
      overview(data.overview)
      BrexCardsScreen(data: data.cards, model: model)
      BrexLimitsScreen(data: data.limits, hidden: app.hideAmounts)
      activity(data.activity)
    }
    .listStyle(.insetGrouped)
    .accessibilityIdentifier("brexList")
  }

  @ViewBuilder
  private func overview(_ overview: BrexCardsOverview) -> some View {
    Section {
      if overview.partial { Text("Partial results").foregroundStyle(Color.token(.mutedForeground)) }
      LabeledContent("Cash", value: financeMoney(overview.cash.totalCents, hidden: app.hideAmounts))
      LabeledContent(
        "Available", value: financeMoney(overview.cash.availableCents, hidden: app.hideAmounts))
      LabeledContent(
        "Card spend",
        value: financeMoney(overview.cardSpend.monthToDateCents, hidden: app.hideAmounts))
      LabeledContent("Change", value: brexChangeLabel(overview.cardSpend.changePercent))
      LabeledContent("Active cards", value: overview.cards.active.formatted())
      LabeledContent("Locked cards", value: overview.cards.locked.formatted())
      LabeledContent("Terminated cards", value: overview.cards.terminated.formatted())
    } header: {
      Text("Overview")
    }

    Section("Near limit") {
      if overview.nearLimit.items.isEmpty {
        Text("Nothing near a limit.").foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(overview.nearLimit.items.prefix(5)) { item in
          VStack(alignment: .leading, spacing: 3) {
            HStack {
              Text(item.name).font(.headline)
              Spacer()
              Text("\(item.percent, specifier: "%.0f")%")
                .foregroundStyle(Color.token(.mutedForeground))
            }
            Text(
              "\(financeMoney(item.usedCents, hidden: app.hideAmounts)) of \(financeMoney(item.limitCents, hidden: app.hideAmounts))"
            )
            .font(.subheadline)
            .foregroundStyle(Color.token(.mutedForeground))
          }
          .padding(.vertical, 2)
        }
      }
    }
  }

  @ViewBuilder
  private func activity(_ data: BrexActivity) -> some View {
    Section("Activity") {
      if data.activities.isEmpty {
        Text("No changes yet.").foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(data.activities.prefix(5)) { row in
          VStack(alignment: .leading, spacing: 3) {
            HStack {
              Text(brexActivityActionLabel(row.action)).font(.headline)
              Spacer(minLength: 8)
              Text(brexActivityResultLabel(row.status))
                .foregroundStyle(Color.token(.mutedForeground))
            }
            if let target = row.target {
              Text(target).foregroundStyle(Color.token(.mutedForeground))
            }
            if let date = brexDate(row.at) {
              Text(date, format: .dateTime.month(.abbreviated).day().hour().minute())
                .font(.caption)
                .foregroundStyle(Color.token(.mutedForeground))
            }
          }
          .padding(.vertical, 2)
        }
      }
    }
  }
}

private func brexDate(_ value: String) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}
