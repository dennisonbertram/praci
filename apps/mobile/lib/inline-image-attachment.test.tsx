// @vitest-environment jsdom
import { lightTokens } from "@rakazo/ui-tokens";
import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { InlineImageAttachment } from "../components/inline-image-attachment";
import { imageArtifactPreview } from "./artifact-open";

vi.mock("./artifact-open", () => ({ imageArtifactPreview: vi.fn() }));
vi.mock("./appearance", () => ({ mobileTokens: () => lightTokens }));
vi.mock("./i18n", () => ({
  useI18n: () => ({ t: (s: string, v?: { name: string }) => s.replace("{name}", v?.name ?? "") }),
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: <T,>(s: T) => s },
  useWindowDimensions: () => ({ width: 400 }),
  View: ({ children }: { children?: ReactNode }) => createElement("div", {}, children),
  Text: ({ children }: { children?: ReactNode }) => createElement("span", {}, children),
  Image: ({ source }: { source: { uri: string } }) => createElement("img", { src: source.uri }),
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    createElement(
      "button",
      { type: "button", onClick: onPress, "aria-label": accessibilityLabel },
      children,
    ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  document.body.innerHTML = "";
});

it("shows the image with its caption and opens it on tap", async () => {
  vi.mocked(imageArtifactPreview).mockResolvedValue({
    uri: "file:///a.png",
    size: { width: 100, height: 50 },
  });
  const onOpen = vi.fn();
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <InlineImageAttachment
        threadTarget={{ botId: "bot" }}
        artifactId="a"
        name="a.png"
        mimeType="image/png"
        alt="A bar chart"
        caption="Q3 revenue"
        labelColor="#000"
        onOpen={onOpen}
      />,
    ),
  );
  expect(el.querySelector("img")?.getAttribute("src")).toBe("file:///a.png");
  expect(el.textContent).toContain("Q3 revenue");
  const button = el.querySelector("button");
  expect(button?.getAttribute("aria-label")).toBe("Open image A bar chart");
  await act(async () => button?.click());
  expect(onOpen).toHaveBeenCalledOnce();
});
