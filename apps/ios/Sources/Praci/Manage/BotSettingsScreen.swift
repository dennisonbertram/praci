import RakazoAPI
import SwiftUI

struct BotSettingsScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let botID: String
  @State private var state: Loadable<BotDetail> = .idle
  @State private var sections: [BotSection] = []
  @State private var name = ""
  @State private var role = ""
  @State private var color = ""
  @State private var speak = false
  @State private var pinned = false
  @State private var sectionID: String?
  @State private var proactivity = "medium"
  @State private var firewall = false
  @State private var firewallBusy = false
  @State private var busy = false
  @State private var error: String?
  @State private var confirmDiscard = false
  @State private var confirmFirewallOff = false
  @State private var access: AgentAccessModel?

  var body: some View {
    LoadableView(state: state, retry: { Task { await load() } }, content: { bot in
      form(bot)
    })
    .navigationTitle("Agent settings")
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
  }

  // A SwiftUI view builder lists its rows in one place.
  // swiftlint:disable:next function_body_length
  private func form(_ bot: BotDetail) -> some View {
    let dirty =
      ManageClient.clean(name) != bot.name || role != bot.title
      || color.caseInsensitiveCompare(bot.color ?? "") != .orderedSame
      || speak != bot.autoSpeak || proactivity != bot.proactivity || pinned != bot.pinned || sectionID != bot.sectionId
    return Form {
      Section {
        TextField("Name", text: $name).accessibilityIdentifier("botName")
        TextField("Role", text: $role).accessibilityIdentifier("botRole")
      }
      Section("Color") { ColorSwatches(selection: $color) }
      if !(bot.spawnKey?.hasPrefix("voice-agent") ?? false) {
        Section {
          Toggle("Firewall", isOn: Binding(get: { firewall }, set: { next in
            // On saves at once; off asks first, so the switch only follows the alert's answer.
            if next { Task { await saveFirewall(true, bot) } } else { confirmFirewallOff = true }
          }))
          .disabled(firewallBusy)
          .accessibilityIdentifier("botFirewall")
        } footer: {
          Text("Treat everything it reads as untrusted. Sends and changes always ask.")
        }
      }
      Section {
        Toggle("Pinned", isOn: $pinned).accessibilityIdentifier("botPinned")
        if !sections.isEmpty {
          Picker("Section", selection: $sectionID) {
            Text("None").tag(String?.none)
            ForEach(sections) { Text($0.name).tag(Optional($0.id)) }
          }
        }
      }
      if !(bot.spawnKey?.hasPrefix("voice-agent") ?? false) {
        Section {
          Picker("Proactive", selection: $proactivity) {
            Text("Low").tag("low")
            Text("Medium").tag("medium")
            Text("High").tag("high")
          }
          .disabled(bot.restricted)
          .accessibilityIdentifier("botProactivity")
        } footer: {
          if bot.restricted { Text("Not used by firewalled or external agents") }
        }
      }
      Section("Voice") {
        Toggle("Read replies aloud", isOn: $speak).accessibilityIdentifier("botSpeak")
      }
      if let access { AgentAccessSection(model: access) }
      if let error {
        Section {
          Text(error).foregroundStyle(Color.token(.destructive))
          Button("Retry") { Task { await save(bot) } }
        }
      }
      Section {
        if bot.archivedAt == nil {
          Button("Archive", role: .destructive) { Task { await archive(bot) } }
            .accessibilityIdentifier("archiveBot")
        } else {
          Button("Restore") { Task { await restore() } }
            .accessibilityIdentifier("restoreBot")
        }
      }
    }
    .accessibilityIdentifier("botSettings")
    .navigationBarBackButtonHidden(dirty)
    .toolbar {
      if dirty {
        ToolbarItem(placement: .cancellationAction) {
          Button { confirmDiscard = true } label: { Label("Back", systemImage: "chevron.left") }
        }
      }
      ToolbarItem(placement: .confirmationAction) {
        if busy {
          ProgressView()
        } else {
          Button("Save") { Task { await save(bot) } }
            .disabled(!dirty || ManageClient.clean(name).isEmpty)
            .accessibilityIdentifier("save")
        }
      }
    }
    .alert("Discard changes?", isPresented: $confirmDiscard) {
      Button("Keep editing", role: .cancel) {}
      Button("Discard", role: .destructive) { dismiss() }
    } message: {
      Text("Your edits to \(bot.name) are not saved.")
    }
    .alert("Turn off Firewall?", isPresented: $confirmFirewallOff) {
      Button("Cancel", role: .cancel) {}
      Button("Turn off", role: .destructive) { Task { await saveFirewall(false, bot) } }
    }
  }

  private func load() async {
    state = .loading
    do {
      let bot = try await ManageClient.bot(botID, app: app)
      name = bot.name
      role = bot.title
      color = bot.color ?? BotPalette.colors[0]
      speak = bot.autoSpeak
      pinned = bot.pinned
      sectionID = bot.sectionId
      proactivity = bot.proactivity
      firewall = bot.firewall
      state = .loaded(bot)
      sections = (try? await ManageClient.agents(app: app).botSections) ?? []
      let model = AgentAccessModel(
        agent: AccessAgent(
          id: bot.id, name: bot.name, spawnKey: bot.spawnKey, restricted: bot.restricted))
      access = model
      await model.load(app)
    } catch {
      state = .failed(error.localizedDescription)
    }
  }

  private func save(_ bot: BotDetail) async {
    busy = true
    error = nil
    defer { busy = false }
    var input = BotUpdateInput(botId: bot.id)
    if ManageClient.clean(name) != bot.name { input.name = ManageClient.clean(name) }
    if role != bot.title { input.title = role.trimmingCharacters(in: .whitespacesAndNewlines) }
    if color.caseInsensitiveCompare(bot.color ?? "") != .orderedSame { input.color = color }
    if speak != bot.autoSpeak { input.autoSpeak = speak }
    if pinned != bot.pinned { input.pinned = pinned }
    if proactivity != bot.proactivity { input.proactivity = proactivity }
    if sectionID != bot.sectionId {
      input.sectionId = sectionID
      input.clearSection = sectionID == nil
    }
    do {
      try await ManageClient.update(input, app: app)
      state = .loaded(try await ManageClient.bot(botID, app: app))
      if let fresh = state.value {
        name = fresh.name
        role = fresh.title
        firewall = fresh.firewall
      }
    } catch {
      self.error = error.localizedDescription
    }
  }

  /// Firewall is its own save: the switch writes it, and the form never carries it.
  private func saveFirewall(_ next: Bool, _ bot: BotDetail) async {
    // One save at a time, so an older request cannot commit after a newer one.
    guard !firewallBusy else { return }
    firewallBusy = true
    defer { firewallBusy = false }
    let previous = firewall
    firewall = next
    error = nil
    var input = BotUpdateInput(botId: bot.id)
    input.firewall = next
    do {
      try await ManageClient.update(input, app: app)
      let fresh = try await ManageClient.bot(botID, app: app)
      state = .loaded(fresh)
      firewall = fresh.firewall
      // Being firewalled changes who can reach this agent, so its access list starts over.
      let model = AgentAccessModel(
        agent: AccessAgent(
          id: fresh.id, name: fresh.name, spawnKey: fresh.spawnKey, restricted: fresh.restricted))
      access = model
      await model.load(app)
    } catch {
      firewall = previous
      self.error = error.localizedDescription
    }
  }

  private func archive(_ bot: BotDetail) async {
    do {
      try await ManageClient.archive(.bot(bot.id), name: bot.name, app: app, onChange: {})
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func restore() async {
    do {
      try await ManageClient.archived(.bot(botID), false, app: app)
      await load()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
