import Foundation
import RakazoAPI

// Port of packages/core/src/thread-message-updates.ts and cloud-agent.ts (block building).

/// Removes this run's live message and obsolete unscoped progress without reordering history.
public func takeLiveMessage(_ messages: [ThreadMessage], liveID: String) -> (
  previous: ThreadMessage?, remaining: [ThreadMessage]
) {
  var previous: ThreadMessage?
  var remaining: [ThreadMessage] = []
  for message in messages {
    if message.id == liveID {
      previous = message
    } else if !message.id.hasPrefix("progress:") || message.runId != nil {
      remaining.append(message)
    }
  }
  return (previous, remaining)
}

/// The URL if it is https without embedded credentials, else nil.
public func cloudAgentHTTPSURL(_ value: String?) -> String? {
  guard let value, !value.isEmpty, let url = URL(string: value), url.scheme == "https",
        url.user == nil, url.password == nil
  else { return nil }
  return value
}

public func cloudAgentBlock(from payload: [String: JSONValue]) -> MessageBlock {
  /// `raw` keeps an empty string like JavaScript's `??`; `string` is the truthy check.
  func raw(_ key: String) -> String? {
    payload[key]?.stringValue
  }
  func string(_ key: String) -> String? {
    guard let value = raw(key), !value.isEmpty else { return nil }
    return value
  }
  let status = payload["status"]?.stringValue
  let known = ["finished", "failed", "cancelled"]
  var fields: [String: JSONValue] = [
    "agentId": .string(raw("agentId") ?? ""),
    "title": .string(raw("title") ?? "Cloud agent"),
    "status": .string(status.flatMap { known.contains($0) ? $0 : nil } ?? "running"),
    "url": .string(cloudAgentHTTPSURL(string("url")) ?? ""),
  ]
  if let branch = string("branch") { fields["branch"] = .string(branch) }
  if let prURL = string("prUrl"), cloudAgentHTTPSURL(prURL) != nil { fields["prUrl"] = .string(prURL) }
  if let run = string("latestRunId") { fields["latestRunId"] = .string(run) }
  return MessageBlock(kind: .cloudAgent, fields: fields)
}

public func updateCloudAgentMessages(_ messages: [ThreadMessage], payload: [String: JSONValue])
  -> [ThreadMessage]
{
  let agentID = payload["agentId"]?.stringValue ?? ""
  let messageID = payload["messageId"]?.stringValue ?? ""
  let block = cloudAgentBlock(from: payload)
  func matches(_ existing: MessageBlock) -> Bool {
    existing.kind == .cloudAgent && existing.fields["agentId"]?.stringValue == agentID
  }
  return messages.map { message in
    guard (!messageID.isEmpty && message.id == messageID) || message.blocks.contains(where: matches)
    else { return message }
    var message = message
    message.blocks = message.blocks.map { matches($0) ? block : $0 }
    return message
  }
}
