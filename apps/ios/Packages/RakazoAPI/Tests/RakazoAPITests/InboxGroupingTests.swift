import Foundation
import Testing

@testable import RakazoAPI

// Ported from packages/core/src/inbox-groups.test.ts, inbox-label.test.ts and
// apps/mobile/lib/inbox.test.ts. A fixed UTC calendar keeps these independent of the runner's zone.
private let calendar: Calendar = {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: "UTC")!
  return calendar
}()

private func at(_ day: Int, _ hour: Int, _ minute: Int = 0, month: Int = 10) -> Date {
  calendar.date(from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute))!
}

private let now = at(12, 15)

private func row(
  _ id: String, _ received: Date, needsReply: Bool? = nil, priority: String? = nil,
  category: String? = nil, feedback: String? = nil, fromSelf: Bool = false
) -> InboxRow {
  InboxRow(
    id: id, receivedAt: received.formatted(.iso8601), needsReply: needsReply, priority: priority,
    category: category, feedback: feedback, fromSelf: fromSelf)
}

private func ids(_ rows: [InboxRow]) -> [String] { rows.map(\.id) }

@Test
func splitsTodayAndEarlierAtTheViewersLocalMidnight() {
  let groups = groupInbox(
    [
      row("just-after-midnight", at(12, 0, 1)),
      row("just-before-midnight", at(11, 23, 59)),
      row("last-week", at(5, 9)),
    ], now: now, calendar: calendar)
  #expect(ids(groups.today) == ["just-after-midnight"])
  #expect(ids(groups.earlier) == ["just-before-midnight", "last-week"])
  #expect(groups.needsReply.isEmpty)
}

@Test
func putsNeedsReplyTrueThreadsInNeedsReplyWhateverTheirDateAndNotInTheOtherGroups() {
  let groups = groupInbox(
    [
      row("old-ask", at(3, 9), needsReply: true),
      row("today-ask", at(12, 8), needsReply: true),
      row("handled", at(12, 7), needsReply: false),
      row("untriaged", at(12, 6)),
    ], now: now, calendar: calendar)
  #expect(ids(groups.needsReply) == ["today-ask", "old-ask"])
  #expect(ids(groups.today) == ["handled", "untriaged"])
  #expect(groups.earlier.isEmpty)
}

@Test
func leavesNeedsReplyEmptyWhenNoRowHasBeenTriagedAndKeepsInputOrder() {
  let groups = groupInbox(
    [row("b", at(12, 9)), row("a", at(12, 8))], now: now, calendar: calendar)
  #expect(groups.needsReply.isEmpty)
  #expect(ids(groups.today) == ["b", "a"])
}

@Test
func treatsAMessageDatedSlightlyInTheFutureAsToday() {
  let groups = groupInbox([row("skewed", at(12, 15, 5))], now: now, calendar: calendar)
  #expect(ids(groups.today) == ["skewed"])
}

@Test
func sortsNeedsReplyNewestFirstWhateverThePriorityOrInputOrder() {
  let groups = groupInbox(
    [
      row("normal-new", at(12, 9), needsReply: true, priority: "normal"),
      row("critical-old", at(2, 9), needsReply: true, priority: "critical"),
      row("important-new", at(12, 8), needsReply: true, priority: "important"),
      row("important-old", at(10, 8), needsReply: true, priority: "important"),
      row("unranked", at(12, 10), needsReply: true),
    ], now: now, calendar: calendar)
  #expect(
    ids(groups.needsReply) == [
      "unranked", "normal-new", "important-new", "important-old", "critical-old",
    ])
}

@Test
func labelsSpamAndJunkOverAttentionOverNewsletterAndSkipsUntriagedRows() {
  let received = at(12, 9)
  #expect(inboxLabel(for: row("a", received)) == nil)
  #expect(inboxLabel(for: row("a", received, category: "spam", fromSelf: false)) == .spam)
  #expect(inboxLabel(for: row("a", received, needsReply: true, category: "bulk")) == .junk)
  #expect(inboxLabel(for: row("a", received, category: "scam")) == .junk)
  #expect(inboxLabel(for: row("a", received, needsReply: true, category: "suspicious")) == nil)
  #expect(inboxLabel(for: row("a", received, needsReply: true, category: "reply")) == .attention)
  #expect(inboxLabel(for: row("a", received, priority: "important", category: "fyi")) == .attention)
  #expect(inboxLabel(for: row("a", received, category: "action")) == .attention)
  #expect(inboxLabel(for: row("a", received, category: "newsletter")) == .newsletter)
  #expect(inboxLabel(for: row("a", received, category: "fyi")) == nil)
}

@Test
func aSenderMarkedNoiseOrAReplyFromSelfNeverReadsAsNeedsAttention() {
  let received = at(12, 9)
  #expect(inboxLabel(for: row("a", received, needsReply: true, category: "reply", feedback: "noise")) == nil)
  #expect(inboxLabel(for: row("a", received, needsReply: true, category: "reply", fromSelf: true)) == nil)
  #expect(
    inboxLabel(for: row("a", received, needsReply: true, category: "newsletter", feedback: "noise"))
      == .newsletter)
}

@Test
func summaryIsTheModelReasonElseTheSnippetOnOneLine() {
  var withReason = row("a", now)
  withReason.reason = "  Asks to move the kickoff.  "
  withReason.snippet = "Hi\n\nignored"
  #expect(withReason.summary == "Asks to move the kickoff.")
  var plain = row("b", now)
  plain.snippet = "Hello,\n\nCan you send\n  pricing?"
  #expect(plain.summary == "Hello, Can you send pricing?")
}

@Test
func timeShowsTheClockForTodayTheWeekdayWithinTheWeekAndTheDateBeyond() {
  let viewingAt = at(13, 21, 53, month: 8)
  #expect(inboxTimeStyle(of: at(13, 14, 44, month: 8), now: viewingAt, calendar: calendar) == .time)
  #expect(inboxTimeStyle(of: at(11, 10, month: 8), now: viewingAt, calendar: calendar) == .weekday)
  #expect(inboxTimeStyle(of: at(24, 9, month: 7), now: viewingAt, calendar: calendar) == .monthDay)
}

@Test
func parsesTimestampsWithAndWithoutFractionalSecondsAndRejectsGarbage() {
  #expect(InboxRow.parseDate("2026-10-29T01:26:42.611Z") != nil)
  #expect(InboxRow.parseDate("2026-10-29T01:26:42Z") != nil)
  #expect(InboxRow.parseDate("not-a-date") == nil)
}
