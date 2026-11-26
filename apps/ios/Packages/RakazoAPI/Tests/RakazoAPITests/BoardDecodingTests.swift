import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesTicketListAndCommentUsingOpenAPIFieldNames() throws {
  let result = try JSONDecoder().decode(
    RPCEnvelope<TicketList>.self, from: loadFixture(named: "board-tickets")).json
  #expect(result.tickets.count == 1)
  #expect(result.tickets[0].ref == "RAK-1")
  #expect(result.tickets[0].assigneeBotId == "bot-placeholder")
  #expect(result.tickets[0].status == .doing)
  #expect(result.tickets[0].priority == .high)

  let comment = try JSONDecoder().decode(
    RPCEnvelope<TicketComment>.self, from: loadFixture(named: "board-comment")).json
  #expect(comment.ticketId == "ticket-placeholder")
  #expect(comment.authorName == "Mock bot")
}

@Test
func groupsTicketsInWebColumnOrder() throws {
  let tickets = try JSONDecoder().decode(
    RPCEnvelope<TicketList>.self, from: loadFixture(named: "board-tickets")).json.tickets
  let groups = groupTicketsByStatus(tickets)
  #expect(groups.map { $0.status } == [.todo, .doing, .review, .blocked, .done, .closed])
  #expect(groups.map { $0.tickets.map(\.ref) } == [[], ["RAK-1"], [], [], [], []])
}
