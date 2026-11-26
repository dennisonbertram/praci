import Foundation
import RakazoCore
import Testing

@testable import Praci

private final class ServerLinkStorage: SessionStorage, @unchecked Sendable {
  var session: StoredSession?
  private(set) var saves = 0
  private(set) var clears = 0

  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws {
    saves += 1
    self.session = session
  }
  func clear() throws {
    clears += 1
    session = nil
  }
}

private actor ServerLinkTransport: HTTPTransport {
  private var responses: [HTTPResponse]
  private var nextSendHook: (@Sendable () async -> Void)?

  init(_ responses: [HTTPResponse]) { self.responses = responses }

  func beforeNextSend(_ hook: @escaping @Sendable () async -> Void) {
    nextSendHook = hook
  }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    let response = responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
    if let hook = nextSendHook {
      nextSendHook = nil
      await hook()
    }
    return response
  }
}

private let previousServer = URL(string: "https://old.example.test")!
private let originalSession = StoredSession(endpoint: previousServer, token: "synthetic-token")

private func response(_ json: String) -> HTTPResponse {
  HTTPResponse(statusCode: 200, body: Data(json.utf8))
}

@MainActor
private func makeAuthentication(
  signedIn: Bool = false,
  responses: [HTTPResponse] = []
) async throws -> (AuthenticationModel, UserDefaults, ServerLinkStorage, ServerLinkTransport) {
  let defaults = UserDefaults(suiteName: UUID().uuidString)!
  defaults.set(previousServer.absoluteString, forKey: "serverOrigin")
  let storage = ServerLinkStorage()
  storage.session = signedIn ? originalSession : nil
  let transport = ServerLinkTransport(
    (signedIn ? [response(#"{"user":{"id":"u1"}}"#)] : []) + responses)
  let client = AuthClient(endpoint: previousServer, storage: storage, transport: transport)
  let authentication = AuthenticationModel(client: client, defaults: defaults)
  if signedIn {
    try await client.restore()
    await authentication.sync()
  }
  return (authentication, defaults, storage, transport)
}

private func connectURL(_ server: String) -> URL {
  var components = URLComponents(string: "rakazo://connect")!
  components.queryItems = [URLQueryItem(name: "server", value: server)]
  return components.url!
}

@Test
@MainActor
func signedOutServerLinkDoesNotChangeStoredEndpointUntilConfirmed() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication()
  let previous = defaults.string(forKey: "serverOrigin")

  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  let firstRevision = authentication.serverLinkRevision
  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  #expect(authentication.serverLinkRevision == firstRevision + 1)
  #expect(authentication.serverSheetPresented)
  #expect(authentication.pendingServer == URL(string: "https://new.example.test"))
  #expect(!authentication.willSignOutWhenChangingServer(to: authentication.pendingServer))
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == previous)
  #expect(storage.session == nil)
  #expect(storage.clears == 0)

  let cancelledRevision = authentication.serverLinkRevision
  authentication.cancelPendingServer()
  #expect(authentication.pendingServer == nil)
  #expect(authentication.serverLinkError == nil)
  #expect(authentication.serverLinkRevision == cancelledRevision)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == previous)
  #expect(storage.session == nil)
  #expect(storage.clears == 0)

  authentication.dismissServerSheet()
  authentication.presentServerSheet()
  #expect(authentication.serverSheetPresented)
  #expect(authentication.serverLinkRevision > 0)
  #expect(authentication.pendingServer == nil)
  #expect(authentication.serverLinkError == nil)
}

@Test
@MainActor
func scannedServerTextStagesBareURLAndConnectLinkWithoutChangingStoredState() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication()
  let savedEndpoint = defaults.string(forKey: "serverOrigin")

  #expect(authentication.stageServerLink("https://bare.example.test"))
  #expect(authentication.pendingServer == URL(string: "https://bare.example.test"))
  #expect(authentication.stageServerLink(connectURL("https://linked.example.test").absoluteString))
  #expect(authentication.pendingServer == URL(string: "https://linked.example.test"))
  #expect(authentication.serverLinkError == nil)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == savedEndpoint)
  #expect(storage.session == nil)
  #expect(storage.clears == 0)
}

@Test
@MainActor
func invalidScannedServerTextPreservesStoredSessionAndEndpoint() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication(signedIn: true)
  let savedEndpoint = defaults.string(forKey: "serverOrigin")
  let savedSession = storage.session
  let saves = storage.saves
  let clears = storage.clears

  #expect(authentication.stageServerLink("https://new.example.test/path"))

  #expect(authentication.pendingServer == nil)
  #expect(
    authentication.serverLinkError == ServerEndpoint.ValidationError.malformed.errorDescription)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == savedEndpoint)
  #expect(authentication.isSignedIn)
  #expect(storage.session == savedSession)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
}

@Test
@MainActor
func confirmingScannedSameServerPreservesSignedInSessionAndStoredEndpoint() async throws {
  let capabilities = response(
    #"{"passwordAuth":true,"passwordReset":false,"resetUrl":null,"sso":null}"#)
  let (authentication, defaults, storage, _) = try await makeAuthentication(
    signedIn: true, responses: [capabilities])
  let savedEndpoint = defaults.string(forKey: "serverOrigin")
  let savedSession = storage.session
  let saves = storage.saves
  let clears = storage.clears
  var beforeSessionEndsCalls = 0
  authentication.beforeSessionEnds = { beforeSessionEndsCalls += 1 }

  #expect(authentication.stageServerLink(previousServer.absoluteString))
  #expect(authentication.pendingServer == previousServer)
  #expect(await authentication.confirmPendingServer())

  #expect(beforeSessionEndsCalls == 0)
  #expect(authentication.isSignedIn)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == savedEndpoint)
  #expect(storage.session == savedSession)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
}

@Test
@MainActor
func staleScannedServerTextCannotReplaceNewerExternalLink() async throws {
  let (authentication, _, _, _) = try await makeAuthentication()
  let scannerRevision = authentication.serverLinkRevision

  #expect(authentication.handleExternalURL(connectURL("https://newer.example.test")))
  let latestRevision = authentication.serverLinkRevision
  #expect(
    !authentication.stageServerLink(
      "https://stale.example.test", ifCurrentRevision: scannerRevision))

  #expect(authentication.serverLinkRevision == latestRevision)
  #expect(authentication.pendingServer == URL(string: "https://newer.example.test"))
  #expect(authentication.serverLinkError == nil)
}

@Test
@MainActor
func signedInServerLinkCancellationPreservesSessionAndStorage() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication(signedIn: true)
  let saved = storage.session
  let saves = storage.saves
  let clears = storage.clears
  let previous = defaults.string(forKey: "serverOrigin")

  #expect(authentication.isSignedIn)
  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  #expect(storage.session == saved)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
  #expect(authentication.endpoint == previousServer)

  authentication.cancelPendingServer()
  #expect(authentication.pendingServer == nil)
  #expect(authentication.isSignedIn)
  #expect(storage.session == saved)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
  #expect(defaults.string(forKey: "serverOrigin") == previous)
}

@Test
@MainActor
func invalidLinkReplacesEarlierPendingLinkWithoutChangingState() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication(signedIn: true)
  let saved = storage.session
  let saves = storage.saves
  let clears = storage.clears
  let previous = defaults.string(forKey: "serverOrigin")

  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  let revision = authentication.serverLinkRevision
  #expect(authentication.handleExternalURL(connectURL("http://public.example.test")))

  #expect(authentication.serverLinkRevision == revision + 1)
  #expect(authentication.pendingServer == nil)
  #expect(
    authentication.serverLinkError == ServerEndpoint.ValidationError.publicHTTP.errorDescription)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == previous)
  #expect(authentication.isSignedIn)
  #expect(storage.session == saved)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
}

@Test
@MainActor
func confirmingPendingServerUsesTheExistingChangeServerPath() async throws {
  let health = response(#"{"json":{"ok":true,"version":"0.1.0"}}"#)
  let capabilities = response(
    #"{"passwordAuth":true,"passwordReset":false,"resetUrl":null,"sso":null}"#)
  let (authentication, defaults, storage, _) = try await makeAuthentication(
    signedIn: true, responses: [health, capabilities])
  var beforeSessionEndsCalls = 0
  authentication.beforeSessionEnds = { beforeSessionEndsCalls += 1 }
  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  #expect(authentication.willSignOutWhenChangingServer(to: authentication.pendingServer))
  #expect(storage.session == originalSession)

  #expect(await authentication.confirmPendingServer())
  #expect(beforeSessionEndsCalls == 1)
  #expect(authentication.pendingServer == nil)
  #expect(authentication.endpoint == URL(string: "https://new.example.test"))
  #expect(defaults.string(forKey: "serverOrigin") == "https://new.example.test")
  #expect(!authentication.isSignedIn)
  #expect(storage.session == nil)
  #expect(storage.clears == 1)
}

@Test
@MainActor
func confirmingSameServerLinkPreservesSignedInSessionAndStoredEndpoint() async throws {
  let capabilities = response(
    #"{"passwordAuth":true,"passwordReset":false,"resetUrl":null,"sso":null}"#)
  let (authentication, defaults, storage, _) = try await makeAuthentication(
    signedIn: true, responses: [capabilities])
  let savedEndpoint = defaults.string(forKey: "serverOrigin")
  let savedSession = storage.session
  let saves = storage.saves
  let clears = storage.clears
  var beforeSessionEndsCalls = 0
  authentication.beforeSessionEnds = { beforeSessionEndsCalls += 1 }

  #expect(authentication.handleExternalURL(connectURL(previousServer.absoluteString)))
  #expect(authentication.pendingServer == previousServer)
  #expect(!authentication.willSignOutWhenChangingServer(to: authentication.pendingServer))
  #expect(storage.session == savedSession)
  #expect(authentication.endpoint == previousServer)

  #expect(await authentication.confirmPendingServer())
  #expect(beforeSessionEndsCalls == 0)
  #expect(authentication.pendingServer == nil)
  #expect(authentication.isSignedIn)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == savedEndpoint)
  #expect(storage.session == savedSession)
  #expect(storage.saves == saves)
  #expect(storage.clears == clears)
}

@Test
@MainActor
func manualSaveCompletionIsStaleWhenANewerLinkArrives() async throws {
  let health = response(#"{"json":{"ok":true,"version":"0.1.0"}}"#)
  let capabilities = response(
    #"{"passwordAuth":true,"passwordReset":false,"resetUrl":null,"sso":null}"#)
  let (authentication, _, _, transport) = try await makeAuthentication(
    responses: [health, capabilities])
  let revision = authentication.serverLinkRevision
  await transport.beforeNextSend {
    await MainActor.run {
      _ = authentication.handleExternalURL(connectURL("https://later.example.test"))
    }
  }

  #expect(await authentication.changeServer(to: URL(string: "https://manual.example.test")!))
  #expect(!authentication.isCurrentServerLinkRevision(revision))
  #expect(authentication.serverSheetPresented)
  #expect(authentication.pendingServer == URL(string: "https://later.example.test"))
  #expect(authentication.endpoint == URL(string: "https://manual.example.test"))
}

@Test
@MainActor
func onlyConnectURLsAreIntercepted() async throws {
  let (authentication, _, _, _) = try await makeAuthentication()
  let signIn = URL(string: "rakazo://sign-in?attempt=1")!
  let open = URL(string: "rakazo://open/bot/b1")!

  #expect(!authentication.handleExternalURL(signIn))
  #expect(!authentication.handleExternalURL(open))
  #expect(Route(url: signIn) == nil)
  #expect(Route(url: open) == .thread(.bot("b1")))
  #expect(!authentication.serverSheetPresented)
  #expect(authentication.pendingServer == nil)
}

@Test
@MainActor
func userinfoServerLinkIsRejectedWithoutChangingStoredSession() async throws {
  let (authentication, defaults, storage, _) = try await makeAuthentication(signedIn: true)
  let saved = storage.session
  let previous = defaults.string(forKey: "serverOrigin")

  #expect(authentication.handleExternalURL(connectURL("https://person@new.example.test")))
  #expect(authentication.pendingServer == nil)
  #expect(
    authentication.serverLinkError == ServerEndpoint.ValidationError.malformed.errorDescription)
  #expect(authentication.endpoint == previousServer)
  #expect(defaults.string(forKey: "serverOrigin") == previous)
  #expect(authentication.isSignedIn)
  #expect(storage.session == saved)
}

@Test
@MainActor
func laterServerLinkDuringConfirmationRemainsPending() async throws {
  let health = response(#"{"json":{"ok":true,"version":"0.1.0"}}"#)
  let capabilities = response(
    #"{"passwordAuth":true,"passwordReset":false,"resetUrl":null,"sso":null}"#)
  let (authentication, _, _, transport) = try await makeAuthentication(
    signedIn: true, responses: [health, capabilities])
  #expect(authentication.handleExternalURL(connectURL("https://new.example.test")))
  let firstRevision = authentication.serverLinkRevision
  await transport.beforeNextSend {
    await MainActor.run {
      _ = authentication.handleExternalURL(connectURL("https://later.example.test"))
    }
  }

  #expect(await authentication.confirmPendingServer())
  #expect(authentication.serverLinkRevision == firstRevision + 1)
  #expect(authentication.serverSheetPresented)
  #expect(authentication.pendingServer == URL(string: "https://later.example.test"))
  #expect(authentication.endpoint == URL(string: "https://new.example.test"))
}
