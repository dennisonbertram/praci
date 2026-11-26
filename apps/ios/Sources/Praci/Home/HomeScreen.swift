import RakazoAPI
import SwiftUI

private enum HomeSheet: Identifiable {
  case newAgent, newGroup, newSpace, spaceSettings, connectModel
  var id: Self { self }
}

struct HomeScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = HomeModel()
  @State private var sheet: HomeSheet?
  /// Set only in the two-pane layout, where tapping a row opens it in the right-hand pane. A List
  /// with a selection binding does not push NavigationLink rows, so the one-column layout has none.
  var selection: Binding<Route?>?

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { boot in
      content(boot)
    })
    .navigationTitle(spaceName)
    .navigationBarTitleDisplayMode(.inline)
    .toolbarTitleMenu { spaceMenu }
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        Button { app.showingSettings = true } label: {
          Label("Settings", systemImage: "gearshape")
        }
        .accessibilityIdentifier("settings")
      }
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { sheet = .newAgent } label: { Label("New agent", systemImage: "person") }
            .accessibilityIdentifier("newAgent")
          Button { sheet = .newGroup } label: { Label("New group", systemImage: "person.2") }
            .accessibilityIdentifier("newGroup")
          Button { sheet = .newSpace } label: { Label("New space", systemImage: "square.stack") }
            .accessibilityIdentifier("newSpace")
        } label: {
          Label("New", systemImage: "plus")
        }
        .accessibilityIdentifier("new")
      }
    }
    .task(id: app.spaceID) { await model.load(app) }
    .onReceive(NotificationCenter.default.publisher(for: .agentsChanged)) { _ in
      Task { await model.load(app) }
    }
    // Pushed screens change agents (rename, settings, archive); reload quietly when Home returns.
    .onAppear { if model.state.value != nil { Task { await model.load(app) } } }
    .sheet(item: $sheet, onDismiss: { Task { await model.load(app) } }) { sheet in
      switch sheet {
      case .newAgent:
        NewBotSheet(onCreated: created)
      case .newGroup:
        NewGroupSheet(onCreated: created)
      case .newSpace:
        NewSpaceSheet()
      case .spaceSettings:
        if let space = currentSpace {
          SpaceSettingsSheet(space: space, onChange: { Task { await model.load(app) } })
        }
      case .connectModel:
        NavigationStack { ModelsScreen() }
      }
    }
  }

  private var currentSpace: SpaceSummary? {
    guard let boot = model.state.value else { return nil }
    return boot.spaces.first { $0.id == boot.me.spaceId }
  }

  private var spaceName: String { currentSpace?.name ?? "" }

  private func created(_ target: ThreadTarget) {
    sheet = nil
    app.open(.thread(target))
    Task { await model.load(app) }
  }

  @ViewBuilder
  private var spaceMenu: some View {
    if let boot = model.state.value {
      Picker(
        "Spaces",
        selection: Binding(
          get: { boot.me.spaceId },
          set: { app.spaceID = $0 })
      ) {
        ForEach(boot.spaces) { space in Text(space.name).tag(space.id) }
      }
      .pickerStyle(.inline)
      Button { sheet = .newSpace } label: { Label("New space", systemImage: "plus") }
      Button { sheet = .spaceSettings } label: {
        Label("Space settings", systemImage: "gearshape")
      }
    }
  }

  // A SwiftUI view builder lists its rows in one place.
  // swiftlint:disable:next function_body_length
  private func content(_ boot: Bootstrap) -> some View {
    let roster = Roster(bots: boot.bots, groups: boot.groups, sections: boot.botSections)
    let visible = roster.visibleAgents(expanded: model.agentsExpanded)
    return Group {
      if let selection {
        List(selection: selection) { rows(boot, roster: roster, visible: visible) }
      } else {
        List { rows(boot, roster: roster, visible: visible) }
      }
    }
    .refreshable { await model.load(app) }
    .accessibilityIdentifier("homeList")
  }

  @ViewBuilder
  // swiftlint:disable:next function_body_length
  private func rows(_ boot: Bootstrap, roster: Roster, visible: (rows: [RosterRow], hiddenCount: Int)) -> some View {
    if let message = model.refreshError {
      Section {
        Label(message, systemImage: "exclamationmark.triangle")
          .foregroundStyle(Color.token(.mutedForeground))
        Button("Try again") { Task { await model.load(app) } }
      }
    }
    if boot.me.needsModel {
      Section {
        Text("\(boot.bots.first?.name ?? String(localized: "Your agent")) cannot reply until a model is connected.")
        Button("Connect a model") { sheet = .connectModel }
          .buttonStyle(.borderedProminent)
          .accessibilityIdentifier("connectModel")
      }
    }
    Section {
      NavigationLink(value: Route.inbox) {
        HStack {
          Label("Inbox", systemImage: "tray")
          Spacer()
          if let count = model.unread, count > 0 {
            Text(count, format: .number).foregroundStyle(Color.token(.mutedForeground))
          }
        }
      }
      .accessibilityIdentifier("inboxRow")
    }
    if !roster.pinned.isEmpty {
      Section("Pinned") { ForEach(roster.pinned) { row in agentRow(row) } }
    }
    Section("Agents") {
      if roster.isEmpty {
        ContentUnavailableView {
          Label("No agents yet", systemImage: "person")
        } actions: {
          Button("New agent") { sheet = .newAgent }
        }
      }
      ForEach(visible.rows) { row in agentRow(row) }
      if roster.agents.count > 4 {
        Button {
          withAnimation { model.agentsExpanded.toggle() }
        } label: {
          Label(
            model.agentsExpanded ? "Show less" : "Show \(visible.hiddenCount) more",
            systemImage: model.agentsExpanded ? "chevron.up" : "chevron.down")
        }
        .foregroundStyle(Color.token(.mutedForeground))
        .accessibilityIdentifier("showMore")
      }
    }
    ForEach(roster.sections, id: \.section.id) { group in
      sectionView(group)
    }
    pages(boot)
  }

  private func sectionView(_ group: Roster.Group) -> some View {
    let collapsed = model.collapsedSections.contains(group.section.id)
    return Section {
      if !collapsed { ForEach(group.rows) { row in agentRow(row) } }
    } header: {
      Button { withAnimation { model.toggle(section: group.section.id) } } label: {
        Label(
          group.section.name.uppercased(),
          systemImage: collapsed ? "chevron.right" : "chevron.down")
      }
      .accessibilityLabel(group.section.name)
      .accessibilityValue(collapsed ? "Collapsed" : "Expanded")
    }
  }

  private func agentRow(_ row: RosterRow) -> some View {
    let target: ThreadTarget = row.kind == .bot ? .bot(row.id) : .group(row.id)
    return NavigationLink(value: Route.thread(target)) {
      AgentRowView(row: row)
    }
    .contextMenu {
      AgentRowMenu(target: target, onChange: { Task { await model.load(app) } })
    }
    .accessibilityIdentifier("agentRow-\(row.id)")
  }

  @ViewBuilder
  private func pages(_ boot: Bootstrap) -> some View {
    let hidden = Set(boot.me.hiddenPages)
    Section("Pages") {
      if !hidden.contains("finance") {
        NavigationLink(value: Route.finance) {
          PageRowView(title: "Finance", systemImage: "chart.line.uptrend.xyaxis")
        }
        .accessibilityIdentifier("pageFinance")
      }
      if !hidden.contains("legal") {
        NavigationLink(value: Route.legal) {
          PageRowView(title: "Legal", systemImage: "doc.text", count: model.glance?.legalDueSoon)
        }
        .accessibilityIdentifier("pageLegal")
      }
      if !hidden.contains("investors") {
        NavigationLink(value: Route.capTable) {
          PageRowView(title: "Cap table", systemImage: "chart.pie")
        }
        .accessibilityIdentifier("pageCapTable")
        NavigationLink(value: Route.investors) {
          PageRowView(title: "Investors", systemImage: "person.3")
        }
        .accessibilityIdentifier("pageInvestors")
      }
      if !hidden.contains("fundraising") {
        NavigationLink(value: Route.fundraising) {
          PageRowView(title: "Fundraising", systemImage: "chart.bar.xaxis")
        }
        .accessibilityIdentifier("pageFundraising")
      }
      if !hidden.contains("gtm") {
        NavigationLink(value: Route.gtm) {
          PageRowView(title: "GTM", systemImage: "megaphone", count: model.glance?.gtmNeedsYou)
        }
        .accessibilityIdentifier("pageGtm")
      }
      if !hidden.contains("brex"), model.glance?.brexConnected == true {
        NavigationLink(value: Route.brex) {
          PageRowView(title: "Brex", systemImage: "creditcard")
        }
        .accessibilityIdentifier("pageBrex")
      }
      if !hidden.contains("data-room") {
        NavigationLink(value: Route.dataRoom) {
          PageRowView(title: "Data room", systemImage: "folder", count: model.glance?.dataRoomWaiting)
        }
        .accessibilityIdentifier("pageDataRoom")
      }
      if !hidden.contains("scanner") {
        NavigationLink(value: Route.scanner) { PageRowView(title: "Scanner", systemImage: "scanner") }
          .accessibilityIdentifier("pageScanner")
      }
      if !hidden.contains("calendar") {
        NavigationLink(value: Route.calendar) {
          PageRowView(title: "Calendar", systemImage: "calendar")
        }
        .accessibilityIdentifier("pageCalendar")
      }
      if !hidden.contains("contacts") {
        NavigationLink(value: Route.contacts) {
          PageRowView(title: "Contacts", systemImage: "person.2")
        }
        .accessibilityIdentifier("pageContacts")
      }
      if boot.me.ticketBoardEnabled == true && model.glance?.hasTickets == true {
        NavigationLink(value: Route.board) {
          PageRowView(title: "Task board", systemImage: "checklist")
        }
        .accessibilityIdentifier("pageBoard")
      }
      if !hidden.contains("meetings") {
        NavigationLink(value: Route.meetings) {
          PageRowView(title: "Meetings", systemImage: "waveform")
        }
        .accessibilityIdentifier("pageMeetings")
      }
      if !hidden.contains("company") {
        NavigationLink(value: Route.company) {
          PageRowView(title: "Company", systemImage: "building.2")
        }
        .accessibilityIdentifier("pageCompany")
      }
      if let first = boot.bots.first {
        NavigationLink(value: Route.computer(botID: first.id)) {
          PageRowView(title: "Team computer", systemImage: "desktopcomputer")
        }
        .accessibilityIdentifier("pageComputer")
      }
    }
  }
}
