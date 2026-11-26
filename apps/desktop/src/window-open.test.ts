import { describe, expect, it } from "vitest";
import {
  mainWindowNavigation,
  oauthPopupSessionPreferences,
  shouldOpenInAppPopup,
} from "./window-open.js";

const appOrigin = "https://rakazo.example.com";

describe("main window navigation", () => {
  it.each(["/settings", "/settings?tab=billing", "/settings#plans"])(
    "allows a same-origin URL with path, query, or hash %s",
    (suffix) => {
      expect(mainWindowNavigation(appOrigin, `${appOrigin}${suffix}`)).toEqual({ allow: true });
    },
  );

  it("opens an off-origin HTTPS URL externally", () => {
    const url = "https://oauth-client.example/callback?code=abc";
    expect(mainWindowNavigation(appOrigin, url)).toEqual({ allow: false, external: url });
  });

  it.each(["file:///tmp/page", "javascript:alert(1)", "smb://server/share"])(
    "blocks non-HTTP(S) URL %s without opening it externally",
    (url) => {
      expect(mainWindowNavigation(appOrigin, url)).toEqual({ allow: false, external: null });
    },
  );

  it("blocks every URL when there is no target origin", () => {
    expect(mainWindowNavigation(null, `${appOrigin}/`)).toEqual({
      allow: false,
      external: `${appOrigin}/`,
    });
    expect(mainWindowNavigation(null, "file:///tmp/page")).toEqual({
      allow: false,
      external: null,
    });
  });

  it("blocks a lookalike origin", () => {
    const url = "https://rakazo.example.com.evil.test/path";
    expect(mainWindowNavigation(appOrigin, url)).toEqual({ allow: false, external: url });
  });
});

describe("desktop child windows", () => {
  it("keeps same-origin app routes in Electron", () => {
    expect(shouldOpenInAppPopup(appOrigin, `${appOrigin}/mcp/oauth/callback`, "_blank")).toBe(true);
  });

  it("opens ordinary external links outside Electron", () => {
    expect(
      shouldOpenInAppPopup(
        appOrigin,
        "https://github.com/dennisonbertram/praci/pull/395",
        "_blank",
      ),
    ).toBe(false);
  });

  it.each([
    "rakazo-model-oauth",
    "rakazo-mcp-oauth",
    "rakazo-sso-oauth",
    "rakazo-app-connect",
    "rakazo-plugin-connect",
  ])("keeps the intentional %s flow in an Electron popup", (frameName) => {
    expect(
      shouldOpenInAppPopup(appOrigin, "https://provider.example.com/authorize", frameName),
    ).toBe(true);
  });

  it("rejects malformed URLs and non-HTTPS third-party targets", () => {
    expect(shouldOpenInAppPopup(appOrigin, "not a url", "rakazo-model-oauth")).toBe(false);
    expect(
      shouldOpenInAppPopup(appOrigin, "http://provider.example.com", "rakazo-model-oauth"),
    ).toBe(false);
  });
});

it("keeps SSO popups sandboxed in the parent session without a privileged preload", () => {
  expect(oauthPopupSessionPreferences("persist:test-server")).toEqual({
    partition: "persist:test-server",
    preload: "",
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  });
  expect(oauthPopupSessionPreferences(null)).not.toHaveProperty("partition");
  expect(shouldOpenInAppPopup(appOrigin, "http://provider.example.com", "rakazo-sso-oauth")).toBe(
    false,
  );
});

it("allows only the named SSO blank popup before provider navigation", () => {
  expect(shouldOpenInAppPopup(appOrigin, "about:blank", "rakazo-sso-oauth")).toBe(true);
  for (const name of ["_blank", "rakazo-mcp-oauth", ""])
    expect(shouldOpenInAppPopup(appOrigin, "about:blank", name)).toBe(false);
  expect(shouldOpenInAppPopup(appOrigin, "about:blank#unsafe", "rakazo-sso-oauth")).toBe(false);
});
