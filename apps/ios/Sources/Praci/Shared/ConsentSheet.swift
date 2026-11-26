import Observation
import RakazoCore
import SwiftUI

/// The foreground disclosure for one AI recipient. With `init(procedure:onDone:)` the sheet looks
/// up the first recipient that still needs consent for the procedure and records the answer itself.
/// With a recipient it only reports the choice, so `AIConsentGate` or the caller records it.
struct ConsentSheet: View {
  @Environment(AppModel.self) private var app
  @Environment(\.openURL) private var openURL
  let procedure: String
  let onDone: (Bool) -> Void
  @State private var target: Target?
  @State private var recordsAnswer = false
  @State private var failure: String?

  struct Target {
    var recipient: AIRecipient
    var privacyURL: String?
    var scope: String
    var version: String
  }

  init(procedure: String, onDone: @escaping (Bool) -> Void) {
    self.procedure = procedure
    self.onDone = onDone
    _recordsAnswer = State(initialValue: true)
  }

  init(
    procedure: String, recipient: AIRecipient, privacyURL: String?,
    onDone: @escaping (Bool) -> Void
  ) {
    self.procedure = procedure
    self.onDone = onDone
    _target = State(
      initialValue: Target(recipient: recipient, privacyURL: privacyURL, scope: "", version: ""))
  }

  var body: some View {
    ScrollView { form }
      .scrollBounceBehavior(.basedOnSize)
      .presentationDetents([.medium, .large])
      .task { await loadIfNeeded() }
  }

  private var form: some View {
    VStack(spacing: 16) {
      if let target {
        Text(Self.title(for: target.recipient)).font(.title3.bold()).multilineTextAlignment(.center)
        Text(AIConsent.disclosure(for: target.recipient.use))
          .multilineTextAlignment(.center)
          .foregroundStyle(Color.token(.mutedForeground))
        if let failure { Text(failure).foregroundStyle(Color.token(.destructive)) }
        VStack(spacing: 8) {
          Button {
            Task { await allow(target) }
          } label: {
            Text("Allow").frame(maxWidth: .infinity)
              .foregroundStyle(Color.token(.primaryForeground))
          }
          .buttonStyle(.borderedProminent)
          .controlSize(.large)
          .accessibilityIdentifier("consentAllow")
          Button("Not now") { onDone(false) }
            .accessibilityIdentifier("consentNotNow")
        }
        if let url = (target.recipient.privacyURL ?? target.privacyURL).flatMap(URL.init(string:)) {
          Button("Privacy details") { openURL(url) }.font(.footnote)
        }
      } else if let failure {
        Text(failure).foregroundStyle(Color.token(.destructive))
        Button("Close") { onDone(false) }
      } else {
        ProgressView()
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  static func title(for recipient: AIRecipient) -> String {
    switch recipient.use {
    case .model: "Share messages and attachments with \(recipient.name)?"
    case .voice: "Share recordings with \(recipient.name)?"
    case .memory: "Share summaries and memories with \(recipient.name)?"
    }
  }

  private func loadIfNeeded() async {
    guard recordsAnswer, target == nil else { return }
    do {
      let status: AIConsentStatus = try await app.call(
        "aiConsent/status", input: ConsentStatusInput(uses: AIConsent.uses(forProcedure: procedure)))
      let uses = AIConsent.uses(forProcedure: procedure)
      guard let recipient = status.recipients.first(where: { !$0.allowed && uses.contains($0.use) })
      else {
        onDone(true)
        return
      }
      target = Target(
        recipient: recipient, privacyURL: status.privacyURL, scope: status.scope,
        version: status.version)
    } catch {
      failure = settingsErrorText(error)
    }
  }

  private func allow(_ target: Target) async {
    guard recordsAnswer else { return onDone(true) }
    do {
      let _: AIConsentStatus = try await app.call(
        "aiConsent/allow",
        input: ConsentAllowInput(
          scope: target.scope, version: target.version, keys: [target.recipient.key]))
      onDone(true)
    } catch {
      failure = settingsErrorText(error)
    }
  }
}

struct ConsentStatusInput: Encodable, Sendable { var uses: [AIDataUse]? }
struct ConsentAllowInput: Encodable, Sendable {
  var scope: String
  var version: String
  var keys: [String]
}

/// Shows the consent sheet for `AIConsentGate`. Attach `.consentSheet(prompter)` to a view near the
/// root, then call `ensure` before a request that sends data to an AI provider.
@MainActor
@Observable
final class ConsentPrompter {
  struct Request: Identifiable {
    let id = UUID()
    let procedure: String
    let recipient: AIRecipient
    let privacyURL: String?
  }

  var request: Request?
  @ObservationIgnored private var continuation: CheckedContinuation<Bool, Never>?
  @ObservationIgnored private let gate = AIConsentGate()

  func ensure(procedure: String, routineActive: Bool? = nil, app: AppModel) async throws {
    let uses = AIConsent.uses(forProcedure: procedure, routineActive: routineActive)
    try await gate.ensure(
      uses: uses,
      coalesceKey: "",
      status: { try await app.call("aiConsent/status", input: ConsentStatusInput(uses: uses)) },
      prompt: { [self] recipient, url in
        await show(Request(procedure: procedure, recipient: recipient, privacyURL: url))
      },
      allow: { grant in
        let _: AIConsentStatus = try await app.call(
          "aiConsent/allow",
          input: ConsentAllowInput(scope: grant.scope, version: grant.version, keys: grant.keys))
      })
  }

  func resolve(_ allowed: Bool) {
    request = nil
    continuation?.resume(returning: allowed)
    continuation = nil
  }

  private func show(_ next: Request) async -> Bool {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      request = next
    }
  }
}

extension View {
  func consentSheet(_ prompter: ConsentPrompter) -> some View {
    sheet(
      item: Binding(get: { prompter.request }, set: { if $0 == nil { prompter.resolve(false) } })
    ) { request in
      ConsentSheet(
        procedure: request.procedure, recipient: request.recipient,
        privacyURL: request.privacyURL, onDone: prompter.resolve)
    }
  }
}
