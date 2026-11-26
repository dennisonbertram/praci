import { withSandboxedArtifactCsp } from "@rakazo/core";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { htmlPageDataScript } from "../lib/agent-page";

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
 * `data` is an HTML page's live data by source name. It is injected as a "praci-data" message event after
 * the first time the document finishes loading and whenever it changes; later load events are ignored, since
 * a page can forge them. Mount it with a `key` of the page id and revision so a new page or revision starts
 * clean. The page cannot send anything back (WebView messages are not handled).
 *
 * `originWhitelist={["*"]}` is deliberate. react-native-webview checks the whitelist before
 * `onShouldStartLoadWithRequest`, and a URL that fails it is handed straight to `Linking.openURL`, whatever its
 * scheme (the default whitelist is http and https only, so a custom scheme would open another app). With "*" every
 * navigation reaches `onShouldStartLoadWithRequest`, which refuses all but the initial about:blank document.
 * `incognito` gives the WebView a non-persistent data store instead of the shared one on iOS.
 */
export function SandboxedHtmlPreview({
  html,
  scripts = true,
  email = false,
  onOpenLink,
  data,
}: {
  html: string;
  scripts?: boolean;
  email?: boolean;
  onOpenLink?: (url: string) => void;
  data?: Record<string, unknown>;
}) {
  const webview = useRef<WebView>(null);
  const loaded = useRef(false);
  const inject = (sources: Record<string, unknown> | undefined) => {
    if (sources !== undefined && loaded.current)
      webview.current?.injectJavaScript(htmlPageDataScript(sources));
  };
  useEffect(() => inject(data), [data]);
  return (
    <View style={styles.container}>
      <WebView
        ref={webview}
        onLoadEnd={() => {
          if (loaded.current) return;
          loaded.current = true;
          inject(data);
        }}
        originWhitelist={["*"]}
        incognito
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
