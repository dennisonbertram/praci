import RakazoAPI
import SwiftUI

struct ArtifactsScreen: View {
  let botID: String
  @Environment(AppModel.self) private var app
  @State private var model: ArtifactsModel
  @State private var pendingRemoval: ArtifactSummary?
  @State private var botName: String?

  init(botID: String) {
    self.botID = botID
    _model = State(initialValue: ArtifactsModel(botID: botID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { items in
      if items.isEmpty && model.refreshError == nil {
        ContentUnavailableView("No artifacts yet", systemImage: "doc.text")
      } else {
        list
      }
    })
    .background(Color.token(.background))
    .navigationTitle(botName.map { "\($0) artifacts" } ?? "Artifacts")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $model.search, prompt: "Search artifacts")
    .task(id: app.spaceID) {
      async let name = agentName(botID, app: app)
      await model.load(app)
      botName = await name
    }
    .refreshable { await model.load(app) }
    .confirmationDialog(
      removalTitle, isPresented: removalBinding, titleVisibility: .visible, presenting: pendingRemoval
    ) { artifact in
      Button("Delete", role: .destructive) { Task { await model.remove(artifact, app: app) } }
        .accessibilityIdentifier("confirmArtifactDelete")
      Button("Cancel", role: .cancel) {}
    } message: { artifact in
      if (artifact.versionCount ?? 1) > 1 {
        Text("This deletes all \(artifact.versionCount ?? 1) versions of this artifact. This can’t be undone.")
      } else {
        Text("This can’t be undone.")
      }
    }
    .actionErrorAlert("Couldn’t delete this artifact", message: Binding(
      get: { model.actionError }, set: { if $0 == nil { model.dismissError() } }))
  }

  private var list: some View {
    List {
      RefreshErrorSection(message: model.refreshError) { await model.load(app) }
      ForEach(model.visible) { artifact in
        Button { app.open(.artifact(artifactID: artifact.id)) } label: { row(artifact) }
          .buttonStyle(.plain)
          .accessibilityIdentifier("artifactRow")
          .contextMenu {
            Button(role: .destructive) { pendingRemoval = artifact } label: {
              Label("Delete", systemImage: "trash")
            }
          }
          .swipeActions {
            Button(role: .destructive) { pendingRemoval = artifact } label: {
              Label("Delete", systemImage: "trash")
            }
          }
      }
    }
    .listStyle(.plain)
    .overlay {
      if model.visible.isEmpty { ContentUnavailableView.search(text: model.search) }
    }
  }

  private func row(_ artifact: ArtifactSummary) -> some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(artifact.title).font(.body).foregroundStyle(Color.token(.foreground)).lineLimit(2)
        Text(subtitle(artifact)).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
      Spacer(minLength: 8)
      Text(rowTimestamp(artifact.createdAt)).font(.footnote)
        .foregroundStyle(Color.token(.mutedForeground))
      Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
        .foregroundStyle(Color.token(.mutedForeground)).accessibilityHidden(true)
    }
    .contentShape(Rectangle())
  }

  private func subtitle(_ artifact: ArtifactSummary) -> String {
    let count = artifact.versionCount ?? 1
    return count > 1 ? "\(artifact.kind.label) · v\(artifact.version) of \(count)" : artifact.kind.label
  }

  private var removalTitle: LocalizedStringKey {
    "Delete “\(pendingRemoval?.title ?? "")”?"
  }

  private var removalBinding: Binding<Bool> {
    Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } })
  }

}
