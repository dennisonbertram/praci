import RakazoAPI
import SwiftUI

struct LegalScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = LegalModel()
  @State private var tab = Tab.contracts

  enum Tab: String, CaseIterable, Identifiable {
    case contracts = "Contracts"
    case deadlines = "Deadlines"
    var id: String { rawValue }
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { overview in
      List {
        Section {
          Picker("View", selection: $tab) {
            ForEach(Tab.allCases) { Text(LocalizedStringKey($0.rawValue)).tag($0) }
          }
          .pickerStyle(.segmented)
          .accessibilityIdentifier("legalTabs")
        }
        .listRowBackground(Color.clear)
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        statusSection(overview)
        switch tab {
        case .contracts: contractSections(overview)
        case .deadlines: deadlineSections(overview)
        }
      }
      .refreshable { await model.load(app) }
    })
    .navigationTitle("Legal")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        if let botId = model.overview?.agent.botId {
          AskAgentButton(
            title: "Ask Legal agent", botID: botId, accessibilityIdentifier: "askLegalAgent")
        }
      }
    }
    .safeAreaInset(edge: .bottom) { undoBanner }
    .task(id: "\(app.spaceID ?? "none"):\(app.settingsClosings)") { await model.load(app) }
    .onDisappear { model.stop() }
  }

  @ViewBuilder
  private func statusSection(_ overview: LegalOverview) -> some View {
    if model.needsModel {
      Section {
        Button { app.openSettings(.models) } label: {
          Label("Add your OpenRouter key", systemImage: "key")
        }
        .accessibilityIdentifier("legalModelBlocker")
      } footer: {
        Text("Scanning needs a model.")
      }
    } else if model.needsConsent, let consent = model.consent {
      Section {
        Text(consent.disclosure)
        ForEach(consent.recipients, id: \.name) { recipient in
          LabeledContent(recipient.name) { Text(recipient.detail).font(.footnote) }
        }
        Button("Allow") { Task { await model.grantConsent(app) } }
          .accessibilityIdentifier("legalConsentAllow")
      } header: {
        Text("Allow Legal to read documents")
      }
    } else {
      Section {
        LabeledContent("Last scan") { Text(lastScanText(overview)) }
        if model.isScanning {
          HStack { ProgressView(); Text("Scanning…").padding(.leading, 8) }
        } else {
          Button { Task { await model.scan(app) } } label: {
            Label("Scan now", systemImage: "doc.text.magnifyingglass")
          }
          .accessibilityIdentifier("scanNow")
        }
        if let run = overview.agent.lastScanRun, run.status == "failed", !model.isScanning {
          Label(run.error ?? "Last scan failed", systemImage: "exclamationmark.triangle")
            .foregroundStyle(Color.token(.destructive))
        }
      } footer: {
        if overview.counts.unreviewedDocuments > 0 {
          Text("\(overview.counts.unreviewedDocuments) Data room documents not yet checked")
        }
      }
    }
    if let message = model.message {
      Section { Text(message).foregroundStyle(Color.token(.destructive)) }
    }
  }

  private func lastScanText(_ overview: LegalOverview) -> String {
    guard let scanned = overview.agent.lastScanAt,
      let date = try? Date(scanned, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true))
    else { return String(localized: "Not scanned yet") }
    return date.formatted(.relative(presentation: .named))
  }

  @ViewBuilder
  private func contractSections(_ overview: LegalOverview) -> some View {
    if overview.contracts.isEmpty {
      Section {
        ContentUnavailableView(
          "No contracts yet", systemImage: "doc.text",
          description: Text("Scan the Data room to find contracts."))
      }
    }
    ForEach(overview.contracts.groupedByType()) { group in
      Section(group.type) {
        ForEach(group.contracts) { contract in
          NavigationLink {
            ContractDetailView(contract: contract, model: model)
          } label: {
            ContractRow(contract: contract, model: model)
          }
        }
      }
    }
  }

  @ViewBuilder
  private func deadlineSections(_ overview: LegalOverview) -> some View {
    if model.openDeadlines.isEmpty {
      Section { ContentUnavailableView("No open deadlines", systemImage: "calendar") }
    }
    if !model.dueSoon.isEmpty {
      Section {
        ForEach(model.dueSoon) { DeadlineRow(deadline: $0, model: model) }
      } header: {
        HStack {
          Text("Due soon")
          Text("\(model.dueSoon.count)")
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .background(Color.token(.warning).opacity(0.2), in: Capsule())
            .foregroundStyle(Color.token(.warning))
        }
      }
    }
    if !model.later.isEmpty {
      CappedSection(
        title: "Later", items: model.later,
        spec: deadlinesSpec(model.later, today: model.today)
      ) { DeadlineRow(deadline: $0, model: model) }
    }
    if !model.done.isEmpty {
      CappedSection(
        title: "Done", items: model.done,
        spec: deadlinesSpec(model.done, today: model.today, latestFirst: true)
      ) { deadline in
        HStack {
          VStack(alignment: .leading) {
            Text(deadline.title).strikethrough()
            Text(LegalDay.display(deadline.dueDate)).font(.footnote)
              .foregroundStyle(Color.token(.mutedForeground))
          }
          Spacer()
          Button("Reopen") { Task { await model.reopen(deadline, app) } }
            .buttonStyle(.borderless)
        }
      }
    }
  }

  @ViewBuilder
  private var undoBanner: some View {
    if let deadline = model.undoable {
      HStack {
        Text("Marked “\(deadline.title)” done").lineLimit(1)
        Spacer()
        Button("Undo") { Task { await model.undo(app) } }
          .accessibilityIdentifier("undoDeadline")
      }
      .padding()
      .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
      .padding(.horizontal)
    }
  }
}

private struct ContractRow: View {
  @Environment(AppModel.self) private var app
  let contract: LegalContract
  let model: LegalModel

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(contract.title)
      Text(contract.counterparties.joined(separator: ", "))
        .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      HStack {
        if let end = contract.expirationDate { Text("Ends \(LegalDay.display(end))") }
        if let cents = contract.valueCents {
          Text(app.hideAmounts ? "•••" : legalMoney(cents: cents, currency: contract.currency))
        }
      }
      .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityElement(children: .combine)
  }
}

private struct DeadlineRow: View {
  @Environment(AppModel.self) private var app
  let deadline: LegalDeadline
  let model: LegalModel

  var body: some View {
    NavigationLink {
      DeadlineDetailView(deadline: deadline, model: model)
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(deadline.title)
        HStack {
          Text(LegalDay.display(deadline.dueDate))
          if let days = LegalDay.days(from: model.today, to: deadline.dueDate) {
            Text(days < 0 ? "Overdue" : days == 0 ? "Today" : "In \(days) days")
              .foregroundStyle(days < 0 ? Color.token(.destructive) : Color.token(.warning))
              .opacity(days <= LegalDay.dueSoonDays ? 1 : 0)
          }
        }
        .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
        if let contract = deadline.contractTitle {
          Text(contract).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
        }
        if deadline.removalProposed {
          Label("May no longer apply", systemImage: "questionmark.circle").font(.footnote)
        }
      }
    }
    .swipeActions(edge: .trailing) {
      Button { Task { await model.close(deadline, status: "done", app) } } label: {
        Label("Done", systemImage: "checkmark")
      }
      .tint(Color.token(.success))
    }
    .accessibilityIdentifier("deadlineRow")
  }
}

private struct ContractDetailView: View {
  @Environment(AppModel.self) private var app
  let contract: LegalContract
  let model: LegalModel

  var body: some View {
    List {
      Section {
        row("Type", contract.contractType)
        row("Status", contract.status.capitalized)
        if !contract.counterparties.isEmpty { row("Parties", contract.counterparties.joined(separator: ", ")) }
        if let start = contract.effectiveDate { row("Starts", LegalDay.display(start)) }
        if let end = contract.expirationDate { row("Ends", LegalDay.display(end)) }
        if contract.autoRenews { row("Renews", "Automatically") }
        if let days = contract.renewalNoticeDays { row("Notice", "\(days) days") }
        if let law = contract.governingLaw { row("Governing law", law) }
        if let cents = contract.valueCents {
          row("Value", app.hideAmounts ? "•••" : legalMoney(cents: cents, currency: contract.currency))
        }
      }
      if let summary = contract.summary { Section("Summary") { Text(summary) } }
      let deadlines = model.openDeadlines.filter { $0.contractId == contract.id }
      if !deadlines.isEmpty {
        Section("Deadlines") {
          ForEach(deadlines) { deadline in
            NavigationLink {
              DeadlineDetailView(deadline: deadline, model: model)
            } label: {
              LabeledContent(deadline.title) { Text(LegalDay.display(deadline.dueDate)) }
            }
          }
        }
      }
    }
    .navigationTitle(contract.title)
    .navigationBarTitleDisplayMode(.inline)
  }

  private func row(_ title: LocalizedStringKey, _ value: String) -> some View {
    LabeledContent(title) { Text(value).multilineTextAlignment(.trailing) }
  }
}

private struct DeadlineDetailView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let deadline: LegalDeadline
  let model: LegalModel

  var body: some View {
    List {
      Section {
        LabeledContent("Due") { Text(LegalDay.display(deadline.dueDate)) }
        LabeledContent("Kind") { Text(deadline.kind.capitalized) }
        if let contract = deadline.contractTitle { LabeledContent("Contract") { Text(contract) } }
      }
      if let quote = deadline.sourceQuote { Section("From the contract") { Text(quote) } }
      if let notes = deadline.notes { Section("Notes") { Text(notes) } }
      Section {
        Button { close("done") } label: { Label("Mark done", systemImage: "checkmark.circle") }
          .accessibilityIdentifier("markDone")
        Button(role: .destructive) { close("dismissed") } label: {
          Label("Dismiss", systemImage: "xmark.circle")
        }
        if deadline.removalProposed {
          Button {
            Task { await model.keep(deadline, app); dismiss() }
          } label: { Label("Keep this deadline", systemImage: "pin") }
        }
      }
    }
    .navigationTitle(deadline.title)
    .navigationBarTitleDisplayMode(.inline)
  }

  private func close(_ status: String) {
    Task {
      await model.close(deadline, status: status, app)
      dismiss()
    }
  }
}
