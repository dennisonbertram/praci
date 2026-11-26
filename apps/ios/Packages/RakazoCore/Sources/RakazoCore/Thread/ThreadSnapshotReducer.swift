import Foundation
import RakazoAPI

// Port of packages/core/src/thread-snapshot-reducer.ts. The server and every client fold the
// same product events into a `threads.get` snapshot, so keep the branches in the same order.

private let knownTriggers: Set<String> = [
  "user", "routine", "resume", "follow_up", "reaction", "call_end", "spawn", "skill",
  "bot_message", "webhook", "messaging", "cloud_agent", "created", "tickets",
]

/// Ticket work runs in the background and stays out of the transcript.
private let backgroundRunTriggers: Set<String> = ["tickets"]

public func activeThreadRuns(_ snapshot: ThreadSnapshot?) -> [ThreadRun] {
  snapshot?.activeRuns ?? snapshot?.run.map { [$0] } ?? []
}

/// True for events that `reduceThreadSnapshot` folds into the snapshot.
public func isThreadSnapshotEvent(_ event: ProductEvent) -> Bool {
  switch event.type {
  case "thread.cleared", "thread.progress", "thread.subagent", "thread.cloud_agent",
       "thread.delegate_pending", "agent.tool.called", "agent.tool.completed",
       "thread.message.created", "thread.message.updated", "thread.message.reaction", "run.started",
       "run.phase", "run.waiting_input", "computer.takeover.requested", "thread.goal.updated":
    true
  default:
    isRunTerminalEvent(type: event.type)
  }
}

private func nonEmpty(_ value: String?) -> String? {
  guard let value, !value.isEmpty else { return nil }
  return value
}

private func runFromStartedEvent(_ event: ProductEvent, previous: ThreadRun?) -> ThreadRun {
  let trigger = event.payload["trigger"]?.stringValue
  return ThreadRun(
    id: nonEmpty(event.runId) ?? previous?.id ?? event.id,
    userId: event.payload["userId"]?.stringValue ?? previous?.userId,
    botId: event.botId,
    threadId: event.threadId,
    taskId: previous?.taskId ?? nonEmpty(event.runId) ?? event.id,
    status: "running",
    trigger: trigger.flatMap { knownTriggers.contains($0) ? $0 : nil } ?? previous?.trigger ?? "user",
    routineId: event.payload["routineId"]?.stringValue ?? previous?.routineId,
    modelProvider: previous?.modelProvider,
    modelId: previous?.modelId,
    error: nil,
    phase: previous?.phase,
    startedAt: previous?.startedAt ?? event.createdAt,
    completedAt: nil,
    createdAt: previous?.createdAt ?? event.createdAt
  )
}

private func updateMemberStatus(_ members: [ThreadMember]?, botID: String, status: String)
  -> [ThreadMember]?
{
  guard let member = members?.first(where: { $0.botId == botID }), member.status != status else {
    return members
  }
  return members?.map { candidate in
    guard candidate.botId == botID else { return candidate }
    var updated = candidate
    updated.status = status
    return updated
  }
}

private func liveMessage(for event: ProductEvent, blocks: [MessageBlock], id: String)
  -> ThreadMessage
{
  ThreadMessage(
    id: id, threadId: event.threadId, seq: event.seq, role: "bot", blocks: blocks,
    botId: event.botId, runId: event.runId, createdAt: event.createdAt
  )
}

/// Updates may omit reply metadata; retain it until an authoritative value arrives.
private func applyReplyMetadata(
  _ payload: [String: JSONValue], to message: inout ThreadMessage, previous: ThreadMessage?
) {
  message.replyToMessageId = payload["replyToMessageId"]?.stringValue ?? previous?.replyToMessageId
  message.replyQuote = payload["replyQuote"]?.stringValue ?? previous?.replyQuote
  switch payload["replyPreview"] {
  case .null?: message.replyPreview = nil
  case .object?:
    if let preview = try? payload["replyPreview"]?.decode(ReplyPreview.self) {
      message.replyPreview = preview
    } else {
      message.replyPreview = previous?.replyPreview
    }
  default: message.replyPreview = previous?.replyPreview
  }
}

private func replacedSubagent(_ message: ThreadMessage, agentIDs: Set<String>) -> Bool {
  guard !agentIDs.isEmpty else { return false }
  return message.blocks.contains { block in
    guard block.kind == .subagent, let id = block.fields["agentId"]?.stringValue else {
      return false
    }
    return agentIDs.contains(id)
  }
}

// Fold one product event into a thread snapshot. The dispatch is one case per event type,
// so its complexity is the event list itself.
// swiftlint:disable:next cyclomatic_complexity
public func reduceThreadSnapshot(_ previous: ThreadSnapshot?, _ event: ProductEvent)
  -> ThreadSnapshot?
{
  guard var prev = previous else { return previous }
  if stopsRunHelpers(type: event.type) {
    prev.messages = settleRunSubagents(prev.messages, runID: event.runId)
  }
  let runID = nonEmpty(event.runId)

  switch event.type {
  case "thread.cleared":
    prev.cursor = event.seq
    prev.messages = []
    prev.olderCursor = nil
    prev.run = nil
    prev.activeRuns = []
    prev.goal = nil
    return prev
  case "thread.goal.updated":
    prev.cursor = event.seq
    prev.goal = try? event.payload["goal"]?.decode(ThreadGoal.self)
    return prev
  case "run.started":
    return reduceRunStarted(prev, event: event, runID: runID)
  case "run.phase":
    return reduceRunPhase(prev, event: event, runID: runID)
  case "run.waiting_input", "computer.takeover.requested":
    return reduceWaiting(prev, event: event, runID: runID)
  case let type where isRunTerminalEvent(type: type):
    return reduceRunEnded(prev, event: event, runID: runID)
  case "thread.progress", "agent.tool.called":
    return reduceLiveUpdate(prev, event: event)
  case "agent.tool.completed":
    prev.cursor = event.seq
    return prev
  case "thread.subagent":
    return reduceSubagent(prev, event: event)
  case "thread.delegate_pending":
    return reduceDelegatePending(prev, event: event)
  case "thread.cloud_agent":
    prev.cursor = event.seq
    prev.messages = updateCloudAgentMessages(prev.messages, payload: event.payload)
    return prev
  case "thread.message.created", "thread.message.updated":
    return reduceMessage(prev, event: event)
  default:
    return prev
  }
}

private func reduceRunStarted(_ snapshot: ThreadSnapshot, event: ProductEvent, runID: String?)
  -> ThreadSnapshot
{
  var prev = snapshot
  // Background runs stay invisible; the server already filters their events, this guards a late one.
  if let trigger = event.payload["trigger"]?.stringValue, backgroundRunTriggers.contains(trigger) {
    prev.cursor = event.seq
    return prev
  }
  prev.cursor = event.seq
  prev.members = updateMemberStatus(prev.members, botID: event.botId, status: "running")
  guard let runID else { return prev }
  let previousRun =
    prev.activeRuns?.first { $0.id == runID } ?? (prev.run?.id == runID ? prev.run : nil)
  let run = runFromStartedEvent(event, previous: previousRun)
  let without = activeThreadRuns(prev).filter { $0.id != run.id }
  let keepsGroupFailure =
    prev.groupId != nil && prev.run?.status == "failed" && prev.run?.id != run.id
  // A group failure lives only in `run`; keep it until dismissed so a late member start cannot wipe it.
  prev.run = keepsGroupFailure ? prev.run : run
  // Bot threads keep a single primary run; groups accumulate concurrent member runs.
  prev.activeRuns = prev.groupId != nil ? without + [run] : [run]
  return prev
}

private func reduceRunPhase(_ snapshot: ThreadSnapshot, event: ProductEvent, runID: String?)
  -> ThreadSnapshot
{
  var prev = snapshot
  prev.cursor = event.seq
  guard let runID,
        prev.run?.id == runID || prev.activeRuns?.contains(where: { $0.id == runID }) == true,
        let phase = try? JSONValue.object(event.payload).decode(RunPhase.self),
        RunPhase.knownKinds.contains(phase.kind)
  else { return prev }
  func withPhase(_ run: ThreadRun) -> ThreadRun {
    guard run.id == runID else { return run }
    var run = run
    run.phase = phase
    return run
  }
  prev.run = prev.run.map(withPhase)
  prev.activeRuns = prev.activeRuns?.map(withPhase)
  return prev
}

private func reduceRunEnded(_ snapshot: ThreadSnapshot, event: ProductEvent, runID: String?)
  -> ThreadSnapshot
{
  var prev = snapshot
  let activeRuns = prev.activeRuns?.filter { $0.id != runID }
  let nextMemberRun = activeRuns?.first { $0.botId == event.botId }
  let failure = runFailureError(type: event.type, payload: event.payload)
  let primaryEnded = runID != nil && prev.run?.id == runID ? prev.run : nil
  // In a group the failing run may be a member run, so look in activeRuns too or its error is lost.
  let endedRun = primaryEnded ?? prev.activeRuns?.first { $0.id == runID }
  let liveID = progressMessageID(event)
  prev.cursor = event.seq
  prev.messages = prev.messages.filter { $0.id != liveID }
  prev.members = updateMemberStatus(
    prev.members, botID: event.botId, status: nextMemberRun?.status ?? "idle"
  )
  // A failed run stays in `run` so the transcript can say why it stopped, like threads.get does.
  if var ended = endedRun, let failure {
    ended.status = "failed"
    ended.error = failure
    prev.run = ended
  } else if primaryEnded != nil {
    prev.run = activeRuns?.first
  }
  prev.activeRuns = activeRuns
  return prev
}

/// `thread.progress` and `agent.tool.called` both fold into the run's single live message.
private func reduceLiveUpdate(_ snapshot: ThreadSnapshot, event: ProductEvent) -> ThreadSnapshot {
  var prev = snapshot
  let liveID = progressMessageID(event)
  let (old, remaining) = takeLiveMessage(prev.messages, liveID: liveID)
  let update: LiveMessageUpdate =
    event.type == "thread.progress"
      ? .progress(event.payload) : .tool(event.payload["name"]?.stringValue ?? "")
  let blocks = reduceLiveMessageBlocks(old?.blocks ?? [], update)
  prev.cursor = event.seq
  prev.messages = remaining + [liveMessage(for: event, blocks: blocks, id: liveID)]
  return prev
}

private func reduceSubagent(_ snapshot: ThreadSnapshot, event: ProductEvent) -> ThreadSnapshot {
  var prev = snapshot
  let block = subagentBlock(from: event.payload)
  let agentID = block.fields["agentId"]?.stringValue ?? ""
  let next = liveMessage(for: event, blocks: [block], id: "subagent:\(agentID)")
  var without: [ThreadMessage] = []
  var kept: [ThreadMessage] = []
  for message in prev.messages {
    if message.id == next.id { continue }
    if message.id.hasPrefix("progress:") {
      if message.runId != nil { kept.append(message) }
    } else {
      without.append(message)
    }
  }
  prev.cursor = event.seq
  prev.messages = without + [next] + kept
  return prev
}

private func reduceDelegatePending(_ snapshot: ThreadSnapshot, event: ProductEvent)
  -> ThreadSnapshot
{
  var prev = snapshot
  prev.cursor = event.seq
  if case let .array(pending)? = event.payload["pending"] {
    prev.delegatePending = pending.compactMap(\.stringValue)
  } else {
    prev.delegatePending = []
  }
  if case .array? = event.payload["agents"] {
    prev.delegatePendingAgents =
      (try? event.payload["agents"]?.decode([DelegatePendingAgent].self)) ?? []
  } else {
    prev.delegatePendingAgents = []
  }
  return prev
}

private func reduceWaiting(_ snapshot: ThreadSnapshot, event: ProductEvent, runID: String?)
  -> ThreadSnapshot
{
  var prev = snapshot
  let status = event.type == "run.waiting_input" ? "waiting_input" : "waiting_takeover"
  let knownInRun = runID != nil && prev.run?.id == runID
  let knownInActive = runID != nil && prev.activeRuns?.contains { $0.id == runID } == true
  // Peer bot_message runs are omitted from snapshots while busy; the first wait event is how an
  // open thread learns they need ask/takeover UI.
  let needsInsert = runID != nil && !knownInRun && !knownInActive
  let runChanged = knownInRun && prev.run != nil && prev.run?.status != status
  let activeRunChanged =
    knownInActive && prev.activeRuns?.contains { $0.id == runID && $0.status != status } == true
  let members = updateMemberStatus(prev.members, botID: event.botId, status: status)
  // Waiting pauses delete progress events server-side; drop the live bubble so a missed
  // message.created cannot leave "working…" stuck next to the wait.
  let liveID = progressMessageID(event)
  let messages = prev.messages.contains { $0.id == liveID } ? prev.messages.filter { $0.id != liveID } : prev.messages
  // The bot is asking for control, so the "computer busy" banner no longer applies.
  var computer = prev.computer
  if event.type == "computer.takeover.requested", prev.computer?.busyBotName != nil {
    computer?.busyBotName = nil
  }
  if !runChanged, !activeRunChanged, !needsInsert, members == prev.members,
     messages == prev.messages, computer == prev.computer
  {
    // Nothing visible changed, but a later cursor keeps reconnects from replaying this event.
    prev.cursor = event.seq
    return prev
  }
  prev.cursor = event.seq
  prev.members = members
  prev.messages = messages
  prev.computer = computer
  if needsInsert, let runID {
    let waitingRun = ThreadRun(
      id: runID, botId: event.botId, threadId: event.threadId, taskId: runID, status: status,
      trigger: "bot_message", startedAt: event.createdAt, createdAt: event.createdAt
    )
    let activeRuns = activeThreadRuns(prev).filter { $0.id != runID } + [waitingRun]
    let promoteWaiting =
      prev.run == nil
        || (prev.run?.status != "waiting_input" && prev.run?.status != "waiting_takeover")
    if promoteWaiting { prev.run = waitingRun }
    prev.activeRuns = activeRuns
    return prev
  }
  if runChanged { prev.run?.status = status }
  if activeRunChanged {
    prev.activeRuns = prev.activeRuns?.map { candidate in
      guard candidate.id == runID else { return candidate }
      var updated = candidate
      updated.status = status
      return updated
    }
  }
  return prev
}

private func reduceMessage(_ snapshot: ThreadSnapshot, event: ProductEvent) -> ThreadSnapshot {
  var prev = snapshot
  let payload = event.payload
  var blocks: [MessageBlock] = []
  if case .array? = payload["blocks"], let decoded = try? payload["blocks"]?.decode([MessageBlock].self) {
    blocks = decoded
  }
  let id = payload["messageId"]?.stringValue ?? event.id
  let known = prev.messages.first { $0.id == id }
  var next = ThreadMessage(
    id: id, threadId: event.threadId, seq: event.seq,
    role: payload["role"]?.stringValue ?? "bot", blocks: blocks, botId: event.botId,
    runId: event.runId, callId: payload["callId"]?.stringValue ?? known?.callId,
    createdAt: known?.createdAt ?? event.createdAt
  )
  applyReplyMetadata(payload, to: &next, previous: known)
  let replacedIDs = Set(
    blocks.filter { $0.kind == .subagent }.compactMap { $0.fields["agentId"]?.stringValue }
  )
  let (_, remaining) = takeLiveMessage(prev.messages, liveID: progressMessageID(event))
  let without = remaining.filter { !replacedSubagent($0, agentIDs: replacedIDs) }
  prev.cursor = event.seq
  if let index = without.firstIndex(where: { $0.id == next.id }) {
    var updated = without
    updated[index] = next
    prev.messages = updated
  } else {
    prev.messages = without + [next]
  }
  // A delegate's reply to a request of this thread ends only that request's waiting state.
  if let replyTo = payload["replyToMessageId"]?.stringValue, let pending = prev.delegatePending {
    prev.delegatePending = pending.filter { $0 != replyTo }
    prev.delegatePendingAgents = prev.delegatePendingAgents?.filter { $0.messageId != replyTo }
  }
  return prev
}
