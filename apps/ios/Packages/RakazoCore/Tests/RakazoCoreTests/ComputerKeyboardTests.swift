import Foundation
import Testing

@testable import RakazoCore

private typealias Keyboard = ComputerKeyboard
private let seed = Keyboard.seed
private func ch(_ backspaces: Int, _ text: String) -> ComputerKeyboardChanges {
  ComputerKeyboardChanges(backspaces: backspaces, text: text)
}

@Test func translatesInsertedAndDeletedText() {
  #expect(Keyboard.changes(from: "___", to: "___a") == ch(0, "a"))
  #expect(Keyboard.changes(from: "___a", to: "___") == ch(1, ""))
}

@Test func returnBecomesAnEnterCommandAndTheDraftStaysStocked() {
  let edit = Keyboard.normalizeEdit(seed, "\(seed)a\n")
  #expect(edit.changes == ch(0, "a\n"))
  #expect(edit.draft.hasSuffix("a\n"))
  #expect(Keyboard.commands(for: edit.changes, control: false) == [.text("a"), .key(.return)])
  #expect(Keyboard.nextDraft("") == seed)
}

@Test func keepsAReturnBetweenCharactersOnEitherSide() {
  let abc: [ComputerKeyboardCommand] = [.text("a"), .key(.return), .text("b")]
  let pasted = Keyboard.normalizeEdit(seed, "\(seed)a\nb")
  #expect(pasted.changes == ch(0, "a\nb"))
  #expect(Keyboard.commands(for: pasted.changes, control: false) == abc)
  let windows = Keyboard.normalizeEdit(seed, "\(seed)a\r\nb")
  #expect(windows.draft.hasSuffix("a\nb"))
  #expect(windows.changes == ch(0, "a\nb"))
  #expect(Keyboard.commands(for: windows.changes, control: false) == abc)
}

@Test func laterBackspacesStayOnTheRemoteReturn() {
  let pasted = Keyboard.normalizeEdit(seed, "\(seed)a\nb")
  let deletedB = Keyboard.normalizeEdit(pasted.draft, String(pasted.draft.dropLast()))
  #expect(deletedB.changes == ch(1, ""))
  #expect(deletedB.draft.hasSuffix("a\n"))
  let deletedReturn = Keyboard.normalizeEdit(deletedB.draft, String(deletedB.draft.dropLast()))
  #expect(deletedReturn.changes == ch(1, ""))
  #expect(deletedReturn.draft.hasSuffix("a") && !deletedReturn.draft.contains("\n"))
  let deletedA = Keyboard.normalizeEdit(deletedReturn.draft, String(deletedReturn.draft.dropLast()))
  #expect(deletedA.changes == ch(1, ""))
  #expect(deletedA.draft == seed)
  #expect(Keyboard.normalizeEdit(pasted.draft, seed).changes == ch(3, ""))
}

@Test func rejectsADeletionThatEntersTheUnsentSeed() {
  let intoSeed = Keyboard.normalizeEdit(seed, String(seed.dropLast()))
  #expect(!intoSeed.aligned && intoSeed.draft == seed && intoSeed.changes == ch(0, ""))
  let cleared = Keyboard.normalizeEdit(seed, "")
  #expect(!cleared.aligned && cleared.draft == seed)
  let partial = String(seed.prefix(40))
  #expect(!Keyboard.isRemoteAlignedEdit(partial, String(partial.dropLast())))
  #expect(Keyboard.isRemoteAlignedEdit(partial, "\(partial)a"))
  let typed = Keyboard.normalizeEdit(seed, "\(seed)a")
  let deletedTyped = Keyboard.normalizeEdit(typed.draft, seed)
  #expect(deletedTyped.aligned && deletedTyped.changes == ch(1, "") && deletedTyped.draft == seed)
  let across = Keyboard.normalizeEdit(typed.draft, String(seed.dropLast()))
  #expect(!across.aligned && across.draft == typed.draft && across.changes == ch(0, ""))
}

@Test func dropsAnEditInsideThePaddingAndKeepsACorrectionInTheTypedSuffix() {
  let draft = "\(seed)ab"
  #expect(Keyboard.padding(draft) == seed.count)
  let insideSeed = "\(seed.dropLast())X_ab"
  #expect(!Keyboard.isRemoteAlignedEdit(draft, insideSeed))
  let edit = Keyboard.normalizeEdit(draft, insideSeed)
  #expect(!edit.aligned && edit.draft == draft)
  #expect(Keyboard.commands(for: edit.changes, control: true).isEmpty)
  let corrected = Keyboard.normalizeEdit("\(seed)recieve", "\(seed)receive")
  #expect(corrected.aligned && corrected.changes == ch(4, "eive"))
}

@Test func controlIsAChordOnOnlyTheNextKey() {
  #expect(Keyboard.commands(for: ch(0, "c"), control: true) == [.char("c", control: true)])
  #expect(Keyboard.commands(for: ch(0, "cd"), control: true) == [.char("c", control: true), .text("d")])
  #expect(
    Keyboard.commands(for: ch(2, "e"), control: true)
      == [.key(.backspace, control: true), .backspace(count: 1), .text("e")])
  #expect(
    Keyboard.commands(for: ch(0, "\nb"), control: true) == [.key(.return, control: true), .text("b")])
  #expect(Keyboard.commands(for: ch(2, ""), control: false) == [.backspace(count: 2)])
}

@Test func commandsAreEmbeddedAsJSONThatCannotBreakOutOfTheInjectedCall() throws {
  let text = "</script>\u{2028}\");alert(1)"
  let script = Keyboard.script(for: .text(text))
  let prefix = "window.rakazoComputerKeyboard?.run("
  #expect(script.hasPrefix(prefix) && script.hasSuffix(");true;"))
  let json = String(script.dropFirst(prefix.count).dropLast(");true;".count))
  #expect(!json.contains("<") && !json.contains("\u{2028}"))
  let object = try #require(
    JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String])
  #expect(object == ["type": "text", "text": text])
  #expect(Keyboard.script(for: .key(.return, control: true)).contains(#""control":true"#))
  #expect(Keyboard.script(for: .key(.tab)).contains(#""name":"Tab""#))
}

@Test func queuesCommandsUntilTheBridgeIsReady() {
  var bridge = ComputerKeyboardBridge()
  let text = ComputerKeyboardCommand.text("a")
  let enter = ComputerKeyboardCommand.key(.return)
  #expect(bridge.push(text).isEmpty && bridge.push(enter).isEmpty)
  #expect(bridge.ready() == [text, enter])
  #expect(bridge.isReady)
  #expect(bridge.push(text) == [text])
  #expect(bridge.ready().isEmpty)
  var next = ComputerKeyboardBridge()
  #expect(!next.isReady && next.push(enter).isEmpty)
  #expect(next.ready() == [enter])
}

@Test func readyProbePostsOnceTheBridgeExists() {
  let script = Keyboard.readyProbe(session: "1\"</script>")
  #expect(script.hasSuffix(";true;"))
  #expect(script.contains("window.rakazoComputerKeyboard"))
  #expect(script.contains("ReactNativeWebView.postMessage"))
  #expect(!script.contains("<"))
  #expect(Keyboard.isReadyMessage("\(Keyboard.readyMessage):4", session: "4"))
  #expect(!Keyboard.isReadyMessage("\(Keyboard.readyMessage):4", session: "5"))
}
