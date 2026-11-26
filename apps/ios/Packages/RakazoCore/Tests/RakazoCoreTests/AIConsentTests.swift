import Foundation
@testable import RakazoCore
import Testing

private let version = "2026-09-14"

private func recipient(_ key: String, _ use: AIDataUse, allowed: Bool = false) -> AIRecipient {
  AIRecipient(key: key, name: "Example \(key)", use: use, allowed: allowed)
}

private let status = AIConsentStatus(
  scope: "account-space", version: version,
  recipients: [recipient("model", .model), recipient("voice", .voice)]
)

private actor Calls {
  var prompts = 0
  var grants: [AIConsentGrant] = []
  var order: [String] = []
  func prompted() {
    prompts += 1
    order.append("prompt")
  }

  func granted(_ grant: AIConsentGrant) {
    grants.append(grant)
    order.append("allow")
  }
}

private struct Offline: Error {}

@Test("identifies a failed preflight separately from a dispatched mutation failure")
func preflightFailureIsBlocked() async {
  await #expect(throws: AIConsentBlocked.self) {
    try await AIConsentGate().ensure(
      uses: [.model], status: { throw Offline() }, prompt: { _, _ in true }, allow: { _ in }
    )
  }
}

@Test("keeps the preflight failure as the cause so an unreachable server stays recognizable")
func keepsCause() async {
  do {
    try await AIConsentGate().ensure(
      uses: [.model], status: { throw Offline() }, prompt: { _, _ in true }, allow: { _ in }
    )
    Issue.record("expected a throw")
  } catch let blocked as AIConsentBlocked {
    #expect(blocked.underlying is Offline)
  } catch {
    Issue.record("wrong error \(error)")
  }
}

@Test("does not grant anything when declined")
func declinedGrantsNothing() async {
  let calls = Calls()
  await #expect(throws: AIConsentBlocked.self) {
    try await AIConsentGate().ensure(
      uses: [.model], status: { status }, prompt: { _, _ in false },
      allow: { await calls.granted($0) }
    )
  }
  #expect(await calls.grants.isEmpty)
}

@Test("only grants the disclosed feature after explicit permission, bound to the account and version")
func grantsAfterPrompt() async throws {
  let calls = Calls()
  try await AIConsentGate().ensure(
    uses: [.model], status: { status },
    prompt: { _, _ in
      await calls.prompted()
      return true
    }, allow: { await calls.granted($0) }
  )
  #expect(await calls.order == ["prompt", "allow"])
  #expect(await calls.grants == [AIConsentGrant(scope: "account-space", version: version, keys: ["model"])])
}

@Test("does not prompt for already granted permissions or read-only procedures")
func noPromptWhenAllowed() async throws {
  let calls = Calls()
  let granted = AIConsentStatus(
    scope: status.scope, version: version,
    recipients: status.recipients.map { recipient($0.key, $0.use, allowed: true) }
  )
  try await AIConsentGate().ensure(
    uses: [.model], status: { granted },
    prompt: { _, _ in
      await calls.prompted()
      return true
    }, allow: { _ in }
  )
  #expect(await calls.prompts == 0)
  #expect(AIConsent.uses(forProcedure: "threads/get") == [])
  #expect(AIConsent.uses(forProcedure: "threads/send") == [.model, .memory])
  #expect(AIConsent.uses(forProcedure: "threads.send") == [.model, .memory])
  #expect(AIConsent.uses(forProcedure: "voice/prepare") == [.voice])
  #expect(AIConsent.uses(forProcedure: "routines/update", routineActive: false) == [])
  #expect(AIConsent.uses(forProcedure: "routines/update", routineActive: true) == [.model, .memory])
  #expect(
    AIConsentTarget.resolve(botID: nil, groupID: nil, routineID: "routine-1")
      == AIConsentTarget(routineID: "routine-1")
  )
  #expect(
    AIConsentTarget.resolve(botID: "bot", groupID: nil, routineID: nil)
      == AIConsentTarget(botID: "bot")
  )
  #expect(
    AIConsentTarget.resolve(botID: "bot", groupID: "group", routineID: "r")
      == AIConsentTarget(groupID: "group", routineID: "r")
  )
}

@Test("coalesces concurrent prompts and grants for one account-space recipient")
func coalescesConcurrent() async throws {
  let calls = Calls()
  let gate = AIConsentGate()
  func run() async throws {
    try await gate.ensure(
      uses: [.model], status: { status },
      prompt: { _, _ in
        await calls.prompted()
        try? await Task.sleep(for: .milliseconds(100))
        return true
      }, allow: { await calls.granted($0) }
    )
  }
  async let first: Void = run()
  async let second: Void = run()
  _ = try await (first, second)
  #expect(await calls.prompts == 1)
  #expect(await calls.grants.count == 1)
}

@Test("does not share a pending grant across account-space scopes or recipients")
func separateScopesDoNotShare() async throws {
  let calls = Calls()
  let gate = AIConsentGate()
  let statuses = [
    AIConsentStatus(scope: "account-a-space", version: version, recipients: [status.recipients[0]]),
    AIConsentStatus(scope: "account-b-space", version: version, recipients: [status.recipients[0]]),
    AIConsentStatus(scope: "account-a-space", version: version, recipients: [status.recipients[1]]),
  ]
  try await withThrowingTaskGroup(of: Void.self) { group in
    for current in statuses {
      group.addTask {
        try await gate.ensure(
          uses: [.model, .voice], status: { current },
          prompt: { _, _ in
            await calls.prompted()
            try? await Task.sleep(for: .milliseconds(50))
            return true
          }, allow: { await calls.granted($0) }
        )
      }
    }
    try await group.waitForAll()
  }
  #expect(await calls.prompts == 3)
  #expect(await calls.grants.count == 3)
}

@Test("does not share a grant across independent API contexts")
func separateAPIContexts() async throws {
  let calls = Calls()
  let gate = AIConsentGate()
  try await withThrowingTaskGroup(of: Void.self) { group in
    for key in ["https://one.example", "https://two.example"] {
      group.addTask {
        try await gate.ensure(
          uses: [.model], coalesceKey: key, status: { status },
          prompt: { _, _ in
            await calls.prompted()
            try? await Task.sleep(for: .milliseconds(50))
            return true
          }, allow: { await calls.granted($0) }
        )
      }
    }
    try await group.waitForAll()
  }
  #expect(await calls.prompts == 2)
  #expect(await calls.grants.count == 2)
}
