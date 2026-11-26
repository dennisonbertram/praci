import RakazoAPI
import SwiftUI

struct ContactForm: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let contact: Contact?
  let onSaved: (Contact) -> Void

  @State private var name: String
  @State private var email: String
  @State private var organization: String
  @State private var kind: ContactKind
  @State private var notes: String
  @State private var busy = false
  @State private var emailError: String?
  @State private var saveError: String?
  @FocusState private var focused: Bool

  private var cleanName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var cleanEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var cleanOrganization: String {
    organization.trimmingCharacters(in: .whitespacesAndNewlines)
  }
  private var cleanNotes: String { notes.trimmingCharacters(in: .whitespacesAndNewlines) }

  init(contact: Contact? = nil, onSaved: @escaping (Contact) -> Void) {
    self.contact = contact
    self.onSaved = onSaved
    _name = State(initialValue: contact?.name ?? "")
    _email = State(initialValue: contact?.email ?? "")
    _organization = State(initialValue: contact?.organization ?? "")
    _kind = State(initialValue: contact?.kind ?? .investor)
    _notes = State(initialValue: contact?.notes ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
            .textContentType(.name)
            .focused($focused)
            .accessibilityIdentifier("contactName")
          TextField("Email", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("contactEmail")
          if let emailError {
            Text(emailError)
              .font(.footnote)
              .foregroundStyle(Color.token(.destructive))
              .accessibilityIdentifier("contactEmailError")
          } else if !cleanEmail.isEmpty && !ContactFormValidation.isValidEmail(cleanEmail) {
            Text("Enter a valid email")
              .font(.footnote)
              .foregroundStyle(Color.token(.destructive))
          }
          TextField("Organization", text: $organization)
            .textContentType(.organizationName)
            .accessibilityIdentifier("contactOrganization")
          Picker("Kind", selection: $kind) {
            ForEach(ContactKind.editableCases, id: \.self) { option in
              Text(option.displayName).tag(option)
            }
          }
          .accessibilityIdentifier("contactKind")
          TextField("Notes", text: $notes, axis: .vertical)
            .lineLimit(3...8)
            .accessibilityIdentifier("contactNotes")
        } footer: {
          if let saveError {
            Text(saveError).foregroundStyle(Color.token(.destructive))
          }
        }
      }
      .navigationTitle(contact == nil ? "Add contact" : "Edit contact")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          if busy {
            ProgressView()
          } else {
            Button("Save") { Task { await save() } }
              .disabled(!isValid || busy)
              .accessibilityIdentifier("saveContact")
          }
        }
      }
      .onChange(of: email) {
        emailError = nil
        saveError = nil
      }
      .onAppear { focused = true }
    }
    .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.medium, .large])
  }

  private var isValid: Bool {
    guard !cleanName.isEmpty, cleanName.count <= 200,
      cleanOrganization.count <= 200, cleanNotes.count <= 5000
    else { return false }
    return cleanEmail.isEmpty || ContactFormValidation.isValidEmail(cleanEmail)
  }

  private func save() async {
    guard isValid, !busy else { return }
    busy = true
    emailError = nil
    saveError = nil
    defer { busy = false }

    let input = ContactSaveInput(
      id: contact?.id,
      name: name,
      email: cleanEmail.isEmpty ? nil : cleanEmail,
      organization: cleanOrganization.isEmpty ? nil : cleanOrganization,
      kind: kind,
      notes: cleanNotes.isEmpty ? nil : cleanNotes)
    do {
      let saved = try await ContactsClient.save(input, app: app)
      onSaved(saved)
      dismiss()
    } catch {
      let message = error.localizedDescription
      if message == ContactFormValidation.emailTakenMessage {
        emailError = message
      } else {
        saveError = message
      }
    }
  }
}

enum ContactFormValidation {
  static let emailTakenMessage = "Another contact already has this email."

  static func isValidEmail(_ value: String) -> Bool {
    let parts = value.split(separator: "@", omittingEmptySubsequences: false)
    guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty,
      !value.contains(where: { $0.isWhitespace })
    else { return false }
    let labels = parts[1].split(separator: ".", omittingEmptySubsequences: false)
    return labels.count >= 2 && labels.allSatisfy { !$0.isEmpty }
  }
}
