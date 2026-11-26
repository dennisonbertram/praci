import PhotosUI
import RakazoAPI
import RakazoCore
import SwiftUI
import UniformTypeIdentifiers

struct ComposerView: View {
  let model: ThreadModel
  @Environment(AppModel.self) private var app
  @State private var picking = false
  @State private var importing = false
  @State private var photos: [PhotosPickerItem] = []
  @FocusState private var focused: Bool
  @State private var dictation = DictationModel()
  @Environment(\.scenePhase) private var scenePhase

  private var composer: ComposerModel { model.composer }

  var body: some View {
    @Bindable var composer = composer
    VStack(alignment: .leading, spacing: 8) {
      if SendQueue.shared.offline {
        Text("Offline. Messages send when you reconnect.")
          .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          .accessibilityIdentifier("offlineBanner")
      }
      if let goal = model.snapshot?.goal { goalLine(goal) }
      if let reply = composer.reply { replyStrip(reply) }
      if !composer.attachments.isEmpty { chips }
      if let notice = composer.notice {
        Text(notice).font(.footnote).foregroundStyle(Color.token(.destructive))
          .accessibilityIdentifier("composerNotice")
      }
      if let answer = SendQueue.shared.notices[composer.originKey] {
        Text(answer).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          .accessibilityIdentifier("composerAnswer")
      }
      DictationNotice(model: dictation)
      HStack(alignment: .bottom, spacing: 8) {
        attachMenu
        TextField("Message \(model.title)", text: $composer.text, axis: .vertical)
          .lineLimit(1...5)
          .focused($focused)
          .padding(.horizontal, 16).frame(minHeight: 44)
          .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 22))
          .accessibilityIdentifier("messageField")
        trailing
      }
    }
    // The glass buttons add about 7 pt around a 30 pt label, which makes them 44 pt like the field.
    .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
    .task { SendQueue.shared.bind(app) }
    .onChange(of: scenePhase) { _, phase in
      // Not on .inactive: the microphone permission prompt itself makes the scene inactive.
      if phase == .background { dictation.stop() }
    }
    .photosPicker(
      isPresented: $picking, selection: $photos, maxSelectionCount: max(composer.slotsLeft, 1),
      matching: .images
    )
    .onChange(of: photos) { _, items in
      guard !items.isEmpty else { return }
      photos = []
      Task { await load(items) }
    }
    .fileImporter(
      isPresented: $importing, allowedContentTypes: [.item], allowsMultipleSelection: true
    ) { result in
      guard case .success(let urls) = result else { return }
      for url in urls.prefix(composer.slotsLeft) { importFile(url) }
    }
  }

  // MARK: Pieces

  private var attachMenu: some View {
    Menu {
      Button { picking = true } label: { Label("Photo Library", systemImage: "photo") }
      Button { importing = true } label: { Label("Files", systemImage: "doc") }
    } label: {
      Image(systemName: "plus").font(.body.weight(.semibold)).frame(width: 30, height: 30)
    }
    .buttonStyle(.glass)
    .buttonBorderShape(.circle)
    .disabled(composer.slotsLeft == 0)
    .accessibilityLabel("Attach")
    .accessibilityIdentifier("attach")
  }

  @ViewBuilder private var trailing: some View {
    let hasDraft = !composer.text.isEmpty || !composer.attachments.isEmpty
    // While an agent runs, Stop shows only when there is nothing to send, so a correction can be queued.
    if !model.runningRuns.isEmpty && !hasDraft {
      Button { Task { await composer.stop(app) } } label: {
        if composer.stopping {
          ProgressView().frame(width: 30, height: 30)
        } else {
          Image(systemName: "stop.fill").frame(width: 30, height: 30)
        }
      }
      .buttonStyle(.glassProminent)
      .buttonBorderShape(.circle)
      .disabled(composer.stopping)
      .accessibilityLabel("Stop")
      .accessibilityIdentifier("stop")
    } else if dictation.listening || !hasDraft {
      DictationButton(model: dictation, text: Bindable(composer).text)
    } else {
      Button { composer.send(app) } label: {
        Image(systemName: "arrow.up").frame(width: 30, height: 30)
      }
      .buttonStyle(.glassProminent)
      .buttonBorderShape(.circle)
      .disabled(!composer.canSend)
      .keyboardShortcut(.return, modifiers: .command)
      .accessibilityLabel("Send")
      .accessibilityIdentifier("send")
    }
  }

  /// The goal text, with "Paused" or "Waiting on you" only when it is not making progress.
  private func goalLine(_ goal: ThreadGoal) -> some View {
    let status = goalStatus(
      goal, runs: model.snapshot?.activeRuns ?? model.snapshot?.run.map { [$0] } ?? [])
    return HStack(spacing: 8) {
      Image(systemName: "scope").font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      Text(goal.text).font(.footnote).lineLimit(1)
      if let status {
        Text(status).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          .layoutPriority(1)
      }
      Spacer(minLength: 0)
      Button { Task { await composer.clearGoal(app, model) } } label: {
        Image(systemName: "xmark").font(.footnote.weight(.semibold)).frame(width: 22, height: 22)
      }
      .buttonStyle(.glass)
      .buttonBorderShape(.circle)
      .accessibilityLabel("Clear goal")
      .accessibilityIdentifier("clearGoal")
    }
    .accessibilityIdentifier("goalLine")
  }

  private func replyStrip(_ reply: ReplyTarget) -> some View {
    HStack(spacing: 8) {
      Rectangle().fill(Color.token(.mutedForeground)).frame(width: 2)
      VStack(alignment: .leading, spacing: 2) {
        Text("Replying to \(reply.author)").font(.caption.weight(.semibold))
        Text(reply.quote).font(.footnote).lineLimit(1)
          .foregroundStyle(Color.token(.mutedForeground))
      }
      Spacer(minLength: 0)
      Button { composer.reply = nil } label: {
        Image(systemName: "xmark").frame(width: 44, height: 44)
      }
      .accessibilityLabel("Cancel reply")
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.horizontal, 12)
    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 20))
    .accessibilityIdentifier("replyStrip")
  }

  private var chips: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(composer.attachments, id: \.id) { file in
          HStack(spacing: 6) {
            Image(systemName: file.mimeType.hasPrefix("image/") ? "photo" : "doc")
            Text(file.name).font(.footnote).lineLimit(1).frame(maxWidth: 140)
            Button {
              composer.attachments.removeAll { $0.id == file.id }
            } label: {
              Image(systemName: "xmark.circle.fill")
                .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Remove \(file.name)")
          }
          .padding(.leading, 12)
          .background(Color.token(.muted), in: Capsule())
        }
      }
    }
    .accessibilityIdentifier("attachmentChips")
  }

  // MARK: Loading picked files

  private func load(_ items: [PhotosPickerItem]) async {
    for item in items.prefix(composer.slotsLeft) {
      guard let data = try? await item.loadTransferable(type: Data.self) else {
        composer.notice = "That photo couldn’t be loaded."
        continue
      }
      let type = item.supportedContentTypes.first { $0.conforms(to: .image) }
      let ext = type?.preferredFilenameExtension ?? "jpg"
      composer.add(data: data, name: "Photo.\(ext)", type: type)
    }
  }

  private func importFile(_ url: URL) {
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    guard let data = try? Data(contentsOf: url) else {
      composer.notice = "\(url.lastPathComponent) couldn’t be read."
      return
    }
    composer.add(
      data: data, name: url.lastPathComponent, type: UTType(filenameExtension: url.pathExtension))
  }
}
