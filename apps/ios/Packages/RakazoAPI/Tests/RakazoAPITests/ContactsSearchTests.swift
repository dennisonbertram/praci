import Foundation
import Testing

@testable import RakazoAPI

@Test(arguments: ["ada", "example.test", "analytical", "fictional", "advisor"])
func contactSearchMatchesEveryWebSearchField(query: String) throws {
  let contact = try JSONDecoder().decode(
    RPCEnvelope<ContactDetail>.self, from: loadFixture(named: "contact-detail")).json.contact
  #expect(contact.matchesSearch(query))
}

@Test
func contactSearchTrimsQueryAndIgnoresCase() throws {
  let contact = try JSONDecoder().decode(
    RPCEnvelope<ContactDetail>.self, from: loadFixture(named: "contact-detail")).json.contact
  #expect(contact.matchesSearch("  ADA LOVELACE  "))
  #expect(contact.matchesSearch("  "))
  #expect(!contact.matchesSearch("not present"))
}
