import RakazoAPI
import RakazoUI
import SwiftUI

/// New message, Reply, Reply all and Forward. Both ids nil is a new message.
struct ComposeSheet: View {
  let replyTo: String?
  let forward: String?
  var replyAll = false
  var onSent: (() -> Void)?
  var onSaved: (() -> Void)?
  @Environment(AppModel.self) private var app

  init(replyTo: String?, forward: String?, replyAll: Bool = false, onSent: (() -> Void)? = nil,
    onSaved: (() -> Void)? = nil
  ) {
    self.replyTo = replyTo
    self.forward = forward
    self.replyAll = replyAll
    self.onSent = onSent
    self.onSaved = onSaved
  }

  var body: some View {
    ComposeContent(app: app, mode: mode, onSent: onSent, onSaved: onSaved)
  }

  private var mode: ComposeMode {
    if let forward { return .forward(forward) }
    if let replyTo { return replyAll ? .replyAll(replyTo) : .reply(replyTo) }
    return .new
  }
}

private struct ComposeContent: View {
  @State private var model: ComposeModel
  let onSent: (() -> Void)?
  let onSaved: (() -> Void)?
  @State private var showsQuote = false
  @State private var asking = false
  @Environment(\.dismiss) private var dismiss
  @Environment(\.dynamicTypeSize) private var typeSize
  @FocusState private var focus: Field?

  // swiftlint:disable:next identifier_name
  private enum Field { case to, cc, bcc, subject, body }

  init(app: AppModel, mode: ComposeMode, onSent: (() -> Void)?, onSaved: (() -> Void)?) {
    _model = State(initialValue: ComposeModel(mode: mode, client: .live(app)))
    self.onSent = onSent
    self.onSaved = onSaved
  }

  var body: some View {
    NavigationStack {
      LoadableView(state: model.state, retry: { Task { await model.load() } }, content: { _ in
        form
      })
      .background(Color.token(.background))
      .navigationTitle(model.title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { cancel() }.accessibilityIdentifier("composeCancel")
        }
        ToolbarItem(placement: .confirmationAction) {
          if model.isSending {
            ProgressView()
          } else {
            Button { Task { await send() } } label: { Label("Send", systemImage: "paperplane.fill") }
              .disabled(!model.canSend)
              .accessibilityIdentifier("composeSend")
          }
        }
      }
    }
    .interactiveDismissDisabled(model.hasChanges || model.isSending)
    .confirmationDialog("This draft has changes", isPresented: $asking, titleVisibility: .visible) {
      Button("Save draft") { Task { if await model.saveDraft() { onSaved?(); dismiss() } } }
        .accessibilityIdentifier("composeSaveDraft")
      Button("Discard draft", role: .destructive) { Task { await model.discard(); dismiss() } }
        .accessibilityIdentifier("composeDiscard")
      Button("Keep editing", role: .cancel) {}
    }
    .task { await model.load() }
  }

  private var form: some View {
    Form {
      if let banner = model.banner { Section { BannerView(banner: banner, close: close) } }
      Section {
        if model.accounts.count > 1 {
          Picker("From", selection: $model.connectionID) {
            ForEach(model.accounts) {
              Text($0.address ?? $0.label).lineLimit(1).truncationMode(.tail).tag($0.connectionId)
            }
          }
          .lineLimit(1)
        } else {
          LabeledContent("From") {
            Text(model.account?.address ?? model.account?.label ?? "")
              .lineLimit(1).truncationMode(.tail)
              .foregroundStyle(Color.token(.mutedForeground))
          }
        }
        recipient("To", text: $model.to, field: .to, invalid: model.toError)
        if model.showsCcBcc {
          recipient("Cc", text: $model.cc, field: .cc, invalid: !MailAddresses.invalid(in: model.cc).isEmpty)
          recipient("Bcc", text: $model.bcc, field: .bcc, invalid: !MailAddresses.invalid(in: model.bcc).isEmpty)
        } else {
          Button("Cc, Bcc") { model.showsCcBcc = true; focus = .cc }
            .foregroundStyle(Color.token(.mutedForeground))
            .accessibilityIdentifier("composeShowCc")
        }
        HStack {
          Text("Subject").foregroundStyle(Color.token(.mutedForeground))
          TextField("", text: $model.subject)
            .focused($focus, equals: .subject)
            .accessibilityIdentifier("composeSubject")
        }
      }
      if !model.attachments.isEmpty {
        Section {
          ForEach(model.attachments) { attachment in
            HStack {
              Image(systemName: "paperclip").foregroundStyle(Color.token(.mutedForeground))
              Text(attachment.filename).lineLimit(1)
              Spacer()
              Text(Int64(attachment.size), format: .byteCount(style: .file))
                .font(.caption).foregroundStyle(Color.token(.mutedForeground))
              Button { model.removeAttachment(attachment.id) } label: {
                Label("Remove", systemImage: "xmark.circle.fill").labelStyle(.iconOnly)
              }
              .buttonStyle(.plain)
            }
          }
        }
      }
      Section {
        TextEditor(text: $model.body)
          .focused($focus, equals: .body)
          .frame(minHeight: model.quote.isEmpty && !typeSize.isAccessibilitySize ? 220 : 120)
          .accessibilityIdentifier("composeBody")
        if !model.quote.isEmpty {
          Button { showsQuote.toggle() } label: {
            Text("…").foregroundStyle(Color.token(.mutedForeground))
          }
          .buttonStyle(.plain)
          .accessibilityLabel(showsQuote ? "Hide quoted text" : "Show quoted text")
          .accessibilityIdentifier("composeQuoteToggle")
          if showsQuote {
            Text(verbatim: model.quote)
              .font(.subheadline)
              .foregroundStyle(Color.token(.mutedForeground))
              .textSelection(.enabled)
          }
        }
      }
    }
    .scrollDismissesKeyboard(.interactively)
    .task {
      // A reply or forward opens ready to type; a new message starts at To.
      try? await Task.sleep(for: .milliseconds(300))
      focus = model.mode == .new ? .to : .body
    }
  }

  private func recipient(_ title: LocalizedStringKey, text: Binding<String>, field: Field, invalid: Bool) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        Text(title).foregroundStyle(Color.token(.mutedForeground))
        TextField("", text: text)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .focused($focus, equals: field)
          .accessibilityIdentifier(field == .to ? "composeTo" : field == .cc ? "composeCc" : "composeBcc")
      }
      if invalid {
        Text("Not a valid address")
          .font(.caption)
          .foregroundStyle(Color.token(.destructive))
      }
    }
  }

  private func cancel() {
    if model.sent || !model.hasChanges {
      Task { await model.discard(); dismiss() }
    } else {
      asking = true
    }
  }

  private func close() { dismiss() }

  private func send() async {
    focus = nil
    if await model.send() {
      onSent?()
      dismiss()
    }
  }
}

private struct BannerView: View {
  let banner: ComposeModel.Banner
  let close: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      switch banner {
      case .notSent(let text), .error(let text):
        Text(verbatim: text)
      case .unknown:
        Text("We couldn’t confirm this sent. Check Sent before sending again.")
        Button("Close", action: close)
      case .reconnect:
        Text("Gmail needs to reconnect before it can send. Reconnect it in Settings.")
      case .disabled(let account):
        Text("Mail writes are off for \(account).")
      }
    }
    .font(.subheadline)
    .foregroundStyle(Color.token(.foreground))
    .accessibilityIdentifier("composeBanner")
  }
}
