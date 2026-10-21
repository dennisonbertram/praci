import Foundation
import RakazoCore
import Testing

@testable import Praci

@Test
func keychainStoresAndClearsAnOriginBoundSession() throws {
  let storage = KeychainSessionStorage(service: "com.rakazo.app.tests.\(UUID().uuidString)")
  defer { try? storage.clear() }
  let endpoint = try ServerEndpoint.normalize("https://praci.example.com")

  #expect(try storage.load() == nil)
  try storage.save(StoredSession(endpoint: endpoint, token: "synthetic-test-token"))
  #expect(try storage.load()?.endpoint == endpoint)
  #expect(try storage.load()?.token == "synthetic-test-token")
  try storage.save(StoredSession(endpoint: endpoint, token: "synthetic-replacement-token"))
  #expect(try storage.load()?.token == "synthetic-replacement-token")
  try storage.clear()
  #expect(try storage.load() == nil)
  try storage.clear()
}
