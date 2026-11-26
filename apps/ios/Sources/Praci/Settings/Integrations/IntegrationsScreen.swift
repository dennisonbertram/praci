import RakazoAPI
import SwiftUI

struct IntegrationsScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.scenePhase) private var scenePhase
  @State private var model = IntegrationsModel()
  @State private var showAll = false
  @State private var search = ""
  @State private var addingServer = false

  private static let preview = 6

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { loaded in
      let snapshot = loaded.matching(search)
      List {
        if let pending = model.pending {
          Section {
            HStack {
              ProgressView()
              Text("Connecting \(pending.name)").foregroundStyle(Color.token(.mutedForeground))
            }
            Button("Cancel", role: .cancel) { Task { await model.cancelPending(app) } }
              .accessibilityIdentifier("cancelConnect")
          }
        }
        if let error = model.error {
          Section { Text(error).foregroundStyle(Color.token(.destructive)) }
        }
        if !snapshot.connections.isEmpty {
          CappedSection(
            title: "Connected", items: snapshot.connections,
            spec: ListSpec(
              sorts: [
                ListSort(id: "attention", title: String(localized: "Needs attention")) { left, right in
                  if left.needsReconnect != right.needsReconnect { return left.needsReconnect }
                  return left.displayName.localizedStandardCompare(right.displayName) == .orderedAscending
                },
                ListSort(id: "name", title: String(localized: "Name")) {
                  $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
                }
              ],
              filters: [
                ListFilter(
                  id: "state", title: String(localized: "Status"),
                  options: [
                    ListFilterOption(id: "reconnect", title: String(localized: "Needs reconnecting")) {
                      $0.needsReconnect
                    }
                  ])
              ],
              searchText: { $0.displayName })
          ) { connection in
            NavigationLink {
              ConnectionDetailScreen(connection: connection, model: model)
            } label: {
              VStack(alignment: .leading) {
                Text(connection.displayName)
                let status = connection.rowStatus
                // Pending with no sign-in open in this app: it was abandoned, not in progress.
                let stalled = status == .connecting
                Text(stalled ? String(localized: "Didn't finish") : status.text ?? connection.account ?? Self.appName(connection, snapshot))
                  .font(.caption)
                  .foregroundStyle(Color.token(status.isProblem || stalled ? .destructive : .mutedForeground))
              }
            }
            .swipeActions(edge: .trailing) {
              if connection.isPending {
                Button("Remove", role: .destructive) { Task { _ = await model.remove(app, connection) } }
                Button("Retry") {
                  Task { await model.retry(app, connection) }
                }
                .tint(Color.token(.primary))
              }
            }
            .accessibilityIdentifier("connection-\(connection.id)")
          }
        }
        if !snapshot.servers.isEmpty || search.isEmpty {
          Section("MCP servers") {
            ForEach(snapshot.servers) { server in
              NavigationLink {
                McpServerDetailScreen(server: server, model: model)
              } label: {
                VStack(alignment: .leading) {
                  Text(server.name)
                  if let text = server.rowStatus.text {
                    Text(text).font(.caption)
                      .foregroundStyle(Color.token(server.rowStatus.isProblem ? .destructive : .mutedForeground))
                  }
                }
              }
              .swipeActions(edge: .trailing) {
                if server.canSignIn,
                  server.rowStatus == .needsReconnect || model.offeredSignIn.contains(server.id)
                {
                  Button(server.isFirstSignIn ? "Sign in" : "Reconnect") {
                    Task { await model.signIn(app, server: server) }
                  }
                  .tint(Color.token(.primary))
                  .accessibilityIdentifier("signIn-\(server.id)")
                }
              }
              .accessibilityIdentifier("server-\(server.id)")
            }
            if search.isEmpty {
              Button("Add") { addingServer = true }.accessibilityIdentifier("addMcpServer")
            }
          }
        }
        if let apps = model.apps { available(apps, snapshot) }
        if !search.isEmpty, snapshot.isEmpty, model.apps.map(searchSettled) ?? true,
          model.apps?.results?.isEmpty ?? true
        { ContentUnavailableView.search(text: search) }
      }
    })
    .searchable(text: $search)
    .onChange(of: search) { model.apps?.setQuery(search) }
    .navigationTitle("Integrations")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
    .onChange(of: scenePhase) { if scenePhase == .active { Task { await model.load(app) } } }
    .onDisappear {
      model.cancelSignIn()
      Task { await model.cancelPending(app) }
    }
    .sheet(isPresented: $addingServer) {
      AddMcpServerSheet(app: app) { agentBotID in
        await model.load(app)
        if let agentBotID { app.open(.thread(.bot(agentBotID))) }
      }
    }
  }

  private static func appName(_ connection: Connection, _ snapshot: IntegrationsSnapshot) -> String {
    snapshot.catalog.first { $0.slug == connection.provider }?.name ?? connection.provider.providerName
  }

  private func searchSettled(_ apps: AppCatalog) -> Bool { !apps.searching && apps.searchError == nil }

  private func available(_ apps: AppCatalog, _ snapshot: IntegrationsSnapshot) -> some View {
    let searching = !search.trimmingCharacters(in: .whitespaces).isEmpty
    let entries = availableApps(searching ? apps.results ?? [] : apps.featured, snapshot.connections)
    let shown = showAll || searching ? entries : Array(entries.prefix(Self.preview))
    let failure = searching ? apps.searchError : apps.featuredError
    return Section("Available") {
      if let failure {
        Text(failure).foregroundStyle(Color.token(.destructive))
        Button("Try again") {
          if searching { apps.retry() } else { Task { await model.load(app) } }
        }
        .accessibilityIdentifier("retryAvailable")
      } else if searching, apps.searching {
        ProgressView()
      }
      ForEach(shown) { entry in
        HStack {
          VStack(alignment: .leading) {
            Text(entry.name)
            if let description = entry.description {
              Text(description).font(.caption).foregroundStyle(Color.token(.mutedForeground))
            }
          }
          Spacer()
          Button("Add") { Task { await add(entry) } }
            .buttonStyle(.bordered)
            .disabled(model.pending != nil)
            .accessibilityIdentifier("add-\(entry.slug)")
        }
      }
      if !showAll, !searching, entries.count > Self.preview {
        Button("Show more") { showAll = true }.accessibilityIdentifier("showMore")
      }
    }
  }

  private func add(_ entry: ConnectorEntry) async {
    await model.add(app, connectorID: entry.connectorId, provider: entry.slug, name: entry.name)
  }
}

/// The name row of a detail screen: tap to rename in an alert.
private struct RenameRow: View {
  let title: String
  let value: String
  let save: (String) -> Void
  @State private var asking = false
  @State private var draft = ""

  var body: some View {
    Button {
      draft = value
      asking = true
    } label: {
      LabeledContent(title, value: value)
    }
    .foregroundStyle(Color.primary)
    .accessibilityIdentifier("rename")
    .alert("Rename", isPresented: $asking) {
      TextField("Name", text: $draft)
      Button("Cancel", role: .cancel) {}
      Button("Save") { save(draft) }
    }
  }
}

private struct ConnectionDetailScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let connection: Connection
  let model: IntegrationsModel
  @State private var access: AccessModel
  @State private var confirmWrites = false
  @State private var confirmRemove = false

  init(connection: Connection, model: IntegrationsModel) {
    self.connection = connection
    self.model = model
    _access = State(
      initialValue: AccessModel(
        subject: .connection(id: connection.id, ownerBotID: connection.agentBotId)))
  }

  private var current: Connection {
    model.state.value?.connections.first { $0.id == connection.id } ?? connection
  }

  var body: some View {
    Form {
      Section {
        RenameRow(title: "Name", value: current.displayName) { text in
          Task { await model.rename(app, connection: current, to: text) }
        }
        if let address = current.account {
          LabeledContent("Address", value: address)
        }
      }
      Section {
        Toggle(
          "Allow changes",
          isOn: Binding(
            get: { current.writesEnabled },
            set: { enabled in
              if enabled { confirmWrites = true } else { Task { await model.setWrites(app, current, enabled: false) } }
            })
        )
        .accessibilityIdentifier("allowWrites")
      } footer: {
        Text(
          current.writesEnabled
            ? "Bots can ask to send or change things. You approve each one."
            : "Off: bots can read but not send or change anything.")
      }
      if current.isConnected && !current.needsReconnect {
        AccessSections(
          model: access, name: current.displayName, subtext: "Which agents can use this account.",
          writesEnabled: current.agentBotId == nil ? nil : current.writesEnabled)
      }
      if current.needsReconnect {
        Section {
          Button("Reconnect") {
            Task {
              await model.add(
                app, connectorID: current.connectorId, provider: current.provider,
                name: current.displayName, replacing: current.id)
              dismiss()
            }
          }
        }
      }
      Section {
        Button("Remove", role: .destructive) { confirmRemove = true }
          .accessibilityIdentifier("removeConnection")
      } footer: {
        if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
      }
    }
    .accessControls(access)
    .navigationTitle(current.displayName)
    .navigationBarTitleDisplayMode(.inline)
    .task { await access.load(app) }
    .alert("Allow changes to \(current.displayName)?", isPresented: $confirmWrites) {
      Button("Cancel", role: .cancel) {}
      Button("Allow") { Task { await model.setWrites(app, current, enabled: true) } }
    } message: {
      Text("Bots will be able to ask to send or change things. You still approve each one.")
    }
    .confirmationDialog("Remove \(current.displayName)?", isPresented: $confirmRemove) {
      Button("Remove", role: .destructive) {
        Task { if await model.remove(app, current) { dismiss() } }
      }
    } message: {
      Text("Bots lose access to this account. You can add it again later.")
    }
  }
}

/// A server's page opened from its agent, outside the Integrations list.
struct McpServerAccessScreen: View {
  @Environment(AppModel.self) private var app
  let server: McpServer
  @State private var model = IntegrationsModel()

  var body: some View {
    McpServerDetailScreen(server: server, model: model)
      .task { await model.load(app) }
  }
}

private struct McpServerDetailScreen: View {
  @Environment(AppModel.self) private var app
  let server: McpServer
  let model: IntegrationsModel
  @State private var access: AccessModel
  @State private var confirmWrites = false

  init(server: McpServer, model: IntegrationsModel) {
    self.server = server
    self.model = model
    _access = State(initialValue: AccessModel(subject: .server(server)))
  }

  private var current: McpServer {
    model.state.value?.servers.first { $0.id == server.id } ?? server
  }

  var body: some View {
    Form {
      Section {
        RenameRow(title: "Name", value: current.name) { text in
          Task { await model.rename(app, server: current, to: text) }
        }
      } footer: {
        if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
      }
      if current.agentBotId != nil, !current.hidesWrites {
        Section {
          Toggle(
            "Allow changes",
            isOn: Binding(
              get: { current.writesEnabled },
              set: { enabled in
                if enabled {
                  confirmWrites = true
                } else {
                  Task { await model.setServerWrites(app, current, enabled: false) }
                }
              })
          )
          .accessibilityIdentifier("allowWrites")
        } footer: {
          Text(
            current.writesEnabled
              ? "The agent asks you before each change."
              : "Off: the agent can read but not change anything.")
        }
      }
      if current.canSignIn {
        Section {
          Button(current.isFirstSignIn ? "Sign in" : "Reconnect") {
            Task { await model.signIn(app, server: current) }
          }
          .disabled(model.signingIn != nil)
          .accessibilityIdentifier("signIn")
        }
      }
      AccessSections(
        model: access, name: current.name, subtext: "Which agents can use this connection.")
    }
    .accessControls(access)
    .navigationTitle(current.name)
    .navigationBarTitleDisplayMode(.inline)
    .task { await access.load(app) }
    .alert("Allow changes to \(current.name)?", isPresented: $confirmWrites) {
      Button("Cancel", role: .cancel) {}
      Button("Allow") { Task { await model.setServerWrites(app, current, enabled: true) } }
    } message: {
      Text("The agent will be able to ask to change things. You still approve each one.")
    }
  }
}
