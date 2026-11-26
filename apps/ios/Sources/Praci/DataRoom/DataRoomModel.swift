import Foundation
import Observation
import RakazoAPI
import RakazoCore
import SwiftUI
import UniformTypeIdentifiers

/// One folder level of the data room (the root when `folder` is nil).
@MainActor
@Observable
final class DataRoomModel {
  struct Upload: Identifiable {
    let id = UUID()
    let file: URL
    let name: String
    let scope: DataRoomScope
    var fraction = 0.0
    var failure: String?
  }

  let folder: DataRoomFolder?
  let source: String?
  var state: Loadable<Void> = .idle
  var subfolders: [DataRoomFolder] = []
  var items: [DataRoomItem] = []
  var nextCursor: String?
  var failedOnly = false
  var query = ""
  var results: [DataRoomSearchHit]?
  var resultsCursor: String?
  var uploads: [Upload] = []
  /// The consent sheet, shown on demand.
  var consent: DataRoomConsent?
  /// Set while the space has not allowed AI to read files; reading waits for it.
  var consentNeeded: DataRoomConsent?
  var notice: String?
  var errorMessage: String?
  @ObservationIgnored private var consentAsked = false
  @ObservationIgnored private var uploadTasks: [UUID: Task<Void, Never>] = [:]

  init(folder: DataRoomFolder?, source: String? = nil) { self.folder = folder; self.source = source }

  var isSearching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

  var hasProcessing: Bool { items.contains { $0.isProcessing } }

  /// Re-reads each file that is still being read every few seconds, in place, so loaded pages and
  /// the scroll position stay as they are. Errors stay quiet.
  func pollWhileReading(_ app: AppModel) async {
    while hasProcessing, !Task.isCancelled {
      try? await Task.sleep(for: .seconds(4))
      if Task.isCancelled { return }
      for id in items.filter(\.isProcessing).prefix(20).map(\.id) {
        guard let fresh: DataRoomItem = try? await app.call("dataRoom/item", input: DataRoomIDInput(id: id)),
          let index = items.firstIndex(where: { $0.id == id })
        else { continue }
        items[index] = fresh
      }
    }
  }

  func load(_ app: AppModel, quiet: Bool = false) async {
    if case .loaded = state {} else { state = .loading }
    do {
      let folders: [DataRoomFolder] = try await app.call("dataRoom/folders")
      let page: DataRoomItemsPage = try await app.call(
        "dataRoom/items/list",
        input: DataRoomItemsListInput(
          folderId: folder?.id, source: source, status: failedOnly ? "failed" : nil))
      subfolders = failedOnly || source == "scan" ? [] : folders.filter { $0.parentId == folder?.id }
      items = page.items
      nextCursor = page.nextCursor
      state = .loaded(())
    } catch {
      if case .loaded = state { if !quiet { errorMessage = settingsErrorText(error) } } else {
        state = .failed(settingsErrorText(error))
      }
    }
    await askConsentOnce(app)
  }

  func loadMore(_ app: AppModel) async {
    guard let cursor = nextCursor else { return }
    nextCursor = nil
    do {
      let page: DataRoomItemsPage = try await app.call(
        "dataRoom/items/list",
        input: DataRoomItemsListInput(
          folderId: folder?.id, source: source, status: failedOnly ? "failed" : nil, cursor: cursor))
      items += page.items.filter { new in !items.contains { $0.id == new.id } }
      nextCursor = page.nextCursor
    } catch {
      nextCursor = cursor
      errorMessage = settingsErrorText(error)
    }
  }

  func search(_ app: AppModel) async {
    let text = query.trimmingCharacters(in: .whitespaces)
    guard !text.isEmpty else {
      results = nil
      return
    }
    do {
      let page: DataRoomSearchPage = try await app.call(
        "dataRoom/search",
        input: DataRoomSearchInput(
          query: text,
          filters: DataRoomSearchInput.Filters(
            folderId: folder?.id, source: source, status: failedOnly ? "failed" : nil)))
      results = page.results
      resultsCursor = page.nextCursor
    } catch is CancellationError {
    } catch {
      results = []
      errorMessage = settingsErrorText(error)
    }
  }

  func loadMoreResults(_ app: AppModel) async {
    guard let cursor = resultsCursor, isSearching else { return }
    resultsCursor = nil
    do {
      let page: DataRoomSearchPage = try await app.call(
        "dataRoom/search",
        input: DataRoomSearchInput(
          query: query.trimmingCharacters(in: .whitespaces),
          filters: DataRoomSearchInput.Filters(
            folderId: folder?.id, source: source, status: failedOnly ? "failed" : nil),
          cursor: cursor))
      results = (results ?? []) + page.results
      resultsCursor = page.nextCursor
    } catch {
      resultsCursor = cursor
      errorMessage = settingsErrorText(error)
    }
  }

  func delete(_ item: DataRoomItem, _ app: AppModel) async {
    do {
      let _: DataRoomOK = try await app.call("dataRoom/itemDelete", input: DataRoomIDInput(id: item.id))
      withAnimation {
        items.removeAll { $0.id == item.id }
        results?.removeAll { $0.item.id == item.id }
      }
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  func deleteFolder(_ target: DataRoomFolder, _ app: AppModel) async {
    do {
      let _: DataRoomOK = try await app.call(
        "dataRoom/folderDelete", input: DataRoomIDInput(id: target.id))
      withAnimation { subfolders.removeAll { $0.id == target.id } }
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  func createFolder(named name: String, _ app: AppModel) async {
    let trimmed = name.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else { return }
    do {
      let created: DataRoomFolder = try await app.call(
        "dataRoom/folderCreate", input: DataRoomFolderCreateInput(name: trimmed, parentId: folder?.id))
      subfolders.append(
        DataRoomFolder(id: created.id, name: created.name, parentId: created.parentId, itemCount: 0))
      subfolders.sort { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  // MARK: Consent

  /// The server reads files only after AI consent. Check on every load, open the sheet once per
  /// screen when a file is waiting, and keep a banner for later.
  private func askConsentOnce(_ app: AppModel) async {
    guard let status: DataRoomConsent = try? await app.call("dataRoom/consent") else { return }
    consentNeeded = status.allowed ? nil : status
    if !status.allowed, hasProcessing, !consentAsked {
      consentAsked = true
      consent = status
    }
  }

  func grantConsent(_ app: AppModel) async {
    guard let pending = consent else { return }
    do {
      let _: DataRoomConsent = try await app.call(
        "dataRoom/consentGrant",
        input: DataRoomConsentGrantInput(
          key: pending.key, version: pending.version, spaceId: pending.spaceId))
      consent = nil
      consentNeeded = nil
      await load(app, quiet: true)
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  // MARK: Upload

  /// Copies picked files into the app's temporary folder, then uploads them one after another.
  func upload(_ files: [(url: URL, name: String)], scope: DataRoomScope, _ app: AppModel) {
    for file in files {
      let upload = Upload(file: file.url, name: file.name, scope: scope)
      uploads.append(upload)
      start(upload.id, app)
    }
  }

  func retry(_ id: UUID, _ app: AppModel) {
    guard let index = uploads.firstIndex(where: { $0.id == id }) else { return }
    uploads[index].failure = nil
    uploads[index].fraction = 0
    start(id, app)
  }

  func cancelUpload(_ id: UUID) {
    uploadTasks[id]?.cancel()
    uploadTasks[id] = nil
    removeUpload(id)
  }

  /// Cancels every upload and deletes its temporary file, when the session ends or changes.
  func cancelAllUploads() {
    uploadTasks.values.forEach { $0.cancel() }
    uploadTasks = [:]
    uploads.forEach { DataRoomFiles.discard($0.file) }
    uploads = []
  }

  private func removeUpload(_ id: UUID) {
    if let upload = uploads.first(where: { $0.id == id }) {
      DataRoomFiles.discard(upload.file)
    }
    uploads.removeAll { $0.id == id }
  }

  private func start(_ id: UUID, _ app: AppModel) {
    guard let upload = uploads.first(where: { $0.id == id }) else { return }
    let mime = UTType(filenameExtension: upload.file.pathExtension)?.preferredMIMEType
      ?? "application/octet-stream"
    let folderID = folder?.id
    uploadTasks[id] = Task { [weak self] in
      do {
        let result = try await DataRoomTransfer(app: app).upload(
          file: upload.file, name: upload.name, mimeType: mime, folderID: folderID,
          scope: upload.scope, progress: { fraction in
            Task { @MainActor in self?.setProgress(id, fraction) }
          })
        guard let self else { return }
        uploadTasks[id] = nil
        removeUpload(id)
        if result.importId != nil {
          notice = "Unpacking \(upload.name) in the background."
        } else if result.duplicate {
          notice = "\(upload.name) is already in the data room."
        }
        await load(app)
      } catch DataRoomTransferError.scopeChanged {
        self?.removeUpload(id)
        self?.uploadTasks[id] = nil
      } catch is CancellationError {
      } catch let error as URLError where error.code == .cancelled {
      } catch {
        self?.uploadFailed(id, settingsErrorText(error))
      }
    }
  }

  private func setProgress(_ id: UUID, _ fraction: Double) {
    if let index = uploads.firstIndex(where: { $0.id == id }) { uploads[index].fraction = fraction }
  }

  private func uploadFailed(_ id: UUID, _ message: String) {
    uploadTasks[id] = nil
    if let index = uploads.firstIndex(where: { $0.id == id }) { uploads[index].failure = message }
  }
}
