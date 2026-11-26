import SwiftUI
import UIKit

/// A small window at the bottom of the screen, so a toast survives the context menu or screen that raised it.
@MainActor
enum UndoToast {
  private static var window: UIWindow?
  private static var dismissal: Task<Void, Never>?

  static func show(_ message: String, undo: @escaping @MainActor () async -> Void) {
    guard
      let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive })
    else { return }
    hide()
    let window = UIWindow(windowScene: scene)
    let bounds = scene.screen.bounds
    window.frame = CGRect(x: 0, y: bounds.height - 140, width: bounds.width, height: 80)
    let view = ToastBody(
      message: message,
      undo: {
        hide()
        Task { await undo() }
      })
    let host = UIHostingController(rootView: view)
    host.view.backgroundColor = .clear
    window.rootViewController = host
    window.windowLevel = .alert
    window.isHidden = false
    Self.window = window
    dismissal = Task {
      try? await Task.sleep(for: .seconds(5))
      if !Task.isCancelled { hide() }
    }
  }

  static func hide() {
    dismissal?.cancel()
    window?.isHidden = true
    window = nil
  }
}

private struct ToastBody: View {
  let message: String
  let undo: () -> Void

  var body: some View {
    VStack {
      HStack(spacing: 16) {
        Text(message).lineLimit(1)
        Button("Undo", action: undo)
          .fontWeight(.semibold)
          .accessibilityIdentifier("archiveUndo")
      }
      .font(.subheadline)
      .padding(.horizontal, 20)
      .padding(.vertical, 12)
      .glassEffect()
    }
  }
}
