import RakazoAPI
import SwiftUI

struct GtmScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = GtmModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }) { overview in
      content(overview)
    }
    .navigationTitle("GTM")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .confirmationDialog(
      "Remove this item?", isPresented: Binding(
        get: { model.removing != nil }, set: { if !$0 { model.removing = nil } }),
      titleVisibility: .visible
    ) {
      Button("Remove", role: .destructive) {
        guard let item = model.removing else { return }
        model.removing = nil
        Task { await model.remove(item, app: app) }
      }
      Button("Cancel", role: .cancel) { model.removing = nil }
    }
    .actionErrorAlert("Could not update GTM", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private func content(_ overview: GtmOverview) -> some View {
    List {
      RefreshErrorSection(message: model.refreshError) { await model.load(app) }
      Section {
        HStack {
          Text(overview.counts.needsYou == 0
            ? String(localized: "Up to date")
            : gtmNeedsYouCount(overview.counts.needsYou))
            .foregroundStyle(overview.counts.needsYou > 0
              ? Color.token(.warning) : Color.token(.mutedForeground))
        }
      }
      group("Needs you", items: overview.groups.needsYou)
      group("In progress", items: overview.groups.inProgress)
      group("Drafts for you", items: overview.groups.drafts)
    }
    .listStyle(.insetGrouped)
    .accessibilityIdentifier("gtmList")
  }

  @ViewBuilder
  private func group(_ title: LocalizedStringKey, items: [GtmItem]) -> some View {
    // An empty group is left out; "Up to date" above already says there is nothing to do.
    if !items.isEmpty {
      Section(title) { ForEach(items) { item in row(item) } }
    }
  }

  private func row(_ item: GtmItem) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(item.title).font(.headline).fixedSize(horizontal: false, vertical: true)
      if let channel = gtmChannelLabel(item.channel) {
        Text(channel).font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
      }
      if let target = item.target, !target.isEmpty {
        LabeledContent("Target", value: target)
          .font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
      }
      if let date = gtmDate(item.scheduledFor) {
        LabeledContent("Scheduled", value: date.formatted(date: .abbreviated, time: .shortened))
          .font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .padding(.vertical, 3)
    .contextMenu {
      if item.status == "parked", gtmCanApprove(item) {
        Button("Approve", systemImage: "checkmark") {
          let selected = item
          Task { await model.update(selected, status: "open", app: app) }
        }
      }
      if item.status == "open" {
        Button("Park", systemImage: "pause") {
          let selected = item
          Task { await model.update(selected, status: "parked", app: app) }
        }
      }
      Button("Mark done", systemImage: "checkmark.circle") {
        let selected = item
        Task { await model.update(selected, status: "done", app: app) }
      }
      Button("Remove", systemImage: "trash", role: .destructive) {
        model.removing = item
      }
    }
    .accessibilityIdentifier("gtmItem-\(item.id)")
  }
}

private func gtmNeedsYouCount(_ count: Int) -> String {
  count == 1 ? String(localized: "1 needs you") : String(localized: "\(count) need you")
}
