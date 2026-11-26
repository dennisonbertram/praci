import Foundation
import Observation
import RakazoAPI

private struct SpaceName: Encodable, Sendable { let name: String }
private struct SpaceRename: Encodable, Sendable { let spaceId: String; let name: String }
private struct SpaceID: Encodable, Sendable { let spaceId: String }

/// Create, rename and delete for one open sheet. The server owns validation; the name is trimmed and capped at 60.
@MainActor
@Observable
final class SpacesModel {
  static let maxNameLength = 60
  var busy = false
  var error: String?

  static func clean(_ name: String) -> String { String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxNameLength)) }

  /// Creates a space and makes it the active one. Returns false on failure (`error` is set).
  func create(_ name: String, app: AppModel) async -> Bool {
    await run {
      let space: SpaceSummary = try await app.call("spaces/create", input: SpaceName(name: Self.clean(name)))
      app.spaceID = space.id
    }
  }

  func rename(_ space: SpaceSummary, to name: String, app: AppModel) async -> Bool {
    await run {
      let _: RenamedSpace = try await app.call(
        "spaces/rename", input: SpaceRename(spaceId: space.id, name: Self.clean(name)))
    }
  }

  /// Deletes a space and moves to the one the server reports as active.
  func remove(_ space: SpaceSummary, app: AppModel) async -> Bool {
    await run {
      let result: RemovedSpace = try await app.call("spaces/remove", input: SpaceID(spaceId: space.id))
      app.spaceID = result.activeSpaceId
    }
  }

  private func run(_ work: () async throws -> Void) async -> Bool {
    guard !busy else { return false }
    busy = true
    error = nil
    defer { busy = false }
    do {
      try await work()
      return true
    } catch {
      self.error = error.localizedDescription
      return false
    }
  }
}
