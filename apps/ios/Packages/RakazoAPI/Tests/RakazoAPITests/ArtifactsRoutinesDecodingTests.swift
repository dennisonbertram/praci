import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesArtifactPageWithCursor() throws {
  let page = try decode(ArtifactPage.self, "artifacts-list-space")
  #expect(page.items.count == 2)
  #expect(page.items[0].versionCount == 1)
  #expect(page.items[0].kind == .markdown)
  #expect(page.items[0].title == "MOCK All-hands Notes - October")
  #expect(page.nextCursor != nil)
}

@Test
func decodesHTMLArtifactContent() throws {
  let detail = try decode(ArtifactDetail.self, "artifact-get-html")
  #expect(detail.summary.kind == .html)
  #expect(detail.text?.contains("<h1>") == true)
}

@Test
func decodesVersionsNewestFirst() throws {
  let versions = try decode([ArtifactVersion].self, "artifact-versions")
  #expect(versions.map(\.version) == [2, 1])
}

@Test
func artifactKindFromMimeOrExtension() {
  #expect(ArtifactKind(mimeType: "application/octet-stream", name: "a.pdf") == .pdf)
  #expect(ArtifactKind(mimeType: "image/png", name: "x.png") == .image)
  #expect(ArtifactKind(mimeType: "image/svg+xml", name: "x.svg") == .other)
  #expect(ArtifactKind(mimeType: "text/csv", name: "x.csv") == .text)
  #expect(ArtifactKind(mimeType: "application/zip", name: "x.zip") == .other)
}

@Test
func pagesGetNullIsNoPage() throws {
  let page = try decode(AgentPage?.self, "pages-get-null")
  #expect(page == nil)
}

@Test
func decodesRoutinesAndHistory() throws {
  let routines = try decode([Routine].self, "routines-list")
  #expect(routines.count == 1)
  #expect(routines[0].active)
  #expect(routines[0].status?.pausedReason == nil)
  let history = try decode(RoutineHistory.self, "routines-history")
  #expect(history.runs.map(\.status) == [.waitingInput, .completed])
  #expect(history.nextCursor == nil)
}

@Test
func routineToleratesMissingFieldsAndUnknownStatus() throws {
  let json = #"{"json":{"id":"r","botId":"b","name":"N","status":{"pausedReason":"x"}}}"#
  let routine = try JSONDecoder().decode(RPCEnvelope<Routine>.self, from: Data(json.utf8)).json
  #expect(routine.crons.isEmpty)
  #expect(routine.pausedReason == .unknown("x"))
}

@Test
func cronTextDescribesCommonSchedules() {
  #expect(CronText.describe("0 8 * * 1-5") == "Weekdays at 8:00 AM")
  #expect(CronText.describe("0 9 * * 1") == "Every Monday at 9:00 AM")
  #expect(CronText.describe("0 9 1 * *") == "Monthly on day 1 at 9:00 AM")
  #expect(CronText.describe("30 18 * * *") == "Every day at 6:30 PM")
  #expect(CronText.describe("*/5 * * * *") == "*/5 * * * *")
  #expect(CronText.describe([]) == "No schedule")
}
