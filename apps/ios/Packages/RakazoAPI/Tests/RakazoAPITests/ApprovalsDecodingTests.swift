import Foundation
@testable import RakazoAPI
import Testing

private func blocks() throws -> [MessageBlock] {
  try JSONDecoder().decode([MessageBlock].self, from: loadFixture(named: "approvals-blocks"))
}

private func ask(_ index: Int) throws -> AskBlock {
  try blocks()[index].decodePayload(AskBlock.self)
}

@Test
func decodesToolApprovalAsk() throws {
  let block = try ask(0)
  #expect(block.isApproval)
  #expect(!block.isAnswered)
  #expect(block.approvalReason == "Asked because this ran in the background.")
  #expect(block.actions.map(\.id) == ["allow", "deny"])
  #expect(block.outcome == nil)
}

@Test
func answeredOutcomesCoverConsentPaymentAndClosedCards() throws {
  #expect(try ask(1).outcome == .allowed)
  #expect(try ask(3).outcome == .approvedWaiting("Mercury"))
  #expect(try ask(4).outcome == .superseded)
}

@Test
func plainAskWithActionsIsNotAnApproval() throws {
  let block = try ask(2)
  #expect(!block.isApproval)
  #expect(!block.isSecret)
  #expect(block.actions.count == 2)
}

@Test
func secretAskIsALoginAndCarriesNoValue() throws {
  let block = try ask(5)
  #expect(block.isSecret)
  #expect(block.isLogin)
  #expect(block.credential?.origin == "https://portal.example.test")
}

@Test
func mailApprovalTitleAndSend() throws {
  let block = try ask(6)
  #expect(block.isMail)
  #expect(block.mail?.title == "Re: Pilot timeline")
  #expect(block.mail?.canSend == true)
  #expect(block.mail?.isDraftTool == true)
}

@Test
func choiceShowsOnlyThePickedOptionOnceAnswered() throws {
  let all = try blocks()
  let open = try all[7].decodePayload(ChoiceBlock.self)
  #expect(open.shownOptions.count == 2)
  let dismissed = try all[8].decodePayload(ChoiceBlock.self)
  #expect(dismissed.isDismissed)
  #expect(dismissed.shownOptions.isEmpty)
}

@Test
func decodesMcpAndConnectBlocks() throws {
  let all = try blocks()
  let mcp = try all[9].decodePayload(McpApprovalBlock.self)
  #expect(mcp.summary == "https://mcp.example.test/sse")
  #expect(mcp.status == "pending")
  let connect = try all[10].decodePayload(ConnectBlock.self)
  #expect(!connect.isConnected)
  #expect(try all[11].decodePayload(ConnectBlock.self).isConnected)
  #expect(all[12].kind == .unknown("future_kind"))
}

@Test
func answerableAskIsTheNewestUnansweredAskOfAWaitingRun() throws {
  func message(_ id: String, run: String?, status: String) -> ThreadMessage {
    ThreadMessage(
      id: id, blocks: [MessageBlock(kind: .ask, fields: ["status": .string(status)])],
      runId: run)
  }
  let waiting = ThreadRun(id: "r2", botId: "b", threadId: "t", status: "waiting_input")
  let running = ThreadRun(id: "r1", botId: "b", threadId: "t", status: "running")
  let messages = [
    message("m1", run: "r1", status: "pending"),
    message("m2", run: "r2", status: "pending"),
    message("m3", run: nil, status: "pending")
  ]
  #expect(
    answerableAskMessageID(messages: messages, run: nil, activeRuns: [running, waiting]) == "m2")
  #expect(answerableAskMessageID(messages: messages, run: running, activeRuns: nil) == nil)
  let answered = [message("m2", run: "r2", status: "answered")]
  #expect(answerableAskMessageID(messages: answered, run: waiting, activeRuns: nil) == nil)
}

@Test
func answerInputEncodesOnlyTheGivenFields() throws {
  let input = ThreadAnswerInput(
    botId: "b1", runId: "r1", messageId: "m1", answer: "allow", mail: MailAnswerEdits(send: true))
  let json = try JSONSerialization.jsonObject(
    with: JSONEncoder().encode(input)) as? [String: Any]
  #expect(Set(json?.keys ?? [:].keys) == ["botId", "runId", "messageId", "answer", "mail"])
  #expect((json?["mail"] as? [String: Bool]) == ["send": true])
}

@Test
func routineAndAllSitesAnswersHaveTheirOwnOutcomes() throws {
  func answered(_ answer: String) throws -> AskOutcome? {
    let json = """
    {"kind":"ask","text":"Review before Write file","approvalEffectId":"e","toolId":"write_file","status":"answered","answer":"\(answer)","actions":[{"id":"allow","label":"Allow once"},{"id":"always_routine","label":"Always for this routine"},{"id":"always_bot_sites","label":"Allow all sites for this agent"},{"id":"deny","label":"Deny"}]}
    """
    let block = try JSONDecoder().decode(AskBlock.self, from: Data(json.utf8))
    #expect(block.isApproval)
    return block.outcome
  }
  #expect(try answered("always_routine") == .alwaysAllowedForRoutine)
  #expect(try answered("always_bot_sites") == .alwaysAllowedForSites)
  #expect(try answered("always") == .alwaysAllowed)
}
