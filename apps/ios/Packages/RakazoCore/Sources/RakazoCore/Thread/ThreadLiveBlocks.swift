import Foundation
import RakazoAPI

// Port of the live-progress folding in packages/core/src/events.ts.

public func progressMessageID(runID: String?, eventID: String?) -> String {
  "progress:\(runID ?? eventID ?? "live")"
}

public func progressMessageID(_ event: ProductEvent) -> String {
  progressMessageID(runID: event.runId, eventID: event.id)
}

public func isRunTerminalEvent(type: String) -> Bool {
  type == "run.completed" || type == "run.failed" || type == "run.cancelled"
}

/// A pause ends the current helper execution, even when the run later resumes.
public func stopsRunHelpers(type: String) -> Bool {
  isRunTerminalEvent(type: type) || type == "run.waiting_input"
    || type == "computer.takeover.requested"
}

/// Marks every running helper of `runID` as stopped. Returns the input when nothing changed.
public func settleRunSubagents(_ messages: [ThreadMessage], runID: String?) -> [ThreadMessage] {
  guard let runID else { return messages }
  return messages.map { message in
    guard message.runId == runID else { return message }
    var message = message
    message.blocks = message.blocks.map { block in
      guard block.kind == .subagent, block.status == "running" else { return block }
      var fields = block.fields
      fields["status"] = .string("failed")
      fields["result"] = .string("stopped")
      return MessageBlock(kind: .subagent, fields: fields)
    }
    return message
  }
}

private let runFailureErrorMax = 300

/// Reason a run failed, clamped for display, or nil when there is no usable error to show.
public func runFailureError(type: String, payload: [String: JSONValue]?) -> String? {
  guard type == "run.failed", case let .string(raw)? = payload?["error"] else { return nil }
  let message = raw.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !message.isEmpty else { return nil }
  // JavaScript counts UTF-16 units; keep the same clamp.
  let units = Array(message.utf16)
  guard units.count > runFailureErrorMax else { return message }
  return String(decoding: units.prefix(runFailureErrorMax), as: UTF16.self) + "…"
}

/// Hides assistant token text on synthetic progress rows. Tool activity stays.
public func stripLiveStreamingProgress(_ messages: [ThreadMessage]) -> [ThreadMessage] {
  var next: [ThreadMessage] = []
  for message in messages {
    guard message.id.hasPrefix("progress:") else {
      next.append(message)
      continue
    }
    let blocks = message.blocks.filter { block in
      if block.kind == .text { return false }
      if block.kind == .progress { return block.fields["activity"] == .bool(true) }
      return true
    }
    if blocks.count == message.blocks.count {
      next.append(message)
    } else if !blocks.isEmpty {
      var stripped = message
      stripped.blocks = blocks
      next.append(stripped)
    }
  }
  return next
}

public func withLiveStreamingProgress(
  _ snapshot: ThreadSnapshot?, streamResponses: Bool
) -> ThreadSnapshot? {
  guard var snapshot, !streamResponses else { return snapshot }
  snapshot.messages = stripLiveStreamingProgress(snapshot.messages)
  return snapshot
}

/// Missing and unknown values stay off; only an explicit "on" enables streaming.
public func normalizeResponseStreamingPreference(_ raw: String?) -> Bool {
  raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "on"
}

public enum LiveMessageUpdate: Sendable {
  case progress([String: JSONValue]?)
  case tool(String)
}

public func progressMessageText(
  _ payload: [String: JSONValue]?, previousText: String = ""
) -> String {
  if case let .string(delta)? = payload?["delta"] { return previousText + delta }
  switch payload?["text"] {
  case let .string(text)?: return text
  case let .number(number)?: return number == number.rounded() ? String(Int(number)) : "\(number)"
  case let .bool(flag)?: return flag ? "true" : "false"
  default: return ""
  }
}

private let sentenceClosers: Set<Character> = ["\"", "'", "”", "’", ")", "]"]

/// True once `text` ends at a sentence boundary (or is empty), so it can flush without cutting a clause.
public func endsSentence(_ text: String) -> Bool {
  var rest = Substring(text.trimmingCharacters(in: .whitespacesAndNewlines))
  if rest.isEmpty { return true }
  while let last = rest.last, sentenceClosers.contains(last) {
    rest = rest.dropLast()
  }
  guard let last = rest.last else { return false }
  return last == "." || last == "!" || last == "?"
}

private func utf16Count(_ text: String) -> Int {
  text.utf16.count
}

private func dropUTF16(_ text: String, _ count: Int) -> String {
  String(decoding: Array(text.utf16).dropFirst(max(0, count)), as: UTF16.self)
}

private func textBlock(_ text: String) -> MessageBlock {
  MessageBlock(kind: .text, fields: ["text": .string(text)])
}

private func stepsOf(_ block: MessageBlock?) -> [JSONValue] {
  guard block?.kind == .steps, case let .array(steps)? = block?.fields["steps"] else { return [] }
  return steps
}

public func appendTextSegment(_ segments: [MessageBlock], text: String) -> [MessageBlock] {
  guard !text.isEmpty else { return segments }
  if let last = segments.last, last.kind == .text {
    return segments.dropLast() + [textBlock((last.text ?? "") + text)]
  }
  return segments + [textBlock(text)]
}

/// Adds one call to the step list, merging into the last step when it has the same label.
public func appendToolStep(_ steps: [JSONValue], toolName: String) -> [JSONValue] {
  let label = humanizeToolName(toolName)
  if case var .object(last)? = steps.last, last["label"] == .string(label) {
    var count = 0
    if case let .number(value)? = last["count"] { count = Int(value) }
    last["count"] = .number(Double(count + 1))
    return steps.dropLast() + [.object(last)]
  }
  return steps + [.object(["label": .string(label), "count": .number(1)])]
}

public func appendToolCallSegment(_ segments: [MessageBlock], toolName: String) -> [MessageBlock] {
  let last = segments.last
  let steps = appendToolStep(stepsOf(last), toolName: toolName)
  let block = MessageBlock(kind: .steps, fields: ["steps": .array(steps)])
  if last?.kind == .steps { return segments.dropLast() + [block] }
  return segments + [block]
}

private func liveMessageText(_ blocks: [MessageBlock]) -> String {
  blocks.filter { $0.kind == .text || $0.kind == .progress }.map { $0.text ?? "" }.joined()
}

private func pendingToolNames(of block: MessageBlock?) -> [String] {
  guard block?.kind == .progress, case let .array(names)? = block?.fields["pendingToolNames"]
  else { return [] }
  return names.compactMap(\.stringValue)
}

/// Folds one progress or tool event into the blocks of a run's live message.
public func reduceLiveMessageBlocks(_ blocks: [MessageBlock], _ update: LiveMessageUpdate)
  -> [MessageBlock]
{
  let tail = blocks.last
  let tailIsProgress = tail?.kind == .progress
  let segments = tailIsProgress ? Array(blocks.dropLast()) : blocks
  let priorText = liveMessageText(blocks)
  let flushedLength =
    tailIsProgress ? utf16Count(priorText) - utf16Count(tail?.text ?? "") : utf16Count(priorText)
  let tailText: String
  let activity: Bool
  var pending = pendingToolNames(of: tail)
  switch update {
  case let .progress(payload):
    tailText = dropUTF16(progressMessageText(payload, previousText: priorText), flushedLength)
    activity = payload?["activity"] == .bool(true)
  case let .tool(name):
    tailText = tailIsProgress ? (tail?.text ?? "") : ""
    activity = tailIsProgress && tail?.fields["activity"] == .bool(true)
    pending.append(name)
  }

  // A status line a tool just reported stays until the next update, whatever its last character is.
  let reachedBoundary: Bool = if case .progress = update, activity {
    tailText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  } else {
    endsSentence(tailText)
  }
  if !pending.isEmpty, reachedBoundary {
    var next = activity ? segments : appendTextSegment(segments, text: tailText)
    for name in pending {
      next = appendToolCallSegment(next, toolName: name)
    }
    return next
  }
  if tailText.isEmpty { return segments }
  var fields: [String: JSONValue] = ["text": .string(tailText)]
  if activity { fields["activity"] = .bool(true) }
  if !pending.isEmpty { fields["pendingToolNames"] = .array(pending.map { .string($0) }) }
  return segments + [MessageBlock(kind: .progress, fields: fields)]
}

public func subagentBlock(from payload: [String: JSONValue]) -> MessageBlock {
  func raw(_ key: String) -> String? {
    payload[key]?.stringValue
  }
  func string(_ key: String) -> String? {
    guard let value = raw(key), !value.isEmpty else { return nil }
    return value
  }
  let status = payload["status"]?.stringValue
  var fields: [String: JSONValue] = [
    "agentId": .string(raw("agentId") ?? ""),
    "name": .string(raw("name") ?? "subagent"),
    "task": .string(raw("task") ?? ""),
    "status": .string(status == "completed" || status == "failed" ? status! : "running"),
  ]
  if let progress = string("progress") { fields["progress"] = .string(progress) }
  if let result = string("result") { fields["result"] = .string(result) }
  return MessageBlock(kind: .subagent, fields: fields)
}

// MARK: - Tool names for people

private let cartaToolLabels: [String: String] = [
  "cap_table_chart": "Carta cap table",
  "set_context": "Carta company",
  "list_contexts": "Carta company",
  "list_accounts": "Carta company",
]

private let toolVerbs: [String: (activity: String, done: String)] = [
  "get": ("checking", "checked"),
  "list": ("checking", "checked"),
  "query": ("checking", "checked"),
  "search": ("searching", "searched"),
  "find": ("searching", "searched"),
  "read": ("reading", "read"),
  "fetch": ("reading", "read"),
  "create": ("creating", "created"),
  "add": ("adding", "added"),
  "update": ("updating", "updated"),
  "edit": ("updating", "updated"),
  "replace": ("updating", "updated"),
  "send": ("sending", "sent"),
  "delete": ("deleting", "deleted"),
  "cancel": ("cancelling", "cancelled"),
  "upload": ("uploading", "uploaded"),
  "remove": ("removing", "removed"),
  "complete": ("completing", "completed"),
  "ask": ("asking", "asked"),
]

private let mailWritePending: [String: String] = [
  "mail send": "Email to send",
  "mail draft": "Draft to save",
]

/// The step line for an approved mail_send or mail_draft once it ended; never "Sent" before then.
public func mailOutcomeSummary(tool: String, outcome: String) -> String {
  switch outcome {
  case "sent": "Sent email"
  case "saved": "Draft saved"
  case "unknown": "Unknown"
  default: tool == "mail_send" ? "Couldn't send" : "Draft not saved"
  }
}

private let toolNameMaxChars = 60

private let plainToolWords: [String: String] = [
  "scratchpad_list": "get notes",
  "scratchpad_add": "add note",
  "scratchpad_update": "update note",
  "scratchpad_complete": "complete note",
  "scratchpad_remove": "remove note",
  "task_catalog": "get open tasks",
  "calendar_agenda": "get upcoming schedule",
  "render_ui": "format the answer",
  "legal_unreviewed_documents": "get unreviewed documents",
  "legal_upsert_node": "update legal records",
  "legal_upsert_contract": "update contracts",
  "legal_upsert_deadline": "update deadlines",
  "legal_link": "update legal records",
  "legal_query": "get legal records",
  "request send money": "ask to send money",
  "request transfer money": "ask to transfer money",
]

private func regex(_ pattern: String) -> NSRegularExpression {
  // The patterns are constants; a failure here is a programming error.
  // swiftlint:disable:next force_try
  try! NSRegularExpression(pattern: pattern)
}

private let camelBoundary = regex("([a-z\\d])([A-Z])")
private let mcpToolName = regex("^mcp__.+?__(.+)$")

private func splitWords(_ text: String, on isSeparator: (Character) -> Bool) -> [String] {
  text.split(whereSeparator: isSeparator).map(String.init)
}

private func isAsciiAlnum(_ char: Character) -> Bool {
  char.isASCII && (char.isLetter || char.isNumber)
}

/// The plain lowercase words of any tool id: no `mcp__server__` prefix, no case or separator style.
private func toolWords(_ name: String, service: String? = nil) -> [String] {
  if let plain = plainToolWords[name] { return plain.split(separator: " ").map(String.init) }
  var id = name
  if id.hasPrefix("mcp__") {
    let range = NSRange(id.startIndex..., in: id)
    if let match = mcpToolName.firstMatch(in: id, range: range),
       let toolRange = Range(match.range(at: 1), in: id),
       let carta = cartaToolLabels[String(id[toolRange])]
    {
      return carta.lowercased().split(separator: " ").map(String.init)
    }
    id = id.components(separatedBy: "__").filter { !$0.isEmpty }.dropFirst(2).joined(separator: " ")
  }
  let spaced = camelBoundary.stringByReplacingMatches(
    in: id, range: NSRange(id.startIndex..., in: id), withTemplate: "$1 $2"
  )
  var words = splitWords(spaced) { !isAsciiAlnum($0) }.map { $0.lowercased() }
  // "Get card by id" is "Get card" to a person.
  if words.count > 2, words[words.count - 2] == "by", words[words.count - 1] == "id" {
    words = Array(words.dropLast(2))
  }
  if let plain = plainToolWords[words.joined(separator: " ")] {
    return plain.split(separator: " ").map(String.init)
  }
  let own = Set(splitWords((service ?? "").lowercased()) { !isAsciiAlnum($0) })
  let rest = words.filter { !own.contains($0) }
  return Array((rest.isEmpty ? words : rest).prefix(8))
}

private func capitalized(_ text: String) -> String {
  var clipped = text
  if text.count > toolNameMaxChars {
    clipped =
      String(text.prefix(toolNameMaxChars - 1)).trimmingCharacters(in: .whitespaces) + "…"
  }
  guard let first = clipped.first else { return clipped }
  return first.uppercased() + clipped.dropFirst()
}

/// A short plain label for a tool id or an earlier label: "Get banking transactions".
/// Empty when there is nothing to say.
public func humanizeToolName(_ name: String, service: String? = nil) -> String {
  capitalized(toolWords(name, service: service).joined(separator: " "))
}

/// A saved step label as shown: labels saved before tool names were humanized are raw ids.
public func toolStepLabel(_ label: String) -> String {
  label.hasPrefix("mcp__") || label.contains("_") ? humanizeToolName(label) : label
}

public enum ToolTense: Sendable {
  case activity
  case done
}

/// A tool as a verb phrase: "Checking banking transactions" while it runs, "Checked ..." after.
public func toolPhrase(_ name: String, _ tense: ToolTense, service: String? = nil) -> String {
  let words = toolWords(name, service: service)
  // A finished step only means the call was made; an approved send or save has its own outcome line.
  if tense == .done, let pending = mailWritePending[words.joined(separator: " ")] {
    return pending
  }
  guard let first = words.first else { return "" }
  let verb = toolVerbs[first].map { tense == .activity ? $0.activity : $0.done } ?? first
  return capitalized(([verb] + words.dropFirst()).joined(separator: " "))
}

/// One line for a run that ended in tool calls: the latest call, or a count when there were several.
public func toolStepsSummary(_ steps: [(label: String, count: Int)], service: String? = nil)
  -> String
{
  guard let last = steps.last else { return "" }
  let total = steps.reduce(0) { $0 + $1.count }
  return total > 1 ? "Used \(total) tools" : toolPhrase(last.label, .done, service: service)
}
