import { withSandboxedArtifactCsp } from "@rakazo/core";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Renders bot-authored HTML in a WebView that cannot reach the app's session:
 * a fresh `source.html` load has no cookies/local storage from the rest of
 * the app, `domStorageEnabled`/file access/shared cookies are explicitly off,
 * and navigation is limited to the preview document itself. The CSP meta tag
 * (the same policy as the web viewer) blocks outbound network requests, except
 * https images in `email` mode.
 */
function isPreviewDocument(url: string): boolean {
  return url === "about:blank" || url === "about:blank/";
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * `email` is for a whole message: https images load, and JavaScript stays off whatever `scripts`
 * says. `scripts={false}` alone is for other untrusted documents. `onOpenLink` receives an http(s) URL
 * only for a positively identified tap (`navigationType: "click"`, reported on iOS only); the
 * navigation itself is always blocked, and every other navigation (meta refresh, Android) opens nothing.
 */
export function SandboxedHtmlPreview({
  html,
  scripts = true,
  email = false,
  onOpenLink,
}: {
  html: string;
  scripts?: boolean;
  email?: boolean;
  onOpenLink?: (url: string) => void;
}) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: withSandboxedArtifactCsp(html, { email }), baseUrl: "about:blank" }}
        style={styles.webview}
        javaScriptEnabled={scripts && !email}
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
