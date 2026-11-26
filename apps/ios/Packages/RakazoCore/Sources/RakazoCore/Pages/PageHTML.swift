import Foundation
import RakazoAPI

// Port of packages/core/src/artifact-sandbox.ts. A test compares these strings with the TypeScript source.

public enum SandboxedHTML {
  public static let csp =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'"
  public static let dnsPrefetchOffMeta = "<meta http-equiv=\"x-dns-prefetch-control\" content=\"off\">"

  public static let viewportMeta = "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"

  /// Prepends the DNS-prefetch and CSP meta tags, after a leading plain doctype when there is one.
  public static func document(_ html: String) -> String {
    var meta = "\(dnsPrefetchOffMeta)<meta http-equiv=\"Content-Security-Policy\" content=\"\(csp)\">"
    // So a page without its own viewport is not drawn at desktop width.
    if html.firstMatch(of: /<meta[^>]+name\s*=\s*["']?viewport/.ignoresCase()) == nil {
      meta += viewportMeta
    }
    if let doctype = html.firstMatch(of: /^\s*<!doctype\s+html\s*>/.ignoresCase()) {
      var out = html
      out.insert(contentsOf: meta, at: doctype.range.upperBound)
      return out
    }
    return "<!DOCTYPE html>\(meta)\(html)"
  }

  /// JavaScript that delivers an HTML page's data as the "praci-data" message event the live viewer
  /// posts. The data goes in as a JSON string the page-side code parses, so it stays plain data
  /// whatever it contains. `<` and U+2028/2029 are escaped so it is also safe inside a script element.
  public static func dataScript(sources: JSONValue) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    func json(_ value: some Encodable) -> String {
      (try? String(data: encoder.encode(value), encoding: .utf8)) ?? "null"
    }
    func escapeForScript(_ text: String) -> String {
      text.replacing("<", with: "\\u003c")
        .replacing("\u{2028}", with: "\\u2028")
        .replacing("\u{2029}", with: "\\u2029")
    }
    let message = "{\"type\":\"praci-data\",\"sources\":\(json(sources))}"
    let literal = escapeForScript(json(escapeForScript(message)))
    return "(function(){window.dispatchEvent(new MessageEvent(\"message\",{data:JSON.parse(\(literal))}))})();true;"
  }
}

/// Decides every navigation of a sandboxed HTML page. Only the first main-frame load of our own
/// document (loadHTMLString reports about:blank or no URL) is allowed; links, redirects, frames
/// and a page's own later navigations are all cancelled, so no URL ever reaches the system.
public struct NavigationGate: Sendable {
  private var used = false
  public init() {}

  public mutating func allows(url: URL?, isMainFrame: Bool) -> Bool {
    guard !used, isMainFrame, url == nil || url?.scheme?.lowercased() == "about" else { return false }
    used = true
    return true
  }
}
