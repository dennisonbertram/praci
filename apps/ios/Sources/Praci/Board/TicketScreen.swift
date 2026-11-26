import Foundation
import Observation
import RakazoAPI
import RakazoCore
import SwiftUI

private struct TicketCommentsInput: Encodable, Sendable {
  let ticketId: String
}

private struct TicketCommentInput: Encodable, Sendable {
  let ticketId: String
  let body: String
}

@MainActor
@Observable
private final class TicketModel {
  let ticketID: String
  let page = PageLoader<Ticket>()
  var state: Loadable<Ticket> { page.state }
  var comments: [TicketComment] = []
  var bots: [BotSummary] = []
  var refreshError: String? { page.refreshError }
  var actionError: String?
  var commentBody = ""
  var submitting = false

  init(ticketID: String) {
    self.ticketID = ticketID
  }

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      let result: TicketList = try await app.call("tickets/list")
      guard let ticket = result.tickets.first(where: { $0.id == ticketID }) else {
        throw RPCError.server(code: "NOT_FOUND", status: 404, message: "Ticket not found")
      }
      return ticket
    }
    guard app.spaceID == requestedSpaceID else { return }
    do {
      let loadedComments: [TicketComment] = try await app.call(
        "tickets/comments", input: TicketCommentsInput(ticketId: ticketID))
      guard app.spaceID == requestedSpaceID else { return }
      comments = loadedComments
    } catch {
      guard app.spaceID == requestedSpaceID else { return }
      page.setRefreshError(settingsErrorText(error))
    }
    let loadedBots: [BotSummary]? = try? await app.call("bots/list")
    guard app.spaceID == requestedSpaceID else { return }
    if let loadedBots { bots = loadedBots }
  }

  func move(_ ticket: Ticket, to status: TicketStatus, app: AppModel) async {
    do {
      let _: JSONValue = try await app.call(
        "tickets/move",
        input: MoveTicketInput(id: ticket.id, status: status.rawValue))
      await load(app)
    } catch {
      actionError = error.localizedDescription
    }
  }

  func addComment(app: AppModel) async {
    let body = commentBody.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !body.isEmpty, !submitting else { return }
    submitting = true
    actionError = nil
    do {
      let created: TicketComment = try await app.call(
        "tickets/comment", input: TicketCommentInput(ticketId: ticketID, body: body))
      if !comments.contains(where: { $0.id == created.id }) { comments.append(created) }
      commentBody = ""
    } catch {
      actionError = error.localizedDescription
    }
    submitting = false
  }
}

struct TicketScreen: View {
  @Environment(AppModel.self) private var app
  let ticketID: String
  @State private var model: TicketModel

  init(ticketID: String) {
    self.ticketID = ticketID
    _model = State(initialValue: TicketModel(ticketID: ticketID))
  }

  var body: some View {
    LoadableView(
      state: model.state, retry: { Task { await model.load(app) } }, content: { ticket in
        List {
          RefreshErrorSection(message: model.refreshError) { await model.load(app) }
          Section {
            Text(ticket.ref)
              .font(.subheadline)
              .foregroundStyle(Color.token(.mutedForeground))
            LabeledContent("Status", value: ticket.status.label)
            LabeledContent("Priority", value: ticket.priority.label)
            LabeledContent(
              "Assignee",
              value: model.bots.first { $0.id == ticket.assigneeBotId }?.name ?? "Unassigned")
            if let description = ticket.description, !description.isEmpty {
              LabeledContent("Description") {
                Text(description).textSelection(.enabled)
              }
            }
          }
          Section("Comments") {
            if model.comments.isEmpty {
              Text("No comments yet")
                .foregroundStyle(Color.token(.mutedForeground))
            }
            ForEach(model.comments) { comment in
              VStack(alignment: .leading, spacing: 3) {
                HStack {
                  Text(comment.authorName ?? "Unknown author")
                    .font(.subheadline.weight(.medium))
                  Spacer()
                  Text(ticketDate(comment.createdAt))
                    .font(.caption)
                    .foregroundStyle(Color.token(.mutedForeground))
                }
                Text(comment.body).textSelection(.enabled)
              }
            }
            // The send button sits beside the field, so the keyboard never covers it.
            HStack(alignment: .bottom) {
              TextField("Add a comment", text: $model.commentBody, axis: .vertical)
                .lineLimit(1...5)
              Button { Task { await model.addComment(app: app) } } label: {
                Image(systemName: "arrow.up.circle.fill").font(.title2)
              }
              .accessibilityLabel("Comment")
              .buttonStyle(.borderless)
              .disabled(
                model.submitting
                  || model.commentBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
          }
          if let error = model.actionError {
            Section {
              Label(error, systemImage: "exclamationmark.triangle")
                .foregroundStyle(Color.token(.destructive))
            }
          }
        }
        .listStyle(.insetGrouped)
        .toolbar {
          ToolbarItem(placement: .topBarTrailing) {
            Menu("Move to") {
              ForEach(TicketStatus.allCases.filter { $0 != ticket.status }, id: \.self) { status in
                Button(status.label) {
                  Task { await model.move(ticket, to: status, app: app) }
                }
              }
            }
          }
        }
      })
    .navigationTitle(model.state.value?.title ?? "Ticket")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: "\(app.spaceID ?? "")-\(ticketID)") { await model.load(app) }
  }

  private func ticketDate(_ value: String) -> String {
    let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    let date = (try? fractional.parse(value)) ?? (try? Date.ISO8601FormatStyle().parse(value))
    return date?.formatted(date: .abbreviated, time: .shortened) ?? value
  }
}

private struct MoveTicketInput: Encodable, Sendable {
  let id: String
  let status: String
}
