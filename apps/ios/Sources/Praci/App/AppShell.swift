import SwiftUI

struct AppShell: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    @Bindable var app = app
    GeometryReader { geometry in
      Group {
        if DuoLayout.isTwoPane(width: geometry.size.width) {
          twoPane(width: geometry.size.width)
        } else {
          stack
        }
      }
    }
    .safeAreaInset(edge: .bottom) {
      if let id = app.archivedMessageID { ArchivedToast(messageID: id) }
    }
    .animation(.default, value: app.archivedMessageID)
    .alert(
      app.capture.closedAlert ?? "", isPresented: Binding(
        get: { app.capture.closedAlert != nil }, set: { if !$0 { app.capture.closedAlert = nil } })
    ) {
      Button("OK", role: .cancel) {}
    }
    .sheet(isPresented: $app.showingSettings, onDismiss: app.settingsDidClose) {
      SettingsSheet(destination: app.settingsDestination)
    }
  }

  /// One column: phones, the Duo outer display and the Duo inner display held upright.
  private var stack: some View {
    @Bindable var app = app
    return NavigationStack(path: $app.path) {
      HomeScreen()
        .safeAreaInset(edge: .top, spacing: 0) { RecordingBar() }
        .navigationDestination(for: Route.self) { route in
          destination(route).safeAreaInset(edge: .top, spacing: 0) { RecordingBar() }
        }
    }
  }

  /// Home on the left, the open screen on the right. The Duo inner display held in book pose is
  /// 890 pt wide with the fold at x = 445, so each column is half the width and the divider sits
  /// on the fold.
  private func twoPane(width: CGFloat) -> some View {
    let column = DuoLayout.sidebarWidth(width: width)
    return NavigationSplitView(columnVisibility: .constant(.all)) {
      HomeScreen(selection: Binding(
        get: { app.path.first },
        set: { app.path = $0.map { [$0] } ?? [] }))
        .safeAreaInset(edge: .top, spacing: 0) { RecordingBar() }
        .navigationSplitViewColumnWidth(column)
    } detail: {
      NavigationStack(path: Binding(
        get: { Array(app.path.dropFirst()) },
        set: { app.path = Array(app.path.prefix(1)) + $0 })
      ) {
        Group {
          if let first = app.path.first {
            destination(first)
          } else {
            ContentUnavailableView("Select an agent", systemImage: "bubble.left")
          }
        }
        .id(app.path.first)
        .safeAreaInset(edge: .top, spacing: 0) { RecordingBar() }
        .navigationDestination(for: Route.self) { route in
          destination(route).safeAreaInset(edge: .top, spacing: 0) { RecordingBar() }
        }
      }
    }
    .navigationSplitViewStyle(.balanced)
  }

  @ViewBuilder
  private func destination(_ route: Route) -> some View {
    switch route {
    case .thread(let target): ThreadScreen(target: target)
    case .inbox: InboxScreen()
    case .inboxMessage(let id): InboxMessageScreen(messageID: id)
    case .computer(let id): ComputerScreen(botID: id)
    case .artifacts(let id): ArtifactsScreen(botID: id)
    case .artifact(let id): ArtifactScreen(artifactID: id)
    case .agentPage(let id, let pageID): AgentPageScreen(botID: id, pageID: pageID)
    case .routines(let id): RoutinesScreen(botID: id)
    case .routine(let id): RoutineScreen(routineID: id)
    case .botSettings(let id): BotSettingsScreen(botID: id)
    case .groupSettings(let id): GroupSettingsScreen(groupID: id)
    case .finance: FinanceScreen()
    case .financeAccounts: FinanceAccountsScreen()
    case .financeAccount(let id): FinanceAccountScreen(accountID: id)
    case .financeBurn: FinanceBurnScreen()
    case .financeMonth(let month): FinanceMonthScreen(month: month)
    case .financeRunway: FinanceRunwayScreen()
    case .financeCrypto: FinanceCryptoScreen()
    case .financeUpcoming: FinanceUpcomingScreen()
    case .financeSubscriptions: FinanceSubscriptionsScreen()
    case .financeSpend(let period, let category):
      FinanceSpendScreen(initialPeriod: period, initialCategory: category)
    case .financeCategory(let slug, let period, let month):
      FinanceCategoryScreen(slug: slug, period: period, month: month)
    case .financeRecurring(let key): FinanceRecurringScreen(key: key)
    case .financeVendor(let key): FinanceVendorScreen(key: key)
    case .financeTransaction(let id): FinanceTransactionScreen(id: id)
    case .financeReceipt(let id): FinanceReceiptScreen(transactionID: id)
    case .company: CompanyScreen()
    case .brex: BrexScreen()
    case .gtm: GtmScreen()
    case .calendar: CalendarScreen()
    case .contacts: ContactsScreen()
    case .contact(let id): ContactDetailScreen(contactID: id)
    case .board: BoardScreen()
    case .ticket(let id): TicketScreen(ticketID: id)
    case .legal: LegalScreen()
    case .fundraising: FundraisingScreen()
    case .capTable: CapTableScreen()
    case .investors: UpdatesScreen()
    case .investorUpdate(let id): UpdateScreen(updateID: id)
    case .dataRoom: DataRoomScreen()
    case .scanner: DataRoomScreen(source: "scan")
    case .dataRoomItem(let id): DataRoomItemLoader(itemID: id)
    case .meetings: MeetingsScreen()
    case .meeting(let id): MeetingDetailScreen(meetingID: id)
    }
  }
}

/// "Archived" with Undo, for a message archived without an Inbox list behind it.
private struct ArchivedToast: View {
  let messageID: String
  @Environment(AppModel.self) private var app

  var body: some View {
    HStack(spacing: 16) {
      Text("Archived")
      Button("Undo") {
        app.archivedMessageID = nil
        Task { try? await InboxMessageClient.live(app).unarchive(messageID) }
      }
      .fontWeight(.semibold)
      .accessibilityIdentifier("shellUndo")
    }
    .font(.subheadline)
    .padding(.horizontal, 20).padding(.vertical, 12)
    .glassEffect()
    .padding(.bottom, 8)
    .task(id: messageID) {
      try? await Task.sleep(for: .seconds(4))
      if app.archivedMessageID == messageID { app.archivedMessageID = nil }
    }
  }
}

/// The wide layout is for the iPhone Duo inner display held in book pose (890 x 626 pt). Portrait
/// inner (626 wide) and the outer display (466 wide) keep one column.
enum DuoLayout {
  static let twoPaneMinimumWidth: CGFloat = 800

  static func isTwoPane(width: CGFloat) -> Bool { width >= twoPaneMinimumWidth }

  static func sidebarWidth(width: CGFloat) -> CGFloat { (width / 2).rounded() }
}
