import Foundation
import RakazoAPI
import Testing

@testable import Praci

struct ContactDeleteConfirmationTests {
  private let contact = try! JSONDecoder().decode(
    Contact.self,
    from: Data(#"{"id":"contact-1","name":"Avery Example","email":null,"organization":null,"kind":"investor","notes":null,"addedBy":null}"#.utf8))

  private func linked(_ json: String) throws -> ContactLinked {
    try JSONDecoder().decode(ContactLinked.self, from: Data(json.utf8))
  }

  @Test func namesEverythingTheDeleteRemovesInTheWebWording() throws {
    let confirmation = ContactDeleteConfirmation(
      contact: contact, linked: try linked(#"{"portal":true,"documents":["d1","d2"],"safes":1}"#))
    #expect(confirmation.title == "Delete Avery Example?")
    #expect(
      confirmation.message
        == "This also removes their portal access and access to 2 shared documents and the link to 1 SAFE.")
  }

  @Test func contactWithNoLinksHasNoMessage() throws {
    let confirmation = ContactDeleteConfirmation(
      contact: contact, linked: try linked(#"{"portal":false,"documents":[],"safes":0}"#))
    #expect(confirmation.message == nil)
  }
}
