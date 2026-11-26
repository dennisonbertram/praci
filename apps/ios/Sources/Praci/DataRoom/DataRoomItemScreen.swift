import QuickLook
import RakazoAPI
import SwiftUI

struct DataRoomItemScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var item: DataRoomItem
  @State private var thumbnail: UIImage?
  @State private var preview: URL?
  @State private var opening = false
  @State private var confirmDelete = false
  @State private var errorMessage: String?
  @State private var consentStatus: DataRoomConsent?
  @State private var consent: DataRoomConsent?

  init(item: DataRoomItem) { _item = State(initialValue: item) }

  var body: some View {
    List {
      if let thumbnail {
        Section {
          Image(uiImage: thumbnail)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity, maxHeight: 280)
            .accessibilityHidden(true)
            .listRowInsets(EdgeInsets())
        }
      }
      Section {
        Button {
          Task { await open() }
        } label: {
          HStack {
            Label("Open", systemImage: "arrow.up.forward.app")
            if opening { Spacer(); ProgressView() }
          }
        }
        .disabled(opening)
        .accessibilityIdentifier("openFile")
      }
      Section {
        if item.isFailed {
          Label(item.error ?? "Couldn’t read this file", systemImage: "exclamationmark.triangle")
            .foregroundStyle(Color.token(.destructive))
        } else if item.isProcessing {
          Label("Reading…", systemImage: "hourglass")
        }
        if DataRoomItemActions.needsConsent(isProcessing: item.isProcessing, consentAllowed: consentStatus?.allowed) {
          Button("Allow AI to read files") { consent = consentStatus }
            .accessibilityIdentifier("dataRoomAllowReading")
        }
        if DataRoomItemActions.showsRetry(
          isFailed: item.isFailed, isProcessing: item.isProcessing, consentAllowed: consentStatus?.allowed)
        {
          Button("Try again") { Task { await retry() } }.accessibilityIdentifier("retryFile")
        }
        LabeledContent("Type", value: DataRoomFormat.kind(item))
        LabeledContent("Size", value: Int64(item.size).formatted(.byteCount(style: .file)))
        if let date = InboxRow.parseDate(item.createdAt) {
          LabeledContent("Added", value: date.formatted(date: .abbreviated, time: .omitted))
        }
        if let docType = item.docType { LabeledContent("Document", value: docType.capitalized) }
        if item.notIndexed { Text("Too large to search inside.").foregroundStyle(Color.token(.mutedForeground)) }
      }
      if let text = item.previewText, !text.isEmpty {
        Section("Preview") {
          Text(text.split(whereSeparator: \.isWhitespace).joined(separator: " "))
            .font(.footnote)
        }
      }
    }
    .background(Color.token(.background))
    .navigationTitle(item.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
          .accessibilityIdentifier("deleteFile")
      }
    }
    .quickLookPreview($preview)
    .sheet(isPresented: Binding(get: { consent != nil }, set: { if !$0 { consent = nil } })) {
      if let consent {
        DataRoomConsentSheet(
          consent: consent, allow: { Task { await grantConsent() } },
          dismiss: { self.consent = nil })
      }
    }
    .onDisappear {
      if let preview { DataRoomFiles.discard(preview) }
      preview = nil
    }
    .confirmationDialog("Delete this file?", isPresented: $confirmDelete, titleVisibility: .visible) {
      Button("Delete", role: .destructive) { Task { await delete() } }
    }
    .alert("Data room", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(errorMessage ?? "")
    }
    .task {
      if item.isProcessing {
        consentStatus = try? await app.call("dataRoom/consent")
      }
      if let fresh: DataRoomItem = try? await app.call("dataRoom/item", input: DataRoomIDInput(id: item.id)) {
        item = fresh
      }
      if item.hasThumbnail, let data = try? await DataRoomTransfer(app: app).thumbnail(for: item.id) {
        thumbnail = UIImage(data: data)
      }
    }
    .task(id: item.status) {
      while item.isProcessing, !Task.isCancelled {
        try? await Task.sleep(for: .seconds(4))
        if let fresh: DataRoomItem = try? await app.call("dataRoom/item", input: DataRoomIDInput(id: item.id)) {
          item = fresh
        }
      }
    }
  }

  private func grantConsent() async {
    guard let pending = consent else { return }
    do {
      let _: DataRoomConsent = try await app.call(
        "dataRoom/consentGrant",
        input: DataRoomConsentGrantInput(
          key: pending.key, version: pending.version, spaceId: pending.spaceId))
      consent = nil
      consentStatus = nil
      if let fresh: DataRoomItem = try? await app.call("dataRoom/item", input: DataRoomIDInput(id: item.id)) {
        item = fresh
      }
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  private func open() async {
    opening = true
    defer { opening = false }
    do {
      preview = try await DataRoomTransfer(app: app).download(item)
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  /// Starts a failed or stuck file over; the server refuses one that is still being read.
  private func retry() async {
    do {
      item = try await app.call("dataRoom/itemRetry", input: DataRoomIDInput(id: item.id))
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  private func delete() async {
    do {
      let _: DataRoomOK = try await app.call("dataRoom/itemDelete", input: DataRoomIDInput(id: item.id))
      dismiss()
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }
}

enum DataRoomItemActions {
  static func needsConsent(isProcessing: Bool, consentAllowed: Bool?) -> Bool {
    isProcessing && consentAllowed == false
  }

  static func showsRetry(isFailed: Bool, isProcessing: Bool, consentAllowed: Bool?) -> Bool {
    isFailed || (isProcessing && consentAllowed != false)
  }
}

/// Opens a Data room file from its id, such as from a link an agent wrote.
struct DataRoomItemLoader: View {
  let itemID: String
  @Environment(AppModel.self) private var app
  @State private var state: Loadable<DataRoomItem> = .idle

  var body: some View {
    LoadableView(state: state, retry: { Task { await load() } }, content: { item in
      DataRoomItemScreen(item: item)
    })
    .task { await load() }
  }

  private func load() async {
    state = .loading
    do {
      state = .loaded(try await app.call("dataRoom/item", input: DataRoomIDInput(id: itemID)))
    } catch {
      state = .failed(error.localizedDescription)
    }
  }
}
