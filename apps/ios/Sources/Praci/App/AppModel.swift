import Foundation
import Observation
import RakazoAPI
import RakazoCore

private struct HideAmountsPreference: Encodable, Sendable { let hideAmounts: Bool }

@MainActor
@Observable
final class AppModel {
  let authentication: AuthenticationModel
  var path: [Route] = []
  var showingSettings = false
  /// A message archived from a screen with no Inbox list behind it; the shell offers Undo.
  var archivedMessageID: String?
  /// The Settings screen to open first, or nil for the top level.
  private(set) var settingsDestination: SettingsDestination?
  /// Counts Settings closings. Pages that Settings can change reload with `.task(id:)` on it.
  private(set) var settingsClosings = 0
  /// Asks for AI data consent. Before any request that sends data to an AI provider (sending a
  /// thread message, running a cleanup, and so on), call
  /// `try await app.consent.ensure(procedure: "<rpc name>", app: app)`; it returns at once when
  /// consent exists, shows the consent sheet otherwise, and throws if the user declines.
  let consent = ConsentPrompter()
  var spaceID: String? {
    didSet { defaults.set(spaceID, forKey: spaceKey) }
  }

  /// The signed-in user, which scopes the unsent-message queue. Cached for offline starts and
  /// confirmed by the server once per session (`confirmUser`).
  private(set) var userID: String?
  private(set) var userConfirmed = false
  /// Shared profile preference used by every Finance, Legal, Brex and Cap table screen.
  private(set) var hideAmounts = true
  private(set) var profile: Me?
  @ObservationIgnored private var profileLoaded = false
  @ObservationIgnored private var profileSpaceID: String?
  @ObservationIgnored private var profileTaskSpaceID: String?
  @ObservationIgnored private var profileTask: Task<Me, Error>?

  /// The meeting recording in progress, if any, and its uploads.
  @ObservationIgnored private(set) lazy var capture = CaptureController(app: self)

  @ObservationIgnored private let rpc: RPCClient
  @ObservationIgnored private let transport: any HTTPTransport
  @ObservationIgnored private let defaults: UserDefaults

  private var spaceKey: String { "spaceID.\(authentication.endpoint.absoluteString)" }
  private var userKey: String { "userID.\(authentication.endpoint.absoluteString)" }

  init(
    authentication: AuthenticationModel,
    transport: any HTTPTransport = URLSessionHTTPTransport(),
    defaults: UserDefaults = .standard
  ) {
    self.authentication = authentication
    self.transport = transport
    self.defaults = defaults
    rpc = RPCClient(auth: authentication.client, transport: transport)
    spaceID = defaults.string(forKey: "spaceID.\(authentication.endpoint.absoluteString)")
    userID = defaults.string(forKey: "userID.\(authentication.endpoint.absoluteString)")
  }

  /// Asks the server who is signed in. A different user than the cached one replaces it.
  func confirmUser() async {
    struct Profile: Decodable, Sendable { var userId: String }
    guard let profile: Profile = try? await call("me") else { return }
    userID = profile.userId
    userConfirmed = true
    defaults.set(profile.userId, forKey: userKey)
  }

  func call<O: Decodable>(_ procedure: String, timeout: TimeInterval = 8) async throws -> O {
    try await call(procedure, input: [String: String](), timeout: timeout)
  }

  /// Sends the active space. If the server rejects it, clears it and retries once without it.
  /// A 401 from an older session (`.stale`) is passed on untouched and never signs out.
  func call<I: Encodable & Sendable, O: Decodable>(
    _ procedure: String, input: I, timeout: TimeInterval = 8
  ) async throws -> O {
    do {
      return try await send(procedure, input: input, spaceID: spaceID, timeout: timeout)
    } catch RPCError.spaceRejected {
      spaceID = nil
      return try await send(procedure, input: input, spaceID: nil, timeout: timeout)
    }
  }

  /// Sends one named space and leaves the active space alone if the server rejects it. Meeting
  /// captures use this: a recording belongs to the space it started in, whatever is selected later.
  func call<I: Encodable & Sendable, O: Decodable>(
    _ procedure: String, input: I, spaceID: String, timeout: TimeInterval = 8
  ) async throws -> O {
    try await send(procedure, input: input, spaceID: spaceID, timeout: timeout)
  }

  /// Downloads a URL on the signed-in server with the session's credentials.
  func data(url: URL) async throws -> Data {
    let auth = authentication.client
    let endpoint = await auth.snapshot().endpoint
    guard url.scheme == endpoint.scheme, url.host() == endpoint.host(), url.port == endpoint.port
    else { throw URLError(.badURL) }
    let sent: AuthorizedRequest
    do {
      sent = try await auth.authorized(
        path: url.path, method: "GET", body: nil, contentType: nil, spaceID: spaceID)
    } catch AuthClientError.unauthorized {
      await endSession()
      throw RPCError.unauthorized
    }
    let request = HTTPRequest(
      url: url, method: "GET", headers: sent.request.headers, timeout: sent.request.timeout)
    let response = try await transport.send(
      request, maximumResponseBytes: RPCClient.maximumResponseBytes)
    switch response.statusCode {
    case 200..<300: return response.body
    case 401:
      let error = await auth.handleUnauthorized(
        generation: sent.generation, hadSpace: sent.hadSpace)
      if error == .unauthorized { await endSession() }
      throw error
    case 404: throw RPCError.notSupported
    default: throw URLError(.badServerResponse)
    }
  }

  func openSettings(_ destination: SettingsDestination? = nil) {
    settingsDestination = destination
    showingSettings = true
  }

  func settingsDidClose() {
    settingsClosings += 1
    settingsDestination = nil
    Task { await refreshHideAmounts() }
  }

  func loadProfile() async throws -> Me {
    let requestedSpaceID = spaceID
    if profileLoaded, profileSpaceID == requestedSpaceID, let profile { return profile }
    if profileTaskSpaceID == requestedSpaceID, let profileTask {
      do {
        let loadedProfile = try await profileTask.value
        if spaceID != requestedSpaceID { return try await loadProfile() }
        return loadedProfile
      } catch {
        if spaceID != requestedSpaceID { return try await loadProfile() }
        throw error
      }
    }
    profileTask?.cancel()
    profileTask = nil
    profileTaskSpaceID = requestedSpaceID
    let task = Task { @MainActor [weak self] () async throws -> Me in
      guard let self else { throw CancellationError() }
      let profile: Me = try await self.call("me")
      guard self.spaceID == requestedSpaceID else { throw CancellationError() }
      self.profile = profile
      self.profileSpaceID = requestedSpaceID
      self.hideAmounts = profile.hideAmounts
      self.profileLoaded = true
      return profile
    }
    profileTask = task
    do {
      let loadedProfile = try await task.value
      if spaceID != requestedSpaceID {
        if profileTaskSpaceID == requestedSpaceID {
          profileTask = nil
          profileTaskSpaceID = nil
        }
        return try await loadProfile()
      }
      if profileTaskSpaceID == requestedSpaceID {
        profileTask = nil
        profileTaskSpaceID = nil
      }
      return loadedProfile
    } catch {
      if profileTaskSpaceID == requestedSpaceID {
        profileTask = nil
        profileTaskSpaceID = nil
      }
      if spaceID != requestedSpaceID { return try await loadProfile() }
      throw error
    }
  }

  func loadHideAmounts() async {
    _ = try? await loadProfile()
  }

  func refreshHideAmounts() async {
    profileLoaded = false
    await loadHideAmounts()
  }

  func updateHideAmounts(_ value: Bool) async throws {
    let requestedSpaceID = spaceID
    let previous = hideAmounts
    hideAmounts = value
    do {
      let profile: Me = try await call(
        "preferences/update", input: HideAmountsPreference(hideAmounts: value))
      guard spaceID == requestedSpaceID else { throw CancellationError() }
      self.profile = profile
      profileSpaceID = requestedSpaceID
      hideAmounts = profile.hideAmounts
      profileLoaded = true
    } catch {
      if spaceID == requestedSpaceID { hideAmounts = previous }
      throw error
    }
  }

  func open(_ url: URL) {
    if let route = Route(url: url) { open(route) }
  }

  func open(_ route: Route) {
    showingSettings = false
    path.append(route)
  }

  /// Drops per-session state after sign-out.
  func reset() {
    path = []
    showingSettings = false
    archivedMessageID = nil
    profileTask?.cancel()
    profileTask = nil
    profileTaskSpaceID = nil
    profileLoaded = false
    profileSpaceID = nil
    profile = nil
    hideAmounts = true
    spaceID = nil
    forgetUser()
  }

  func reloadSpace() {
    spaceID = defaults.string(forKey: spaceKey)
    forgetUser()
    userID = defaults.string(forKey: userKey)
  }

  /// Unsent messages stay on disk under their owner's scope, but leave memory.
  private func forgetUser() {
    defaults.removeObject(forKey: userKey)
    userID = nil
    userConfirmed = false
    SendQueue.shared.unbind()
  }

  private func send<I: Encodable & Sendable, O: Decodable>(
    _ procedure: String, input: I, spaceID: String?, timeout: TimeInterval
  ) async throws -> O {
    do {
      return try await rpc.call(procedure, input: input, spaceID: spaceID, timeout: timeout)
    } catch RPCError.unauthorized {
      await endSession()
      throw RPCError.unauthorized
    }
  }

  func endSession() async {
    reset()
    await authentication.sync()
  }
}
