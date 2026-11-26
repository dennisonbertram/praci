import Foundation
import RakazoAPI
import SwiftUI
import Testing
import UIKit

@testable import Praci

/// Draws changed views at the default and the large accessibility text size. Saves PNGs only when
/// `VISUAL_SHOTS` names a folder; otherwise it only checks that the views lay out.
@MainActor
private func shot<V: View>(_ view: V, name: String, large: Bool) async {
  let size = CGSize(width: 402, height: large ? 700 : 360)
  let content = view
    .environment(\.dynamicTypeSize, large ? .accessibility3 : .large)
    .frame(width: size.width, height: size.height, alignment: .top)
    .background(Color.white)
  guard let folder = ProcessInfo.processInfo.environment["VISUAL_SHOTS"] else { return }
  let renderer = ImageRenderer(content: content)
  renderer.scale = 3
  try? FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
  try? renderer.uiImage?.pngData()?.write(
    to: URL(fileURLWithPath: folder).appendingPathComponent("\(name)-\(large ? "large" : "default").png"))
}

@Test @MainActor func renderChangedViews() async throws {
  let row = InboxRow(
    id: "m1", from: "Priya Placeholder", subject: "[MOCK] Quick question on the hiring plan",
    snippet: "Hi Maya, before the LP call, can you confirm we still plan to hire two engineers?",
    receivedAt: "2026-11-04T12:02:00Z", unread: true)
  let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Packages/RakazoAPI/Tests/RakazoAPITests/Fixtures/home-bootstrap.json")
  let envelope = try #require(
    try JSONSerialization.jsonObject(with: Data(contentsOf: fixtures)) as? [String: Any])
  let boot = try JSONDecoder().decode(
    Bootstrap.self, from: JSONSerialization.data(withJSONObject: try #require(envelope["json"])))
  let roster = Roster(bots: boot.bots, groups: boot.groups, sections: boot.botSections)
  let agent = try #require((roster.pinned + roster.agents).first)
  for large in [false, true] {
    await shot(
      VStack { InboxRowView(row: row, now: .now); InboxRowView(row: row, now: .now) }.padding(),
      name: "inbox-row", large: large)
    await shot(AgentRowView(row: agent).padding(), name: "home-row", large: large)
    await shot(
      VStack { Spacer(); PrimaryActionButton("Connect Carta") {}; Spacer() }, name: "empty-state", large: large)
  }
}
