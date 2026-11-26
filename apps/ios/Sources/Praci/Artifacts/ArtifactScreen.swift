import RakazoAPI
import SwiftUI
import UIKit

struct ArtifactScreen: View {
  let artifactID: String
  @Environment(AppModel.self) private var app
  @State private var model: ArtifactModel
  @State private var confirmingDelete = false

  init(artifactID: String) {
    self.artifactID = artifactID
    _model = State(initialValue: ArtifactModel(artifactID: artifactID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { detail in
      preview(detail)
    })
    .background(Color.token(.background))
    .navigationTitle(model.state.value?.summary.title ?? "Artifact")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if model.state.value != nil {
        if let url = model.shareURL {
          ToolbarItem(placement: .topBarTrailing) {
            ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") }
              .accessibilityIdentifier("artifactShare")
          }
        }
        ToolbarItem(placement: .topBarTrailing) { moreMenu }
      }
    }
    .task(id: app.spaceID) { await model.load(app) }
    .onChange(of: model.removed) { _, removed in
      if removed, !app.path.isEmpty { app.path.removeLast() }
    }
    .confirmationDialog(
      "Delete “\(model.state.value?.summary.title ?? "")”?", isPresented: $confirmingDelete,
      titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) { Task { await model.remove(app: app) } }
        .accessibilityIdentifier("confirmArtifactDelete")
      Button("Cancel", role: .cancel) {}
    } message: {
      if model.versions.count > 1 {
        Text("This deletes all \(model.versions.count) versions of this artifact. This can’t be undone.")
      } else {
        Text("This can’t be undone.")
      }
    }
    .actionErrorAlert("Couldn’t delete this artifact", message: Binding(
      get: { model.actionError }, set: { if $0 == nil { model.dismissError() } }))
  }

  private var moreMenu: some View {
    Menu {
      if model.versions.count > 1 {
        Picker(
          "Versions",
          selection: Binding(
            get: { model.selectedVersion ?? 0 },
            set: { number in
              if let picked = model.versions.first(where: { $0.version == number }) {
                Task { await model.select(picked, app: app) }
              }
            })
        ) {
          ForEach(model.versions) { entry in
            Text("v\(entry.version) · \(rowTimestamp(entry.createdAt))").tag(entry.version)
          }
        }
      }
      Button(role: .destructive) { confirmingDelete = true } label: {
        Label("Delete", systemImage: "trash")
      }
    } label: {
      Label("More", systemImage: "ellipsis.circle")
    }
    .accessibilityIdentifier("artifactMore")
  }

  @ViewBuilder
  private func preview(_ detail: ArtifactDetail) -> some View {
    let summary = detail.summary
    VStack(spacing: 0) {
      if model.versions.count > 1, let number = model.selectedVersion {
        Text("v\(number) of \(model.latestVersion ?? number)")
          .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          .padding(.vertical, 6)
          .accessibilityIdentifier("artifactVersion")
      }
      switch summary.kind {
      case .html:
        ScrollView { SafeHTMLView(html: detail.text ?? "").padding() }
      case .markdown:
        ScrollView { MarkdownView(text: detail.text ?? "").padding() }
      case .text:
        ScrollView {
          Text(detail.text ?? "").font(.footnote.monospaced()).textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading).padding()
        }
      case .pdf:
        if let data = detail.data { PDFPreview(data: data) } else { unavailable }
      case .image:
        if let data = detail.data, let image = UIImage(data: data) {
          ScrollView([.horizontal, .vertical]) {
            Image(uiImage: image).resizable().scaledToFit().frame(maxWidth: .infinity)
              .accessibilityLabel(summary.title)
          }
        } else {
          unavailable
        }
      case .other:
        unavailable
      }
    }
  }

  private var unavailable: some View {
    ContentUnavailableView("No preview for this file type", systemImage: "doc")
  }
}
