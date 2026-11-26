import RakazoAPI
import RakazoCore
import SwiftUI
import WebKit

/// Bot-authored HTML that can run its own scripts but cannot reach the app or the network: a data
/// store that keeps nothing, no script message handlers (the page cannot send anything back), no
/// popups, a CSP that blocks every request, and a navigation gate that cancels everything but the
/// first load. `data` is delivered as a "praci-data" message event once the document has loaded,
/// and again when it changes. Give the view an `.id` of the page and revision so a new page starts clean.
struct SandboxedHTMLView: UIViewRepresentable {
  let html: String
  let data: JSONValue?

  static func makeConfiguration() -> WKWebViewConfiguration {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
    configuration.mediaTypesRequiringUserActionForPlayback = .all
    configuration.allowsInlineMediaPlayback = false
    return configuration
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIView(context: Context) -> WKWebView {
    let view = WKWebView(frame: .zero, configuration: Self.makeConfiguration())
    view.navigationDelegate = context.coordinator
    view.uiDelegate = context.coordinator
    // Not a theme color: HTML written for a white page leaves its own text dark.
    view.isOpaque = true
    view.backgroundColor = .white
    view.scrollView.backgroundColor = .white
    context.coordinator.view = view
    context.coordinator.data = data
    view.loadHTMLString(SandboxedHTML.document(html), baseURL: nil)
    return view
  }

  func updateUIView(_: WKWebView, context: Context) {
    context.coordinator.update(data)
  }

  @MainActor
  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    weak var view: WKWebView?
    var data: JSONValue?
    private var gate = NavigationGate()
    private var loaded = false
    private var delivered: JSONValue?

    func update(_ next: JSONValue?) {
      data = next
      inject()
    }

    private func inject() {
      guard loaded, let data, data != delivered else { return }
      delivered = data
      view?.evaluateJavaScript(SandboxedHTML.dataScript(sources: data), completionHandler: nil)
    }

    func webView(
      _: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
      let own = gate.allows(
        url: navigationAction.request.url, isMainFrame: navigationAction.targetFrame?.isMainFrame ?? false
      )
      decisionHandler(own ? .allow : .cancel)
    }

    /// Later load events are ignored: a page can forge them.
    func webView(_: WKWebView, didFinish _: WKNavigation!) {
      guard !loaded else { return }
      loaded = true
      inject()
    }

    func webView(
      _: WKWebView, createWebViewWith _: WKWebViewConfiguration,
      for _: WKNavigationAction, windowFeatures _: WKWindowFeatures
    ) -> WKWebView? {
      nil
    }
  }
}
