import Foundation

/// Key-bar logic for the Team Computer page. A port of `apps/mobile/lib/computer-keyboard.ts`.
/// The page installs `window.rakazoComputerKeyboard.run(command)`; the app sends JSON commands.
public enum ComputerKeyName: String, Sendable, Hashable, Codable {
  case escape = "Escape"
  case tab = "Tab"
  case `return` = "Return"
  case backspace = "Backspace"
  case arrowLeft = "ArrowLeft"
  case arrowUp = "ArrowUp"
  case arrowRight = "ArrowRight"
  case arrowDown = "ArrowDown"
}

public enum ComputerKeyboardCommand: Sendable, Hashable, Encodable {
  case text(String)
  case backspace(count: Int)
  case key(ComputerKeyName, control: Bool = false)
  case char(String, control: Bool = false)

  private enum CodingKeys: String, CodingKey { case type, text, count, name, control }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .text(let text):
      try container.encode("text", forKey: .type)
      try container.encode(text, forKey: .text)
    case .backspace(let count):
      try container.encode("backspace", forKey: .type)
      try container.encode(count, forKey: .count)
    case .key(let name, let control):
      try container.encode("key", forKey: .type)
      try container.encode(name, forKey: .name)
      if control { try container.encode(true, forKey: .control) }
    case .char(let text, let control):
      try container.encode("char", forKey: .type)
      try container.encode(text, forKey: .text)
      if control { try container.encode(true, forKey: .control) }
    }
  }
}

public struct ComputerKeyboardChanges: Sendable, Hashable {
  public var backspaces: Int
  public var text: String
  public init(backspaces: Int, text: String) {
    self.backspaces = backspaces
    self.text = text
  }
}

public struct ComputerKeyboardEdit: Sendable, Hashable {
  public let changes: ComputerKeyboardChanges
  public let draft: String
  public let aligned: Bool
}

public enum ComputerKeyboard {
  /// The text field always holds this many unsent characters so Backspace has something to delete.
  public static let seed = String(repeating: "_", count: 99)
  /// Set before the page loads so it attaches the key bridge instead of its own keyboard.
  public static let nativeBoot = "window.__rakazoNativeKeys=true;true;"
  public static let readyMessage = "rakazo-computer-keyboard-ready"
  static let readyPolls = 300

  /// Insertions and deletions between two drafts, as the in-page keyboard sends them.
  public static func changes(from old: String, to new: String) -> ComputerKeyboardChanges {
    let oldChars = Array(old), newChars = Array(new)
    var inputCount = newChars.count - oldChars.count
    var backspaces = inputCount < 0 ? -inputCount : 0
    for index in 0..<min(oldChars.count, newChars.count) where newChars[index] != oldChars[index] {
      inputCount = newChars.count - index
      backspaces = oldChars.count - index
      break
    }
    return ComputerKeyboardChanges(
      backspaces: backspaces,
      text: inputCount > 0 ? String(newChars[(newChars.count - inputCount)...]) : "")
  }

  public static func nextDraft(_ next: String) -> String {
    next.isEmpty || next.count > seed.count * 2 ? seed : next
  }

  /// One newline per Return so a later Backspace deletes that break before the text before it.
  private static func withReturnBoundaries(_ value: String) -> String {
    value.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
  }

  /// Leading seed characters that were never sent. An edit there is not the remote caret.
  public static func padding(_ draft: String) -> Int {
    if draft.hasPrefix(seed) { return seed.count }
    if seed.hasPrefix(draft) { return draft.count }
    return zip(draft, seed).prefix { $0 == $1 }.count
  }

  /// Appends and end deletions of sent text match a remote caret at the end of the draft. A
  /// deletion that enters the unsent seed is rejected, as is any other change inside the padding.
  public static func isRemoteAlignedEdit(_ old: String, _ new: String) -> Bool {
    if old.hasPrefix(new) { return new.count >= padding(old) }
    if new.hasPrefix(old) { return true }
    let common = zip(old, new).prefix { $0 == $1 }.count
    return common >= padding(old)
  }

  public static func normalizeEdit(_ old: String, _ next: String) -> ComputerKeyboardEdit {
    let value = withReturnBoundaries(next)
    guard isRemoteAlignedEdit(old, value) else {
      return ComputerKeyboardEdit(
        changes: ComputerKeyboardChanges(backspaces: 0, text: ""), draft: old, aligned: false)
    }
    return ComputerKeyboardEdit(
      changes: changes(from: old, to: value), draft: nextDraft(value), aligned: true)
  }

  public static func commands(for changes: ComputerKeyboardChanges, control: Bool)
    -> [ComputerKeyboardCommand]
  {
    var commands: [ComputerKeyboardCommand] = []
    var controlPending = control
    if changes.backspaces > 0 {
      if controlPending {
        commands.append(.key(.backspace, control: true))
        controlPending = false
        if changes.backspaces > 1 { commands.append(.backspace(count: changes.backspaces - 1)) }
      } else {
        commands.append(.backspace(count: changes.backspaces))
      }
    }
    var plain = ""
    func flush() {
      if !plain.isEmpty { commands.append(.text(plain)) }
      plain = ""
    }
    for character in changes.text {
      if character == "\n" || character == "\r" || character == "\r\n" {
        flush()
        commands.append(.key(.return, control: controlPending))
        controlPending = false
      } else if controlPending {
        flush()
        commands.append(.char(String(character), control: true))
        controlPending = false
      } else {
        plain.append(character)
      }
    }
    flush()
    return commands
  }

  /// JSON embedded as a JS expression. Escapes keep text from breaking out of the injected call.
  static func escapedJSON<T: Encodable>(_ value: T) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let json = (try? encoder.encode(value)).flatMap { String(bytes: $0, encoding: .utf8) } ?? "null"
    return json.replacingOccurrences(of: "<", with: "\\u003c")
      .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
      .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
  }

  public static func script(for command: ComputerKeyboardCommand) -> String {
    "window.rakazoComputerKeyboard?.run(\(escapedJSON(command)));true;"
  }

  /// Asks the page to post a ready message once its keyboard bridge exists.
  public static func readyProbe(session: String) -> String {
    let message = escapedJSON("\(readyMessage):\(session)")
    let bridgeReady = "bridge&&typeof bridge.run===\"function\"&&window.ReactNativeWebView"
    return "(function(){var left=\(readyPolls);function tick(){var bridge=window.rakazoComputerKeyboard;"
      + "if(\(bridgeReady)){window.ReactNativeWebView.postMessage(\(message));return;}"
      + "left-=1;if(left>0)setTimeout(tick,100);}tick();})();true;"
  }

  public static func isReadyMessage(_ data: String, session: String) -> Bool {
    data == "\(readyMessage):\(session)"
  }
}

/// Holds commands until the page has installed the keyboard bridge, then flushes them in order.
public struct ComputerKeyboardBridge: Sendable {
  private var accepting = false
  private var pending: [ComputerKeyboardCommand] = []
  public init() {}

  public var isReady: Bool { accepting }

  public mutating func push(_ command: ComputerKeyboardCommand) -> [ComputerKeyboardCommand] {
    if accepting { return [command] }
    pending.append(command)
    return []
  }

  public mutating func ready() -> [ComputerKeyboardCommand] {
    if accepting { return [] }
    accepting = true
    defer { pending = [] }
    return pending
  }
}
