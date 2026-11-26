import Foundation
import RakazoAPI
import RakazoCore
import Testing

@testable import Praci

@MainActor
struct ApprovalModelTests {
  private let echo = RPCError.server(
    code: "BAD_REQUEST", status: 400, message: "Invalid value hunter2-secret")

  @Test func secretAnswersShowAFixedMessageThatNeverEchoesTheServer() {
    let message = ApprovalModel.failureMessage(echo, secret: true)
    #expect(message == ApprovalModel.secretFailure)
    #expect(!message.contains("hunter2"))
  }

  @Test func otherCardsKeepTheServerMessage() {
    #expect(ApprovalModel.failureMessage(echo, secret: false) == echo.localizedDescription)
  }
}
