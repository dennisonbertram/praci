import PhotosUI
import RakazoAPI
import RakazoUI
import SwiftUI
import UniformTypeIdentifiers

struct DataRoomScreen: View {
  var source: String? = nil
  var body: some View {
    DataRoomListView(folder: nil, source: source)
  }
}

/// A picked photo, copied from the photo library to a temporary file so it can be streamed.
struct PickedFile: Transferable {
  let url: URL

  static var transferRepresentation: some TransferRepresentation {
    FileRepresentation(importedContentType: .item) { received in
      PickedFile(url: try DataRoomFiles.copyToTemporary(received.file))
    }
  }
}

enum DataRoomFiles {
  private static var protection: [FileAttributeKey: Any] {
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
  }

  /// A fresh, unguessable folder with file protection, so a name from outside never picks the path.
  static func newTemporaryFolder(prefix: String) throws -> URL {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(
      "\(prefix)-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(
      at: folder, withIntermediateDirectories: true, attributes: protection)
    return folder
  }

  /// Keeps only a plain file name: no separators, no traversal, never empty.
  static func safeName(_ name: String) -> String {
    let cleaned = name.replacingOccurrences(of: "\\", with: "/")
      .split(separator: "/").last.map(String.init) ?? ""
    let plain = String(cleaned.unicodeScalars.filter { $0.value >= 32 && $0 != ":" })
      .trimmingCharacters(in: .whitespaces)
    return plain.isEmpty || plain.allSatisfy({ $0 == "." }) ? "file" : String(plain.prefix(200))
  }

  static func copyToTemporary(_ source: URL) throws -> URL {
    let folder = try newTemporaryFolder(prefix: "dataroom-upload")
    let destination = folder.appendingPathComponent(safeName(source.lastPathComponent))
    try FileManager.default.copyItem(at: source, to: destination)
    try? FileManager.default.setAttributes(protection, ofItemAtPath: destination.path)
    return destination
  }

  /// Removes a temporary file together with its private folder.
  static func discard(_ file: URL) {
    try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
  }
}

struct DataRoomListView: View {
  let folder: DataRoomFolder?
  let source: String?
  @Environment(AppModel.self) private var app
  @State private var model: DataRoomModel
  @State private var showingImporter = false
  @State private var showingPhotos = false
  @State private var photos: [PhotosPickerItem] = []
  @State private var showingNewFolder = false
  @State private var newFolderName = ""
  @State private var itemToDelete: DataRoomItem?
  @State private var folderToDelete: DataRoomFolder?
  @State private var importTask: Task<Void, Never>?

  init(folder: DataRoomFolder?, source: String? = nil) {
    self.folder = folder
    self.source = source
    _model = State(initialValue: DataRoomModel(folder: folder, source: source))
  }

  var body: some View {
    pickers(core)
      .alert("New folder", isPresented: $showingNewFolder) {
        TextField("Name", text: $newFolderName).accessibilityIdentifier("newFolderName")
        Button("Cancel", role: .cancel) { newFolderName = "" }
        Button("Create") {
          let name = newFolderName
          newFolderName = ""
          Task { await model.createFolder(named: name, app) }
        }
        .accessibilityIdentifier("createFolder")
      }
      .modifier(DeleteDialogs(model: model, itemToDelete: $itemToDelete, folderToDelete: $folderToDelete))
      .modifier(DataRoomAlerts(model: model))
  }

  private func pickers(_ view: some View) -> some View {
    view
      .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.item], allowsMultipleSelection: true) {
        importFiles($0)
      }
      .photosPicker(isPresented: $showingPhotos, selection: $photos, matching: .any(of: [.images, .videos]))
      .onChange(of: photos) { importPhotos() }
      .onChange(of: app.authentication.isSignedIn) { endTransfers() }
      .onChange(of: app.userID) { endTransfers() }
      .onChange(of: app.spaceID) { endTransfers() }
      .onDisappear { if !app.authentication.isSignedIn { endTransfers() } }
  }

  private var core: some View {
    LoadableView(
      state: model.state, retry: { Task { await model.load(app) } },
      content: { _ in content })
    .background(Color.token(.background))
    .navigationTitle(folder?.name ?? (source == "scan" ? "Scanner" : "Data room"))
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $model.query, prompt: "Search")
    .task { await model.load(app) }
    .task(id: "\(app.userID ?? ""):\(app.spaceID ?? "")") {
      if source == "scan" {
        let _: BotSummary? = try? await app.call("scanner/agent")
      }
    }
    .task(id: model.hasProcessing) { await model.pollWhileReading(app) }
    .task(id: model.query) {
      guard model.isSearching else { return model.results = nil }
      try? await Task.sleep(for: .milliseconds(300))
      guard !Task.isCancelled else { return }
      await model.search(app)
    }
    .onChange(of: model.failedOnly) {
      Task {
        await model.load(app)
        await model.search(app)
      }
    }
    .toolbar { toolbar }
  }

  @ViewBuilder
  private var content: some View {
    if model.isSearching {
      searchList
    } else {
      browseList
    }
  }

  private var isEmpty: Bool {
    model.items.isEmpty && model.subfolders.isEmpty && model.uploads.isEmpty
  }

  private var browseList: some View {
    List {
      if model.hasProcessing, let needed = model.consentNeeded {
        Section {
          Button("Allow AI to read files") { model.consent = needed }
            .accessibilityIdentifier("dataRoomAllowReading")
        } footer: {
          Text("Files wait to be read until you allow it.")
        }
      }
      if !model.uploads.isEmpty {
        Section("Uploading") {
          ForEach(model.uploads) { upload in
            DataRoomUploadRow(
              upload: upload, retry: { model.retry(upload.id, app) },
              cancel: { model.cancelUpload(upload.id) })
          }
        }
      }
      if !model.subfolders.isEmpty {
        Section("Folders") {
          ForEach(model.subfolders) { sub in
            NavigationLink { DataRoomListView(folder: sub, source: source) } label: { DataRoomFolderRow(folder: sub) }
              .swipeActions { deleteButton { folderToDelete = sub } }
          }
        }
      }
      if !model.items.isEmpty {
        Section(folder == nil && !model.failedOnly ? "Recently added" : "Files") {
          ForEach(model.items) { item in
            NavigationLink { DataRoomItemScreen(item: item) } label: { DataRoomItemRow(item: item) }
              .swipeActions { deleteButton { itemToDelete = item } }
              .task {
                if item.id == model.items.last?.id { await model.loadMore(app) }
              }
          }
        }
      }
    }
    .listStyle(.insetGrouped)
    .refreshable { await model.load(app) }
    .overlay {
      if isEmpty { emptyState }
    }
  }

  @ViewBuilder
  private var emptyState: some View {
    if model.failedOnly {
      ContentUnavailableView("No failed files", systemImage: "checkmark.circle")
    } else if source == "scan" {
      ContentUnavailableView("No scans yet", systemImage: "scanner")
    } else {
      ContentUnavailableView {
        Label("No files yet", systemImage: "tray")
      } actions: {
        PrimaryActionButton("Add files") { showingImporter = true }
          .accessibilityIdentifier("addFiles")
      }
    }
  }

  private var searchList: some View {
    List {
      if let results = model.results {
        Section(results.count == 1 ? "1 result" : "\(results.count) results") {
          ForEach(results) { hit in
            NavigationLink {
              DataRoomItemScreen(item: hit.item)
            } label: {
              DataRoomItemRow(item: hit.item, snippet: hit.snippet)
            }
              .swipeActions { deleteButton { itemToDelete = hit.item } }
              .task {
                if hit.id == results.last?.id { await model.loadMoreResults(app) }
              }
          }
        }
      }
    }
    .listStyle(.insetGrouped)
    .overlay {
      if let results = model.results, results.isEmpty {
        ContentUnavailableView.search(text: model.query)
      } else if model.results == nil {
        ProgressView()
      }
    }
  }

  private func deleteButton(_ action: @escaping () -> Void) -> some View {
    // Not `role: .destructive`: that collapses the row at once, but the row only goes after the
    // confirmation and the server call, and the list crashes on the mismatch.
    Button(action: action) { Label("Delete", systemImage: "trash") }
      .tint(Color.token(.destructive))
      .accessibilityIdentifier("deleteRow")
  }

  @ToolbarContentBuilder
  private var toolbar: some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
      Menu {
        Toggle(isOn: $model.failedOnly) { Label("Failed files", systemImage: "exclamationmark.triangle") }
      } label: {
        Label(
          "Filter",
          systemImage: model.failedOnly
            ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
      }
      .accessibilityIdentifier("dataRoomFilter")
    }
    if source == "scan" {
      ToolbarItem(placement: .primaryAction) {
        AskAgentButton(title: "Ask Scanner agent", action: {
          let user = app.userID
          let space = app.spaceID
          Task {
            do {
              let bot: BotSummary = try await app.call("scanner/agent")
              if user == app.userID && space == app.spaceID { app.open(.thread(.bot(bot.id))) }
            } catch {
              if user == app.userID && space == app.spaceID { model.errorMessage = settingsErrorText(error) }
            }
          }
        }, accessibilityIdentifier: nil)
      }
    } else { ToolbarItem(placement: .topBarTrailing) {
      Menu {
        Button { showingImporter = true } label: { Label("Files", systemImage: "folder") }
          .accessibilityIdentifier("addFromFiles")
        Button { showingPhotos = true } label: { Label("Photos", systemImage: "photo") }
          .accessibilityIdentifier("addFromPhotos")
        Button { showingNewFolder = true } label: { Label("New folder", systemImage: "folder.badge.plus") }
          .accessibilityIdentifier("newFolder")
      } label: {
        Label("Add", systemImage: "plus")
      }
      .accessibilityIdentifier("dataRoomAdd")
    } }
  }

  /// Stops picks that are still loading and discards uploads of the previous account.
  private func endTransfers() {
    importTask?.cancel()
    importTask = nil
    model.cancelAllUploads()
  }

  private func importFiles(_ result: Result<[URL], any Error>) {
    switch result {
    case .failure(let error):
      model.errorMessage = error.localizedDescription
    case .success(let urls):
      importTask?.cancel()
      importTask = Task {
        // The scope is taken before any copy, so the files can only go to the account that picked them.
        guard let scope = await DataRoomScope.capture(app) else { return }
        var files: [(url: URL, name: String)] = []
        for url in urls {
          let scoped = url.startAccessingSecurityScopedResource()
          defer { if scoped { url.stopAccessingSecurityScopedResource() } }
          if let copy = try? DataRoomFiles.copyToTemporary(url) {
            files.append((copy, copy.lastPathComponent))
          } else {
            model.errorMessage = "Couldn’t read \(url.lastPathComponent)."
          }
        }
        await finishImport(files, scope)
      }
    }
  }

  private func importPhotos() {
    let picked = photos
    photos = []
    guard !picked.isEmpty else { return }
    importTask?.cancel()
    importTask = Task {
      guard let scope = await DataRoomScope.capture(app) else { return }
      var files: [(url: URL, name: String)] = []
      for photo in picked {
        if let file = try? await photo.loadTransferable(type: PickedFile.self) {
          files.append((file.url, file.url.lastPathComponent))
        } else if !Task.isCancelled {
          model.errorMessage = "Couldn’t read that photo."
        }
      }
      await finishImport(files, scope)
    }
  }

  /// Uploads the picks only if the session is still the one they were picked in.
  private func finishImport(_ files: [(url: URL, name: String)], _ scope: DataRoomScope) async {
    guard !Task.isCancelled, await DataRoomScope.capture(app) == scope else {
      files.forEach { DataRoomFiles.discard($0.url) }
      return
    }
    model.upload(files, scope: scope, app)
  }
}

private struct DeleteDialogs: ViewModifier {
  let model: DataRoomModel
  @Binding var itemToDelete: DataRoomItem?
  @Binding var folderToDelete: DataRoomFolder?
  @Environment(AppModel.self) private var app

  func body(content: Content) -> some View {
    content
      .confirmationDialog(
        "Delete this file?",
        isPresented: Binding(get: { itemToDelete != nil }, set: { if !$0 { itemToDelete = nil } }),
        titleVisibility: .visible, presenting: itemToDelete
      ) { item in
        Button("Delete \(item.name)", role: .destructive) { Task { await model.delete(item, app) } }
      }
      .confirmationDialog(
        "Delete this folder?",
        isPresented: Binding(get: { folderToDelete != nil }, set: { if !$0 { folderToDelete = nil } }),
        titleVisibility: .visible, presenting: folderToDelete
      ) { target in
        Button("Delete \(target.name)", role: .destructive) { Task { await model.deleteFolder(target, app) } }
      }
  }
}

private struct DataRoomAlerts: ViewModifier {
  @Bindable var model: DataRoomModel
  @Environment(AppModel.self) private var app

  func body(content: Content) -> some View {
    content
      .actionErrorAlert("Data room", message: Binding(
        get: { model.errorMessage }, set: { model.errorMessage = $0 }), cancelButton: true)
      .alert(
        "Data room",
        isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } })
      ) {
        Button("OK", role: .cancel) {}
      } message: {
        Text(model.notice ?? "")
      }
      .sheet(isPresented: Binding(get: { model.consent != nil }, set: { if !$0 { model.consent = nil } })) {
        if let consent = model.consent {
          DataRoomConsentSheet(
            consent: consent, allow: { Task { await model.grantConsent(app) } },
            dismiss: { model.consent = nil })
        }
      }
  }
}
