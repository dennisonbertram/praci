import RakazoAPI
import SwiftUI

struct BoardScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = BoardModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { tickets in
      List {
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        if tickets.isEmpty {
          ContentUnavailableView("No tickets yet", systemImage: "checklist")
            .listRowSeparator(.hidden)
        } else {
          ForEach(groupTicketsByStatus(tickets)) { group in
            if !group.tickets.isEmpty {
              Section(group.status.label) {
                ForEach(group.tickets) { ticket in
                  NavigationLink(value: Route.ticket(id: ticket.id)) {
                    TicketRow(
                      ticket: ticket,
                      assignee: model.bots.first { $0.id == ticket.assigneeBotId }?.name ?? "Unassigned")
                  }
                  .accessibilityIdentifier("boardTicket-\(ticket.id)")
                }
              }
            }
          }
        }
      }
      .listStyle(.insetGrouped)
    })
    .navigationTitle("Task board")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
  }
}

private struct TicketRow: View {
  let ticket: Ticket
  let assignee: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(ticket.ref).font(.caption).foregroundStyle(Color.token(.mutedForeground))
      Text(ticket.title).font(.headline)
      Text(assignee).font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityElement(children: .combine)
  }
}
