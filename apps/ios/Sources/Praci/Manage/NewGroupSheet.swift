import RakazoAPI
import SwiftUI

/// Name plus 2 to 6 members, picked from every agent (J4).
struct NewGroupSheet: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let onCreated: (ThreadTarget) -> Void
  @State private var name = ""
  @State private var picked: [String] = []
  @State private var bots: Loadable<[BotSummary]> = .idle
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name).accessibilityIdentifier("groupName")
        }
        Section {
          LoadableView(state: bots, retry: { Task { await load() } }, content: { list in
            MemberRows(bots: list, picked: $picked)
          })
        } header: {
          Text("Members")
        } footer: {
          MemberFooter(count: picked.count, error: error)
        }
      }
      .accessibilityIdentifier("newGroup")
      .navigationTitle("New group")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button { dismiss() } label: { Label("Cancel", systemImage: "xmark") }
        }
        ToolbarItem(placement: .confirmationAction) {
          if busy {
            ProgressView()
          } else {
            Button("Create") { Task { await create() } }
              .disabled(!ManageClient.canCreateGroup(name: name, members: picked.count))
              .accessibilityIdentifier("create")
          }
        }
      }
      .task { await load() }
    }
    .presentationDetents([.large])
  }

  private func load() async {
    bots = .loading
    do { bots = .loaded(try await ManageClient.agents(app: app).bots) } catch {
      bots = .failed(error.localizedDescription)
    }
  }

  private func create() async {
    busy = true
    error = nil
    defer { busy = false }
    do {
      let group = try await ManageClient.createGroup(
        GroupCreateInput(name: ManageClient.clean(name), botIds: picked), app: app)
      onCreated(.group(group.id))
    } catch {
      self.error = error.localizedDescription
    }
  }
}

struct MemberRows: View {
  let bots: [BotSummary]
  @Binding var picked: [String]

  var body: some View {
    ForEach(bots) { bot in
      let isOn = picked.contains(bot.id)
      Button {
        if isOn { picked.removeAll { $0 == bot.id } } else { picked.append(bot.id) }
      } label: {
        HStack {
          BotAvatarView(name: bot.name, avatar: bot.color, size: 28)
          Text(bot.name).foregroundStyle(Color.token(.foreground))
          Spacer()
          if isOn { Image(systemName: "checkmark").foregroundStyle(Color.token(.foreground)) }
        }
      }
      .disabled(!isOn && picked.count >= ManageClient.memberRange.upperBound)
      .accessibilityAddTraits(isOn ? .isSelected : [])
      .accessibilityIdentifier("member-\(bot.id)")
    }
  }
}

struct MemberFooter: View {
  let count: Int
  let error: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("\(count) selected")
      if !ManageClient.memberRange.contains(count) { Text("Choose 2 to 6 members.") }
      if let error { Text(error).foregroundStyle(Color.token(.destructive)) }
    }
  }
}
