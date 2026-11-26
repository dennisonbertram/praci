import Foundation
import Observation
import RakazoCore

/// Rules for the Change password form.
enum PasswordFormError: Equatable {
  case mismatch

  var message: String { String(localized: "Passwords do not match") }
}

struct ChangePasswordForm: Equatable {
  var current = ""
  var new = ""
  var confirmation = ""

  /// Save is enabled once every field is filled and the new password is long enough.
  var canSave: Bool { !current.isEmpty && new.count >= 8 && !confirmation.isEmpty }
  var error: PasswordFormError? { !confirmation.isEmpty && new != confirmation ? .mismatch : nil }
}

@MainActor
@Observable
final class AccountModel {
  var security: Loadable<AccountSecurity> = .idle
  var notice: String?
  var busy = false
  var errorMessage: String?
  /// Set once the server has emailed a deletion code.
  var codeSent = false

  func load(_ app: AppModel) async {
    if security.value == nil { security = .loading }
    do {
      security = .loaded(try await app.authentication.client.accountSecurity())
    } catch {
      await app.authentication.sync()
      if security.value == nil { security = .failed(Self.message(error)) }
    }
  }

  /// True when the password was changed. The person stays signed in on this device.
  func changePassword(_ form: ChangePasswordForm, _ app: AppModel) async -> Bool {
    guard form.error == nil, form.canSave, !busy else { return false }
    busy = true
    errorMessage = nil
    defer { busy = false }
    do {
      try await app.authentication.client.changePassword(current: form.current, new: form.new)
      await app.authentication.sync()
      notice = String(localized: "Password changed")
      return true
    } catch {
      // The client may have ended the session (rejected, or no replacement could be kept).
      await app.authentication.sync()
      errorMessage = Self.message(error)
      return false
    }
  }

  func sendDeletionCode(_ app: AppModel) async {
    guard !busy else { return }
    busy = true
    errorMessage = nil
    defer { busy = false }
    do {
      try await app.authentication.client.requestAccountDeletionCode()
      codeSent = true
    } catch {
      await app.authentication.sync()
      errorMessage = Self.message(error)
    }
  }

  /// On success the session is gone: leave Settings and show sign-in.
  func delete(_ proof: AccountDeletionProof, _ app: AppModel) async -> Bool {
    guard !busy else { return false }
    busy = true
    errorMessage = nil
    defer { busy = false }
    await app.authentication.beforeSessionEnds?()
    do {
      // The account is gone once the server says so, even if this device could not clear itself.
      _ = try await app.authentication.client.deleteAccount(proof)
      app.reset()
      await app.authentication.sync()
      app.authentication.showNotice(String(localized: "Your account was deleted"))
      return true
    } catch {
      await app.authentication.sync()
      errorMessage = Self.message(error)
      return false
    }
  }

  /// Emailed codes are hexadecimal; pasting can add spaces or line breaks.
  static func cleanCode(_ pasted: String) -> String {
    String(pasted.filter { !$0.isWhitespace })
  }

  private static func message(_ error: any Error) -> String {
    (error as? any LocalizedError)?.errorDescription ?? String(localized: "Something went wrong. Try again.")
  }
}
