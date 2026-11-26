import Foundation
import RakazoAPI
import Testing

@testable import Praci

@MainActor
private final class FakeMessage {
  var calls: [String] = []
  var unread = true

  func client() -> InboxMessageClient {
    InboxMessageClient(
      get: { _ in
        try JSONDecoder().decode(
          MailMessage.self, from: Data(#"{"from":"a@example.test","unread":\#(self.unread)}"#.utf8))
      },
      markRead: { self.calls.append("markRead \($0)") },
      archive: { self.calls.append("archive \($0)") },
      unarchive: { self.calls.append("unarchive \($0)") },
      askAgent: { _ in throw URLError(.badURL) },
      connection: { _ in "c1" },
      unsubscribe: { _, _, _ in throw URLError(.badURL) },
      attachment: { _, _ in throw URLError(.badURL) })
  }
}

@Test @MainActor
func openingAnUnreadMessageMarksItReadOnTheServer() async {
  let fake = FakeMessage()
  let model = InboxMessageModel(messageID: "m1", client: fake.client())
  await model.load()
  #expect(fake.calls == ["markRead m1"])
}

@Test @MainActor
func openingAReadMessageDoesNotCallTheServerAgain() async {
  let fake = FakeMessage()
  fake.unread = false
  let model = InboxMessageModel(messageID: "m1", client: fake.client())
  await model.load()
  #expect(fake.calls.isEmpty)
}
