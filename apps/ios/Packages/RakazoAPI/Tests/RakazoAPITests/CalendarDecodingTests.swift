import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesAgendaAndOptionalEventFields() throws {
  let agenda = try JSONDecoder().decode(
    RPCEnvelope<CalendarAgenda>.self, from: loadFixture(named: "calendar-agenda")).json
  #expect(agenda.items.count == 3)
  #expect(agenda.items[0].kind == .event)
  #expect(agenda.items[0].joinUrl == "https://meet.google.test/room/1")
  #expect(agenda.items[1].kind == .todo)
  #expect(agenda.items[2].mailId == "message-placeholder")
  #expect(agenda.errors.first?.reconnect == true)
  #expect(agenda.googleConnected)
}

@Test
func decodesUnknownCalendarKindWithoutLosingOtherFields() throws {
  let json = #"{"id":"future-1","kind":"future_kind","title":"Future","start":"2026-11-16T12:00:00Z","end":null,"allDay":false,"botId":null,"botName":null,"account":null,"href":null}"#
  let item = try JSONDecoder().decode(CalendarItem.self, from: Data(json.utf8))
  #expect(item.kind == .unknown("future_kind"))
}
