import Foundation
import RakazoCore
import Security

struct KeychainSessionStorage: SessionStorage {
  private let service: String

  init(service: String = Bundle.main.bundleIdentifier ?? "com.rakazo.app.dev") {
    self.service = service
  }

  private var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: "session",
    ]
  }

  func load() throws -> StoredSession? {
    var query = query
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data else {
      throw StorageError.unavailable
    }
    do {
      return try JSONDecoder().decode(StoredSession.self, from: data)
    } catch {
      try clear()
      return nil
    }
  }

  func save(_ session: StoredSession) throws {
    let data = try JSONEncoder().encode(session)
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]
    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      let item = query.merging(attributes) { _, new in new }
      guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else {
        throw StorageError.unavailable
      }
    } else if status != errSecSuccess {
      throw StorageError.unavailable
    }
  }

  func clear() throws {
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw StorageError.unavailable
    }
  }

  private enum StorageError: LocalizedError {
    case unavailable

    var errorDescription: String? {
      "Couldn’t update your saved sign-in. Unlock your iPhone and try again."
    }
  }
}
