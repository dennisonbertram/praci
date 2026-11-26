import Foundation
import RakazoAPI
import Testing

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(T.self, from: loadFixture(named: name))
}

@Test
func decodesDataRoomItemsIncludingFailedAndProcessing() throws {
  let page = try decode(DataRoomItemsPage.self, "dataroom-items")
  #expect(page.items.count == 3)
  #expect(page.nextCursor == nil || page.nextCursor?.isEmpty == false)
  #expect(page.items.contains { $0.isProcessing })
  #expect(page.items.allSatisfy { !$0.name.isEmpty && $0.mimeType == "application/pdf" })
}

@Test
func decodesDataRoomFolders() throws {
  let folders = try decode([DataRoomFolder].self, "dataroom-folders")
  #expect(folders.count == 3)
  #expect(folders.allSatisfy { $0.itemCount != nil })
}

@Test
func decodesSearchHitsWithHighlightMarkers() throws {
  let page = try decode(DataRoomSearchPage.self, "dataroom-search")
  let snippet = try #require(page.results.first?.snippet)
  #expect(snippet.contains("\u{1}"))
  let runs = DataRoomHighlight.runs(snippet)
  #expect(runs.filter(\.isMatch).map(\.text) == ["term", "sheet"])
  #expect(runs.allSatisfy { !$0.text.contains("\u{1}") && !$0.text.contains("\u{2}") })
}

@Test
func highlightDropsStrayMarkers() {
  #expect(DataRoomHighlight.runs("a\u{2}b\u{1}").map(\.text) == ["a", "b"])
  #expect(DataRoomHighlight.runs("").isEmpty)
}

@Test
func decodesConsentAndUploadResults() throws {
  let consent = try decode(DataRoomConsent.self, "dataroom-consent")
  #expect(!consent.allowed)
  #expect(consent.recipients.count == 1)
  let created = try decode(DataRoomUploadResult.self, "dataroom-upload")
  #expect(created.item != nil && !created.duplicate)
  let zip = try decode(DataRoomUploadResult.self, "dataroom-upload-zip")
  #expect(zip.item == nil && zip.importId == "import-placeholder")
  let duplicate = try JSONDecoder().decode(
    DataRoomUploadResult.self, from: Data(#"{"duplicate":true}"#.utf8))
  #expect(duplicate.duplicate)
}

@Test
func listInputOmitsUnsetFilters() throws {
  let data = try JSONEncoder().encode(DataRoomItemsListInput(status: "failed", limit: 10))
  let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
  #expect(object["status"] as? String == "failed")
  #expect(object["folderId"] == nil && object["cursor"] == nil)
}

@Test
func scanListAndSearchPreserveSource() throws {
  let list = try JSONEncoder().encode(DataRoomItemsListInput(source: "scan", cursor: "next"))
  let listObject = try #require(JSONSerialization.jsonObject(with: list) as? [String: Any])
  #expect(listObject["source"] as? String == "scan")
  #expect(listObject["cursor"] as? String == "next")
  let search = try JSONEncoder().encode(DataRoomSearchInput(query: "contract", filters: .init(source: "scan")))
  let searchObject = try #require(JSONSerialization.jsonObject(with: search) as? [String: Any])
  #expect((searchObject["filters"] as? [String: Any])?["source"] as? String == "scan")
}
