import Foundation
import JavaScriptCore
import RakazoAPI
@testable import RakazoCore
import Testing

struct SandboxedHTMLTests {
  @Test func policyMatchesTheTypeScriptSource() throws {
    var url = URL(fileURLWithPath: #filePath)
    var source: String?
    for _ in 0 ..< 8 {
      url.deleteLastPathComponent()
      let candidate = url.appending(path: "packages/core/src/artifact-sandbox.ts")
      if let text = try? String(contentsOf: candidate, encoding: .utf8) {
        source = text
        break
      }
    }
    let text = try #require(source, "artifact-sandbox.ts not found above the test file")
    #expect(text.contains("\"\(SandboxedHTML.csp)\""))
    #expect(text.contains("'\(SandboxedHTML.dnsPrefetchOffMeta)'"))
  }

  @Test func prependsMetaAfterDoctype() {
    let meta = "\(SandboxedHTML.dnsPrefetchOffMeta)<meta http-equiv=\"Content-Security-Policy\" content=\"\(SandboxedHTML.csp)\">"
    let withViewport = meta + SandboxedHTML.viewportMeta
    #expect(SandboxedHTML.document("<p>x</p>") == "<!DOCTYPE html>\(withViewport)<p>x</p>")
    #expect(SandboxedHTML.document("<!doctype html><p>x</p>") == "<!doctype html>\(withViewport)<p>x</p>")
    let own = "<meta name=\"viewport\" content=\"width=500\"><p>x</p>"
    #expect(SandboxedHTML.document(own) == "<!DOCTYPE html>\(meta)\(own)")
  }

  /// Runs the script in JavaScriptCore with a stub window and returns what the page's listener gets.
  private func delivered(_ sources: JSONValue) throws -> String {
    let context = JSContext()!
    var failure: String?
    context.exceptionHandler = { _, error in failure = error?.toString() }
    context.evaluateScript(
      """
      var received = null;
      var window = { dispatchEvent: function (e) { received = JSON.stringify(e.data); } };
      function MessageEvent(type, init) { this.data = init.data; }
      """
    )
    let script = SandboxedHTML.dataScript(sources: sources)
    #expect(!script.contains("<"))
    #expect(!script.contains("\u{2028}") && !script.contains("\u{2029}"))
    context.evaluateScript(script)
    #expect(failure == nil)
    return try #require(context.evaluateScript("received")?.toString())
  }

  @Test func scriptDeliversDataUnchanged() throws {
    let tricky = "</script><b>\u{2028}\u{2029}\"quote\" 'single' \\ back / é"
    let json = try delivered(.object(["a": .object(["value": .string(tricky), "n": .number(2.5)])]))
    let data = try #require(try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
    #expect(data["type"] as? String == "praci-data")
    let a = (data["sources"] as? [String: Any])?["a"] as? [String: Any]
    #expect(a?["value"] as? String == tricky)
    #expect(a?["n"] as? Double == 2.5)
  }

  @Test func gateAllowsOnlyTheFirstOwnLoad() {
    var gate = NavigationGate()
    let blank = URL(string: "about:blank")
    let results = [
      gate.allows(url: URL(string: "https://example.com"), isMainFrame: true),
      gate.allows(url: blank, isMainFrame: false),
      gate.allows(url: blank, isMainFrame: true),
      gate.allows(url: blank, isMainFrame: true),
      gate.allows(url: URL(string: "tel:123"), isMainFrame: true),
      gate.allows(url: nil, isMainFrame: true),
    ]
    #expect(results == [false, false, true, false, false, false])
  }
}
