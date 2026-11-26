import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

// Ported from packages/core/src/thread-snapshot-reducer.test.ts (same case names).

@Test("puts a run.phase on the run it names and ignores other runs")
func runPhaseNamesItsRun() throws {
  let started = try reduceThreadSnapshot(
    makeSnapshot(),
    makeEvent("run.started", runId: "run-1", payload: ["trigger": .string("user")])
  )
  let phase: [String: JSONValue] = [
    "kind": .string("connecting"), "name": .string("Devin"), "at": .string(threadAt),
  ]
  let next = try reduceThreadSnapshot(
    started, makeEvent("run.phase", runId: "run-1", seq: 6, payload: phase)
  )
  let expected = RunPhase(kind: "connecting", name: "Devin", at: threadAt)
  #expect(next?.run?.phase == expected)
  #expect(next?.activeRuns?.first?.phase == expected)
  let other = try reduceThreadSnapshot(
    next,
    makeEvent(
      "run.phase", runId: "run-2", seq: 7,
      payload: ["kind": .string("thinking"), "at": .string(threadAt)]
    )
  )
  #expect(other?.cursor == 7)
  #expect(other?.run?.phase == expected)
}

@Test("ignores a late background-run start but advances the cursor")
func ignoresBackgroundRunStart() throws {
  let next = try reduceThreadSnapshot(
    makeSnapshot(),
    makeEvent("run.started", runId: "run-1", payload: ["trigger": .string("tickets")])
  )
  #expect(next?.cursor == 5)
  #expect(next?.run == nil)
}

@Test("clears progress and the busy banner when a takeover is requested")
func clearsProgressOnTakeover() throws {
  let next = try reduceThreadSnapshot(
    makeSnapshot(
      messages: [ThreadMessage(id: "progress:run-1", threadId: "thread-1", seq: 1)],
      computer: ThreadComputer(state: "running", busyBotName: "Peer")
    ),
    makeEvent("computer.takeover.requested", runId: "run-1")
  )
  #expect(next?.messages == [])
  #expect(next?.computer?.busyBotName == nil)
  #expect(next?.run?.id == "run-1")
  #expect(next?.run?.status == "waiting_takeover")
  #expect(next?.run?.trigger == "bot_message")
}

@Test("advances the cursor on a repeated wait without replacing the run")
func repeatedWaitKeepsRun() throws {
  let waiting = try reduceThreadSnapshot(
    makeSnapshot(), makeEvent("run.waiting_input", runId: "run-1")
  )
  let repeated = try reduceThreadSnapshot(
    waiting, makeEvent("run.waiting_input", runId: "run-1", seq: 6)
  )
  #expect(repeated?.cursor == 6)
  #expect(repeated?.run == waiting?.run)
}

@Test("accepts run.started and terminal run events")
func acceptsRunEvents() throws {
  #expect(try isThreadSnapshotEvent(makeEvent("run.started")))
  #expect(try isThreadSnapshotEvent(makeEvent("run.completed")))
  #expect(try !isThreadSnapshotEvent(makeEvent("bot.updated")))
}

@Test("takes the waiting delegate requests from a thread.delegate_pending event")
func takesDelegatePending() throws {
  let agents: JSONValue = .array([
    .object(["messageId": .string("m1"), "id": .string("b2"), "name": .string("B")]),
  ])
  let next = try reduceThreadSnapshot(
    makeSnapshot(),
    makeEvent(
      "thread.delegate_pending",
      payload: ["pending": .array([.string("m1"), .string("m2")]), "agents": agents]
    )
  )
  #expect(next?.cursor == 5)
  #expect(next?.delegatePending == ["m1", "m2"])
  #expect(next?.delegatePendingAgents == [DelegatePendingAgent(messageId: "m1", id: "b2", name: "B")])
}

@Test("ends only the waiting request that a delegate's reply answers")
func endsOnlyAnsweredRequest() throws {
  func reply(_ replyTo: String?) throws -> ProductEvent {
    var payload: [String: JSONValue] = [
      "messageId": .string("reply-1"), "role": .string("user"),
      "blocks": .array([
        .object([
          "kind": .string("bot_message_received"), "fromBotId": .string("b"),
          "fromBotName": .string("B"), "text": .string("done"),
        ]),
      ]),
    ]
    if let replyTo { payload["replyToMessageId"] = .string(replyTo) }
    return try makeEvent("thread.message.created", payload: payload)
  }
  let waiting = makeSnapshot(
    delegatePending: ["m1", "m2"],
    delegatePendingAgents: [
      DelegatePendingAgent(messageId: "m1", id: "b2", name: "B"),
      DelegatePendingAgent(messageId: "m2", id: "b3", name: "C"),
    ]
  )
  #expect(try reduceThreadSnapshot(waiting, reply("m1"))?.delegatePending == ["m2"])
  #expect(
    try reduceThreadSnapshot(waiting, reply("m1"))?.delegatePendingAgents == [
      DelegatePendingAgent(messageId: "m2", id: "b3", name: "C"),
    ]
  )
  // A message that answers no waiting request (a status update, another agent) changes nothing.
  #expect(try reduceThreadSnapshot(waiting, reply(nil))?.delegatePending == ["m1", "m2"])
  #expect(try reduceThreadSnapshot(waiting, reply("other"))?.delegatePending == ["m1", "m2"])
}

@Test(
  "settles helpers on a stopping event without reviving them on resume",
  arguments: [
    "run.waiting_input", "computer.takeover.requested", "run.completed", "run.failed",
    "run.cancelled",
  ]
)
func settlesHelpers(type: String) throws {
  let helper: [String: JSONValue] = [
    "agentId": .string("helper"), "name": .string("Helper"), "task": .string("Check"),
    "status": .string("running"),
  ]
  func helperBlock(_ next: ThreadSnapshot?, _ id: String) -> MessageBlock? {
    next?.messages.first { $0.id == "subagent:\(id)" }?.blocks.first
  }
  var next = try reduceThreadSnapshot(
    makeSnapshot(), makeEvent("thread.subagent", runId: "run-1", seq: 1, payload: helper)
  )
  next = try reduceThreadSnapshot(next, makeEvent(type, runId: "run-1", seq: 2))
  #expect(helperBlock(next, "helper")?.fields["status"] == .string("failed"))
  #expect(helperBlock(next, "helper")?.fields["result"] == .string("stopped"))
  next = try reduceThreadSnapshot(next, makeEvent("run.started", runId: "run-1", seq: 3))
  var resumed = helper
  resumed["agentId"] = .string("resumed")
  next = try reduceThreadSnapshot(
    next, makeEvent("thread.subagent", runId: "run-1", seq: 4, payload: resumed)
  )
  #expect(helperBlock(next, "helper")?.fields["status"] == .string("failed"))
  #expect(helperBlock(next, "resumed")?.fields["status"] == .string("running"))
}

// Cases the TypeScript file does not cover: the paths the live thread screen depends on.

@Test("streams progress into one live message, then replaces it with the stored message")
func progressThenStoredMessage() throws {
  var snapshot = makeSnapshot(messages: [ThreadMessage(id: "m0", seq: 0, role: "user")])
  try snapshot =
    try #require(reduceThreadSnapshot(
      snapshot,
      makeEvent(
        "thread.progress", runId: "run-1", seq: 4,
        payload: ["text": .string("Lis"), "streaming": .bool(true)]
      )
    ))
  try snapshot =
    try #require(reduceThreadSnapshot(
      snapshot,
      makeEvent(
        "thread.progress", runId: "run-1", seq: 5, payload: ["delta": .string("bon")]
      )
    ))
  #expect(snapshot.messages.map(\.id) == ["m0", "progress:run-1"])
  #expect(snapshot.messages[1].blocks == [block("progress", ["text": .string("Lisbon")])])
  try snapshot =
    try #require(reduceThreadSnapshot(
      snapshot,
      makeEvent(
        "thread.message.created", runId: "run-1", seq: 6,
        payload: [
          "messageId": .string("m2"), "role": .string("bot"),
          "blocks": .array([.object(["kind": .string("text"), "text": .string("Lisbon")])]),
        ]
      )
    ))
  #expect(snapshot.messages.map(\.id) == ["m0", "m2"])
  #expect(snapshot.cursor == 6)
}

@Test("a failed run stays in run with its error and leaves activeRuns")
func failedRunKeepsError() throws {
  var snapshot = try reduceThreadSnapshot(
    makeSnapshot(), makeEvent("run.started", runId: "run-1", payload: ["trigger": .string("user")])
  )
  snapshot = try reduceThreadSnapshot(
    snapshot,
    makeEvent("run.failed", runId: "run-1", seq: 6, payload: ["error": .string("provider missing")])
  )
  #expect(snapshot?.run?.status == "failed")
  #expect(snapshot?.run?.error == "provider missing")
  #expect(snapshot?.activeRuns == [])
  let done = try reduceThreadSnapshot(
    reduceThreadSnapshot(
      makeSnapshot(), makeEvent("run.started", runId: "run-1", payload: ["trigger": .string("user")])
    ),
    makeEvent("run.completed", runId: "run-1", seq: 6)
  )
  #expect(done?.run == nil)
}

@Test("group threads accumulate concurrent member runs and mark members running")
func groupRuns() throws {
  let members = [ThreadMember(botId: "bot-1", name: "A", status: "idle")]
  var snapshot = makeSnapshot(groupId: "group-1", members: members)
  try snapshot =
    try #require(reduceThreadSnapshot(snapshot, makeEvent("run.started", runId: "run-1", seq: 4)))
  try snapshot =
    try #require(reduceThreadSnapshot(
      snapshot, makeEvent("run.started", runId: "run-2", seq: 5, botId: "bot-2")
    ))
  #expect(snapshot.activeRuns?.map(\.id) == ["run-1", "run-2"])
  #expect(snapshot.members?.first?.status == "running")
}

@Test("thread.cleared empties the thread and a null snapshot stays null")
func clearedAndNull() throws {
  let cleared = try reduceThreadSnapshot(
    makeSnapshot(messages: [ThreadMessage(id: "m")]), makeEvent("thread.cleared", seq: 9)
  )
  #expect(cleared?.messages == [])
  #expect(cleared?.cursor == 9)
  #expect(try reduceThreadSnapshot(nil, makeEvent("thread.cleared")) == nil)
}

@Test("a cloud_agent event updates the matching block in place")
func cloudAgentEvent() throws {
  let cloud = block(
    "cloud_agent",
    [
      "agentId": .string("a1"), "title": .string("Agent"), "status": .string("running"),
      "url": .string(""),
    ]
  )
  let next = try reduceThreadSnapshot(
    makeSnapshot(messages: [ThreadMessage(id: "m1", blocks: [cloud])]),
    makeEvent(
      "thread.cloud_agent",
      payload: ["agentId": .string("a1"), "messageId": .string("m1"), "status": .string("finished")]
    )
  )
  #expect(next?.messages.first?.blocks.first?.fields["status"] == .string("finished"))
}

@Test("a message update keeps createdAt, callId and reply metadata it omits")
func messageUpdateKeepsMetadata() throws {
  let known = ThreadMessage(
    id: "m1", seq: 1, role: "bot", replyToMessageId: "r1", replyQuote: "q", callId: "c1",
    createdAt: "2025-01-01T00:00:00.000Z"
  )
  let next = try reduceThreadSnapshot(
    makeSnapshot(messages: [known]),
    makeEvent("thread.message.updated", seq: 8, payload: ["messageId": .string("m1")])
  )
  let message = try #require(next?.messages.first)
  #expect(message.createdAt == "2025-01-01T00:00:00.000Z")
  #expect(message.callId == "c1")
  #expect(message.replyToMessageId == "r1")
  #expect(message.replyQuote == "q")
  #expect(message.seq == 8)
}

@Test("folds thread.goal.updated into the snapshot and clears it on null or thread.cleared")
func foldsGoalUpdates() throws {
  let goal: JSONValue = .object([
    "id": .string("goal-1"), "text": .string("Find three suppliers"), "status": .string("paused"),
    "stopReason": .string("owner"), "lastReason": .null, "continuations": .number(2),
    "startedAt": .string(threadAt),
  ])
  let set = try reduceThreadSnapshot(
    makeSnapshot(), makeEvent("thread.goal.updated", seq: 6, payload: ["goal": goal]))
  #expect(set?.cursor == 6)
  #expect(set?.goal?.text == "Find three suppliers")
  #expect(set?.goal?.status == "paused")
  let none = try reduceThreadSnapshot(
    set, makeEvent("thread.goal.updated", seq: 7, payload: ["goal": .null]))
  #expect(none?.goal == nil)
  let again = try reduceThreadSnapshot(
    set, makeEvent("thread.cleared", seq: 8))
  #expect(again?.goal == nil)
  #expect(try isThreadSnapshotEvent(makeEvent("thread.goal.updated")))
}
