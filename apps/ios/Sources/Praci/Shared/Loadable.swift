import SwiftUI
import Observation

enum Loadable<T> {
  case idle
  case loading
  case loaded(T)
  case failed(String)

  var value: T? {
    if case .loaded(let value) = self { value } else { nil }
  }
}

extension Loadable: Sendable where T: Sendable {}

/// Owns the first-load and refresh states for one page, dropping responses that no longer match
/// the current request or space.
@MainActor
@Observable
final class PageLoader<Value: Sendable> {
  private(set) var state: Loadable<Value> = .idle
  private(set) var refreshError: String?
  @ObservationIgnored private var generation = 0
  @ObservationIgnored private var spaceID: String?

  func setRefreshError(_ message: String?) { refreshError = message }
  func setState(_ state: Loadable<Value>) { self.state = state }
  func setValue(_ value: Value) { state = .loaded(value) }

  func load(
    spaceID requestedSpaceID: String?,
    isCurrent: @escaping () -> Bool = { true },
    onError: ( (any Error) -> Void)? = nil,
    onSuccess: ((Value) -> Void)? = nil,
    forceFailure: ((any Error) -> Bool)? = nil,
    fetch: () async throws -> Value
  ) async {
    if spaceID != requestedSpaceID {
      spaceID = requestedSpaceID
      generation += 1
      state = .idle
      refreshError = nil
    }
    generation += 1
    let requestGeneration = generation
    if state.value == nil { state = .loading }

    do {
      let value = try await fetch()
      guard generation == requestGeneration, isCurrent() else { return }
      onSuccess?(value)
      state = .loaded(value)
      refreshError = nil
    } catch {
      guard generation == requestGeneration, isCurrent() else { return }
      onError?(error)
      if forceFailure?(error) == true {
        state = .failed(settingsErrorText(error))
        refreshError = nil
      } else if state.value == nil { state = .failed(settingsErrorText(error)) }
      else { refreshError = settingsErrorText(error) }
    }
  }
}

struct LoadableView<T, Content: View>: View {
  let state: Loadable<T>
  let retry: () -> Void
  @ViewBuilder let content: (T) -> Content

  var body: some View {
    switch state {
    case .idle, .loading:
      ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
    case .loaded(let value):
      content(value)
    case .failed(let message):
      ContentUnavailableView {
        Label("Couldn’t load", systemImage: "exclamationmark.triangle")
      } description: {
        Text(message)
      } actions: {
        Button("Try again", action: retry)
      }
    }
  }
}
