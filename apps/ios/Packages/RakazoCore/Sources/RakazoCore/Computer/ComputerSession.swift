import Foundation
import RakazoAPI

/// Time source for polling, renewal and heartbeats; tests inject a manual one.
public protocol ComputerClock: Sendable {
  func nowMs() -> Int
  func sleep(_ duration: Duration) async throws
}

public struct SystemComputerClock: ComputerClock {
  public init() {}
  public func nowMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }
  public func sleep(_ duration: Duration) async throws { try await Task.sleep(for: duration) }
}

/// One polling lifecycle for an open Team Computer page. A port of `computer-refresh.ts`.
/// It polls the status about every 2 seconds, re-reads the screen URL only when the status that
/// shapes it changed or the held URL nears expiry, and pings the heartbeat while the computer
/// is running. `stop()` ends every task; call it when the page disappears or the app
/// goes to the background.
@MainActor
public final class ComputerSession {
  public struct Hooks {
    public var readStatus: @MainActor () async throws -> ComputerStatus
    public var readScreen: @MainActor (_ attempts: Int) async throws -> String?
    public var heartbeat: @MainActor () async throws -> Void
    public var onStatus: (ComputerStatus) -> Void
    public var onScreen: (String?) -> Void

    public init(
      readStatus: @escaping @MainActor () async throws -> ComputerStatus,
      readScreen: @escaping @MainActor (_ attempts: Int) async throws -> String?,
      heartbeat: @escaping @MainActor () async throws -> Void,
      onStatus: @escaping (ComputerStatus) -> Void,
      onScreen: @escaping (String?) -> Void
    ) {
      self.readStatus = readStatus
      self.readScreen = readScreen
      self.heartbeat = heartbeat
      self.onStatus = onStatus
      self.onScreen = onScreen
    }
  }

  private let hooks: Hooks
  private let clock: any ComputerClock
  private var active = false
  private var paused = false
  /// Bumped by `stop` and `perform` so a read that finished late is dropped.
  private var generation = 0
  private var pollTask: Task<Void, Never>?
  private var heartbeatTask: Task<Void, Never>?
  // A completed read is cached even when it returned nil, so the status alone decides when to
  // ask again. `invalidateScreen` clears it.
  private var screenLoaded = false
  private var screenKey: String?
  private var screenReadAt = 0

  public init(hooks: Hooks, clock: any ComputerClock = SystemComputerClock()) {
    self.hooks = hooks
    self.clock = clock
  }

  public var isActive: Bool { active }

  /// Reads once, throwing that read's error, then keeps polling.
  public func start() async throws {
    guard !active else { return }
    active = true
    do {
      _ = try await refresh(force: true)
    } catch {
      startPolling()
      throw error
    }
    startPolling()
  }

  public func stop() {
    active = false
    generation += 1
    pollTask?.cancel()
    heartbeatTask?.cancel()
    pollTask = nil
    heartbeatTask = nil
    screenLoaded = false
    screenKey = nil
  }

  /// The viewer could not use the current URL: read a fresh one on the next poll.
  public func invalidateScreen() { screenLoaded = false }

  /// Pings every 60 seconds while the computer is running (the server keeps it awake while
  /// someone watches). The first ping is immediate. Starts or stops from each status read.
  private func setHeartbeat(_ running: Bool) {
    if !running {
      heartbeatTask?.cancel()
      heartbeatTask = nil
      return
    }
    guard active, heartbeatTask == nil else { return }
    let clock = clock, ping = hooks.heartbeat
    heartbeatTask = Task { @MainActor in
      while !Task.isCancelled {
        try? await ping()
        do { try await clock.sleep(ComputerScreenURL.heartbeatInterval) } catch { return }
      }
    }
  }

  /// Runs a boot, takeover or release with polling paused, then reads status and screen again.
  public func perform<T>(
    screenAttempts: Int = ComputerScreenURL.openAttempts, _ action: () async throws -> T
  ) async throws -> T? {
    guard active else { return nil }
    generation += 1
    paused = true
    pollTask?.cancel()
    pollTask = nil
    defer {
      paused = false
      if active { startPolling() }
    }
    let result = try await action()
    guard active else { return nil }
    _ = try await refresh(force: true, attempts: screenAttempts)
    return result
  }

  @discardableResult
  public func refresh(force: Bool, attempts: Int = 1) async throws -> ComputerStatus? {
    let token = generation
    let status = try await hooks.readStatus()
    guard active, token == generation else { return nil }
    hooks.onStatus(status)
    setHeartbeat(status.state == .running)
    if screenIsStale(status, force: force) {
      do {
        let url = try await hooks.readScreen(attempts)
        guard active, token == generation else { return nil }
        screenLoaded = true
        screenKey = Self.key(status)
        screenReadAt = ComputerScreenURL.renewReadAt(url, readAt: clock.nowMs())
        hooks.onScreen(url)
      } catch is CancellationError {
        return nil
      } catch {
        // Keep the last URL after a failed read; a successful nil clears it.
      }
    }
    return status
  }

  private func screenIsStale(_ status: ComputerStatus, force: Bool) -> Bool {
    force || !screenLoaded || screenKey != Self.key(status)
      || clock.nowMs() - screenReadAt >= ComputerScreenURL.renewAfterMs
  }

  private static func key(_ status: ComputerStatus) -> String {
    [
      "\(status.state)", "\(status.mode)", status.kind, "\(status.controlHolder)", status.controlBotId ?? "",
      "\(status.screenAvailable)", "\(status.screenWidth ?? 0)", "\(status.screenHeight ?? 0)",
      status.homeRevision ?? ""
    ].joined(separator: "|")
  }

  private func startPolling() {
    pollTask?.cancel()
    guard active, !paused else { return }
    let clock = clock
    pollTask = Task { [weak self] in
      while !Task.isCancelled {
        do { try await clock.sleep(ComputerScreenURL.pollInterval) } catch { return }
        guard let self, !Task.isCancelled else { return }
        _ = try? await self.refresh(force: false)
      }
    }
  }
}
