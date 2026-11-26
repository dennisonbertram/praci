import Foundation
import Observation
import RakazoAPI

extension Notification.Name {
  static let contactsDidChange = Notification.Name("contactsDidChange")
}

private struct ContactIDInput: Encodable, Sendable {
  let id: String
}

private struct ContactDeleteResponse: Decodable, Sendable {
  let ok: Bool
}

@MainActor
enum ContactsClient {
  static func save(_ input: ContactSaveInput, app: AppModel) async throws -> Contact {
    let saved: Contact = try await app.call("contacts/save", input: input)
    NotificationCenter.default.post(name: .contactsDidChange, object: saved.id)
    return saved
  }

  static func linked(_ contact: Contact, app: AppModel) async throws -> ContactLinked {
    try await app.call("contacts/linked", input: ContactIDInput(id: contact.id))
  }

  static func delete(_ contact: Contact, app: AppModel) async throws {
    let result: ContactDeleteResponse = try await app.call(
      "contacts/delete", input: ContactIDInput(id: contact.id))
    guard result.ok else { throw ContactDeletionError.notDeleted }
    NotificationCenter.default.post(name: .contactsDidChange, object: contact.id)
  }
}

enum ContactDeletionError: Error {
  case notDeleted
}

struct ContactDeleteConfirmation: Identifiable {
  let contact: Contact
  let linked: ContactLinked

  var id: String { contact.id }
  var title: String { "Delete \(contact.name)?" }
  var message: String? {
    let removals = Self.removals(linked)
    return removals.isEmpty ? nil : "This also removes \(removals)."
  }

  private static func removals(_ linked: ContactLinked) -> String {
    var parts: [String] = []
    if linked.portal { parts.append("their portal access") }
    if !linked.documents.isEmpty {
      let count = linked.documents.count
      parts.append("access to \(count) shared document\(count == 1 ? "" : "s")")
    }
    if linked.safes > 0 {
      let count = linked.safes
      parts.append("the link\(count == 1 ? "" : "s") to \(count) SAFE\(count == 1 ? "" : "s")")
    }
    return parts.joined(separator: " and ")
  }
}

@MainActor
@Observable
final class ContactDeletionModel {
  var confirmation: ContactDeleteConfirmation?
  var error: String?
  private(set) var retryContact: Contact?
  private(set) var busy = false

  func request(_ contact: Contact, app: AppModel) async {
    guard !busy else { return }
    retryContact = contact
    busy = true
    error = nil
    defer { busy = false }
    do {
      let linked = try await ContactsClient.linked(contact, app: app)
      confirmation = ContactDeleteConfirmation(contact: contact, linked: linked)
      retryContact = contact
    } catch {
      self.error = error.localizedDescription
    }
  }

  /// Takes the contact from the tapped button: the dialog clears `confirmation` as it closes,
  /// before this task runs.
  func deleteConfirmed(_ contact: Contact, app: AppModel) async -> Bool {
    guard !busy else { return false }
    busy = true
    error = nil
    defer { busy = false }
    do {
      try await ContactsClient.delete(contact, app: app)
      self.confirmation = nil
      retryContact = nil
      return true
    } catch {
      self.error = error.localizedDescription
      retryContact = contact
      self.confirmation = nil
      return false
    }
  }
}

@MainActor
@Observable
final class ContactsModel {
  var state: Loadable<[Contact]> = .idle
  var query = ""
  var refreshError: String?

  @ObservationIgnored private var generation = 0
  @ObservationIgnored private var loadedSpaceID: String?
  @ObservationIgnored private var hasLoadedSpace = false

  var visibleContacts: [Contact] {
    (state.value ?? []).filter { $0.matchesSearch(query) }
  }

  func load(_ app: AppModel) async {
    if hasLoadedSpace, loadedSpaceID != app.spaceID {
      state = .idle
      refreshError = nil
    }
    loadedSpaceID = app.spaceID
    hasLoadedSpace = true
    generation += 1
    let request = generation
    if state.value == nil { state = .loading }
    do {
      let contacts: [Contact] = try await app.call("contacts/list")
      guard request == generation else { return }
      state = .loaded(contacts)
      refreshError = nil
    } catch {
      guard request == generation else { return }
      if state.value == nil {
        state = .failed(error.localizedDescription)
      } else {
        refreshError = error.localizedDescription
      }
    }
  }

}

private struct ContactDetailInput: Encodable, Sendable {
  let id: String
}

@MainActor
@Observable
final class ContactDetailModel {
  private(set) var contactID: String
  var state: Loadable<ContactDetail> = .idle
  var refreshError: String?

  @ObservationIgnored private var generation = 0
  @ObservationIgnored private var loadedSpaceID: String?
  @ObservationIgnored private var hasLoadedSpace = false

  init(contactID: String) { self.contactID = contactID }

  func updateContact(_ contact: Contact) {
    guard case .loaded(var detail) = state else { return }
    detail.contact = contact
    state = .loaded(detail)
  }

  func load(_ app: AppModel, contactID: String? = nil) async {
    var identityChanged = false
    if hasLoadedSpace, loadedSpaceID != app.spaceID {
      loadedSpaceID = app.spaceID
      hasLoadedSpace = true
      identityChanged = true
    } else if !hasLoadedSpace {
      loadedSpaceID = app.spaceID
      hasLoadedSpace = true
    }
    if let contactID, contactID != self.contactID {
      self.contactID = contactID
      identityChanged = true
    }
    if identityChanged {
      state = .idle
      refreshError = nil
    }
    let id = self.contactID
    generation += 1
    let request = generation
    if state.value == nil { state = .loading }
    do {
      let detail: ContactDetail = try await app.call(
        "contacts/detail", input: ContactDetailInput(id: id))
      guard request == generation else { return }
      state = .loaded(detail)
      refreshError = nil
    } catch {
      guard request == generation else { return }
      if state.value == nil {
        state = .failed(error.localizedDescription)
      } else {
        refreshError = error.localizedDescription
      }
    }
  }
}
