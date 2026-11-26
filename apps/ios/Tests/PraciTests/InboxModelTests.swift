// swiftlint:disable force_try
import Foundation
import RakazoAPI
import Testing

@testable import Praci

private struct Boom: LocalizedError { var errorDescription: String? { "Mail writes are off." } }

@MainActor
private final class Fake {
  var pages: [InboxList] = []
  var archiveError: Error?
  var unarchiveError: Error?
  var onUnarchive: () -> Void = {}
  var calls: [String] = []
  var tokens: [String?] = []

  func client() -> InboxClient {
    InboxClient(
      list: { _, _, token in
        self.calls.append("list")
        self.tokens.append(token)
        return self.pages.isEmpty ? Self.list([]) : self.pages.removeFirst()
      },
      refresh: { self.calls.append("refresh"); return try Self.decode(#"{"ok":true}"#) },
      markRead: { id, read in self.calls.append("markRead \(id) \(read)") },
      archive: { id in
        self.calls.append("archive \(id)")
        if let error = self.archiveError { throw error }
      },
      unarchive: { id in
        self.calls.append("unarchive \(id)")
        self.onUnarchive()
        if let error = self.unarchiveError { throw error }
      },
      spam: { id in
        self.calls.append("spam \(id)")
        return try Self.decode(#"{"done":["\#(id)"],"failed":[],"batchId":"b1"}"#)
      },
      undoBatch: { id in
        self.calls.append("undo \(id)")
        return try Self.decode(#"{"restored":1,"failed":0}"#)
      })
  }

  static func decode<T: Decodable>(_ json: String) throws -> T {
    try JSONDecoder().decode(T.self, from: Data(json.utf8))
  }

  static func list(_ ids: [String], next: String? = nil) -> InboxList {
    let rows = ids.map { #"{"id":"\#($0)","receivedAt":"2026-10-29T01:26:42Z","unread":true}"# }
    let token = next.map { #""\#($0)""# } ?? "null"
    return try! decode(#"{"rows":[\#(rows.joined(separator: ","))],"nextPageToken":\#(token)}"#)
  }
}

@Test @MainActor
func startShowsTheListThenSyncsOnceAndShowsWhatArrived() async {
  let fake = Fake()
  fake.pages = [Fake.list(["a"]), Fake.list(["a", "b"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  #expect(fake.calls == ["list", "refresh", "list"])
  #expect(model.rows.map(\.id) == ["a", "b"])
}

@Test @MainActor
func archiveRemovesTheRowAndOffersUndoWhichUnarchivesAndReloads() async throws {
  let fake = Fake()
  fake.pages = [Fake.list(["a", "b"]), Fake.list(["a", "b"]), Fake.list(["a", "b"]), Fake.list(["a", "b"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  await model.archive(model.rows[0])
  #expect(model.rows.map(\.id) == ["b"])
  let toast = try #require(model.toast)
  await model.undo(toast)
  #expect(fake.calls.suffix(2) == ["unarchive a", "list"])
  #expect(model.toast == nil)
}

@Test @MainActor
func undoShowsTheRowBeforeTheServerAnswersAndRemovesItAgainIfTheRestoreFails() async throws {
  let fake = Fake()
  fake.pages = [Fake.list(["a", "b"]), Fake.list(["a", "b"])]
  fake.unarchiveError = Boom()
  let model = InboxModel(client: fake.client())
  await model.start()
  await model.archive(model.rows[0])
  var shownDuringCall: [String] = []
  fake.onUnarchive = { shownDuringCall = model.rows.map(\.id) }
  await model.undo(try #require(model.toast))
  #expect(shownDuringCall == ["a", "b"])
  #expect(model.rows.map(\.id) == ["b"])
  #expect(model.actionError == "Mail writes are off.")
}

@Test @MainActor
func aFailedArchivePutsTheRowBackWhereItWasAndShowsTheServerMessage() async {
  let fake = Fake()
  fake.pages = [Fake.list(["a", "b", "c"]), Fake.list(["a", "b", "c"])]
  fake.archiveError = Boom()
  let model = InboxModel(client: fake.client())
  await model.start()
  await model.archive(model.rows[1])
  #expect(model.rows.map(\.id) == ["a", "b", "c"])
  #expect(model.actionError == "Mail writes are off.")
  #expect(model.toast == nil)
}

@Test @MainActor
func spamUndoUsesTheBatchId() async throws {
  let fake = Fake()
  fake.pages = [Fake.list(["a"]), Fake.list(["a"]), Fake.list(["a"]), Fake.list(["a"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  await model.markSpam(model.rows[0])
  #expect(model.rows.isEmpty)
  await model.undo(try #require(model.toast))
  #expect(fake.calls.contains("undo b1"))
}

@Test @MainActor
func theLastRowLoadsTheNextPageOnceAndSkipsDuplicates() async {
  let fake = Fake()
  fake.pages = [Fake.list(["a", "b"], next: "t2"), Fake.list(["a", "b"], next: "t2"), Fake.list(["b", "c"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  await model.loadMoreIfNeeded(after: model.rows[0])  // not the last row: nothing
  #expect(fake.tokens.last! == nil)
  await model.loadMoreIfNeeded(after: model.rows[1])
  #expect(fake.tokens.last! == "t2")
  #expect(model.rows.map(\.id) == ["a", "b", "c"])
  #expect(model.list?.nextPageToken == nil)
}

@Test @MainActor
func openingARowMarksItReadOnScreen() async {
  let fake = Fake()
  fake.pages = [Fake.list(["a"]), Fake.list(["a"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  model.didOpen(model.rows[0])
  #expect(model.rows[0].unread == false)
}

@Test @MainActor
func aMessageArchivedOnItsScreenLeavesTheListWithAnUndoToast() async throws {
  let fake = Fake()
  fake.pages = [Fake.list(["a", "b"]), Fake.list(["a", "b"])]
  let model = InboxModel(client: fake.client())
  await model.start()
  model.archivedElsewhere("a")
  #expect(model.rows.map(\.id) == ["b"])
  #expect(model.toast?.undo == .unarchive(messageID: "a"))
}
