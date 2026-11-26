import Foundation
import Observation
import RakazoAPI

struct IntegrationsSnapshot: Sendable {
  var connections: [Connection]
  var catalog: [ConnectorEntry]
  /// Every MCP server, including disabled ones.
  var servers: [McpServer] = []
}

extension IntegrationsSnapshot {
  var isEmpty: Bool { connections.isEmpty && servers.isEmpty }

  /// Keeps the connected and MCP rows whose visible text contains every word of `query`, ignoring case and accents.
  /// A blank query keeps everything.
  func matching(_ query: String) -> IntegrationsSnapshot {
    let words = query.split(whereSeparator: \.isWhitespace).map(String.init)
    guard !words.isEmpty else { return self }
    func hit(_ fields: String?...) -> Bool {
      let text = fields.compactMap { $0 }.joined(separator: " ")
      return words.allSatisfy { text.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }
    return IntegrationsSnapshot(
      connections: connections.filter { connection in
        hit(
          connection.displayName, connection.account,
          catalog.first { $0.slug == connection.provider }?.name)
      },
      catalog: catalog,
      servers: servers.filter { hit($0.name) })
  }
}

/// Apps that are not connected yet, from the featured set or a search.
func availableApps(_ entries: [ConnectorEntry], _ connections: [Connection]) -> [ConnectorEntry] {
  entries.filter { entry in !entry.connected && !connections.contains { $0.provider == entry.slug } }
}

/// The apps offered to add. Opening the screen loads only the short featured set; typed text is
/// sent to the server after a pause, and a slower earlier request never replaces a newer one.
@MainActor
@Observable
final class AppCatalog {
  var featured: [ConnectorEntry] = []
  var featuredError: String?
  /// Matches for the current text; nil while the field is empty.
  var results: [ConnectorEntry]?
  var searching = false
  var searchError: String?
  private(set) var task: Task<Void, Never>?
  @ObservationIgnored private var query = ""
  @ObservationIgnored private var generation = 0
  @ObservationIgnored private let fetchFeatured: () async throws -> [ConnectorEntry]
  @ObservationIgnored private let fetchSearch: (String) async throws -> [ConnectorEntry]
  @ObservationIgnored private let pause: () async throws -> Void

  init(
    featured: @escaping () async throws -> [ConnectorEntry],
    search: @escaping (String) async throws -> [ConnectorEntry],
    pause: @escaping () async throws -> Void = { try await Task.sleep(for: .milliseconds(300)) }
  ) {
    fetchFeatured = featured
    fetchSearch = search
    self.pause = pause
  }

  func loadFeatured() async {
    do {
      featured = try await fetchFeatured()
      featuredError = nil
    } catch {
      featuredError = settingsErrorText(error)
    }
  }

  func setQuery(_ text: String) {
    query = text.trimmingCharacters(in: .whitespacesAndNewlines)
    run()
  }

  func retry() { run() }

  private func run() {
    task?.cancel()
    generation += 1
    searchError = nil
    guard !query.isEmpty else {
      results = nil
      searching = false
      task = nil
      return
    }
    searching = true
    let (text, mine) = (query, generation)
    task = Task {
      do {
        try await pause()
        let found = try await fetchSearch(text)
        guard mine == generation else { return }
        results = found
      } catch is CancellationError {
        return
      } catch {
        guard mine == generation else { return }
        results = nil
        searchError = settingsErrorText(error)
      }
      searching = false
    }
  }
}

struct BeginConnectionInput: Encodable, Sendable {
  var connectorId: String
  var provider: String
  var displayName: String
  var replacesConnectionId: String?
  /// Tells the server to return the sign-in to this app, which has no web session.
  var client = "ios"
}
struct ConnectionIDInput: Encodable, Sendable { var connectionId: String }
struct SetWritesInput: Encodable, Sendable {
  var connectionId: String
  var enabled: Bool
}
struct CatalogInput: Encodable, Sendable { var query: String? = nil }
struct RenameConnectionInput: Encodable, Sendable {
  var connectionId: String
  var displayName: String
}
struct RenameServerInput: Encodable, Sendable {
  var id: String
  var name: String
}

struct PendingConnection: Equatable {
  var id: String
  var name: String
}

@MainActor
@Observable
final class IntegrationsModel {
  var state: Loadable<IntegrationsSnapshot> = .idle
  var pending: PendingConnection?
  var error: String?
  private(set) var apps: AppCatalog?
  /// The server whose sign-in is open.
  private(set) var signingIn: String?
  private(set) var offeredSignIn: Set<String> = []
  @ObservationIgnored private var polling: Task<Void, Never>?
  @ObservationIgnored private let browser = SSOBrowser()

  /// Signs in to an MCP server in the system browser. Cancelling leaves the row and screen unchanged.
  func signIn(_ app: AppModel, server: McpServer) async {
    guard signingIn == nil else { return }
    signingIn = server.id
    error = nil
    let flow = McpSignInFlow(
      begin: { id, reauthorize in
        try await app.call(
          "mcp/oauth/begin",
          input: McpOAuthBeginInput(serverId: id, reauthorize: reauthorize ? true : nil))
      },
      open: { [browser] url in try await browser.open(url) },
      complete: { id, code, state in
        let _: OKResult = try await app.call(
          "mcp/oauth/complete", input: McpOAuthCompleteInput(sessionId: id, code: code, state: state))
      })
    let outcome = await flow.run(serverID: server.id, reauthorize: !server.isFirstSignIn)
    signingIn = nil
    if case .failed(let message) = outcome { error = message }
    if outcome == .connected { offeredSignIn.remove(server.id) }
    await load(app)
  }

  /// Ends an open sign-in, for example when the screen goes away.
  func cancelSignIn() { browser.cancel() }

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      async let connections: [Connection] = app.call("connections/list")
      let apps = self.apps ?? AppCatalog(
        featured: { try await app.call("connections/featured", timeout: 15) },
        search: { text in
          try await app.call("connections/catalog", input: CatalogInput(query: text), timeout: 15)
        })
      self.apps = apps
      async let featured: Void = apps.loadFeatured()
      if apps.results != nil || apps.searchError != nil { apps.retry() }
      let all = await settlingPending(app, try await connections)
      await featured
      let servers = try await AccessClient.servers(app)
      // A server that just appeared is offered a sign-in on its row; a browser never opens by itself.
      if let known = state.value?.servers.map(\.id) {
        offeredSignIn.formUnion(servers.map(\.id).filter { !known.contains($0) })
      }
      state = .loaded(
        IntegrationsSnapshot(
          connections: all.filter { $0.status != "revoked" && $0.id != pending?.id },
          catalog: apps.featured, servers: servers))
    } catch {
      state = .failed(settingsErrorText(error))
    }
  }

  /// Starts the sign-in, shows it in the in-app browser, then checks until the provider finishes.
  func add(
    _ app: AppModel, connectorID: String, provider: String, name: String,
    replacing: String? = nil
  ) async {
    error = nil
    let begin: ConnectionBegin
    do {
      begin = try await app.call(
        "connections/begin",
        input: BeginConnectionInput(
          connectorId: connectorID, provider: provider, displayName: name,
          replacesConnectionId: replacing))
    } catch {
      self.error = settingsErrorText(error)
      return
    }
    pending = PendingConnection(id: begin.connectionId, name: name)
    if let url = begin.authorizationUrl.flatMap(URL.init(string:)) {
      do {
        _ = try await browser.open(url)
      } catch {
        // Closing the sheet is a cancel; anything else is shown.
        if !(error is CancellationError) { self.error = settingsErrorText(error) }
        await cancelPending(app)
        return
      }
    }
    let task = Task { await poll(app, id: begin.connectionId) }
    polling = task
    await task.value
  }

  /// Starts the sign-in again. The server does not reuse a pending row, so the old one goes first.
  func retry(_ app: AppModel, _ connection: Connection) async {
    guard await remove(app, connection) else { return }
    await add(
      app, connectorID: connection.connectorId, provider: connection.provider,
      name: connection.displayName)
  }

  /// Rows left pending by an earlier visit, or a sign-in finished while the app was away, are
  /// checked once. Whatever is still pending is shown as not finished.
  private func settlingPending(_ app: AppModel, _ rows: [Connection]) async -> [Connection] {
    var settled = rows
    for (index, row) in rows.enumerated() where row.isPending && row.id != pending?.id {
      if let done: Connection = try? await app.call(
        "connections/complete", input: ConnectionIDInput(connectionId: row.id))
      {
        settled[index] = done
      }
    }
    return settled
  }

  func cancelPending(_ app: AppModel) async {
    polling?.cancel()
    guard let current = pending else { return }
    pending = nil
    let _: OKResult? = try? await app.call(
      "connections/revoke", input: ConnectionIDInput(connectionId: current.id))
    await load(app)
  }

  func setWrites(_ app: AppModel, _ connection: Connection, enabled: Bool) async {
    error = nil
    do {
      let _: Connection = try await app.call(
        "connections/setWrites", input: SetWritesInput(connectionId: connection.id, enabled: enabled))
      await load(app)
    } catch {
      self.error = settingsErrorText(error)
    }
  }

  /// Saves a new name (1 to 60 characters for an account, 1 to 120 for a server).
  func rename(_ app: AppModel, connection: Connection, to text: String) async {
    await rename(app, text, limit: AccessLogic.accountNameLimit, current: connection.displayName) {
      let _: Connection = try await app.call(
        "connections/rename",
        input: RenameConnectionInput(connectionId: connection.id, displayName: $0))
    }
  }

  func rename(_ app: AppModel, server: McpServer, to text: String) async {
    await rename(app, text, limit: AccessLogic.serverNameLimit, current: server.name) {
      let _: McpServer = try await app.call(
        "mcp/servers/rename", input: RenameServerInput(id: server.id, name: $0))
    }
  }

  private func rename(
    _ app: AppModel, _ text: String, limit: Int, current: String,
    _ send: (String) async throws -> Void
  ) async {
    error = nil
    guard let name = AccessLogic.validName(text, limit: limit) else {
      error = "Use 1 to \(limit) characters."
      return
    }
    guard name != current else { return }
    do {
      try await send(name)
      await load(app)
    } catch {
      self.error = settingsErrorText(error)
    }
  }

  func setServerWrites(_ app: AppModel, _ server: McpServer, enabled: Bool) async {
    error = nil
    do {
      try await AccessClient.setServerWrites(app, server: server.id, enabled: enabled)
      await load(app)
    } catch {
      self.error = settingsErrorText(error)
    }
  }

  func remove(_ app: AppModel, _ connection: Connection) async -> Bool {
    error = nil
    do {
      let _: OKResult = try await app.call(
        "connections/revoke", input: ConnectionIDInput(connectionId: connection.id))
      await load(app)
      return true
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }

  /// Checks every 2 s for up to five minutes.
  private func poll(_ app: AppModel, id: String) async {
    for _ in 0..<150 {
      try? await Task.sleep(for: .seconds(2))
      if Task.isCancelled { return }
      do {
        let result: Connection = try await app.call(
          "connections/complete", input: ConnectionIDInput(connectionId: id))
        if result.isConnected {
          pending = nil
          await load(app)
          return
        }
        if result.status == "error" || result.status == "revoked" {
          error = result.error ?? "Sign-in did not finish."
          pending = nil
          await load(app)
          return
        }
      } catch {
        // A request that fails while the app was in the background must not end the wait.
        continue
      }
    }
    error = "Sign-in did not finish. Try again."
    await cancelPending(app)
  }
}

extension String {
  /// A readable name for a provider slug the catalog does not name, such as "googlecalendar".
  var providerName: String {
    let names = ["googlecalendar": "Google Calendar", "googledrive": "Google Drive", "googledocs": "Google Docs", "googlesheets": "Google Sheets"]
    return names[lowercased()] ?? capitalized
  }
}
