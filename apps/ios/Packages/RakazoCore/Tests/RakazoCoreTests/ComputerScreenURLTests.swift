import Foundation
import Testing

@testable import RakazoCore

private let now = 1_710_000_000_000
private let hour = 60 * 60_000
private func view(_ token: String, _ expires: Int = now + hour) -> String {
  "https://app.example/novnc/session/view/\(expires).\(token)/embed.html?"
    + "autoconnect=true&resize=scale&view_only=true&path=websockify"
}
private func control(_ token: String, _ expires: Int = now + hour) -> String {
  "https://app.example/novnc/session/control/\(expires).\(token)/embed.html?"
    + "autoconnect=true&resize=scale&view_only=false&path=websockify"
}
private let api = URL(string: "http://127.0.0.1:3301")!

@Test func embeddableLeavesPublicStreamAlone() {
  let url = "https://sandbox.e2b.app/stream?authKey=abc&view_only=true"
  #expect(ComputerScreenURL.embeddable(url, apiBase: URL(string: "https://api.rakazo.test")!)?.absoluteString == url)
}

@Test func embeddableKeepsLoopbackWhenApiIsLoopback() {
  let url = "http://127.0.0.1:16080/embed.html?view_only=true"
  #expect(ComputerScreenURL.embeddable(url, apiBase: api)?.absoluteString == url)
}

@Test func embeddableRewritesLoopbackToTheApiHost() {
  #expect(
    ComputerScreenURL.embeddable(
      "http://localhost:16080/embed.html", apiBase: URL(string: "http://192.168.1.20:3100")!)?
      .absoluteString == "http://192.168.1.20:16080/embed.html")
}

@Test func embeddableRejectsMissingAndUnsupportedUrls() {
  #expect(ComputerScreenURL.embeddable(nil, apiBase: api) == nil)
  #expect(ComputerScreenURL.embeddable("fake://screen/fake-team-home/researcher", apiBase: api) == nil)
  #expect(ComputerScreenURL.embeddable("not a URL", apiBase: api) == nil)
}

@Test func rotatingTokensAreTheSameStream() {
  #expect(ComputerScreenURL.streamKey(view("aaa")) == ComputerScreenURL.streamKey(view("bbb")))
  #expect(ComputerScreenURL.retainSource(view("aaa"), view("bbb"), now: now) == view("aaa"))
}

@Test func adoptsNewerSameStreamUrlInRenewWindow() {
  let held = view("old", now + 10 * 60_000)
  let renewed = view("new", now + hour)
  #expect(ComputerScreenURL.retainSource(held, renewed, now: now) == renewed)
  #expect(
    ComputerScreenURL.retainSource(view("old"), view("new", now + 65 * 60_000), now: now)
      == view("old"))
}

@Test func reconnectsWhenViewControlOrOriginChanges() {
  #expect(ComputerScreenURL.streamKey(view("a")) != ComputerScreenURL.streamKey(control("a")))
  #expect(ComputerScreenURL.retainSource(view("a"), control("c"), now: now) == control("c"))
  let other = "https://other.example/novnc/session/view/1710000000000.aaa/embed.html"
  #expect(ComputerScreenURL.retainSource(view("a"), other, now: now) == other)
}

@Test func visibleScreenKeepsTheLoadedUrl() {
  let held = view("a")
  #expect(ComputerScreenURL.nextLoaded(held: held, next: view("b"), visible: true, now: now) == held)
  #expect(ComputerScreenURL.nextLoaded(held: held, next: view("b"), visible: false, now: now) == nil)
  #expect(ComputerScreenURL.nextLoaded(held: nil, next: view("b"), visible: true, now: now) == view("b"))
  #expect(ComputerScreenURL.nextLoaded(held: held, next: control("c"), visible: true, now: now) == control("c"))
  let renewing = view("old", now + 10 * 60_000)
  let next = view("new", now + 70 * 60_000)
  #expect(ComputerScreenURL.nextLoaded(held: renewing, next: next, visible: true, now: now) == next)
}

@Test func reusedSealRenewsBeforeItsOriginalExpiry() {
  let issuedAt = now
  let readAt = issuedAt + 20 * 60_000
  let expiresAt = issuedAt + hour
  let reused = view("reused", expiresAt)
  let renewAt = ComputerScreenURL.renewReadAt(reused, readAt: readAt) + ComputerScreenURL.renewAfterMs
  #expect(ComputerScreenURL.renewReadAt(reused, readAt: readAt) == issuedAt)
  #expect(renewAt == expiresAt - 10 * 60_000)
  #expect(readAt + ComputerScreenURL.renewAfterMs > expiresAt)
  #expect(ComputerScreenURL.renewReadAt(view("fresh", readAt + hour), readAt: readAt) == readAt)
  #expect(ComputerScreenURL.renewReadAt("https://sandbox.example/stream?authKey=one", readAt: readAt) == readAt)
  #expect(ComputerScreenURL.renewReadAt(nil, readAt: readAt) == readAt)
}

@Test func providerUrlsKeepViewVersusControl() {
  let held = "https://sandbox.example/stream?authKey=one&view_only=true"
  let rotated = "https://sandbox.example/stream?authKey=two&view_only=true"
  let takeover = "https://sandbox.example/stream?authKey=two&view_only=false"
  #expect(ComputerScreenURL.streamKey(held) == ComputerScreenURL.streamKey(rotated))
  #expect(ComputerScreenURL.retainSource(held, rotated, now: now) == held)
  #expect(ComputerScreenURL.retainSource(held, takeover, now: now) == takeover)
}

private actor Counter {
  var calls = 0
  var sleeps = 0
  func call() -> Int { calls += 1; return calls }
  func sleep() { sleeps += 1 }
}
private struct Boom: Error {}

@Test func readReturnsTheFirstUrlWithoutRetrying() async throws {
  let counter = Counter()
  let url = try await ComputerScreenURL.read { _ = await counter.call(); return "https://screen.example/embed" }
  #expect(url == "https://screen.example/embed")
  #expect(await counter.calls == 1)
}

@Test func readRetriesThrownFailuresAndEmptyAnswersUntilAUrlArrives() async throws {
  let counter = Counter()
  let url = try await ComputerScreenURL.read(
    attempts: 5, sleep: { _ in await counter.sleep() },
    request: {
      switch await counter.call() {
      case 1: throw Boom()
      case 2: return nil
      default: return "https://screen.example/embed"
      }
    })
  #expect(url == "https://screen.example/embed")
  #expect(await counter.sleeps == 2)
}

@Test func readThrowsTheLastErrorAndReturnsNilWhenOnlyEmpty() async throws {
  await #expect(throws: Boom.self) {
    _ = try await ComputerScreenURL.read(attempts: 2, sleep: { _ in }, request: { throw Boom() })
  }
  let none = try await ComputerScreenURL.read(attempts: 2, sleep: { _ in }, request: { nil })
  #expect(none == nil)
}
