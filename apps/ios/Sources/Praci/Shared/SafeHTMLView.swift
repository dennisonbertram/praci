import SwiftUI
import WebKit

/// Renders untrusted HTML (a mail body) with no scripts and no navigation. Scripts are off, the page's own
/// links never load in place (a tap opens the link in Safari), and a Content-Security-Policy meta tag lets
/// only data: and https: images and inline styles load. The view grows to the height of its content.
struct SafeHTMLView: View {
  let html: String
  /// The signed-in server. The server rewrites remote images in a mail to its own signed image proxy
  /// (`/api/inbox/image?...`), so the sender never sees the reader's address; those paths load from here.
  var server: URL?
  @State private var height: CGFloat = 1

  var body: some View {
    SafeHTMLWebView(document: SafeHTML.document(for: html, server: server), height: $height)
      .frame(height: height)
      .accessibilityIdentifier("safeHTML")
  }
}

enum SafeHTML {
  static let proxyPath = "/api/inbox/image?"

  /// A plain-http server (a local or LAN install) has to be named in `img-src` too, or its proxy
  /// images would be blocked.
  static func policy(server: URL? = nil) -> String {
    var images = "data: https:"
    if let server, server.scheme == "http", let host = server.host() {
      images += " http://\(host)" + (server.port.map { ":\($0)" } ?? "")
    }
    return "default-src 'none'; img-src \(images); style-src 'unsafe-inline'"
  }

  /// Our head comes first so the policy meta tag is always in the real head; the mail's own `<base>` and
  /// `<meta http-equiv>` tags are removed so they can neither redirect relative URLs nor loosen anything.
  static func document(for html: String, server: URL? = nil) -> String {
    var cleaned = html.replacing(/<(base|meta)\b[^>]*>/.ignoresCase(), with: "")
    if let server, var parts = URLComponents(url: server, resolvingAgainstBaseURL: false) {
      parts.path = ""
      parts.query = nil
      if let origin = parts.url?.absoluteString {
        cleaned = cleaned.replacing("src=\"" + proxyPath, with: "src=\"" + origin + proxyPath)
      }
    }
    return """
      <!doctype html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="\(policy(server: server))">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
      :root { color-scheme: light dark; }
      body { font: -apple-system-body; margin: 0; overflow-wrap: anywhere; word-break: break-word; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      </style></head><body>\(cleaned)</body></html>
      """
  }

  /// Only web links are opened, and only from a tap.
  static func openableURL(_ url: URL?) -> URL? {
    guard let url, let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http"
    else { return nil }
    return url
  }
}

private struct SafeHTMLWebView: UIViewRepresentable {
  let document: String
  @Binding var height: CGFloat

  func makeCoordinator() -> Coordinator { Coordinator(height: $height) }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = false
    configuration.websiteDataStore = .nonPersistent()
    configuration.mediaTypesRequiringUserActionForPlayback = .all
    configuration.allowsInlineMediaPlayback = false
    let view = WKWebView(frame: .zero, configuration: configuration)
    view.navigationDelegate = context.coordinator
    view.isOpaque = false
    view.backgroundColor = .clear
    view.scrollView.isScrollEnabled = false
    view.scrollView.backgroundColor = .clear
    context.coordinator.observe(view)
    context.coordinator.load(document, in: view)
    return view
  }

  func updateUIView(_ view: WKWebView, context: Context) {
    context.coordinator.load(document, in: view)
  }

  @MainActor
  final class Coordinator: NSObject, WKNavigationDelegate {
    private let height: Binding<CGFloat>
    private var loaded: String?
    private var observation: NSKeyValueObservation?

    init(height: Binding<CGFloat>) { self.height = height }

    func observe(_ view: WKWebView) {
      // Scripts are off, so the height comes from the scroll view's content size.
      observation = view.scrollView.observe(\.contentSize, options: [.new]) { [weak self] _, change in
        guard let new = change.newValue?.height else { return }
        Task { @MainActor in
          guard let self, abs(self.height.wrappedValue - new) > 0.5, new > 0 else { return }
          self.height.wrappedValue = new
        }
      }
    }

    func load(_ document: String, in view: WKWebView) {
      guard loaded != document else { return }
      loaded = document
      view.loadHTMLString(document, baseURL: nil)
    }

    func webView(
      _ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
      // The one allowed navigation is our own document load. Everything else, including tapped links,
      // never loads in place.
      if navigationAction.navigationType == .linkActivated,
        let url = SafeHTML.openableURL(navigationAction.request.url)
      {
        UIApplication.shared.open(url)
      }
      // loadHTMLString reports an `.other` navigation to about:blank (or no URL); a mail's own redirects
      // (meta refresh) are stripped with its meta tags.
      let scheme = navigationAction.request.url?.scheme
      let own = navigationAction.navigationType == .other && (scheme == nil || scheme == "about")
      decisionHandler(own ? .allow : .cancel)
    }
  }
}
