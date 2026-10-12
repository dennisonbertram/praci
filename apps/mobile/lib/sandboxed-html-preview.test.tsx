// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SandboxedHtmlPreview } from "../components/sandboxed-html-preview";

type WebViewProps = {
  source: { html: string };
  javaScriptEnabled: boolean;
  onShouldStartLoadWithRequest: (request: { url: string; navigationType?: string }) => boolean;
};
const webview = vi.hoisted(() => ({ props: null as unknown }));
vi.mock("react-native-webview", () => ({
  WebView: (props: unknown) => {
    webview.props = props;
    return null;
  },
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const props = () => webview.props as WebViewProps;
const show = (element: ReactNode) => act(() => root.render(element));

it("runs scripts by default, as artifacts need", () => {
  show(<SandboxedHtmlPreview html="<p>hi</p>" />);
  expect(props().javaScriptEnabled).toBe(true);
});

it("turns JavaScript off with scripts={false}", () => {
  show(<SandboxedHtmlPreview html="<p>hi</p>" scripts={false} />);
  expect(props().javaScriptEnabled).toBe(false);
});

it("opens a tapped http(s) link and still blocks the navigation", () => {
  const onOpenLink = vi.fn();
  show(<SandboxedHtmlPreview html="<a>x</a>" scripts={false} onOpenLink={onOpenLink} />);
  const allow = props().onShouldStartLoadWithRequest;
  expect(allow({ url: "https://example.com/a", navigationType: "click" })).toBe(false);
  expect(allow({ url: "http://example.com/b", navigationType: "click" })).toBe(false);
  expect(onOpenLink.mock.calls).toEqual([["https://example.com/a"], ["http://example.com/b"]]);
});

it("opens nothing for a meta refresh, an Android request, or a non-http(s) tap", () => {
  const onOpenLink = vi.fn();
  show(<SandboxedHtmlPreview html="<a>x</a>" scripts={false} onOpenLink={onOpenLink} />);
  const allow = props().onShouldStartLoadWithRequest;
  expect(allow({ url: "https://example.com/", navigationType: "other" })).toBe(false);
  expect(allow({ url: "https://example.com/" })).toBe(false);
  expect(allow({ url: "javascript:alert(1)", navigationType: "click" })).toBe(false);
  expect(allow({ url: "intent://x#Intent;end", navigationType: "click" })).toBe(false);
  expect(allow({ url: "tel:+15555550100", navigationType: "click" })).toBe(false);
  expect(onOpenLink).not.toHaveBeenCalled();
});

it("keeps today's behavior without onOpenLink: only the document itself loads", () => {
  show(<SandboxedHtmlPreview html="<p>hi</p>" />);
  const allow = props().onShouldStartLoadWithRequest;
  expect(allow({ url: "about:blank", navigationType: "other" })).toBe(true);
  expect(allow({ url: "https://example.com/", navigationType: "click" })).toBe(false);
});

it("blocks remote images by default, as artifacts need", () => {
  show(<SandboxedHtmlPreview html='<img src="https://tracker.example/p.gif">' />);
  expect(props().source.html).toContain("img-src data:;");
  expect(props().source.html).not.toContain("https:");
});

it("email mode loads https images, runs no script, and still blocks other navigation", () => {
  const onOpenLink = vi.fn();
  show(<SandboxedHtmlPreview html="<img src='https://x.example/p.png'>" email onOpenLink={onOpenLink} />);
  expect(props().source.html).toContain("img-src data: https:;");
  expect(props().source.html).toContain("default-src 'none'");
  expect(props().javaScriptEnabled).toBe(false);
  const allow = props().onShouldStartLoadWithRequest;
  expect(allow({ url: "https://x.example/p.png", navigationType: "other" })).toBe(false);
  expect(allow({ url: "https://x.example/a", navigationType: "click" })).toBe(false);
  expect(onOpenLink).toHaveBeenCalledWith("https://x.example/a");
});

it("email mode keeps JavaScript off even if scripts is left on", () => {
  show(<SandboxedHtmlPreview html="<p>hi</p>" email scripts />);
  expect(props().javaScriptEnabled).toBe(false);
});
