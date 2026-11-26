import RakazoCore
import SwiftUI

/// Esc, Tab, Ctrl and arrows, plus a keyboard toggle. The text field holds the seed text the
/// page-side keyboard expects, so Backspace and Return arrive as edits. It is invisible: the
/// iOS keyboard types into it and every edit is sent as a command.
struct ComputerKeyBar: View {
  let onCommand: (ComputerKeyboardCommand) -> Void
  @State private var text = ComputerKeyboard.seed
  @State private var accepted = ComputerKeyboard.seed
  @State private var selection: TextSelection?
  @State private var control = false
  @FocusState private var focused: Bool

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
    HStack(spacing: 6) {
      Button { focused.toggle() } label: {
        Label(focused ? "Hide keyboard" : "Show keyboard", systemImage: "keyboard")
          .labelStyle(.iconOnly)
      }
      .accessibilityIdentifier("computerKeyboardToggle")
      key("Esc", .escape)
      key("Tab", .tab)
      Button { control.toggle() } label: { Text("Ctrl").lineLimit(1).fixedSize() }
        .tint(control ? Color.token(.primary) : nil)
        .accessibilityIdentifier("computerKeyCtrl")
      key("←", .arrowLeft, "Left")
      key("↓", .arrowDown, "Down")
      key("↑", .arrowUp, "Up")
      key("→", .arrowRight, "Right")
    }
    }
    .buttonStyle(.bordered)
    .controlSize(.small)
    .buttonBorderShape(.capsule)
    .font(.footnote)
    .frame(maxWidth: .infinity)
    .background {
      TextField("", text: $text, selection: $selection, axis: .vertical)
        .focused($focused)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .frame(width: 1, height: 1)
        .opacity(0.01)
        .accessibilityLabel("Computer keyboard")
        .accessibilityIdentifier("computerKeyboard")
    }
    .onChange(of: text) { _, new in typed(new) }
    // The bar appears when the user takes control; open the keyboard right away.
    .task {
      try? await Task.sleep(for: .milliseconds(400))
      focused = true
    }
  }

  private func key(_ label: LocalizedStringKey, _ name: ComputerKeyName, _ spoken: LocalizedStringKey? = nil)
    -> some View
  {
    Button {
      onCommand(.key(name, control: control))
      control = false
    } label: {
      Text(label).lineLimit(1).fixedSize()
    }
    .accessibilityLabel(spoken ?? label)
    .accessibilityIdentifier("computerKey\(name.rawValue)")
  }

  private func typed(_ new: String) {
    guard new != accepted else { return }
    let edit = ComputerKeyboard.normalizeEdit(accepted, new)
    if edit.aligned {
      let commands = ComputerKeyboard.commands(for: edit.changes, control: control)
      commands.forEach(onCommand)
      if !commands.isEmpty { control = false }
    }
    accepted = edit.draft
    if text != edit.draft { text = edit.draft }
    // The remote caret is always at the end of the draft.
    selection = TextSelection(insertionPoint: edit.draft.endIndex)
  }
}
