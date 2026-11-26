import RakazoAPI
import RakazoCore
import SwiftUI

/// A bot's named pages: Markdown with live metric, table and chart blocks, or one sandboxed HTML page.
/// `pages/get` answers null when the agent has not saved one.
struct AgentPageScreen: View {
  let botID: String
  @Environment(AppModel.self) private var app
  @State private var model: AgentPageModel
  @State private var botName: String?
  @State private var confirmingStop = false

  init(botID: String, pageID: String? = nil) {
    self.botID = botID
    _model = State(initialValue: AgentPageModel(botID: botID, pageID: pageID))
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { page in
      if let page, !page.content.isEmpty {
        if page.isHTML {
          SandboxedHTMLView(html: page.content, data: model.htmlData)
            .id("\(page.id ?? ""):\(page.revision ?? 0)")
            .ignoresSafeArea(edges: .bottom)
            .accessibilityIdentifier("htmlPage")
        } else {
          ScrollView {
            VStack(alignment: .leading, spacing: 12) {
              ForEach(Array(model.blocks.enumerated()), id: \.offset) { _, block in
                blockView(block)
              }
              if let updated = detailTimestamp(page.updatedAt) {
                Text("Updated \(updated)").font(.footnote)
                  .foregroundStyle(Color.token(.mutedForeground))
              }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
          }
        }
      } else {
        ContentUnavailableView("No page yet", systemImage: "doc.text")
      }
    })
    .background(Color.token(.background))
    .navigationTitle(model.page?.title ?? botName ?? "Page")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if model.page != nil { ToolbarItem(placement: .topBarTrailing) { moreMenu } }
    }
    .safeAreaInset(edge: .bottom) {
      Button { app.open(.thread(.bot(botID))) } label: {
        Text("Open chat").frame(maxWidth: .infinity).foregroundStyle(Color.token(.primaryForeground))
      }
      .buttonStyle(.borderedProminent)
      .tint(Color.token(.primary))
      .controlSize(.large)
      .padding()
      .accessibilityIdentifier("openChat")
    }
    .task {
      async let name = agentName(botID, app: app)
      await model.load(app)
      botName = await name
    }
    .refreshable { await model.load(app) }
    .sheet(item: $model.sharing) { link in
      if let url = URL(string: link.url) { ActivityView(items: [url]).presentationDetents([.medium, .large]) }
    }
    .confirmationDialog("Stop sharing this link?", isPresented: $confirmingStop, titleVisibility: .visible) {
      Button("Stop sharing", role: .destructive) { Task { await model.stopSharing(app) } }
      Button("Cancel", role: .cancel) {}
    }
    .actionErrorAlert("Something went wrong", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }))
  }

  private var moreMenu: some View {
    Menu {
      if model.pages.count > 1 {
        Picker(
          "Page",
          selection: Binding(
            get: { model.pageID ?? model.page?.id ?? "" },
            set: { id in Task { await model.select(id, app) } }
          )
        ) {
          ForEach(model.pages) { entry in Text(entry.title).tag(entry.id) }
        }
      }
      Button { Task { await model.share(app) } } label: {
        Label("Share", systemImage: "square.and.arrow.up")
      }
      .disabled(model.busy)
      if model.shared != nil {
        Button(role: .destructive) { confirmingStop = true } label: {
          Label("Stop sharing", systemImage: "link.badge.plus")
        }
        .disabled(model.busy)
      }
    } label: {
      Label("More", systemImage: "ellipsis.circle")
    }
    .accessibilityIdentifier("pageMore")
  }

  // MARK: Blocks

  @ViewBuilder
  private func blockView(_ block: PageBlock) -> some View {
    switch block {
    case let .markdown(text):
      MarkdownView(text: text)
    case let .chart(name, svg):
      SafeHTMLView(html: Self.chartDocument(app.hideAmounts ? maskSVGText(svg) : svg))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
    case .chartError:
      Text("Chart could not be drawn.").font(.footnote)
        .foregroundStyle(Color.token(.mutedForeground))
    case let .metric(label, status, error, value):
      HStack(spacing: 8) {
        Text(label)
        Spacer(minLength: 8)
        if status == "failed" || status == "paused" {
          FailedSource(error: error, canRetry: status == "failed") { Task { await model.refresh(app) } }
        }
        Text(value.map(cell) ?? Self.placeholder(status))
          .monospacedDigit()
          .foregroundStyle(value == nil ? Color.token(.mutedForeground) : Color.token(.foreground))
      }
      .padding(.horizontal, 16).padding(.vertical, 12)
      .background(Color.token(.card), in: RoundedRectangle(cornerRadius: 12))
    case let .table(name, status, error, rows):
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text(name).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          if status == "failed" || status == "paused" {
          FailedSource(error: error, canRetry: status == "failed") { Task { await model.refresh(app) } }
        }
        }
        .padding(.horizontal, 16)
        if rows.isEmpty {
          Text(Self.placeholder(status)).font(.subheadline)
            .foregroundStyle(Color.token(.mutedForeground)).padding(.horizontal, 16)
        } else {
          VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
              VStack(alignment: .leading, spacing: 2) {
                Text(cell(row.title))
                if !row.details.isEmpty {
                  Text(row.details.map(cell).joined(separator: " · ")).font(.subheadline)
                    .foregroundStyle(Color.token(.mutedForeground))
                }
              }
              .frame(maxWidth: .infinity, alignment: .leading)
              .padding(.horizontal, 16).padding(.vertical, 10)
              if index < rows.count - 1 { Divider().padding(.leading, 16) }
            }
          }
          .background(Color.token(.card), in: RoundedRectangle(cornerRadius: 12))
        }
      }
    }
  }

  private func cell(_ cell: LiveCell) -> String {
    cell.usd && app.hideAmounts ? maskCurrencyText(cell.text) : cell.text
  }

  static func warningLabel(canRetry: Bool) -> String { canRetry ? "Source failed" : "Source paused" }

  static func placeholder(_ status: String) -> String {
    switch status {
    case "pending": "Waiting for approval"
    case "denied": "Not approved"
    case "missing": "Source not found"
    case "paused": "Paused"
    default: "No data yet"
    }
  }

  /// The server's SVG, scaled to the width of the screen.
  static func chartDocument(_ svg: String) -> String {
    "<style>svg{display:block;max-width:100%;height:auto}</style>" + svg
  }
}

/// A warning mark for a source whose last refresh failed or is paused; tapping it shows the error, and Retry for a failed one.
private struct FailedSource: View {
  let error: String?
  let canRetry: Bool
  let retry: () -> Void
  @State private var showing = false

  var body: some View {
    Button { showing = true } label: {
      Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Color.token(.warning))
    }
    .accessibilityLabel(AgentPageScreen.warningLabel(canRetry: canRetry))
    .popover(isPresented: $showing) {
      VStack(alignment: .leading, spacing: 12) {
        if let error { Text(error).font(.footnote) }
        if canRetry {
          Button("Retry") {
            showing = false
            retry()
          }
        }
      }
      .padding()
      .presentationCompactAdaptation(.popover)
    }
  }
}
