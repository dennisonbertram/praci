import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

// Ported from the matching describe blocks of packages/core/src/events.test.ts (same case names).

@Test("recognizes every terminal run outcome")
func terminalOutcomes() {
  #expect(isRunTerminalEvent(type: "run.completed"))
  #expect(isRunTerminalEvent(type: "run.failed"))
  #expect(isRunTerminalEvent(type: "run.cancelled"))
  #expect(!isRunTerminalEvent(type: "run.waiting_input"))
}

@Test("enables streaming only for an explicit on value")
func streamingPreference() {
  #expect(normalizeResponseStreamingPreference("on"))
  #expect(normalizeResponseStreamingPreference(" ON "))
  #expect(!normalizeResponseStreamingPreference("off"))
  #expect(!normalizeResponseStreamingPreference(" OFF "))
  #expect(!normalizeResponseStreamingPreference(""))
  #expect(!normalizeResponseStreamingPreference(nil))
  #expect(!normalizeResponseStreamingPreference("maybe"))
}

@Test("strips live token bubbles and leaves tool activity")
func stripsLiveTokens() {
  let messages = [
    ThreadMessage(id: "m1", blocks: [textBlock("hi")]),
    ThreadMessage(id: "progress:run-1", blocks: [block("progress", ["text": .string("Lisbon")])]),
    ThreadMessage(
      id: "progress:run-2",
      blocks: [block("progress", ["text": .string("partial")]), stepsBlock([("Shell", 1)])]
    ),
    ThreadMessage(
      id: "progress:run-3",
      blocks: [block("progress", ["text": .string("Using browser"), "activity": .bool(true)])]
    ),
  ]
  #expect(
    stripLiveStreamingProgress(messages) == [
      messages[0],
      ThreadMessage(id: "progress:run-2", blocks: [stepsBlock([("Shell", 1)])]),
      messages[3],
    ]
  )
}

@Test("strips flushed narration text from synthetic progress messages")
func stripsFlushedNarration() {
  let durable = ThreadMessage(id: "m-final", blocks: [textBlock("Lisbon is the capital of Portugal.")])
  let live = ThreadMessage(
    id: "progress:run-1",
    blocks: [
      textBlock("I'm checking that now."), stepsBlock([("Browser", 1)]),
      block("progress", ["text": .string("Lisbon is the cap")]),
    ]
  )
  #expect(
    stripLiveStreamingProgress([durable, live]) == [
      durable, ThreadMessage(id: "progress:run-1", blocks: [stepsBlock([("Browser", 1)])]),
    ]
  )
}

@Test("returns the same snapshot when streaming is on or there is nothing to strip")
func sameSnapshotWhenNothingToStrip() {
  let snapshot = makeSnapshot(messages: [ThreadMessage(id: "m1", blocks: [textBlock("done")])])
  #expect(withLiveStreamingProgress(snapshot, streamResponses: true) == snapshot)
  #expect(withLiveStreamingProgress(snapshot, streamResponses: false) == snapshot)
  #expect(withLiveStreamingProgress(nil, streamResponses: false) == nil)
}

@Test("preserves structured live activity markers")
func preservesActivityMarkers() {
  let blocks = reduceLiveMessageBlocks(
    [], .progress(["text": .string("Using browser"), "activity": .bool(true)])
  )
  #expect(blocks == [block("progress", ["text": .string("Using browser"), "activity": .bool(true)])])
}

@Test("replaces punctuated activity text with its tool step")
func replacesActivityWithToolStep() {
  let activity = reduceLiveMessageBlocks(
    [], .progress(["text": .string("Running: echo done."), "activity": .bool(true)])
  )
  #expect(reduceLiveMessageBlocks(activity, .tool("shell")) == [stepsBlock([("Shell", 1)])])
}

@Test("holds a tool call that lands mid-sentence until the sentence completes")
func holdsMidSentenceTool() {
  var blocks = reduceLiveMessageBlocks([], .progress(["text": .string("Let me check")]))
  blocks = reduceLiveMessageBlocks(blocks, .tool("shell"))
  #expect(
    blocks == [
      block("progress", ["text": .string("Let me check"), "pendingToolNames": .array([.string("shell")])]),
    ]
  )
  blocks = reduceLiveMessageBlocks(blocks, .progress(["delta": .string(" it.")]))
  #expect(blocks == [textBlock("Let me check it."), stepsBlock([("Shell", 1)])])
}

@Test("progress deltas append to the text already shown")
func deltasAppend() {
  var blocks = reduceLiveMessageBlocks([], .progress(["text": .string("Lis")]))
  blocks = reduceLiveMessageBlocks(blocks, .progress(["delta": .string("bon")]))
  #expect(blocks == [block("progress", ["text": .string("Lisbon")])])
}

@Test("returns the error only for run.failed with a real message")
func failureErrorOnlyForFailed() {
  func error(_ type: String, _ payload: [String: JSONValue]?) -> String? {
    runFailureError(type: type, payload: payload)
  }
  #expect(error("run.failed", ["error": .string("provider missing")]) == "provider missing")
  #expect(error("run.failed", [:]) == nil)
  #expect(error("run.failed", ["error": .string("   ")]) == nil)
  #expect(error("run.failed", ["error": .number(42)]) == nil)
  #expect(error("run.failed", nil) == nil)
  #expect(error("run.completed", ["error": .string("nope")]) == nil)
  #expect(error("run.cancelled", ["error": .string("nope")]) == nil)
}

@Test("trims surrounding space and clamps a runaway message")
func trimsAndClamps() {
  #expect(runFailureError(type: "run.failed", payload: ["error": .string("  spaced  ")]) == "spaced")
  let long = runFailureError(
    type: "run.failed", payload: ["error": .string(String(repeating: "x", count: 400))]
  )
  #expect(long?.utf16.count == 301)
  #expect(long?.hasSuffix("…") == true)
}

// MARK: humanizeToolName and tool phrases

@Test("turns a Composio-style constant into a readable label")
func composioConstant() {
  #expect(humanizeToolName("SLACK_FIND_CHANNELS") == "Slack find channels")
}

@Test("turns a lowercase builtin tool name into a readable label")
func builtinName() {
  #expect(humanizeToolName("request_takeover") == "Request takeover")
}

@Test("drops the MCP prefix and server slug, which can be an internal id")
func dropsMCPPrefix() {
  #expect(humanizeToolName("mcp__integration-26dcd2f6__set_context") == "Carta company")
  #expect(humanizeToolName("mcp__carta__cap_table_chart") == "Carta cap table")
  #expect(humanizeToolName("mcp__linear__list_issues") == "List issues")
}

@Test("splits camelCase ids, with or without an MCP prefix")
func splitsCamelCase() {
  #expect(humanizeToolName("mcp__finance-mercury__getAccounts") == "Get accounts")
  #expect(humanizeToolName("requestSendMoney") == "Ask to send money")
}

@Test("gives internal tools plain phrases without catalog, underscores or ids")
func plainInternalPhrases() {
  let ids = [
    "task_catalog", "legal_unreviewed_documents", "legal_upsert_node", "legal_upsert_contract",
    "legal_upsert_deadline", "legal_link", "legal_query",
    "mcp__finance-mercury__requestSendMoney", "mcp__finance-mercury__requestTransferMoney",
  ]
  for id in ids {
    for tense in [ToolTense.activity, .done] {
      let phrase = toolPhrase(id, tense)
      #expect(!phrase.contains(/_|catalog|[a-z][A-Z]|^Request/), "\(id) -> \(phrase)")
    }
  }
  #expect(toolPhrase("task_catalog", .activity) == "Checking open tasks")
  #expect(toolPhrase("legal_upsert_node", .activity) == "Updating legal records")
  #expect(toolPhrase("legal_unreviewed_documents", .done) == "Checked unreviewed documents")
  #expect(toolPhrase("mcp__finance-mercury__requestSendMoney", .activity) == "Asking to send money")
}

@Test("never shows mcp__, underscores or camelCase ids")
func neverShowsRawIDs() {
  let ids = [
    "mcp__finance-brex__get_banking_transactions", "mcp__brex__list_cards", "mail_search",
    "getAccounts", "SLACK_FIND_CHANNELS", "mcp__a____b__", "mcp__only_server", "__", "",
    String(repeating: "x", count: 500), String(repeating: "a_", count: 200),
  ]
  for id in ids {
    for text in [humanizeToolName(id), toolPhrase(id, .activity), toolPhrase(id, .done)] {
      #expect(!text.contains(/mcp|_|[a-z][A-Z]/), "\(id) -> \(text)")
      #expect(text.utf16.count <= 60)
    }
  }
}

@Test("names the scratchpad tools in plain words")
func scratchpadWords() {
  #expect(toolPhrase("scratchpad_list", .activity) == "Checking notes")
  #expect(toolPhrase("scratchpad_add", .done) == "Added note")
  #expect(humanizeToolName("scratchpad_remove") == "Remove note")
}

@Test("never says a mail send or draft finished before its outcome is known")
func mailOutcomes() {
  #expect(toolPhrase("mail_send", .done) == "Email to send")
  #expect(toolPhrase("mail_draft", .done) == "Draft to save")
  #expect(mailOutcomeSummary(tool: "mail_send", outcome: "sent") == "Sent email")
  #expect(mailOutcomeSummary(tool: "mail_send", outcome: "failed") == "Couldn't send")
  #expect(mailOutcomeSummary(tool: "mail_draft", outcome: "saved") == "Draft saved")
  #expect(mailOutcomeSummary(tool: "mail_draft", outcome: "failed") == "Draft not saved")
}

@Test("puts MCP, connector and built-in tools in the present or past tense")
func tenses() {
  let brex = "mcp__finance-brex__get_banking_transactions"
  #expect(toolPhrase(brex, .activity) == "Checking banking transactions")
  #expect(toolPhrase(brex, .done) == "Checked banking transactions")
  #expect(toolPhrase("mail_search", .done) == "Mail search")
  #expect(toolPhrase("SLACK_FIND_CHANNELS", .done) == "Slack find channels")
  #expect(toolPhrase("mcp__x__createInvoice", .activity) == "Creating invoice")
  #expect(toolPhrase("mcp__x__send_message", .done) == "Sent message")
  #expect(toolPhrase("mcp__a____b__", .done) == "B")
}

@Test("drops the agent's own service name and a trailing by-id")
func dropsServiceName() {
  #expect(toolPhrase("brex_list_cards", .done, service: "Brex") == "Checked cards")
  #expect(toolPhrase("mcp__brex__get_card_by_id", .activity, service: "Brex agent") == "Checking card")
  #expect(humanizeToolName("brex", service: "Brex") == "Brex")
}

@Test("cleans a step label saved as a raw id and leaves other labels alone")
func cleansRawStepLabel() {
  #expect(toolStepLabel("get_active_integration") == "Get active integration")
  #expect(toolStepLabel("Read a file") == "Read a file")
}

@Test("summarizes steps as the latest call or a count")
func summarizesSteps() {
  #expect(toolStepsSummary([]) == "")
  #expect(toolStepsSummary([("Get banking transactions", 1)]) == "Checked banking transactions")
  #expect(toolStepsSummary([("Get active integration", 1), ("Get banking transactions", 1)]) == "Used 2 tools")
  #expect(toolStepsSummary([("Get banking transactions", 3)]) == "Used 3 tools")
}

// MARK: steps and segments

private func steps(_ pairs: [(String, Int)]) -> [JSONValue] {
  pairs.map { .object(["label": .string($0.0), "count": .number(Double($0.1))]) }
}

@Test("starts a new step for the first call")
func firstStep() {
  #expect(appendToolStep([], toolName: "SLACK_FIND_CHANNELS") == steps([("Slack find channels", 1)]))
}

@Test("increments the count when the same tool fires again in a row")
func repeatedStep() {
  let first = appendToolStep([], toolName: "SLACK_FIND_CHANNELS")
  #expect(appendToolStep(first, toolName: "SLACK_FIND_CHANNELS") == steps([("Slack find channels", 2)]))
}

@Test("appends a new step when a different tool fires")
func differentStep() {
  let first = appendToolStep([], toolName: "SLACK_FIND_CHANNELS")
  #expect(
    appendToolStep(first, toolName: "SLACK_FETCH_CONVERSATION_HISTORY")
      == steps([("Slack find channels", 1), ("Slack fetch conversation history", 1)])
  )
}

@Test("is false mid-clause, with no terminal punctuation")
func notSentenceMidClause() {
  #expect(!endsSentence("Let me check what I have loca"))
}

@Test("is false when the text trails off on whitespace with no punctuation")
func notSentenceTrailingSpace() {
  #expect(!endsSentence("Let me check Slack "))
}

@Test("is true once the text ends on a sentence terminator")
func sentenceTerminator() {
  #expect(endsSentence("Let me check. "))
  #expect(endsSentence("Is that right?"))
  #expect(endsSentence("She said \"stop!\""))
}

@Test("is true for an empty or whitespace-only string — nothing to protect")
func emptyIsSentence() {
  #expect(endsSentence(""))
  #expect(endsSentence("   "))
}

@Test("starts a new text segment when there are none")
func firstTextSegment() {
  #expect(appendTextSegment([], text: "hello") == [textBlock("hello")])
}

@Test("does nothing when the text is empty")
func emptyTextSegment() {
  let segments = [stepsBlock([("Shell", 1)])]
  #expect(appendTextSegment(segments, text: "") == segments)
}

@Test("merges into the last segment when it is already text")
func mergesTextSegment() {
  #expect(appendTextSegment(appendTextSegment([], text: "a"), text: "b") == [textBlock("ab")])
}

@Test("starts a new text segment after a steps segment")
func textAfterSteps() {
  #expect(
    appendTextSegment([stepsBlock([("Shell", 1)])], text: "done")
      == [stepsBlock([("Shell", 1)]), textBlock("done")]
  )
}

@Test("starts a new steps segment when there are none")
func firstStepsSegment() {
  #expect(
    appendToolCallSegment([], toolName: "SLACK_FIND_CHANNELS")
      == [stepsBlock([("Slack find channels", 1)])]
  )
}

@Test("collapses into the last steps segment for the same tool")
func collapsesStepsSegment() {
  let segments = appendToolCallSegment([], toolName: "SLACK_FIND_CHANNELS")
  #expect(
    appendToolCallSegment(segments, toolName: "SLACK_FIND_CHANNELS")
      == [stepsBlock([("Slack find channels", 2)])]
  )
}

@Test("starts a new steps segment after a text segment")
func stepsAfterText() {
  #expect(
    appendToolCallSegment([textBlock("hi")], toolName: "shell")
      == [textBlock("hi"), stepsBlock([("Shell", 1)])]
  )
}

@Test("adds a new step entry within the same steps segment for a different tool")
func newEntryInSegment() {
  let segments = appendToolCallSegment([], toolName: "SLACK_FIND_CHANNELS")
  #expect(
    appendToolCallSegment(segments, toolName: "shell")
      == [stepsBlock([("Slack find channels", 1), ("Shell", 1)])]
  )
}
