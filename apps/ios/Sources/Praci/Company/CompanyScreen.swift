import RakazoAPI
import RakazoUI
import SwiftUI

/// The reconstructed map of the business: who works here, who the company deals with, and what
/// happened. It reads like the wiki the server builds from mail and files, not a settings page.
struct CompanyScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = CompanyModel()
  @State private var search = ""
  @State private var fact: CompanyFactSelection?

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { page in
      content(page)
    })
    .background(Color.token(.background))
    .navigationTitle("Company")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $search, prompt: Text("Search"))
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        if let page = model.page, !page.isEmpty {
          Button { Task { await model.load(app) } } label: {
            Label("Refresh", systemImage: "arrow.clockwise")
          }
          .accessibilityIdentifier("companyRefresh")
        }
      }
    }
    .sheet(item: $fact) { selection in
      CompanyFactSheet(selection: selection, page: model.page)
        .presentationDetents([.medium, .large])
    }
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
    .onChange(of: app.settingsClosings) { Task { await model.load(app) } }
  }

  @ViewBuilder
  private func content(_ page: CompanyPage) -> some View {
    if page.isEmpty {
      ContentUnavailableView {
        Label("No company facts yet", systemImage: "building.2")
      } description: {
        Text("Import from your mail and files to fill this page.")
      }
    } else {
      VStack(spacing: 0) {
        tabPicker(page)
        Divider()
        if isEmpty(page) {
          emptyState(page)
        } else {
        List {
          if let refreshError = model.refreshError {
            Section {
              Label(refreshError, systemImage: "exclamationmark.triangle")
                .foregroundStyle(Color.token(.destructive))
                .font(.footnote)
            }
          }
          // A failed Accept or Dismiss leaves the fact as it was, so say why rather than look stuck.
          if let actionError = model.actionError {
            Section {
              Label(actionError, systemImage: "exclamationmark.triangle")
                .foregroundStyle(Color.token(.destructive))
                .font(.footnote)
            }
          }
          Section(sectionTitle(page) ?? "") {
            switch model.tab {
            case .history: historyRows(page)
            case .review: reviewRows(page)
            default: entityRows(page)
            }
          }
        }
        .listStyle(.insetGrouped)
        }
      }
    }
  }

  /// Whether the current tab has nothing to show, which replaces the list with an explanation.
  private func isEmpty(_ page: CompanyPage) -> Bool {
    switch model.tab {
    case .review: model.entities(search: search).allSatisfy { $0.status != .suggested }
    case .history: model.events(search: search).isEmpty
    default: model.entities(search: search).isEmpty
    }
  }

  @ViewBuilder
  private func emptyState(_ page: CompanyPage) -> some View {
    Spacer()
    switch model.tab {
    case .review:
      ContentUnavailableView(
        "Nothing to review", systemImage: "checkmark.circle",
        description: Text("Suggested facts show up here before they join the map."))
    case .history:
      ContentUnavailableView(
        "Nothing has happened yet", systemImage: "clock",
        description: Text("Events your bots read from mail and files appear here."))
    case .people:
      ContentUnavailableView(
        "No people yet", systemImage: "person",
        description: Text("People your bots recognise from mail appear here."))
    case .organisations:
      ContentUnavailableView(
        "No organisations yet", systemImage: "briefcase",
        description: Text("Investors, customers and vendors appear here."))
    case .overview:
      ContentUnavailableView(
        "No matches", systemImage: "magnifyingglass",
        description: Text("Try a different search."))
    }
    Spacer()
  }

  /// The tabs sit above the list so switching never scrolls the content away. Five labels do not
  /// fit a phone at full length, so the segmented control uses the short form of each.
  private func tabPicker(_ page: CompanyPage) -> some View {
    Picker("View", selection: $model.tab) {
      ForEach(CompanyTab.allCases) { tab in
        Text(tab.shortTitle(count: page.pending.count)).tag(tab)
      }
    }
    .pickerStyle(.segmented)
    .padding(.horizontal)
    .padding(.vertical, 8)
    .accessibilityIdentifier("companyTabs")
  }

  /// The heading above the rows, or nil when the tab's own name already says it.
  private func sectionTitle(_ page: CompanyPage) -> String? {
    switch model.tab {
    case .history: "Events"
    case .review: "Waiting for review"
    default: nil
    }
  }

  @ViewBuilder
  private func entityRows(_ page: CompanyPage) -> some View {
    ForEach(model.entities(search: search)) { entity in
      Button {
        fact = .entity(entity)
      } label: {
        CompanyEntityRow(entity: entity)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("companyRow")
    }
  }

  @ViewBuilder
  private func historyRows(_ page: CompanyPage) -> some View {
    ForEach(model.events(search: search)) { event in
      Button {
        fact = .event(event)
      } label: {
        CompanyEventRow(event: event)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("companyEventRow")
    }
  }

  @ViewBuilder
  private func reviewRows(_ page: CompanyPage) -> some View {
    let rows = model.entities(search: search).filter { $0.status == .suggested }
    ForEach(rows) { entity in
      VStack(alignment: .leading, spacing: 8) {
        CompanyEntityRow(entity: entity)
        HStack(spacing: 12) {
          Button("Accept") {
            Task { await model.confirm(CompanyFactInput(kind: "entity", id: entity.id), app) }
          }
          .buttonStyle(.borderedProminent)
          .controlSize(.small)
          Button("Dismiss", role: .destructive) {
            Task { await model.reject(CompanyFactInput(kind: "entity", id: entity.id), app) }
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
        }
      }
      .padding(.vertical, 4)
      .accessibilityIdentifier("companyReviewRow")
    }
  }
}

// MARK: - Rows

private struct CompanyEntityRow: View {
  let entity: CompanyEntity

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Image(systemName: symbol)
        .foregroundStyle(.secondary)
        .frame(width: 20)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(entity.displayName)
          .font(.body)
          .foregroundStyle(Color.token(.foreground))
        if let subtitle = entity.subtitle {
          Text(subtitle)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
      if entity.status == .suggested {
        Text("Suggested")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
    .contentShape(.rect)
  }

  private var symbol: String {
    switch entity.kind {
    case .company: "building.2"
    case .person: "person"
    case .organisation: "briefcase"
    case .matter: "doc.text"
    case .project: "square.stack.3d.up"
    case .product: "shippingbox"
    }
  }
}

private struct CompanyEventRow: View {
  let event: CompanyEvent

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(event.occursOn?.display ?? "")
        .font(.caption)
        .foregroundStyle(.secondary)
        .frame(width: 84, alignment: .leading)
      VStack(alignment: .leading, spacing: 2) {
        Text(event.title)
          .font(.body)
          .foregroundStyle(Color.token(.foreground))
        Text(event.streamTitle)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      if let amount = event.amountCents, let currency = event.currency {
        Text(financeMoney(amount, currency: currency, hidden: false))
          .font(.callout.monospacedDigit())
          .foregroundStyle(.secondary)
      }
    }
    .contentShape(.rect)
  }
}

// MARK: - Fact selection

/// What the fact sheet is showing, so a tap on a row or an event opens the same surface.
enum CompanyFactSelection: Identifiable, Hashable {
  case entity(CompanyEntity)
  case edge(CompanyEdge)
  case event(CompanyEvent)

  var id: String {
    switch self {
    case let .entity(row): "entity-\(row.id)"
    case let .edge(row): "edge-\(row.id)"
    case let .event(row): "event-\(row.id)"
    }
  }
}
