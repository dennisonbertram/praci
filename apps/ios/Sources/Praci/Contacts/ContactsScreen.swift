import RakazoAPI
import SwiftUI

struct ContactsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = ContactsModel()
  @State private var deletion = ContactDeletionModel()
  @State private var showingForm = false
  @State private var formContact: Contact?

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { contacts in
      if contacts.isEmpty && model.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        ContentUnavailableView("No contacts yet", systemImage: "person.2")
      } else if model.visibleContacts.isEmpty {
        ContentUnavailableView.search(text: model.query)
      } else {
        List {
          RefreshErrorSection(message: model.refreshError) { await model.load(app) }
          Section {
            ForEach(model.visibleContacts) { contact in
              NavigationLink(value: Route.contact(id: contact.id)) {
                ContactRow(contact: contact)
              }
              .accessibilityIdentifier("contactRow-\(contact.id)")
              .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button(role: .destructive) {
                  Task { await deletion.request(contact, app: app) }
                } label: {
                  Label("Delete", systemImage: "trash")
                }
                .disabled(deletion.busy)
              }
            }
          }
        }
        .listStyle(.plain)
      }
    })
    .navigationTitle("Contacts")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          formContact = nil
          showingForm = true
        } label: {
          Image(systemName: "plus")
        }
        .accessibilityLabel("Add contact")
      }
    }
    .searchable(text: $model.query, prompt: "Search contacts")
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .onReceive(NotificationCenter.default.publisher(for: .contactsDidChange)) { _ in
      Task { await model.load(app) }
    }
    .sheet(isPresented: $showingForm) {
      ContactForm(contact: formContact) { _ in }
    }
    .confirmationDialog(
      deletion.confirmation?.title ?? "",
      isPresented: Binding(
        get: { deletion.confirmation != nil },
        set: { if !$0 { deletion.confirmation = nil } }),
      // iPhone hides a confirmation's title and message by default; the message names what else goes.
      titleVisibility: .visible)
    {
      Button("Cancel", role: .cancel) { deletion.confirmation = nil }
      Button("Delete", role: .destructive) {
        guard let contact = deletion.confirmation?.contact else { return }
        Task { _ = await deletion.deleteConfirmed(contact, app: app) }
      }
      .disabled(deletion.busy)
    } message: {
      if let message = deletion.confirmation?.message { Text(message) }
    }
    .alert(
      "Could not delete contact",
      isPresented: Binding(
        get: { deletion.error != nil },
        set: { if !$0 { deletion.error = nil } }))
    {
      if let contact = deletion.retryContact {
        Button("Try again") { Task { await deletion.request(contact, app: app) } }
      }
      Button("OK", role: .cancel) { deletion.error = nil }
    } message: {
      Text(deletion.error ?? "")
    }
  }
}

private struct ContactRow: View {
  let contact: Contact

  var body: some View {
    HStack(spacing: 12) {
      Initials(name: contact.name)
      VStack(alignment: .leading, spacing: 2) {
        Text(contact.name).font(.headline)
        if !contact.subtitle.isEmpty {
          Text(contact.subtitle)
            .font(.subheadline)
            .foregroundStyle(Color.token(.mutedForeground))
        }
      }
      Spacer(minLength: 8)
      Text(contact.kind.displayName)
        .font(.caption)
        .foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityElement(children: .combine)
  }
}

private extension Contact {
  var subtitle: String {
    [organization, email].compactMap { value in
      guard let value, !value.isEmpty else { return nil }
      return value
    }.joined(separator: " · ")
  }
}
