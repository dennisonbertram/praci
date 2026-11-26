import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesContactDetailAndItsRelatedItems() throws {
  let detail = try JSONDecoder().decode(
    RPCEnvelope<ContactDetail>.self, from: loadFixture(named: "contact-detail")).json

  #expect(detail.contact.id == "contact-placeholder")
  #expect(detail.contact.email == "ada@example.test")
  #expect(detail.contact.organization == "Analytical Engines (Mock)")
  #expect(detail.contact.kind == .advisor)
  #expect(detail.mail.first?.subject == "Mock introduction")
  #expect(detail.meetings.first?.id == "meeting-placeholder")
  #expect(detail.documents.first?.name == "Mock overview.pdf")
  #expect(detail.safes.first?.amountCents == 125_000)
}

@Test
func decodesUnknownContactKindWithoutLosingContactFields() throws {
  let json = #"{"id":"contact-placeholder","name":"Ada Lovelace","email":null,"organization":null,"kind":"future_kind","notes":null,"addedBy":null,"createdAt":"2026-11-10T12:00:00Z","updatedAt":"2026-11-11T12:00:00Z"}"#
  let contact = try JSONDecoder().decode(Contact.self, from: Data(json.utf8))
  #expect(contact.kind == .unknown("future_kind"))
  #expect(contact.name == "Ada Lovelace")
}

@Test
func decodesContactLinkedResponse() throws {
  let linked = try JSONDecoder().decode(
    RPCEnvelope<ContactLinked>.self, from: loadFixture(named: "contact-linked")).json

  #expect(linked.portal)
  #expect(linked.documents == ["document-placeholder"])
  #expect(linked.safes == 2)
}

@Test
func contactSaveInputEncodesOnlySupportedFieldsAndNullEmptyOptionals() throws {
  let input = ContactSaveInput(
    name: "Morgan Example", email: nil, organization: nil, kind: .advisor, notes: nil)
  let data = try JSONEncoder().encode(input)
  let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])

  #expect(Set(object.keys) == Set(["name", "email", "organization", "kind", "notes"]))
  #expect(object["name"] as? String == "Morgan Example")
  #expect(object["kind"] as? String == "advisor")
  #expect(object["email"] is NSNull)
  #expect(object["organization"] is NSNull)
  #expect(object["notes"] is NSNull)
}

@Test
func contactSaveInputIncludesOnlyTheContactIDForAnEdit() throws {
  let input = ContactSaveInput(
    id: "contact-placeholder", name: "Morgan Example", email: nil, organization: nil,
    kind: .advisor, notes: nil)
  let object = try #require(
    JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any])

  #expect(Set(object.keys) == Set(["id", "name", "email", "organization", "kind", "notes"]))
  #expect(object["id"] as? String == "contact-placeholder")
}
