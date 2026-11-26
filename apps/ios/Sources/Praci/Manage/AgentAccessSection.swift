import Observation
import RakazoAPI
import SwiftUI

/// The accounts and servers one agent can reach, each with the switch its own page has.
@MainActor
@Observable
final class AgentAccessModel {
  enum Phase: Equatable {
    case loading
    case loaded
    case failed(String)
  }

  let agent: AccessAgent
  private(set) var phase = Phase.loading
  private(set) var rows: [AccessLogic.Row] = []
  private(set) var servers: [McpServer] = []
  private(set) var saving = false
  var error: String?
  var query = ""

  init(agent: AccessAgent) { self.agent = agent }

  /// For previews and tests: a loaded model without a server.
  init(agent: AccessAgent, rows: [AccessLogic.Row]) {
    self.agent = agent
    self.rows = rows
    phase = .loaded
  }

  var showsSearch: Bool { rows.count > AccessLogic.controlsMinimum }
  var shown: [AccessLogic.Row] {
    let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
    guard showsSearch, !needle.isEmpty else { return rows }
    return rows.filter { "\($0.name) \($0.address ?? "")".lowercased().contains(needle) }
  }

  func load(_ app: AppModel) async {
    phase = .loading
    do {
      try await fetch(app)
      phase = .loaded
    } catch {
      phase = .failed(settingsErrorText(error))
    }
  }

  private func fetch(_ app: AppModel) async throws {
    let connections: [Connection] = try await app.call("connections/list")
    let servers = try await AccessClient.servers(app)
    self.servers = servers
    let effective = try await AccessClient.effective(app)
    let accesses = try await AccessClient.accessAll(app)
    let assigned = try await AccessClient.assigned(app, botID: agent.id)
    rows = AccessLogic.rows(
      for: agent, connections: connections, servers: servers, effective: effective,
      accesses: accesses, assigned: assigned)
  }

  /// "Allow changes" for this agent on one account.
  func toggleWrite(_ app: AppModel, _ row: AccessLogic.Row, on next: Bool) async {
    guard !saving, row.kind == .connection, let write = row.write, !write.fixed, write.enabled,
      let index = rows.firstIndex(where: { $0.id == row.id })
    else { return }
    saving = true
    error = nil
    let before = rows[index].write?.on
    rows[index].write?.on = next
    var saved = true
    do {
      try await AccessClient.setAgentAccess(
        app, connection: row.refID, botID: agent.id, on: true, canWrite: next)
    } catch {
      saved = false
      rows[index].write?.on = before ?? false
      self.error = settingsErrorText(error)
    }
    await refresh(app, saved: saved)
    saving = false
  }

  func toggle(_ app: AppModel, _ row: AccessLogic.Row, on next: Bool) async {
    guard !saving, !row.locked, let index = rows.firstIndex(where: { $0.id == row.id }) else {
      return
    }
    saving = true
    error = nil
    let before = rows[index].on
    rows[index].on = next
    var saved = true
    do {
      switch row.kind {
      case .connection:
        try await AccessClient.setAgentAccess(
          app, connection: row.refID, botID: agent.id, on: next)
      case .server:
        try await AccessClient.assign(app, botID: agent.id, serverID: row.refID, on: next)
      }
    } catch {
      saved = false
      rows[index].on = before
      self.error = settingsErrorText(error)
    }
    await refresh(app, saved: saved)
    saving = false
  }

  /// The switches follow the server. If that read fails after a save that landed, say so.
  private func refresh(_ app: AppModel, saved: Bool) async {
    do {
      try await fetch(app)
    } catch where saved {
      self.error = String(localized: "Saved, but the list could not be refreshed")
    } catch {}
  }
}

/// The "Access" section of the agent settings screen.
struct AgentAccessSection: View {
  @Environment(AppModel.self) private var app
  @Bindable var model: AgentAccessModel

  var body: some View {
    switch model.phase {
    case .loading:
      Section("Access") { ProgressView().frame(maxWidth: .infinity) }
    case .failed(let message):
      Section("Access") {
        Text(message).foregroundStyle(Color.token(.destructive))
        Button("Try again") { Task { await model.load(app) } }
      }
    case .loaded:
      if !model.rows.isEmpty { list }
    }
  }

  private var list: some View {
    Section {
      if model.showsSearch {
        TextField("Search accounts", text: $model.query)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .accessibilityIdentifier("accessSearch")
      }
      ForEach(model.shown) { row in
        Toggle(
          isOn: Binding(
            get: { row.on },
            set: { value in Task { await model.toggle(app, row, on: value) } })
        ) {
          VStack(alignment: .leading) {
            Text(row.name)
            if let address = row.address {
              Text(address).font(.caption).foregroundStyle(Color.token(.mutedForeground))
            }
            if row.limited {
              Text("Saved, but another account of this app limits access")
                .font(.caption).foregroundStyle(Color.token(.mutedForeground))
            }
          }
        }
        .disabled(model.saving || row.locked)
        .accessibilityIdentifier("agentAccess-\(row.id)")
        // The agent's own server: its page is where sharing it with other agents is switched on.
        if row.kind == .server, row.locked, row.on, let server = model.servers.first(where: { $0.id == row.refID }) {
          NavigationLink("Sharing") { McpServerAccessScreen(server: server) }
            .accessibilityIdentifier("agentShare-\(row.refID)")
        }
        if let write = row.write, row.on {
          Toggle(
            isOn: Binding(
              get: { write.on },
              set: { value in Task { await model.toggleWrite(app, row, on: value) } })
          ) {
            VStack(alignment: .leading) {
              Text("Allow changes")
              Text("The agent asks you before each change.")
                .font(.caption).foregroundStyle(Color.token(.mutedForeground))
            }
          }
          .disabled(model.saving || write.fixed || !write.enabled)
          .padding(.leading, 20)
          .accessibilityIdentifier("agentWrite-\(row.id)")
        }
      }
      if model.shown.isEmpty {
        Text("No matching accounts").foregroundStyle(Color.token(.mutedForeground))
      }
    } header: {
      Text("Access")
    } footer: {
      if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
    }
  }
}
