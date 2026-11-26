import Foundation
import RakazoAPI
import Testing

@testable import Praci

private struct GoogleFailure: Error {}

@Test @MainActor
func googleAgendaFailureKeepsLocalCalendarItemsAndOffersConnect() async throws {
  let local = try JSONDecoder().decode(CalendarAgenda.self, from: Data(#"{"items":[{"id":"todo:todo-placeholder","kind":"todo","title":"Review plan","start":"2026-11-16T15:00:00Z","end":null,"allDay":false,"botId":"bot-placeholder","botName":"Planning bot","account":null,"href":null}],"errors":[],"googleConnected":true}"#.utf8))
  var sources: [String] = []
  var waitingWasCalled = false
  let client = CalendarClient(
    agenda: { _, _, source in
      sources.append(source)
      if source == "local" { return local }
      throw GoogleFailure()
    },
    waitingOnYou: { waitingWasCalled = true; return [] },
    markDone: { _ in })
  let model = CalendarModel(
    client: client,
    now: { ISO8601DateFormatter().date(from: "2026-11-14T12:00:00Z")! },
    timeZone: TimeZone(secondsFromGMT: 0)!)
  await model.load()
  #expect(sources == ["local", "google"])
  #expect(waitingWasCalled)
  #expect(model.items.map(\.id) == ["todo:todo-placeholder"])
  #expect(model.googleNeedsAction)
  #expect(model.googleNeedsReconnect == false)
}
