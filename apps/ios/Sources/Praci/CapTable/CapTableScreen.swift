import RakazoAPI
import SwiftUI

struct CapTableScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = CapTableModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { result in
      if let snapshot = result.snapshot {
        List {
          RefreshErrorSection(message: model.refreshError) { await model.load(app) }
          summary(snapshot, result)
          if !snapshot.shareClasses.isEmpty {
            Section("Share classes") {
              ForEach(snapshot.shareClasses) { shareClass in
                LabeledContent(shareClass.name) {
                  Text([shareClass.shares.map { $0.formatted() }, shareClass.percent.map { capPercent($0) }]
                    .compactMap { $0 }.joined(separator: " · "))
                }
              }
            }
          }
          CappedSection(
            title: "Holders", items: snapshot.holders, spec: holdersSpec(snapshot.holders)
          ) { holder in
            NavigationLink {
              HolderDetailView(holder: holder, hide: app.hideAmounts)
            } label: {
              HolderRow(holder: holder, hide: app.hideAmounts)
            }
          }
        }
        .refreshable { await model.load(app) }
      } else {
        ContentUnavailableView {
          Label("See who owns your company", systemImage: "chart.pie")
        } actions: {
          PrimaryActionButton("Connect Carta") { app.openSettings(.integrations) }
            .accessibilityIdentifier("connectCarta")
        }
      }
    })
    .navigationTitle("Cap table")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        if let id = model.agentID {
          AskAgentButton(
            title: "Ask Carta agent", botID: id, accessibilityIdentifier: "askCartaAgent")
        }
      }
    }
    .task(id: "\(app.spaceID ?? "none"):\(app.settingsClosings)") { await model.load(app) }
  }

  @ViewBuilder
  private func summary(_ snap: CapSnapshot, _ result: CapTableResult) -> some View {
    Section {
      if let diluted = snap.fullyDilutedShares { LabeledContent("Fully diluted") { Text(diluted.formatted()) } }
      if let pool = snap.optionPoolAvailable { LabeledContent("Option pool available") { Text(pool.formatted()) } }
      if let valuation = snap.latest409a {
        LabeledContent("409A") {
          Text(app.hideAmounts ? "•••" : capUSD(valuation.pricePerShareUsd, fractionDigits: 2))
        }
      }
      LabeledContent("As of") { Text(LegalDay.display(snap.asOf)) }
      if result.syncing { HStack { ProgressView(); Text("Syncing with Carta").padding(.leading, 8) } }
    } header: {
      Text(snap.companyName)
    } footer: {
      if result.lastReadFailed { Text("Couldn’t refresh from Carta. Showing the last sync.") }
    }
  }
}

private struct HolderRow: View {
  let holder: CapHolder
  let hide: Bool

  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text(holder.name)
        Text([holder.security, holder.shares.map { "\($0.formatted()) shares" }]
          .compactMap { $0 }.joined(separator: " · "))
          .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
        if let amount = holder.amountUsd {
          Text("Invested \(hide ? "•••" : capUSD(amount))")
            .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
        }
      }
      Spacer()
      if let percent = holder.percent { Text(capPercent(percent)).monospacedDigit() }
    }
    .accessibilityElement(children: .combine)
  }
}

private struct HolderDetailView: View {
  let holder: CapHolder
  let hide: Bool

  var body: some View {
    List {
      Section {
        if let security = holder.security { LabeledContent("Security") { Text(security) } }
        if let shares = holder.shares { LabeledContent("Shares") { Text(shares.formatted()) } }
        if let percent = holder.percent { LabeledContent("Ownership") { Text(capPercent(percent)) } }
        if let amount = holder.amountUsd { LabeledContent("Invested") { Text(hide ? "•••" : capUSD(amount)) } }
      }
      if holder.email != nil || holder.organization != nil {
        Section("Contact") {
          if let org = holder.organization { LabeledContent("Organization") { Text(org) } }
          if let email = holder.email { LabeledContent("Email") { Text(email) } }
        }
      }
    }
    .navigationTitle(holder.name)
    .navigationBarTitleDisplayMode(.inline)
  }
}
