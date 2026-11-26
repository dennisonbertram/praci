import SwiftUI
import UIKit

/// System, Light or Dark. Stored on this device only.
enum AppearanceChoice: String, CaseIterable, Identifiable {
  case system, light, dark

  static let storageKey = "appearance"

  var id: Self { self }

  var title: LocalizedStringKey {
    switch self {
    case .system: "System"
    case .light: "Light"
    case .dark: "Dark"
    }
  }

  var style: UIUserInterfaceStyle {
    switch self {
    case .system: .unspecified
    case .light: .light
    case .dark: .dark
    }
  }

  /// Applies the stored choice to every window. Call at launch and after a change.
  @MainActor
  static func applyStored(_ defaults: UserDefaults = .standard) {
    let choice = defaults.string(forKey: storageKey).flatMap(Self.init(rawValue:)) ?? .system
    choice.apply()
  }

  @MainActor
  func apply() {
    for scene in UIApplication.shared.connectedScenes {
      for window in (scene as? UIWindowScene)?.windows ?? [] {
        window.overrideUserInterfaceStyle = style
      }
    }
  }
}
