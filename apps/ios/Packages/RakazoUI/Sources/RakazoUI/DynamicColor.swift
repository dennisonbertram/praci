import SwiftUI
import UIKit

extension Color {
  /// A semantic token that follows the current light or dark appearance.
  public static func token(_ token: SemanticColor) -> Color {
    Color(
      uiColor: UIColor { traits in
        UIColor(RakazoTokens.color(token, for: traits.userInterfaceStyle == .dark ? .dark : .light))
      })
  }
}
