import Foundation
import RakazoAPI

let threadAt = "2026-01-01T00:00:00.000Z"

func makeEvent(
  _ type: String, runId: String? = nil, seq: Int = 5, id: String = "event-1",
  botId: String = "bot-1", payload: [String: JSONValue] = [:]
) throws -> ProductEvent {
  var object: [String: JSONValue] = [
    "id": .string(id), "spaceId": .string("space-1"), "threadId": .string("thread-1"),
    "botId": .string(botId), "seq": .number(Double(seq)), "type": .string(type),
    "createdAt": .string(threadAt), "payload": .object(payload),
  ]
  if let runId { object["runId"] = .string(runId) }
  return try JSONDecoder().decode(
    ProductEvent.self, from: JSONEncoder().encode(JSONValue.object(object))
  )
}

func makeSnapshot(
  cursor: Int = 3, messages: [ThreadMessage] = [], run: ThreadRun? = nil,
  activeRuns: [ThreadRun]? = nil, groupId: String? = nil, members: [ThreadMember]? = nil,
  computer: ThreadComputer? = nil, delegatePending: [String]? = nil,
  delegatePendingAgents: [DelegatePendingAgent]? = nil
) -> ThreadSnapshot {
  ThreadSnapshot(
    threadId: "thread-1", cursor: cursor, messages: messages, groupId: groupId, members: members,
    run: run, activeRuns: activeRuns, delegatePending: delegatePending,
    delegatePendingAgents: delegatePendingAgents, computer: computer
  )
}

func block(_ kind: String, _ fields: [String: JSONValue] = [:]) -> MessageBlock {
  MessageBlock(kind: MessageBlock.Kind(rawValue: kind), fields: fields)
}

func textBlock(_ text: String) -> MessageBlock {
  block("text", ["text": .string(text)])
}

func stepsBlock(_ steps: [(String, Int)]) -> MessageBlock {
  block(
    "steps",
    [
      "steps": .array(
        steps.map { .object(["label": .string($0.0), "count": .number(Double($0.1))]) }
      ),
    ]
  )
}
