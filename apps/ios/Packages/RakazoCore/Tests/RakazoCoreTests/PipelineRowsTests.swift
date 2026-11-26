import Foundation
@testable import RakazoCore
import Testing

private let today = "2026-11-04"

private func contact(
  _ id: String, _ stage: String? = nil, status: String? = nil,
  next: String? = nil, hasTime: Bool = false
) -> PipelineContact {
  PipelineContact(
    id: id, name: "Firm \(id)", stage: stage, status: status,
    nextCallAt: next, nextCallHasTime: hasTime)
}

@Test("uses contact stage when a pipeline status is absent")
func statusFallsBackToStage() {
  let rows = pipelineRows([
    contact("target", "target"), contact("intro", "intro"), contact("meeting", "meeting"),
    contact("diligence", "diligence"), contact("committed", "committed"),
  ], today: today)
  #expect(rows.map(\.status) == ["not_reached", "intro_requested", "meeting_booked", "diligence", "committed"])
}

@Test("an explicit record status takes precedence over contact stage")
func recordStatusWins() {
  let rows = pipelineRows([contact("one", "target", status: "met")], today: today)
  #expect(rows.first?.status == "met")
}

@Test("date-only calls keep their date and map to the web day bands")
func dateBands() {
  let values: [(String, PipelineDayBand)] = [
    ("2026-11-03T12:00:00.000Z", .overdue),
    ("2026-11-04T12:00:00.000Z", .today),
    ("2026-11-11T12:00:00.000Z", .week),
    ("2026-11-12T12:00:00.000Z", .later),
  ]
  for (at, expected) in values {
    #expect(pipelineDayBand(at: at, hasTime: false, today: today) == expected)
  }
  #expect(pipelineDayBand(at: nil, hasTime: false, today: today) == .none)
}

@Test("Due now includes overdue and today only")
func dueNow() {
  #expect(pipelineDayBand(at: "2026-11-03T12:00:00Z", hasTime: false, today: today) == .overdue)
  #expect(pipelineDayBand(at: "2026-11-04T12:00:00Z", hasTime: false, today: today) == .today)
  #expect(pipelineDayBand(at: "2026-11-05T12:00:00Z", hasTime: false, today: today) == .week)
}

@Test("sorts due bands and dates first, leaves no-date rows last, and keeps stable ties")
func dueFirstOrdering() {
  let rows = pipelineRows([
    contact("none"), contact("today", next: "2026-11-04T12:00:00.000Z"),
    contact("later", next: "2026-11-12T12:00:00.000Z"),
    contact("overdue-late", next: "2026-11-02T12:00:00.000Z"),
    contact("overdue-early", next: "2026-11-01T12:00:00.000Z"),
    contact("today-tie", next: "2026-11-04T12:00:00.000Z"),
    contact("passed", "passed"),
  ], today: today)
  #expect(rows.map(\.id) == ["overdue-early", "overdue-late", "today", "today-tie", "later", "none"])
}

@Test("round-trips a date-only call at noon UTC")
func noonUTCRoundTrip() {
  let encoded = pipelineCallISO(day: "2026-11-04")
  #expect(encoded == "2026-11-04T12:00:00.000Z")
  #expect(pipelineCallISO(day: "2026-03-08") == "2026-03-08T12:00:00.000Z")
  #expect(pipelineCallDay(at: encoded, hasTime: false, timeZone: TimeZone(secondsFromGMT: -7 * 3600)!) == "2026-11-04")
  #expect(pipelineCallISO(day: "2026-11-04", time: "15:30", timeZone: TimeZone(secondsFromGMT: 0)!) == "2026-11-04T15:30:00.000Z")
}
