import RakazoAPI
import RakazoUI
import SwiftUI

/// The "To do" card for the top of the Inbox list. It hides itself when triage is off or nothing is open.
/// Tapping a row's text opens its message; the circle marks it done.
struct TodosCard: View {
  @Environment(AppModel.self) private var app

  var body: some View { TodosCardContent(app: app) }
}

private struct TodosCardContent: View {
  let app: AppModel
  @State private var model: TodosModel

  init(app: AppModel) {
    self.app = app
    _model = State(initialValue: TodosModel(client: .live(app)))
  }

  var body: some View {
    Group {
      if model.isVisible {
        VStack(alignment: .leading, spacing: 0) {
          Text("To do")
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 4)
          ForEach(model.todos) { todo in
            row(todo)
            if todo.id != model.todos.last?.id { Divider().padding(.leading, 52) }
          }
        }
        .background(Color.token(.card), in: .rect(cornerRadius: 14))
        .accessibilityIdentifier("todosCard")
      }
    }
    .task { await model.load() }
    .alert(
      "Couldn’t finish that",
      isPresented: Binding(get: { model.actionError != nil }, set: { if !$0 { model.actionError = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(verbatim: model.actionError ?? "")
    }
  }

  private func row(_ todo: MailTodo) -> some View {
    HStack(spacing: 4) {
      Button { Task { await model.complete(todo) } } label: {
        Label("Mark done", systemImage: "circle")
          .labelStyle(.iconOnly)
          .font(.title2)
          .foregroundStyle(Color.token(.mutedForeground))
          .frame(width: 44, height: 44)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("todoDone")
      Button {
        if let id = todo.messageId { app.open(.inboxMessage(messageID: id)) }
      } label: {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text(todo.text).font(.subheadline).foregroundStyle(Color.token(.foreground))
            if let line = detail(todo) {
              Text(line).font(.caption).foregroundStyle(Color.token(.mutedForeground))
            }
          }
          Spacer(minLength: 8)
          if let due = todo.dueOn.flatMap({ TodoDue.label($0) }) {
            Text(due).font(.caption).foregroundStyle(Color.token(.mutedForeground))
          }
        }
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .disabled(todo.messageId == nil)
    }
    .padding(.horizontal, 4).padding(.trailing, 10)
  }

  private func detail(_ todo: MailTodo) -> String? {
    let parts = [todo.from, todo.detail].compactMap { $0 }.filter { !$0.isEmpty }
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
  }
}
