import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesMeetingsPage() throws {
  let page = try decode(MeetingsPage.self, "meetings-list")
  #expect(page.items.map(\.title) == ["Roadmap sync", "Customer call"])
  #expect(page.items[0].minutes == 45 && page.items[0].sourceName == "Praci")
  #expect(page.items[1].minutes == nil && page.items[1].sourceName == "Granola")
  #expect(page.nextCursor == "cursor-2")
}

@Test
func unknownSourceShowsItsId() throws {
  let json = #"{"json":{"id":"m","title":"T","startedAt":"2026-10-29T16:00:00Z","endedAt":null,"provider":"zoom"}}"#
  let meeting = try JSONDecoder().decode(RPCEnvelope<Meeting>.self, from: Data(json.utf8)).json
  #expect(meeting.sourceName == "zoom")
}

@Test
func omiCloudSourceHasAName() throws {
  let json = #"{"json":{"id":"m","title":"T","startedAt":"2026-10-29T16:00:00Z","endedAt":null,"provider":"omi_cloud"}}"#
  let meeting = try JSONDecoder().decode(RPCEnvelope<Meeting>.self, from: Data(json.utf8)).json
  #expect(meeting.sourceName == "Omi cloud")
}

@Test
func decodesMeetingDetail() throws {
  let detail = try decode(MeetingDetail.self, "meetings-get")
  #expect(detail.meeting.id == "meeting-1" && !detail.partial)
  #expect(detail.decisions.count == 1 && detail.followUps.count == 1)
  #expect(detail.todos.map(\.doneAt) == [nil, "2026-10-30T09:00:00.000Z"])
  #expect(detail.todos[0].dueOn == "2026-11-02")
  #expect(detail.transcript?.hasPrefix("Alex:") == true)
}

@Test
func decodesPartialMeetingWithNoTranscript() throws {
  let detail = try decode(MeetingDetail.self, "meetings-get-partial")
  #expect(detail.partial && detail.transcript == nil && detail.summary.isEmpty)
}

@Test
func decodesCaptures() throws {
  #expect(try decode(CaptureStarted.self, "capture-start").captureId == "capture-1")
  let active = try #require(try decode(ActiveCapture?.self, "capture-active"))
  #expect(active.status == .recording && active.tracks == ["microphone"])
  #expect(try decode(ActiveCapture?.self, "capture-active-null") == nil)
}

@Test
func spaceCarriesRecordingPolicy() throws {
  let boot = try decode(Bootstrap.self, "home-bootstrap")
  #expect(boot.spaces.map(\.meetingRecording) == ["confirm", "remind"])
}

@Test
func meetingDetailReadsSummarizingFlag() throws {
  #expect(try decode(MeetingDetail.self, "meetings-get").summarizing == false)
  let json = #"{"json":{"id":"m","title":"T","startedAt":"2026-10-29T16:00:00Z","endedAt":null,"provider":"praci","summarizing":true}}"#
  let detail = try JSONDecoder().decode(RPCEnvelope<MeetingDetail>.self, from: Data(json.utf8)).json
  #expect(detail.summarizing)
}
