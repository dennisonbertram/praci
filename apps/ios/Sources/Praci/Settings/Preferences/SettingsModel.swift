import Foundation
import Observation
import RakazoAPI

/// The profile and the server-side preferences shown in the Settings list.
@MainActor
@Observable
final class SettingsModel {
  var state: Loadable<Me> = .idle
  /// Shown under the list when a change could not be saved.
  var errorMessage: String?
  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      let profile = try await app.loadProfile()
      state = .loaded(profile)
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }

  /// Flips the switch at once and puts it back if the server refuses.
  func setHideAmounts(_ value: Bool, _ app: AppModel) async {
    errorMessage = nil
    do {
      try await app.updateHideAmounts(value)
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
