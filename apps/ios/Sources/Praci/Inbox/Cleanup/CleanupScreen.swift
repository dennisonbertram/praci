import RakazoAPI
import RakazoUI
import SwiftUI

/// "1 sender" or "3 senders".
private func senders(_ count: Int) -> String { count == 1 ? "1 sender" : "\(count) senders" }

/// Bulk cleanup of the senders that fill the inbox (J2): Archive and Unsubscribe are separate choices,
/// each with its own confirmation.
struct CleanupScreen: View {
  @Environment(AppModel.self) private var app

  var body: some View { CleanupContent(app: app) }
}

private struct CleanupContent: View {
  @State private var model: CleanupModel
  @State private var confirming: CleanupKind?
  @State private var confirmingFollowUp = false

  init(app: AppModel) {
    _model = State(initialValue: CleanupModel(client: .live(app)))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.reload() } }, content: { list in
      switch model.phase {
      case .selecting: selecting(list)
      case .running(let kind): RunningView(kind: kind, cancel: model.cancel)
      case .done(let summary): DoneView(summary: summary, model: model, unsubscribe: { confirmingFollowUp = true })
      case .failed(let kind, let message):
        ContentUnavailableView {
          Label("Couldn’t finish", systemImage: "exclamationmark.triangle")
        } description: {
          Text(verbatim: message)
        } actions: {
          Button("Try again") { model.retry() }.accessibilityIdentifier("cleanupRetry")
          Button("Back") { model.doneViewing() }
        }
        .accessibilityIdentifier("cleanupFailed")
      }
    })
    .background(Color.token(.background))
    .navigationTitle("Cleanup")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load() }
    .alert(archiveTitle, isPresented: shown(.archive)) {
      Button("Archive") { model.run(.archive) }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Undo brings them back.")
    }
    .alert(unsubscribeTitle, isPresented: shown(.unsubscribe)) {
      Button("Unsubscribe", role: .destructive) { model.run(.unsubscribe) }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Unsubscribing can’t be undone.")
    }
    .alert(
      LocalizedStringKey("Unsubscribe from \(senders(model.followUpSenders.count))?"), isPresented: $confirmingFollowUp
    ) {
      Button("Unsubscribe", role: .destructive) { model.unsubscribeArchived() }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Unsubscribing can’t be undone.")
    }
    .alert(mailTitle, isPresented: Binding(get: { !model.pendingMail.isEmpty && isIdle }, set: { _ in })) {
      Button("Send") { model.answerMail(send: true) }
      Button("Cancel", role: .cancel) { model.answerMail(send: false) }
    }
    .actionErrorAlert("Couldn’t finish that", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private var isIdle: Bool {
    if case .running = model.phase { return false }
    return true
  }

  private func shown(_ kind: CleanupKind) -> Binding<Bool> {
    Binding(get: { confirming == kind }, set: { if !$0, confirming == kind { confirming = nil } })
  }

  private var archiveTitle: LocalizedStringKey { "Archive \(model.archiveCount) emails?" }
  private var unsubscribeTitle: LocalizedStringKey {
    LocalizedStringKey("Unsubscribe from \(senders(model.unsubscribeCount))?")
  }
  private var mailTitle: LocalizedStringKey {
    "Send an unsubscribe email to \(model.pendingMail.first?.mailTo ?? "")?"
  }

  @ViewBuilder
  private func selecting(_ list: CleanupList) -> some View {
    if list.senders.isEmpty {
      ContentUnavailableView(
        "Nothing to clean up", systemImage: "checklist",
        description: Text("Senders that fill your inbox appear here."))
        .accessibilityIdentifier("cleanupEmpty")
    } else {
      List(model.senders) { sender in
        Button {
          model.toggle(sender)
        } label: {
          SenderRow(sender: sender, selected: model.selected.contains(sender.id))
        }
          .buttonStyle(.plain)
          .listRowBackground(Color.token(.background))
      }
      .listStyle(.plain)
      .accessibilityIdentifier("cleanupList")
      .safeAreaInset(edge: .bottom) { actionBar }
    }
  }

  private var actionBar: some View {
    VStack(spacing: 8) {
      Group {
        if model.selected.isEmpty {
          Text("Select senders to clean up")
        } else {
          Text(LocalizedStringKey("\(senders(model.selected.count)) selected"))
        }
      }
      .font(.subheadline)
      .foregroundStyle(Color.token(.mutedForeground))
      HStack(spacing: 12) {
        Button { confirming = .archive } label: {
          Text(model.archiveCount > 0 ? "Archive \(model.archiveCount) emails" : "Archive").frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.token(.primary))
        .foregroundStyle(Color.token(.primaryForeground))
        .disabled(model.targets(.archive).isEmpty)
        .accessibilityIdentifier("cleanupArchive")
        Button { confirming = .unsubscribe } label: { Text("Unsubscribe").frame(maxWidth: .infinity) }
          .buttonStyle(.bordered)
          .disabled(model.unsubscribeCount == 0)
          .accessibilityIdentifier("cleanupUnsubscribe")
      }
      .controlSize(.large)
    }
    .padding(.horizontal, 16).padding(.vertical, 10)
    .background(.bar)
  }
}

private struct SenderRow: View {
  let sender: CleanupSender
  let selected: Bool

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: selected ? "checkmark.circle.fill" : "circle")
        .font(.title3)
        .foregroundStyle(selected ? Color.token(.primary) : Color.token(.mutedForeground))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(sender.name.isEmpty ? sender.address : sender.name)
          .font(.headline)
          .foregroundStyle(Color.token(.foreground))
          .lineLimit(1)
        Text(detail)
          .font(.subheadline)
          .foregroundStyle(Color.token(.mutedForeground))
        if sender.spamLike {
          Text("Looks like spam").font(.caption).foregroundStyle(Color.token(.warning))
        }
      }
      Spacer()
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(selected ? .isSelected : [])
    .accessibilityIdentifier("cleanupSender")
  }

  private var detail: String {
    let count = "\(sender.messageCount) emails"
    guard let date = sender.lastReceivedAt.flatMap(InboxRow.parseDate) else { return count }
    return "\(count) · last \(date.formatted(.dateTime.month(.abbreviated).day()))"
  }
}

private struct RunningView: View {
  let kind: CleanupKind
  let cancel: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      ProgressView()
      Text(kind == .unsubscribe ? "Unsubscribing" : "Archiving")
        .foregroundStyle(Color.token(.mutedForeground))
      Button("Cancel", action: cancel).buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityIdentifier("cleanupRunning")
  }
}

private struct DoneView: View {
  let summary: CleanupModel.Summary
  let model: CleanupModel
  let unsubscribe: () -> Void

  var body: some View {
    List {
      Section {
        VStack(spacing: 12) {
          Image(systemName: "checkmark.circle").font(.largeTitle).foregroundStyle(Color.token(.success))
          Text(headline).font(.title3.weight(.semibold)).multilineTextAlignment(.center)
          if summary.kind != .unsubscribe, !summary.batchIDs.isEmpty, !summary.undone {
            Button("Undo") { Task { await model.undo() } }
              .buttonStyle(.bordered).accessibilityIdentifier("cleanupUndo")
          }
          if summary.kind == .archive, !summary.undone, summary.senders.contains(where: \.canUnsubscribe) {
            let count = summary.senders.filter(\.canUnsubscribe).count
            Button(LocalizedStringKey("Unsubscribe from \(senders(count))"), action: unsubscribe)
            .accessibilityIdentifier("cleanupUnsubscribeArchived")
          }
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
      }
      if !summary.failures.isEmpty {
        Section {
          ForEach(summary.failures, id: \.self) { Text(verbatim: $0).foregroundStyle(Color.token(.destructive)) }
        }
      }
      if !summary.links.isEmpty {
        Section {
          ForEach(summary.links, id: \.self) { url in
            Button("Open unsubscribe link for \(url.host() ?? "sender")") { UIApplication.shared.open(url) }
          }
        }
      }
      Section {
        Button("Done") { model.doneViewing() }.accessibilityIdentifier("cleanupDone")
      }
    }
    .scrollContentBackground(.hidden)
    .accessibilityIdentifier("cleanupDoneView")
  }

  private var headline: LocalizedStringKey {
    switch summary.kind {
    case .unsubscribe: LocalizedStringKey("Unsubscribed from \(senders(summary.senders.count))")
    case .archive where summary.undone: "Undone"
    default: "\(summary.done) emails archived"
    }
  }
}
