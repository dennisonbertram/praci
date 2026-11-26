import RakazoAPI
import SwiftUI
import UIKit

/// Context-menu items for a Home row. Pin state and name load when the menu opens.
struct AgentRowMenu: View {
  @Environment(AppModel.self) private var app
  let target: ThreadTarget
  let onChange: () -> Void
  @State private var name = ""
  @State private var pinned = false

  var body: some View {
    Group {
      Button { Task { await togglePin() } } label: {
        Label(pinned ? "Unpin" : "Pin", systemImage: pinned ? "pin.slash" : "pin")
      }
      .accessibilityIdentifier("rowPin")
      Button { rename() } label: { Label("Rename", systemImage: "pencil") }
        .accessibilityIdentifier("rowRename")
      Button { app.open(settingsRoute) } label: {
        Label("Settings", systemImage: "gearshape")
      }
      .accessibilityIdentifier("rowSettings")
      Button(role: .destructive) { Task { await archive() } } label: {
        Label("Archive", systemImage: "archivebox")
      }
      .accessibilityIdentifier("rowArchive")
    }
    .task { await load() }
  }

  private var settingsRoute: Route {
    switch target {
    case .bot(let id): .botSettings(botID: id)
    case .group(let id): .groupSettings(groupID: id)
    }
  }

  private func load() async {
    switch target {
    case .bot(let id):
      if let bot = try? await ManageClient.bot(id, app: app) { (name, pinned) = (bot.name, bot.pinned) }
    case .group(let id):
      if let group = try? await ManageClient.group(id, app: app) { (name, pinned) = (group.name, group.pinned) }
    }
  }

  private func togglePin() async {
    let flag = !pinned
    let app = app
    let target = target
    do {
      switch target {
      case .bot(let id): try await ManageClient.update(BotUpdateInput(botId: id, pinned: flag), app: app)
      case .group(let id): try await ManageClient.update(GroupUpdateInput(groupId: id, pinned: flag), app: app)
      }
      onChange()
    } catch {
      SystemAlert.present(title: String(localized: "Could not update"), message: error.localizedDescription)
    }
  }

  private func archive() async {
    do {
      try await ManageClient.archive(target, name: name, app: app, onChange: onChange)
    } catch {
      SystemAlert.present(title: String(localized: "Could not archive"), message: error.localizedDescription)
    }
  }

  /// A system alert, because the menu is gone before a SwiftUI alert could appear.
  private func rename() {
    let app = app
    let target = target
    let onChange = onChange
    RenameAlert.present(current: name) { newName in
      Task {
        do {
          switch target {
          case .bot(let id): try await ManageClient.update(BotUpdateInput(botId: id, name: newName), app: app)
          case .group(let id): try await ManageClient.update(GroupUpdateInput(groupId: id, name: newName), app: app)
          }
          onChange()
        } catch {
          SystemAlert.present(title: String(localized: "Could not rename"), message: error.localizedDescription)
        }
      }
    }
  }
}

@MainActor
private enum SystemAlert {
  static func present(title: String, message: String? = nil, configure: (UIAlertController) -> Void = { _ in }) {
    guard
      let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive }),
      var top = scene.keyWindow?.rootViewController
    else { return }
    while let next = top.presentedViewController { top = next }
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    configure(alert)
    if alert.actions.isEmpty { alert.addAction(UIAlertAction(title: String(localized: "OK"), style: .cancel)) }
    top.present(alert, animated: true)
  }
}

/// Holds the text-change observer so the alert's buttons can remove it when the alert closes.
@MainActor
private final class ObserverBox {
  var token: (any NSObjectProtocol)?
  func remove() {
    if let token { NotificationCenter.default.removeObserver(token) }
    token = nil
  }
}

@MainActor
private enum RenameAlert {
  static func present(current: String, save: @escaping @MainActor (String) -> Void) {
    SystemAlert.present(title: String(localized: "Rename")) { alert in
      alert.addTextField { field in
        field.text = current
        field.autocapitalizationType = .words
        field.accessibilityIdentifier = "renameField"
      }
      let observer = ObserverBox()
      alert.addAction(UIAlertAction(title: String(localized: "Cancel"), style: .cancel) { _ in observer.remove() })
      let saveAction = UIAlertAction(title: String(localized: "Save"), style: .default) { _ in
        observer.remove()
        if let value = ManageClient.renamed(alert.textFields?.first?.text ?? "", from: current) { save(value) }
      }
      saveAction.isEnabled = false
      alert.addAction(saveAction)
      // Save stays disabled for a blank or unchanged name, so the alert cannot close without saving.
      if let field = alert.textFields?.first {
        observer.token = NotificationCenter.default.addObserver(
          forName: UITextField.textDidChangeNotification, object: field, queue: .main
        ) { _ in
          // The handler runs on the main queue; tell the compiler so it may touch UIKit.
          MainActor.assumeIsolated {
            saveAction.isEnabled = ManageClient.renamed(field.text ?? "", from: current) != nil
          }
        }
      }
    }
  }
}
