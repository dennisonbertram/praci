import Foundation
import Observation
import RakazoAPI
import RakazoCore
import WebKit

/// Runs scripts in the screen page. The web view registers itself when it is created.
@MainActor
final class ComputerWebHandle {
  weak var webView: WKWebView?
  func run(_ script: String) { webView?.evaluateJavaScript(script, completionHandler: nil) }
}

@MainActor
@Observable
final class ComputerModel {
  let botID: String
  private(set) var status: ComputerStatus?
  /// Set when the first status read fails.
  private(set) var loadError: String?
  /// The last boot, takeover or release failure, shown until the next action.
  private(set) var actionError: String?
  /// Set when the screen page could not be loaded.
  private(set) var screenError: String?
  private(set) var booting = false
  /// Takeover was refused because the bot is running (HTTP 409); Stop and take control clears it.
  private(set) var botBlocksTakeover = false
  /// The page the web view keeps loaded; a same-stream token refresh does not replace it.
  private(set) var loadedURL: URL?
  /// Changes whenever the keyboard bridge must start over (control or page changed).
  private(set) var keyboardSession = 0
  @ObservationIgnored let webHandle = ComputerWebHandle()

  @ObservationIgnored private var session: ComputerSession?
  @ObservationIgnored private var screen: String?
  @ObservationIgnored private var heldURL: String?
  @ObservationIgnored private var surfaceKey = ""
  @ObservationIgnored private var bridge = ComputerKeyboardBridge()
  @ObservationIgnored private var autoBooted = false
  @ObservationIgnored private var apiBase = ServerEndpoint.defaultURL
  @ObservationIgnored private var clock: any ComputerClock = SystemComputerClock()

  init(botID: String) { self.botID = botID }

  var hasControl: Bool { status?.userHasControl(of: botID) ?? false }
  var isLoaded: Bool { status != nil }
  var takeoverRequested: Bool { status?.takeoverRequested ?? false }

  /// Reads status and screen, boots a stopped computer once, and starts polling.
  func start(_ app: AppModel) async {
    if session?.isActive == true { return }
    apiBase = app.authentication.endpoint
    let bot = botID
    let session = ComputerSession(
      hooks: .init(
        readStatus: { try await app.call("computer/status", input: ComputerBotInput(botId: bot)) },
        readScreen: { attempts in
          try await ComputerScreenURL.read(attempts: attempts) {
            let screen: ComputerScreenResponse = try await app.call(
              "computer/screenUrl", input: ComputerBotInput(botId: bot))
            return screen.url
          }
        },
        heartbeat: {
          let _: ComputerAck = try await app.call(
            "computer/heartbeat", input: ComputerBotInput(botId: bot))
        },
        onStatus: { [weak self] in self?.apply(status: $0) },
        onScreen: { [weak self] in self?.apply(screen: $0) }),
      clock: clock)
    self.session = session
    do {
      try await session.start()
      loadError = nil
    } catch {
      if status == nil { loadError = error.localizedDescription }
      return
    }
    if !autoBooted, let state = status?.state, state == .stopped || state == .error {
      autoBooted = true
      await openComputer(takeControl: false, app: app)
    }
  }

  /// Stops polling and heartbeats. Called when the page disappears or the app backgrounds.
  func stop() {
    session?.stop()
  }

  func retry(_ app: AppModel) async {
    loadError = nil
    screenError = nil
    session?.stop()
    await start(app)
  }

  /// Boots the computer when it is not running, and takes control when asked.
  func openComputer(takeControl: Bool, app: AppModel) async {
    guard let session else { return }
    actionError = nil
    botBlocksTakeover = false
    let needsBoot = status?.state != .running || screen == nil
    let needsTakeover = takeControl && !hasControl
    let bot = botID
    booting = needsBoot
    defer { booting = false }
    do {
      _ = try await session.perform {
        if needsBoot {
          let _: ComputerStatus = try await app.call(
            "computer/boot", input: ComputerBotInput(botId: bot),
            timeout: ComputerScreenURL.lifecycleTimeout)
        }
        if needsTakeover {
          let _: ComputerTakeover = try await app.call(
            "computer/takeover", input: ComputerBotInput(botId: bot))
        }
      }
    } catch {
      actionError = error.localizedDescription
      if takeControl, Self.isBotBlockingTakeover(error) { botBlocksTakeover = true }
    }
  }

  /// Only the server's "Stop the bot first" conflict offers Stop and take control; other 409s
  /// (such as a control race) just show their message.
  nonisolated static func isBotBlockingTakeover(_ error: any Error) -> Bool {
    guard case RPCError.server(_, 409, let message) = error else { return false }
    return message == "Stop the bot first"
  }

  /// Stops the bot's run (the same call as Stop in the thread), then takes control.
  func stopBotAndTakeControl(app: AppModel) async {
    struct Input: Encodable, Sendable { var botId: String }
    do {
      let _: JSONValue = try await app.call("threads/stop", input: Input(botId: botID))
    } catch {
      actionError = error.localizedDescription
      return
    }
    await openComputer(takeControl: true, app: app)
  }

  func takeControl(app: AppModel) async { await openComputer(takeControl: true, app: app) }

  /// Gives control back. `reason` is nil for a plain release.
  func release(_ reason: ComputerReleaseReason?, app: AppModel) async {
    guard let session else { return }
    actionError = nil
    let bot = botID
    do {
      _ = try await session.perform(screenAttempts: 1) {
        let _: ComputerAck = try await app.call(
          "computer/release", input: ComputerReleaseInput(botId: bot, reason: reason))
      }
    } catch {
      actionError = error.localizedDescription
    }
  }

  /// Called when the screen closes: stops polling and gives control back, so the lease is not held.
  func close(app: AppModel) {
    stop()
    guard hasControl else { return }
    let bot = botID
    Task {
      let _: ComputerAck? = try? await app.call(
        "computer/release", input: ComputerReleaseInput(botId: bot, reason: nil))
    }
  }

  /// The page could not be loaded; read a fresh URL on the next poll.
  func screenFailed(_ message: String) {
    screenError = message
    session?.invalidateScreen()
    recompute()
  }

  func send(_ command: ComputerKeyboardCommand) {
    for ready in bridge.push(command) { webHandle.run(ComputerKeyboard.script(for: ready)) }
  }

  func screenMessage(_ data: String) {
    guard ComputerKeyboard.isReadyMessage(data, session: String(keyboardSession)) else { return }
    for command in bridge.ready() { webHandle.run(ComputerKeyboard.script(for: command)) }
  }

  // MARK: Session callbacks

  private func apply(status next: ComputerStatus) {
    status = next
    recompute()
  }

  private func apply(screen url: String?) {
    screen = url
    screenError = nil
    recompute()
  }

  private func recompute() {
    let next = ComputerScreenURL.embeddable(screen, apiBase: apiBase)
    let visible = status?.state == .running && next != nil && screenError == nil
    heldURL = ComputerScreenURL.nextLoaded(
      held: heldURL, next: next?.absoluteString, visible: visible, now: clock.nowMs())
    loadedURL = heldURL.flatMap(URL.init(string:))
    let key = "\(hasControl):\(heldURL ?? "")"
    if key != surfaceKey {
      surfaceKey = key
      keyboardSession += 1
      bridge = ComputerKeyboardBridge()
    }
  }
}
