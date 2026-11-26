import Foundation
import RakazoAPI

private struct BotRef: Encodable, Sendable { let botId: String }
private struct GroupRef: Encodable, Sendable { let groupId: String }

struct BotCreateInput: Encodable, Sendable {
  let name: String
  let title: String
  let color: String
  /// Stable per sheet so a retry cannot create a second agent.
  let spawnKey: String
}

struct GroupCreateInput: Encodable, Sendable {
  let name: String
  let botIds: [String]
}

/// Only the fields that changed are sent. `clearSection` sends an explicit null.
struct BotUpdateInput: Encodable, Sendable {
  let botId: String
  var name: String?
  var title: String?
  var color: String?
  var pinned: Bool?
  var autoSpeak: Bool?
  var sectionId: String?
  var clearSection = false
  var proactivity: String?
  /// Sent only by the Firewall switch itself, never by the rest of the form's save.
  var firewall: Bool?

  private enum Keys: String, CodingKey {
    case botId, name, title, color, pinned, autoSpeak, sectionId, proactivity, firewall
  }

  func encode(to encoder: Encoder) throws {
    var box = encoder.container(keyedBy: Keys.self)
    try box.encode(botId, forKey: .botId)
    try box.encodeIfPresent(name, forKey: .name)
    try box.encodeIfPresent(title, forKey: .title)
    try box.encodeIfPresent(color, forKey: .color)
    try box.encodeIfPresent(pinned, forKey: .pinned)
    try box.encodeIfPresent(autoSpeak, forKey: .autoSpeak)
    try box.encodeIfPresent(proactivity, forKey: .proactivity)
    try box.encodeIfPresent(firewall, forKey: .firewall)
    if clearSection {
      try box.encodeNil(forKey: .sectionId)
    } else {
      try box.encodeIfPresent(sectionId, forKey: .sectionId)
    }
  }
}

struct GroupUpdateInput: Encodable, Sendable {
  let groupId: String
  var name: String?
  var botIds: [String]?
  var pinned: Bool?
}

/// Procedure calls shared by the sheets, the settings screens and the row menu.
@MainActor
enum ManageClient {
  static let maxNameLength = 80
  static let memberRange = 2...6

  static func clean(_ name: String) -> String {
    String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxNameLength))
  }

  /// The name to save for a rename, or nil when it is blank or unchanged.
  static func renamed(_ text: String, from current: String) -> String? {
    let value = clean(text)
    return value.isEmpty || value == current ? nil : value
  }

  static func archiveMessage(_ name: String) -> String {
    let name = clean(name)
    return name.isEmpty ? String(localized: "Archived") : String(localized: "Archived \(name)")
  }

  static func canCreateGroup(name: String, members: Int) -> Bool {
    !clean(name).isEmpty && memberRange.contains(members)
  }

  static func createBot(_ input: BotCreateInput, app: AppModel) async throws -> BotDetail {
    try await app.call("bots/create", input: input)
  }

  static func createGroup(_ input: GroupCreateInput, app: AppModel) async throws -> GroupSummary {
    try await app.call("groups/create", input: input)
  }

  static func bot(_ id: String, app: AppModel) async throws -> BotDetail {
    try await app.call("bots/get", input: BotRef(botId: id))
  }

  static func group(_ id: String, app: AppModel) async throws -> GroupSummary {
    try await app.call("groups/get", input: GroupRef(groupId: id))
  }

  static func update(_ input: BotUpdateInput, app: AppModel) async throws {
    let _: BotDetail = try await app.call("bots/update", input: input)
  }

  static func update(_ input: GroupUpdateInput, app: AppModel) async throws {
    let _: GroupSummary = try await app.call("groups/update", input: input)
  }

  static func removeGroup(_ id: String, app: AppModel) async throws {
    let _: OKResult = try await app.call("groups/remove", input: GroupRef(groupId: id))
  }

  static func agents(app: AppModel) async throws -> Bootstrap {
    try await app.call("bootstrap")
  }

  static func archived(_ target: ThreadTarget, _ flag: Bool, app: AppModel) async throws {
    switch (target, flag) {
    case (.bot(let id), true): let _: OKResult = try await app.call("bots/archive", input: BotRef(botId: id))
    case (.bot(let id), false): let _: OKResult = try await app.call("bots/restore", input: BotRef(botId: id))
    case (.group(let id), true): let _: OKResult = try await app.call("groups/archive", input: GroupRef(groupId: id))
    case (.group(let id), false): let _: OKResult = try await app.call("groups/restore", input: GroupRef(groupId: id))
    }
  }

  /// Archives, pops to Home and offers Undo (J3).
  static func archive(
    _ target: ThreadTarget, name: String, app: AppModel, onChange: @escaping () -> Void
  ) async throws {
    try await archived(target, true, app: app)
    app.path = []
    onChange()
    UndoToast.show(archiveMessage(name)) {
      try? await archived(target, false, app: app)
      onChange()
    }
  }
}
