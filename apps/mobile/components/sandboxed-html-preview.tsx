import { withSandboxedArtifactCsp } from "@rakazo/core";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Renders bot-authored HTML in a WebView that cannot reach the app's session:
 * a fresh `source.html` load has no cookies/local storage from the rest of
 * the app, `domStorageEnabled`/file access/shared cookies are explicitly off,
 * and navigation is limited to the preview document itself. The CSP meta tag
 * (the same policy as the web viewer) blocks outbound network requests.
 */
function isPreviewDocument(url: string): boolean {
  return url === "about:blank" || url === "about:blank/";
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * `scripts={false}` is for untrusted documents such as email. `onOpenLink` receives an http(s) URL
 * only for a positively identified tap (`navigationType: "click"`, reported on iOS only); the
 * navigation itself is always blocked, and every other navigation (meta refresh, Android) opens nothing.
 */
export function SandboxedHtmlPreview({
  html,
  scripts = true,
  onOpenLink,
}: {
  html: string;
  scripts?: boolean;
  onOpenLink?: (url: string) => void;
}) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: withSandboxedArtifactCsp(html), baseUrl: "about:blank" }}
        style={styles.webview}
        javaScriptEnabled={scripts}
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        mixedContentMode="never"
        cacheEnabled={false}
        onShouldStartLoadWithRequest={({ url, navigationType }) => {
          if (isPreviewDocument(url)) return true;
          if (onOpenLink && navigationType === "click" && isWebUrl(url)) onOpenLink(url);
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Not a theme color: HTML written for a white page leaves its own text dark,
  // so the canvas has to be white in dark mode too.
  webview: { flex: 1, backgroundColor: "white" },
});
