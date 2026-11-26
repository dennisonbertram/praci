import Foundation
import Testing

@testable import Praci

private let enUS = Locale(identifier: "en_US")

@Test
func moneyIsCentsFormattedWithTheAccountCurrency() {
  #expect(financeMoney(153_322_065, hidden: false, locale: enUS) == "$1,533,221")
  #expect(financeMoney(-5_840_000, hidden: false, locale: enUS) == "$58,400")
  #expect(financeMoney(500_000, currency: "EUR", hidden: false, locale: enUS) == "€5,000")
  #expect(financeMoney(61_240, hidden: false, exact: true, locale: enUS) == "$612.40")
}

@Test
func hiddenAmountsAreMaskedWithoutRevealingSize() {
  #expect(financeMoney(153_322_065, hidden: true, locale: enUS) == financeMask)
  #expect(financeMoney(5, hidden: true, locale: enUS) == financeMask)
  #expect(financeSignedMoney(120_000, currency: "USD", hidden: true, locale: enUS) == financeMask)
}

@Test
func moneyInGetsAPlusSign() {
  #expect(financeSignedMoney(120_000, currency: "USD", hidden: false, locale: enUS) == "+$1,200")
  #expect(financeSignedMoney(-8_800, currency: "USD", hidden: false, locale: enUS) == "$88")
}

@Test
func monthDayRunwayAndNoteWording() {
  #expect(financeMonthLabel("2025-11", locale: enUS) == "Nov")
  #expect(financeMonthLabel("junk") == "junk")
  #expect(financeDay("2026-10-24", locale: enUS) == "Oct 24")
  #expect(financeDay("2026-10-28T15:00:00.000Z", locale: enUS) == "Oct 28")
  #expect(financeRunway(22.7, hidden: false) == "23 mo")
  #expect(financeRunway(nil, hidden: false) == "—")
  #expect(financeNonUSDNote(1) == "1 non-USD transaction not counted")
  #expect(financeNonUSDNote(3) == "3 non-USD transactions not counted")
}
