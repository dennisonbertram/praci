import Testing

@testable import Praci

struct DataRoomItemActionsTests {
  @Test func processingFileWithoutConsentOffersConsentInsteadOfRetry() {
    #expect(DataRoomItemActions.needsConsent(isProcessing: true, consentAllowed: false))
    #expect(!DataRoomItemActions.showsRetry(
      isFailed: false, isProcessing: true, consentAllowed: false))
  }

  @Test func processingFileWithConsentCanBeRetried() {
    #expect(!DataRoomItemActions.needsConsent(isProcessing: true, consentAllowed: true))
    #expect(DataRoomItemActions.showsRetry(
      isFailed: false, isProcessing: true, consentAllowed: true))
  }

  @Test func failedFileCanBeRetriedRegardlessOfConsent() {
    #expect(DataRoomItemActions.showsRetry(
      isFailed: true, isProcessing: false, consentAllowed: false))
  }
}
