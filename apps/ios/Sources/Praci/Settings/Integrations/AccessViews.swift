import RakazoAPI
import SwiftUI

/// The Access sections of an account or server detail screen: a switch per agent.
struct AccessSections: View {
  @Environment(AppModel.self) private var app
  let model: AccessModel
  /// What the agents get, as in "Let other agents use Founder mail directly".
  let name: String
  let subtext: String
  /// The account's own "Allow changes" switch. Nil where agents have no change switch of their own.
  var writesEnabled: Bool?

  var body: some View {
    switch model.phase {
    case .loading:
      Section("Access") {
        ProgressView().frame(maxWidth: .infinity)
      }
    case .failed(let message):
      Section("Access") {
        Text(message).foregroundStyle(Color.token(.destructive))
        Button("Try again") { Task { await model.load(app) } }
      }
    case .loaded:
      loaded
    }
  }

  @ViewBuilder
  private var loaded: some View {
    if let error = model.error {
      Section { Text(error).foregroundStyle(Color.token(.destructive)) }
    }
    if model.hasOwner, !model.sharingHidden {
      Section {
        Toggle(
          "Let other agents use \(name) directly",
          isOn: Binding(
            get: { model.shared },
            set: { value in Task { await model.setShared(app, value) } })
        )
        .disabled(model.saving)
        .accessibilityIdentifier("accessShared")
      }
    }
    if model.showsList { list }
  }

  @ViewBuilder
  private var list: some View {
    let layout = model.layout
    Section {
      if model.agents.count > 1 { allNone }
      if layout.mail {
        if let owner = layout.owner { row(owner) }
        if !layout.chats.isEmpty { chatsRow(layout.chats) }
      } else if let owner = layout.owner {
        row(owner)
      }
      if !layout.mail { rest(layout) }
    } header: {
      Text("Access")
    } footer: {
      Text(subtext)
    }
    if layout.mail, !layout.others.isEmpty || model.showsControls {
      Section("Other agents") { rest(layout) }
    }
  }

  @ViewBuilder
  private func rest(_ layout: AccessLogic.Layout) -> some View {
    ForEach(layout.others) { row($0) }
    if layout.others.isEmpty, model.showsControls {
      Text("No matching agents").foregroundStyle(Color.token(.mutedForeground))
    }
    if !layout.mail, !layout.chats.isEmpty { chatsRow(layout.chats) }
  }

  private var allNone: some View {
    HStack {
      Spacer()
      Button("All") { Task { await model.setAll(app, on: true) } }
        .disabled(model.saving || model.everyone)
        .accessibilityIdentifier("accessAll")
      Button("None") { Task { await model.setAll(app, on: false) } }
        .disabled(model.saving || (model.noneOn && !model.everyone))
        .accessibilityIdentifier("accessNone")
    }
    .buttonStyle(.bordered)
  }

  @ViewBuilder
  private func row(_ agent: AccessAgent) -> some View {
    toggle(agent)
    if let writesEnabled, model.isOn(agent) { writeRow(agent, writesEnabled) }
  }

  private func writeRow(_ agent: AccessAgent, _ enabled: Bool) -> some View {
    let owner = agent.id == model.subject.ownerBotID
    return Toggle(
      isOn: Binding(
        get: { owner ? enabled : model.isWriting(agent) },
        set: { value in Task { await model.toggleWrite(app, agent, on: value) } })
    ) {
      VStack(alignment: .leading) {
        Text("Allow changes")
        Text("The agent asks you before each change.")
          .font(.caption).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .disabled(model.saving || owner || !enabled)
    .padding(.leading, 20)
    .accessibilityIdentifier("accessWrite-\(agent.id)")
  }

  private func toggle(_ agent: AccessAgent) -> some View {
    Toggle(
      agent.name,
      isOn: Binding(
        get: { model.isOn(agent) },
        set: { value in Task { await model.toggle(app, agent, on: value) } })
    )
    .disabled(model.saving || agent.id == model.subject.ownerBotID)
    .accessibilityIdentifier("access-\(agent.id)")
  }

  private func chatsRow(_ chats: [AccessAgent]) -> some View {
    let some = chats.contains { model.isOn($0) }
    return Toggle(
      isOn: Binding(
        get: { some },
        set: { value in Task { await model.toggleChats(app, on: value) } })
    ) {
      VStack(alignment: .leading) {
        Text("Email chats")
        Text(chats.count.formatted()).font(.caption).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .disabled(model.saving || model.chatsLocked)
    .accessibilityIdentifier("accessChats")
  }
}

/// Search and the On/Off filter, for a list longer than `AccessLogic.controlsMinimum`.
struct AccessControls: ViewModifier {
  @Bindable var model: AccessModel

  @ViewBuilder
  func body(content: Content) -> some View {
    if model.showsControls, model.showsList {
      content
        .searchable(text: $model.query, prompt: "Search agents")
        .toolbar {
          ToolbarItem(placement: .topBarTrailing) {
            Menu {
              Picker("Show", selection: $model.filter) {
                Text("All agents").tag(AccessLogic.Filter.all)
                Text("On").tag(AccessLogic.Filter.on)
                Text("Off").tag(AccessLogic.Filter.off)
              }
            } label: {
              Label("Show", systemImage: "line.3.horizontal.decrease")
            }
            .accessibilityIdentifier("accessFilter")
          }
        }
    } else {
      content
    }
  }
}

extension View {
  func accessControls(_ model: AccessModel) -> some View { modifier(AccessControls(model: model)) }
}
