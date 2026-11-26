@testable import Praci
import Testing
import WebKit

@MainActor
struct SandboxedHTMLViewTests {
  @Test func configurationKeepsNothingAndOpensNoWindows() {
    let configuration = SandboxedHTMLView.makeConfiguration()
    #expect(!configuration.websiteDataStore.isPersistent)
    #expect(configuration.defaultWebpagePreferences.allowsContentJavaScript)
    #expect(!configuration.preferences.javaScriptCanOpenWindowsAutomatically)
    // No scripts or message handlers are installed, so a page cannot send anything to the app.
    #expect(configuration.userContentController.userScripts.isEmpty)
  }

  @Test func chartDocumentScalesTheSvg() {
    #expect(AgentPageScreen.chartDocument("<svg/>").hasSuffix("<svg/>"))
    #expect(AgentPageScreen.placeholder("pending") == "Waiting for approval")
    #expect(AgentPageScreen.placeholder("denied") == "Not approved")
    #expect(AgentPageScreen.placeholder("missing") == "Source not found")
    #expect(AgentPageScreen.placeholder("paused") == "Paused")
    #expect(AgentPageScreen.warningLabel(canRetry: true) == "Source failed")
    #expect(AgentPageScreen.warningLabel(canRetry: false) == "Source paused")
    #expect(AgentPageScreen.placeholder("empty") == "No data yet")
  }
}
