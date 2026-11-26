import Observation
import RakazoAPI
import SwiftUI

@MainActor
@Observable
final class UsageModel {
  var state: Loadable<UsageSummary> = .idle

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      state = .loaded(try await app.call("usage/summary"))
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }
}

extension UsageSummary {
  /// The server leaves the total empty when some records lack one; the sum of the input, output
  /// and cache counts it sent is then the best figure. Nil only when it sent none of them.
  var displayTotal: Int? {
    if let totalTokens { return totalTokens }
    let known = [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].compactMap { $0 }
    return known.isEmpty ? nil : known.reduce(0, +)
  }
}

struct UsageScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = UsageModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { usage in
      List {
        // The server totals every record for this person in this space, with no date limit.
        Section("All time in this space") {
          row("Runs", usage.runs)
          row("Model calls", usage.modelCalls)
          row("Input tokens", usage.inputTokens)
          row("Output tokens", usage.outputTokens)
          row("Total tokens", usage.displayTotal)
        }
      }
    })
    .navigationTitle("Usage")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
  }

  private func row(_ title: LocalizedStringKey, _ value: Int?) -> some View {
    LabeledContent(title) {
      Text(value.map { $0.formatted() } ?? "—")
    }
  }
}
