import Foundation
import Testing

@testable import Praci

@Test
@MainActor
func pageLoaderShowsFirstLoadFailure() async {
  let loader = PageLoader<String>()

  await loader.load(spaceID: "space-a") { throw PageFailure.unavailable }

  #expect(loader.state.value == nil)
  if case .failed(let message) = loader.state {
    #expect(message == "The page could not load.")
  } else {
    #expect(Bool(false))
  }
  #expect(loader.refreshError == nil)
}

@Test
@MainActor
func pageLoaderKeepsValueAndSetsRefreshError() async {
  let loader = PageLoader<String>()
  await loader.load(spaceID: "space-a") { "loaded" }

  await loader.load(spaceID: "space-a") { throw PageFailure.unavailable }

  #expect(loader.state.value == "loaded")
  #expect(loader.refreshError == PageFailure.unavailable.localizedDescription)
}

@Test
@MainActor
func pageLoaderDropsResultFromPreviousSpace() async {
  let loader = PageLoader<String>()
  let response = LoaderResponse()
  let earlier = Task {
    await loader.load(spaceID: "space-a") { await response.wait() }
  }
  await response.waitUntilRequested()

  await loader.load(spaceID: "space-b") { "new space" }
  await response.resume("old space")
  await earlier.value

  #expect(loader.state.value == "new space")
  #expect(loader.refreshError == nil)
}

private enum PageFailure: LocalizedError {
  case unavailable
  var errorDescription: String? { "The page could not load." }
}

@MainActor
private final class LoaderResponse {
  private var continuation: CheckedContinuation<String, Never>?
  private var requestedContinuation: CheckedContinuation<Void, Never>?

  func wait() async -> String {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      requestedContinuation?.resume()
      requestedContinuation = nil
    }
  }

  func waitUntilRequested() async {
    if continuation != nil { return }
    await withCheckedContinuation { requestedContinuation = $0 }
  }

  func resume(_ value: String) {
    continuation?.resume(returning: value)
    continuation = nil
  }
}
