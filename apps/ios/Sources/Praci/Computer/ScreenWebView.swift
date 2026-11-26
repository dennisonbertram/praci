import RakazoCore
import SwiftUI
import WebKit

/// The noVNC page. The page expects React Native's `window.ReactNativeWebView.postMessage`, so a
/// script at document start forwards it to a WebKit message handler. With `nativeKeys` the page
/// attaches the key bridge instead of its own keyboard; the app then types through `ComputerKeyboard`.
struct ScreenWebView: UIViewRepresentable {
  let url: URL
  let nativeKeys: Bool
  let keyboardSession: Int
  let handle: ComputerWebHandle
  let onMessage: (String) -> Void
  let onFailure: () -> Void

  static let handlerName = "rakazoBridge"
  static let shim = "window.ReactNativeWebView={postMessage:function(m){"
    + "window.webkit.messageHandlers.\(handlerName).postMessage(String(m));}};"

  func makeCoordinator() -> Coordinator { Coordinator(self) }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    let script = Self.shim + (nativeKeys ? ComputerKeyboard.nativeBoot : "")
    configuration.userContentController.addUserScript(
      WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    configuration.userContentController.add(context.coordinator, name: Self.handlerName)
    let view = WKWebView(frame: .zero, configuration: configuration)
    view.navigationDelegate = context.coordinator
    view.scrollView.isScrollEnabled = false
    view.isOpaque = false
    view.backgroundColor = .clear
    view.accessibilityIdentifier = "computerScreen"
    handle.webView = view
    view.load(URLRequest(url: url))
    return view
  }

  func updateUIView(_ view: WKWebView, context: Context) {
    context.coordinator.parent = self
    handle.webView = view
  }

  static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
    view.configuration.userContentController.removeScriptMessageHandler(forName: handlerName)
    view.stopLoading()
  }

  @MainActor
  final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var parent: ScreenWebView
    init(_ parent: ScreenWebView) { self.parent = parent }

    nonisolated func userContentController(
      _ controller: WKUserContentController, didReceive message: WKScriptMessage
    ) {
      guard let body = message.body as? String else { return }
      Task { @MainActor in parent.onMessage(body) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      guard parent.nativeKeys else { return }
      let probe = ComputerKeyboard.readyProbe(session: String(parent.keyboardSession))
      webView.evaluateJavaScript(probe, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
      report(error)
    }

    func webView(
      _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
      withError error: Error
    ) {
      report(error)
    }

    func webView(
      _ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
      decisionHandler: @escaping @MainActor (WKNavigationResponsePolicy) -> Void
    ) {
      if let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
        parent.onFailure()
        decisionHandler(.cancel)
      } else {
        decisionHandler(.allow)
      }
    }

    private func report(_ error: Error) {
      if (error as NSError).code != NSURLErrorCancelled { parent.onFailure() }
    }
  }
}
