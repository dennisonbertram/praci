import RakazoAPI
import RakazoUI
import SwiftUI

/// One fact in full: what it says, where it was read from, and what it connects to.
struct CompanyFactSheet: View {
  let selection: CompanyFactSelection
  let page: CompanyPage?

  @Environment(\.dismiss) private var dismiss
  @Environment(AppModel.self) private var app
  @State private var actionError: String?

  var body: some View {
    NavigationStack {
      List {
        header
        relationships
        evidence
      }
      .listStyle(.insetGrouped)
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("Done") { dismiss() }
        }
      }
      .alert(
        "Couldn’t finish that",
        isPresented: Binding(
          get: { actionError != nil }, set: { if !$0 { actionError = nil } })
      ) {
        Button("OK", role: .cancel) {}
      } message: {
        Text(verbatim: actionError ?? "")
      }
    }
  }

  private var title: String {
    switch selection {
    case let .entity(row): row.displayName
    case let .edge(row): row.relationTitle
    case let .event(row): row.title
    }
  }

  @ViewBuilder
  private var header: some View {
    switch selection {
    case let .entity(row):
      Section {
        LabeledContent("Kind", value: row.kind.title)
        LabeledContent("Status", value: row.status.title)
        if let identityLine = row.identityLine {
          LabeledContent("Known by", value: identityLine)
        }
        if let subtitle = row.subtitle {
          Text(subtitle).font(.callout).foregroundStyle(.secondary)
        }
      }
    case let .edge(row):
      Section {
        LabeledContent("From", value: page?.name(of: row.fromId) ?? row.fromId)
        LabeledContent("To", value: page?.name(of: row.toId) ?? row.toId)
        LabeledContent("Relationship", value: row.relationTitle)
        if let role = row.role { LabeledContent("Role", value: role) }
        if let startsOn = row.startsOn { LabeledContent("Since", value: startsOn.display) }
        if let endsOn = row.endsOn { LabeledContent("Until", value: endsOn.display) }
      }
    case let .event(row):
      Section {
        LabeledContent("Stream", value: row.streamTitle)
        if let occursOn = row.occursOn { LabeledContent("When", value: occursOn.display) }
        if let amount = row.amountCents, let currency = row.currency {
          LabeledContent("Amount", value: financeMoney(amount, currency: currency, hidden: false))
        }
        LabeledContent("Status", value: row.status.title)
      }
    }
  }

  @ViewBuilder
  private var relationships: some View {
    if case let .entity(row) = selection, !row.edges.isEmpty {
      Section("Relationships") {
        ForEach(row.edges) { edge in
          VStack(alignment: .leading, spacing: 2) {
            Text(edge.relationTitle).font(.callout)
            Text(otherEnd(edge, from: row.id))
              .font(.caption)
              .foregroundStyle(.secondary)
            if let startsOn = edge.startsOn {
              Text(startsOn.display).font(.caption2).foregroundStyle(.tertiary)
            }
          }
        }
      }
    }
  }

  /// The name of the entity at the far end of an edge from the row being shown.
  private func otherEnd(_ edge: CompanyEdge, from id: String) -> String {
    let other = edge.fromId == id ? edge.toId : edge.fromId
    return page?.name(of: other) ?? other
  }

  @ViewBuilder
  private var evidence: some View {
    let rows = evidenceRows
    if !rows.isEmpty {
      Section("Where this came from") {
        ForEach(rows) { row in
          VStack(alignment: .leading, spacing: 4) {
            Text(row.quote).font(.callout)
            Text(row.sourceTitle).font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    }
  }

  private var evidenceRows: [CompanyEvidence] {
    switch selection {
    case let .entity(row): row.evidence
    case let .edge(row): row.evidence
    case let .event(row): row.evidence
    }
  }
}
