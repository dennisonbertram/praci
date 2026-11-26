import RakazoAPI
import SwiftUI

struct GroupSettingsScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let groupID: String
  @State private var state: Loadable<GroupSummary> = .idle
  @State private var bots: [BotSummary] = []
  @State private var name = ""
  @State private var picked: [String] = []
  @State private var busy = false
  @State private var error: String?
  @State private var confirmDiscard = false
  @State private var confirmDelete = false

  var body: some View {
    LoadableView(state: state, retry: { Task { await load() } }, content: { group in
      form(group)
    })
    .navigationTitle("Group settings")
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
  }

  // A SwiftUI view builder lists its rows in one place.
  // swiftlint:disable:next function_body_length
  private func form(_ group: GroupSummary) -> some View {
    let original = group.members.map(\.botId)
    let dirty = ManageClient.clean(name) != group.name || Set(picked) != Set(original)
    let valid = ManageClient.canCreateGroup(name: name, members: picked.count)
    return Form {
      Section { TextField("Name", text: $name).accessibilityIdentifier("groupName") }
      Section {
        MemberRows(bots: bots, picked: $picked)
      } header: {
        Text("Members")
      } footer: {
        MemberFooter(count: picked.count, error: error)
      }
      if error != nil {
        Section { Button("Retry") { Task { await save(group) } } }
      }
      Section {
        if group.archivedAt == nil {
          Button("Archive", role: .destructive) { Task { await archive(group) } }
            .accessibilityIdentifier("archiveGroup")
        } else {
          Button("Restore") { Task { await restore() } }
        }
        Button("Delete group", role: .destructive) { confirmDelete = true }
          .accessibilityIdentifier("deleteGroup")
      }
    }
    .accessibilityIdentifier("groupSettings")
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
          Button("Save") { Task { await save(group) } }
            .disabled(!dirty || !valid)
            .accessibilityIdentifier("save")
        }
      }
    }
    .alert("Discard changes?", isPresented: $confirmDiscard) {
      Button("Keep editing", role: .cancel) {}
      Button("Discard", role: .destructive) { dismiss() }
    } message: {
      Text("Your edits to \(group.name) are not saved.")
    }
    .alert("Delete \(group.name)?", isPresented: $confirmDelete) {
      Button("Cancel", role: .cancel) {}
      Button("Delete", role: .destructive) { Task { await delete() } }
    } message: {
      Text("This removes the group and its messages for everyone in it. The agents are not deleted.")
    }
  }

  private func load() async {
    state = .loading
    do {
      let group = try await ManageClient.group(groupID, app: app)
      name = group.name
      picked = group.members.map(\.botId)
      state = .loaded(group)
      bots = (try? await ManageClient.agents(app: app).bots) ?? []
    } catch {
      state = .failed(error.localizedDescription)
    }
  }

  private func save(_ group: GroupSummary) async {
    busy = true
    error = nil
    defer { busy = false }
    var input = GroupUpdateInput(groupId: group.id)
    if ManageClient.clean(name) != group.name { input.name = ManageClient.clean(name) }
    if Set(picked) != Set(group.members.map(\.botId)) { input.botIds = picked }
    do {
      try await ManageClient.update(input, app: app)
      await load()
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func archive(_ group: GroupSummary) async {
    do {
      try await ManageClient.archive(.group(group.id), name: group.name, app: app, onChange: {})
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func restore() async {
    do {
      try await ManageClient.archived(.group(groupID), false, app: app)
      await load()
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func delete() async {
    do {
      try await ManageClient.removeGroup(groupID, app: app)
      app.path = []
    } catch {
      self.error = error.localizedDescription
    }
  }
}
