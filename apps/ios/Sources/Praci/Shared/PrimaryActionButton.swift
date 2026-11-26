import SwiftUI

/// The full-width, 50 pt primary button used for the one action of an empty state.
struct PrimaryActionButton: View {
  let title: LocalizedStringKey
  let action: () -> Void

  init(_ title: LocalizedStringKey, action: @escaping () -> Void) {
    self.title = title
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      Text(title).frame(maxWidth: .infinity).foregroundStyle(Color.token(.primaryForeground))
    }
    .buttonStyle(.borderedProminent)
    .tint(Color.token(.primary))
    .controlSize(.large)
    .padding(.horizontal, 16)
  }
}
