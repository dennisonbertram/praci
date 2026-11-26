import RakazoAPI
import RakazoCore
import SwiftUI

struct ThreadScreen: View {
  let target: ThreadTarget
  @Environment(AppModel.self) private var app
  @State private var model: ThreadModel
  @State private var attempt = 0
  @State private var atBottom = true
  /// True while a finger is on the thread or it is still coasting from a drag.
  @State private var userScrolling = false
  @State private var confirmingArchive = false

  init(target: ThreadTarget) {
    self.target = target
    _model = State(initialValue: ThreadModel(target: target))
  }

  private struct RunKey: Hashable {
    var spaceID: String?
    var attempt: Int
  }

  var body: some View {
    LoadableView(state: model.state, retry: { attempt += 1 }, content: { snapshot in
      content(snapshot)
    })
    .background(Color.token(.background))
    .navigationTitle(model.title)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar { toolbar }
    .task(id: RunKey(spaceID: app.spaceID, attempt: attempt)) { await model.run(app) }
    .confirmationDialog("Archive \(model.title)?", isPresented: $confirmingArchive) {
      Button("Archive agent", role: .destructive) {
        Task { _ = await model.archive(app) }
      }
    }
    .alert("Couldn’t archive", isPresented: archiveFailed) {
      Button("OK") { model.archiveError = nil }
    } message: {
      Text(model.archiveError ?? "")
    }
  }

  private var archiveFailed: Binding<Bool> {
    Binding(get: { model.archiveError != nil }, set: { if !$0 { model.archiveError = nil } })
  }

  // MARK: Content

  // A SwiftUI view builder lists its rows in one place.
  // swiftlint:disable:next function_body_length
  private func content(_ snapshot: ThreadSnapshot) -> some View {
    let (messages, reactions) = ThreadReactions.project(snapshot.messages)
    let divider = model.dividerID
    return ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 8) {
          if snapshot.olderCursor != nil {
            if model.olderError != nil {
              Button("Couldn’t load earlier messages. Try again") {
                model.olderError = nil
                Task { await model.loadOlder(app) }
              }
              .font(.footnote).frame(maxWidth: .infinity)
            } else {
              ProgressView().frame(maxWidth: .infinity)
                .onAppear { Task { await model.loadOlder(app) } }
            }
          }
          if let error = model.refreshError {
            Text("Couldn’t refresh. Showing the last loaded messages.")
              .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
              .accessibilityHint(error)
          }
          if messages.isEmpty { emptyState }
          ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
            if message.id == divider { UnreadDivider() }
            ThreadMessageView(
              message: message, model: model, reactions: reactions[message.id] ?? [],
              showsSender: index == 0 || messages[index - 1].botId != message.botId
                || messages[index - 1].role == "user",
              showsTime: index == messages.count - 1
                || messages[index + 1].role != message.role
                || messages[index + 1].botId != message.botId
            )
            .id(message.id)
            .modifier(DismissesKeyboardOnTap(enabled: !message.hasInput))
          }
          PendingSendsView(model: model)
          footer
          Color.clear.frame(height: 1).id(Self.bottomID)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        // A layer behind the rows: only the gaps between them reach it, never a field on top.
        .background { Color.clear.contentShape(Rectangle()).modifier(DismissesKeyboardOnTap(enabled: true)) }
      }
      .defaultScrollAnchor(.bottom)
      .scrollDismissesKeyboard(.interactively)
      .onScrollPhaseChange { _, phase in
        userScrolling = phase == .tracking || phase == .interacting || phase == .decelerating
      }
      .accessibilityIdentifier("threadList")
      .onScrollGeometryChange(for: ScrollEdge.self) { geometry in
        ScrollEdge(
          nearBottom: geometry.visibleRect.maxY >= geometry.contentSize.height - 48,
          height: geometry.contentSize.height,
          // The keyboard or composer shrinking the view moves the bottom out of sight, like new content.
          viewport: geometry.containerSize.height)
      } action: { old, new in
        if BottomFollow.shouldFollow(
          heightChanged: new.height != old.height || new.viewport != old.viewport,
          atBottom: atBottom, userScrolling: userScrolling)
        {
          // New content makes the bottom move away; keep following unless the reader is dragging.
          // Otherwise a streaming reply pulls every drag back down.
          proxy.scrollTo(Self.bottomID, anchor: .bottom)
        } else {
          atBottom = new.nearBottom
          if new.nearBottom { Task { await model.markRead(app) } }
        }
      }
      .onChange(of: messages.last?.id) { _, _ in
        if atBottom {
          withAnimation { proxy.scrollTo(Self.bottomID, anchor: .bottom) }
          Task { await model.markRead(app) }
        }
      }
      .onChange(of: model.runningRuns.count) { _, _ in
        if atBottom { withAnimation { proxy.scrollTo(Self.bottomID, anchor: .bottom) } }
      }
      .overlay(alignment: .bottomTrailing) {
        if !atBottom {
          Button {
            Task { await jumpToLatest(proxy) }
          } label: {
            Label("Jump to latest", systemImage: "arrow.down")
              .font(.subheadline.weight(.semibold))
              .padding(.horizontal, 14).padding(.vertical, 10)
          }
          .buttonStyle(.glass)
          .padding(.horizontal, 16).padding(.bottom, 80)
          .accessibilityIdentifier("jumpToLatest")
        }
      }
      .safeAreaInset(edge: .bottom) { ComposerView(model: model) }
    }
  }

  private static let bottomID = "thread-bottom"

  /// Rows below the screen are only estimated, so the first jump can land short; repeat once rows exist.
  private func jumpToLatest(_ proxy: ScrollViewProxy) async {
    for _ in 0..<3 {
      withAnimation { proxy.scrollTo(Self.bottomID, anchor: .bottom) }
      try? await Task.sleep(for: .milliseconds(350))
    }
    atBottom = true
    await model.markRead(app)
  }

  @ViewBuilder private var footer: some View {
    ForEach(model.runningRuns.filter(showsIndicator), id: \.id) { run in
      let name = workingName(run)
      WorkingIndicator(name: name, avatar: workingAvatar(run))
    }
    if let failure = model.failureText {
      Text(failure.isEmpty ? "Last run failed." : "Last run failed: \(failure)")
        .font(.footnote).foregroundStyle(Color.token(.destructive))
        .accessibilityIdentifier("runFailed")
    }
  }

  /// The indicator gives way as soon as the run's reply text starts streaming.
  private func showsIndicator(_ run: ThreadRun) -> Bool {
    !model.storedMessages.contains { message in
      message.runId == run.id && message.id.hasPrefix("progress:")
        && message.blocks.contains { $0.kind == .progress && $0.fields["activity"] != .bool(true) }
    }
  }

  private func workingName(_ run: ThreadRun) -> String {
    switch target {
    case .bot: model.title
    case .group: model.memberName(run.botId) ?? model.title
    }
  }

  private func workingAvatar(_ run: ThreadRun) -> String? {
    switch target {
    case .bot: model.botColor
    case .group: model.memberColor(run.botId)
    }
  }

  private var emptyState: some View {
    Text(target.isGroup ? "Message the group" : "Say hello to \(model.title).")
      .foregroundStyle(Color.token(.mutedForeground))
      .frame(maxWidth: .infinity)
      .padding(.vertical, 40)
  }

  // MARK: Toolbar

  @ToolbarContentBuilder private var toolbar: some ToolbarContent {
    if case .bot(let id) = target {
      ToolbarItem(placement: .topBarTrailing) {
        CallButton(botID: id, name: model.title, avatar: model.botColor)
      }
    }
    ToolbarItem(placement: .topBarTrailing) {
      Menu {
        switch target {
        case .bot(let id):
          Button { app.open(.computer(botID: id)) } label: {
            Label("Open computer", systemImage: "desktopcomputer")
          }
          Button { app.open(.artifacts(botID: id)) } label: {
            Label("Artifacts", systemImage: "square.stack.3d.up")
          }
          Button { app.open(.agentPage(botID: id)) } label: {
            Label("Agent page", systemImage: "doc.text")
          }
          Button { app.open(.botSettings(botID: id)) } label: {
            Label("Settings", systemImage: "gearshape")
          }
          Divider()
          Button(role: .destructive) { confirmingArchive = true } label: {
            Label("Archive agent", systemImage: "archivebox")
          }
        case .group(let id):
          Button { app.open(.groupSettings(groupID: id)) } label: {
            Label("Settings", systemImage: "gearshape")
          }
        }
      } label: {
        Label("Agent actions", systemImage: "ellipsis")
      }
      .accessibilityIdentifier("botActions")
    }
  }
}

extension ThreadTarget {
  fileprivate var isGroup: Bool { if case .group = self { true } else { false } }
}

enum BottomFollow {
  /// Follow new content to the bottom only when the reader is at the bottom and not dragging.
  static func shouldFollow(heightChanged: Bool, atBottom: Bool, userScrolling: Bool) -> Bool {
    heightChanged && atBottom && !userScrolling
  }
}

private struct ScrollEdge: Equatable {
  var nearBottom: Bool
  var height: CGFloat
  var viewport: CGFloat
}

private struct UnreadDivider: View {
  var body: some View {
    HStack(spacing: 8) {
      line
      Text("New").font(.caption.weight(.semibold)).foregroundStyle(Color.token(.mutedForeground))
      line
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("unreadDivider")
  }

  private var line: some View {
    Rectangle().fill(Color.token(.border)).frame(height: 1)
  }
}

/// Taps on read-only content close the keyboard. Cards with answer fields are left out so a tap
/// on a field is never competing with this one.
private struct DismissesKeyboardOnTap: ViewModifier {
  let enabled: Bool

  func body(content: Content) -> some View {
    if enabled {
      content.onTapGesture {
        UIApplication.shared.sendAction(
          #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
      }
    } else {
      content
    }
  }
}

extension ThreadMessage {
  /// True when a block can hold a text field (an answer, a username or a password).
  fileprivate var hasInput: Bool {
    blocks.contains { [.ask, .choice, .mcpApproval, .appConnect, .connect, .card].contains($0.kind) }
  }
}
