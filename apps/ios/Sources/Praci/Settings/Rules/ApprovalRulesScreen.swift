import Observation
import RakazoAPI
import RakazoCore
import SwiftUI

struct SetRuleInput: Encodable, Sendable {
  var effect: String
  var matchKind: String
  var matchValue: String
}
struct RuleIDInput: Encodable, Sendable { var id: String }
struct AutoReviewInput: Encodable, Sendable { var enabled: Bool }

struct PermissionInput: Encodable, Sendable {
  var level: String?

  enum CodingKeys: String, CodingKey { case level }

  // The server reads null as "follow the deployment default"; it must be sent explicitly.
  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(level, forKey: .level)
  }
}

struct RulesSnapshot: Sendable {
  var rules: [ApprovalRule]
  var autoReview: AutoReview
  var permissions: PermissionSettings
}

@MainActor
@Observable
final class RulesModel {
  var state: Loadable<RulesSnapshot> = .idle
  var error: String?
  var permissionError: String?
  private(set) var permissionSaving = false

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      async let rules: [ApprovalRule] = app.call("approvalRules/list")
      async let review: AutoReview = app.call("autoReview/get")
      async let permissions: PermissionSettings = app.call("permissions/get")
      state = .loaded(
        try await RulesSnapshot(rules: rules, autoReview: review, permissions: permissions))
    } catch {
      state = .failed(settingsErrorText(error))
    }
  }

  func set(_ app: AppModel, effect: String, kind: String, value: String) async -> Bool {
    await run(app) {
      let _: ApprovalRule = try await app.call(
        "approvalRules/set",
        input: SetRuleInput(effect: effect, matchKind: kind, matchValue: value))
    }
  }

  func remove(_ app: AppModel, _ rule: ApprovalRule) async {
    _ = await run(app) {
      let _: OKResult = try await app.call("approvalRules/remove", input: RuleIDInput(id: rule.id))
    }
  }

  func setAutoReview(_ app: AppModel, _ enabled: Bool) async {
    _ = await run(app) {
      let _: AutoReview = try await app.call("autoReview/set", input: AutoReviewInput(enabled: enabled))
    }
  }

  /// A nil level restores the deployment default. The picker reads the stored level, so a failed
  /// save leaves it on the old value; a change while a save is in flight is ignored.
  func setPermission(_ app: AppModel, _ level: String?) async {
    if permissionSaving { return }
    permissionSaving = true
    defer { permissionSaving = false }
    permissionError = nil
    do {
      let saved: PermissionSettings = try await app.call(
        "permissions/set", input: PermissionInput(level: level))
      if var snapshot = state.value {
        snapshot.permissions = saved
        state = .loaded(snapshot)
      } else {
        await load(app)
      }
    } catch {
      permissionError = settingsErrorText(error)
    }
  }

  private func run(_ app: AppModel, _ call: () async throws -> Void) async -> Bool {
    error = nil
    do {
      try await call()
      await load(app)
      return true
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }
}

/// The calls approved without a card shown under the rules, each with the tool's own undo.
/// Loads on its own so a failure here never hides the rules, and the section stays out of the
/// list while the answer is empty.
@MainActor
@Observable
final class AutoApprovalsModel {
  private(set) var rows: [AutoApproval] = []
  private(set) var loadFailed = false
  private(set) var failedID: String?
  private(set) var busyID: String?

  var hidden: Bool { rows.isEmpty && !loadFailed }

  func load(_ app: AppModel) async {
    do {
      let result: AutoApprovalRows = try await app.call("autoReview/approvals")
      rows = result.rows
      loadFailed = false
    } catch {
      loadFailed = true
    }
  }

  func undo(_ app: AppModel, id: String) async {
    busyID = id
    failedID = nil
    do {
      let _: OKResult = try await app.call("autoReview/undo", input: RuleIDInput(id: id))
      for index in rows.indices where rows[index].id == id {
        rows[index].undoable = false
        rows[index].undone = true
      }
    } catch {
      failedID = id
      await load(app)
    }
    busyID = nil
  }
}

struct ApprovalRulesScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = RulesModel()
  @State private var autoModel = AutoApprovalsModel()
  @State private var adding = false

  private static let effects: [(String, LocalizedStringKey)] = [
    ("always_allow", "Allow"), ("require_approval", "Ask"), ("block", "Block"),
  ]

  /// The picker's tag for following the deployment default: a nil level on the wire.
  private static let defaultTag = "default"

  /// The Default option names the level it inherits, like web's "Default (Ask for everything)".
  private static func levelTitle(_ level: String) -> String {
    switch level {
    case "open": String(localized: "Open")
    case "ask_changes": String(localized: "Ask for changes")
    case "ask_everything": String(localized: "Ask for everything")
    default: level
    }
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { snapshot in
      List {
        Section {
          Picker(
            "Permissions",
            selection: Binding(
              get: { snapshot.permissions.level ?? Self.defaultTag },
              set: { tag in
                Task { await model.setPermission(app, tag == Self.defaultTag ? nil : tag) }
              })
          ) {
            Text("Default (\(Self.levelTitle(snapshot.permissions.effectiveDefault)))")
              .tag(Self.defaultTag)
            Text("Open").tag("open")
            Text("Ask for changes").tag("ask_changes")
            Text("Ask for everything").tag("ask_everything")
          }
          .accessibilityIdentifier("permissions")
          .disabled(model.permissionSaving)
          Toggle(
            "Review actions automatically",
            isOn: Binding(
              get: { snapshot.autoReview.enabled },
              set: { enabled in Task { await model.setAutoReview(app, enabled) } })
          )
          .disabled(!snapshot.autoReview.checkerAvailable)
          .accessibilityIdentifier("autoReview")
        } footer: {
          if let error = model.permissionError {
            Text(error).foregroundStyle(Color.token(.destructive))
          } else if snapshot.permissions.effective == "open" {
            Text("Sending to new people, payments, permanent deletes and access requests always ask.")
          }
        }
        Section {
          ForEach(snapshot.rules) { rule in
            LabeledContent {
              Menu {
                ForEach(Self.effects, id: \.0) { effect in
                  Button(effect.1) {
                    Task {
                      _ = await model.set(
                        app, effect: effect.0, kind: rule.matchKind, value: rule.matchValue)
                    }
                  }
                }
              } label: {
                Text(Self.effects.first { $0.0 == rule.effect }?.1 ?? "Ask")
              }
            } label: {
              VStack(alignment: .leading) {
                Text(rule.matchValue.capitalized)
                Text(rule.matchKind.capitalized).font(.caption)
                  .foregroundStyle(Color.token(.mutedForeground))
              }
            }
            .swipeActions {
              Button("Remove", role: .destructive) { Task { await model.remove(app, rule) } }
            }
            .accessibilityIdentifier("rule-\(rule.matchValue)")
          }
        } header: {
          Text("Rules")
        } footer: {
          if let error = model.error {
            Text(error).foregroundStyle(Color.token(.destructive))
          }
        }
        if !autoModel.hidden {
          Section("Approved automatically") {
            if autoModel.loadFailed {
              VStack(alignment: .leading) {
                Text("Could not load approvals")
                  .foregroundStyle(Color.token(.destructive))
                Button("Retry") { Task { await autoModel.load(app) } }
                  .accessibilityIdentifier("autoApprovalsRetry")
              }
            }
            ForEach(autoModel.rows) { row in
              HStack {
                VStack(alignment: .leading) {
                  Text(
                    toolStepLabel(row.tool) + (row.target.map { " · \($0)" } ?? ""))
                  let when = rowTimestamp(row.at)
                  Text(when.isEmpty ? row.botName : "\(row.botName) · \(when)")
                    .font(.caption)
                    .foregroundStyle(Color.token(.mutedForeground))
                }
                Spacer()
                if autoModel.failedID == row.id {
                  Text("Could not undo")
                    .font(.caption)
                    .foregroundStyle(Color.token(.destructive))
                } else if row.undone {
                  Text("Undone")
                    .font(.caption)
                    .foregroundStyle(Color.token(.mutedForeground))
                } else if row.undoable {
                  Button("Undo") { Task { await autoModel.undo(app, id: row.id) } }
                    .disabled(autoModel.busyID == row.id)
                    .accessibilityIdentifier("autoApproval-undo-\(row.id)")
                }
              }
              .accessibilityIdentifier("autoApproval-\(row.id)")
            }
          }
        }
      }
      .overlay {
        if snapshot.rules.isEmpty && autoModel.hidden {
          ContentUnavailableView("No rules", systemImage: "checkmark.shield")
        }
      }
    })
    .navigationTitle("Approval rules")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Button("Add rule", systemImage: "plus") { adding = true }
          .accessibilityIdentifier("addRule")
      }
    }
    .task {
      async let approvals: Void = autoModel.load(app)
      await model.load(app)
      await approvals
    }
    .refreshable {
      async let approvals: Void = autoModel.load(app)
      await model.load(app)
      await approvals
    }
    .sheet(isPresented: $adding) { AddRuleSheet(model: model) }
  }
}

private struct AddRuleSheet: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let model: RulesModel
  @State private var kind = "tool"
  @State private var value = ""
  @State private var effect = "require_approval"

  var body: some View {
    NavigationStack {
      Form {
        Picker("Applies to", selection: $kind) {
          Text("Tool").tag("tool")
          Text("Connector").tag("connector")
          Text("Category").tag("category")
          Text("Site").tag("site")
        }
        TextField("Name", text: $value)
          .autocorrectionDisabled()
          .textInputAutocapitalization(.never)
          .accessibilityIdentifier("ruleValue")
        Picker("Action", selection: $effect) {
          Text("Allow").tag("always_allow")
          Text("Ask").tag("require_approval")
          Text("Block").tag("block")
        }
        if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
      }
      .navigationTitle("Add rule")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            Task {
              if await model.set(
                app, effect: effect, kind: kind,
                value: value.trimmingCharacters(in: .whitespacesAndNewlines))
              {
                dismiss()
              }
            }
          }
          .disabled(value.trimmingCharacters(in: .whitespaces).isEmpty)
          .accessibilityIdentifier("saveRule")
        }
      }
    }
    .presentationDetents([.medium])
  }
}
