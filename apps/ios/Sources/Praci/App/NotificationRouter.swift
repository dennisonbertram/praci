import Foundation
import UserNotifications

/// What a push opens. Parsed from the data fields the server adds to every push
/// (`expoNotificationData` and `expoPushData` in `packages/adapters/src/expo-push.ts`; the APNs
/// provider puts the same fields at the top level of the payload next to `aps`).
struct PushTarget: Equatable {
  let spaceID: String?
  let thread: ThreadTarget

  /// A group wins over a bot. A payload with neither (for example a link-only notification)
  /// opens nothing.
  init?(userInfo: [AnyHashable: Any]) {
    func text(_ key: String) -> String? {
      guard let value = userInfo[key] as? String, !value.isEmpty else { return nil }
      return value
    }
    if let group = text("groupId") {
      thread = .group(group)
    } else if let bot = text("botId") {
      thread = .bot(bot)
    } else {
      return nil
    }
    spaceID = text("spaceId")
  }

  /// A banner is hidden only while the user is already looking at this exact thread.
  func showsBanner(openRoute: Route?, activeSpaceID: String?) -> Bool {
    !(openRoute == .thread(thread) && (spaceID == nil || spaceID == activeSpaceID))
  }
}

@MainActor
final class NotificationRouter: NSObject, UNUserNotificationCenterDelegate {
  private let app: AppModel
  private let defaults: UserDefaults
  private(set) var pending: PushTarget?
  private var startupDone = false
  private var authorizationRequested = false
  private static let tokenKey = "pushToken"

  init(app: AppModel, defaults: UserDefaults = .standard) {
    self.app = app
    self.defaults = defaults
    super.init()
    app.authentication.beforeSessionEnds = { [weak self] in
      self?.pending = nil
      await self?.unregisterIfNeeded()
    }
  }

  /// The app has no push registration yet: it needs the APNs entitlement and signing, which stay
  /// with the maintainer. When that exists, call this with the hex device token right after
  /// `notifications/registerPush` succeeds so sign-out can undo it.
  func didRegister(token: String) {
    defaults.set(token, forKey: Self.tokenKey)
  }

  /// Call before the session ends. Does nothing unless a token was registered.
  func unregisterIfNeeded() async {
    guard defaults.string(forKey: Self.tokenKey) != nil else { return }
    let ack = try? await app.call("notifications/unregisterPush") as PushAck
    if ack != nil {
      defaults.removeObject(forKey: Self.tokenKey)
    }
  }

  /// Opens a tapped push now, or keeps it until sign-in finishes restoring.
  func open(_ target: PushTarget) {
    guard app.authentication.isSignedIn else {
      // Only a launch tap that arrives before the session is restored waits; later taps could
      // otherwise open a thread in another account or on another server.
      pending = startupDone ? nil : target
      return
    }
    pending = nil
    if let space = target.spaceID, space != app.spaceID { app.spaceID = space }
    app.path = []
    app.open(.thread(target.thread))
  }

  /// Run when sign-in state changes or startup finishes. A tap that arrives while signed out is
  /// dropped once startup is done: the payload names no server, so it cannot be matched.
  func settle(startupDone done: Bool) {
    if done { startupDone = true }
    if app.authentication.isSignedIn, !authorizationRequested {
      authorizationRequested = true
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }
    guard let target = pending else { return }
    if app.authentication.isSignedIn {
      open(target)
    } else if startupDone {
      pending = nil
    }
  }

  /// Completion-handler forms, not the async ones: UIKit needs the handler called on the main
  /// thread, and the async bridge calls it from a background executor.
  nonisolated func userNotificationCenter(
    _: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping @Sendable () -> Void
  ) {
    let target = PushTarget(userInfo: response.notification.request.content.userInfo)
    Task { @MainActor in
      if let target { open(target) }
      completionHandler()
    }
  }

  nonisolated func userNotificationCenter(
    _: UNUserNotificationCenter, willPresent notification: UNNotification,
    withCompletionHandler completion: @escaping @Sendable (UNNotificationPresentationOptions) -> Void
  ) {
    let target = PushTarget(userInfo: notification.request.content.userInfo)
    Task { @MainActor in
      let show = target.map(showsBanner(for:)) ?? true
      completion(show ? [.banner, .list, .sound] : [])
    }
  }

  private func showsBanner(for target: PushTarget) -> Bool {
    target.showsBanner(openRoute: app.path.last, activeSpaceID: app.spaceID)
  }
}

private struct PushAck: Decodable {
  let ok: Bool // swiftlint:disable:this identifier_name
}
