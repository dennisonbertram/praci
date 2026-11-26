import Foundation
import RakazoAPI
import SwiftUI

struct ContactDetailScreen: View {
  @Environment(AppModel.self) private var app
  let contactID: String
  @State private var model: ContactDetailModel
  @State private var deletion = ContactDeletionModel()
  @State private var formContact: Contact?

  init(contactID: String) {
    self.contactID = contactID
    _model = State(initialValue: ContactDetailModel(contactID: contactID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { detail in
      List {
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        contactSection(detail.contact)
        if !detail.mail.isEmpty {
          Section("Emails") {
            ForEach(detail.mail) { mail in
              NavigationLink(value: Route.inboxMessage(messageID: mail.id)) {
                VStack(alignment: .leading, spacing: 2) {
                  Text(mail.subject).lineLimit(1)
                  Text("\(mail.from) · \(mail.snippet.split(whereSeparator: \.isWhitespace).joined(separator: " "))")
                    .font(.footnote)
                    .foregroundStyle(Color.token(.mutedForeground))
                    .lineLimit(2)
                  Text(contactDate(mail.receivedAt))
                    .font(.caption)
                    .foregroundStyle(Color.token(.mutedForeground))
                }
              }
            }
          }
        }
        if !detail.meetings.isEmpty {
          Section("Meetings") {
            ForEach(detail.meetings) { meeting in
              NavigationLink(value: Route.meeting(id: meeting.id)) {
                LabeledContent(meeting.title, value: contactDate(meeting.startedAt))
              }
            }
          }
        }
        if !detail.documents.isEmpty {
          Section("Documents") {
            ForEach(detail.documents) { document in
              NavigationLink(value: Route.dataRoomItem(itemID: document.id)) {
                Text(document.name)
              }
            }
          }
        }
        if !detail.safes.isEmpty {
          Section("SAFEs") {
            ForEach(detail.safes) { safe in
              LabeledContent {
                Text(safe.status.capitalized)
              } label: {
                Text(Decimal(safe.amountCents) / 100, format: .currency(code: "USD"))
              }
            }
          }
        }
      }
      .listStyle(.insetGrouped)
    })
    .navigationTitle(model.state.value?.contact.name ?? "Contact")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if let contact = model.state.value?.contact {
        ToolbarItemGroup(placement: .topBarTrailing) {
          Button("Edit") { formContact = contact }
          Button(role: .destructive) {
            Task { await deletion.request(contact, app: app) }
          } label: {
            Label("Delete", systemImage: "trash")
          }
          .disabled(deletion.busy)
        }
      }
    }
    .refreshable { await model.load(app) }
    .task(id: "\(app.spaceID ?? "")-\(contactID)") {
      await model.load(app, contactID: contactID)
    }
    // `item:` hands the sheet the contact; `isPresented:` could build the form before it was set.
    .sheet(item: $formContact) { contact in
      ContactForm(contact: contact) { saved in
        model.updateContact(saved)
        Task { await model.load(app) }
      }
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
        Task {
          if await deletion.deleteConfirmed(contact, app: app),
            app.path.last == .contact(id: contactID)
          {
            app.path.removeLast()
          }
        }
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

  @ViewBuilder
  private func contactSection(_ contact: Contact) -> some View {
    Section {
      HStack(spacing: 12) {
        Initials(name: contact.name)
        Text(contact.name).font(.headline)
      }
      .accessibilityElement(children: .combine)
      if let email = contact.email, !email.isEmpty,
        let destination = mailto(email)
      {
        LabeledContent("Email") {
          Link(email, destination: destination)
        }
      }
      if let organization = contact.organization, !organization.isEmpty {
        LabeledContent("Organization", value: organization)
      }
      LabeledContent("Kind", value: contact.kind.displayName)
      if let addedBy = contact.addedBy {
        LabeledContent("Added by", value: addedBy.name)
      }
      if let notes = contact.notes, !notes.isEmpty {
        LabeledContent("Notes") {
          Text(notes).textSelection(.enabled)
        }
      }
    }
  }

  private func mailto(_ email: String) -> URL? {
    var components = URLComponents()
    components.scheme = "mailto"
    components.path = email
    return components.url
  }

  private func contactDate(_ value: String) -> String {
    let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    let date = (try? fractional.parse(value)) ?? (try? Date.ISO8601FormatStyle().parse(value))
    return date?.formatted(date: .abbreviated, time: .omitted) ?? value
  }
}
