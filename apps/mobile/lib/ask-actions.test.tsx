// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskActions, AskContext } from "../components/AskActions";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
  Pressable: ({
    children,
    onPress,
    accessibilityRole,
  }: {
    children?: ReactNode;
    onPress: () => void;
    accessibilityRole?: string;
  }) =>
    createElement(
      "button",
      { type: "button", role: accessibilityRole, onClick: onPress },
      children,
    ),
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../lib/native", () => ({
  native: { tertiaryLabel: "gray", fillPressed: "gray", fill: "white" },
}));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({ mutedForeground: "gray", foreground: "black" }),
}));
vi.mock("../lib/i18n", () => ({
  useI18n: () => ({ t: (value: string) => value }),
}));

describe("AskContext", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));

  it("shows the approval reason", () => {
    act(() =>
      root.render(
        createElement(AskContext, { approvalReason: "Firewall: may add a link or address" }),
      ),
    );
    expect(container.textContent).toContain("Firewall: may add a link or address");
  });

  it("keeps folded detail hidden until expanded", () => {
    act(() =>
      root.render(
        createElement(AskContext, { detail: "page: Example\nAdds: link", detailFolded: true }),
      ),
    );
    expect(container.textContent).not.toContain("page: Example");
    act(() => (container.querySelector("button") as HTMLButtonElement).click());
    expect(container.textContent).toContain("page: Example");
  });

  it("shows the mail-already-sent reason as a warning", () => {
    act(() =>
      root.render(createElement(AskContext, { approvalReason: "Already sent", warning: true })),
    );
    expect(container.textContent).toContain("Already sent");
  });

  it("discloses standing approval and exposes each answer as a button", () => {
    act(() =>
      root.render(
        createElement(AskActions, {
          actions: [
            { id: "allow", label: "Allow once" },
            { id: "always", label: "Always allow" },
          ],
          onAnswer: async () => undefined,
        }),
      ),
    );
    expect(container.textContent).toContain("Won't ask again anywhere in this space.");
    expect(container.querySelectorAll('button[role="button"]')).toHaveLength(2);

    act(() =>
      root.render(
        createElement(AskActions, {
          actions: [{ id: "always", label: "Always for this agent" }],
          onAnswer: async () => undefined,
        }),
      ),
    );
    expect(container.textContent).not.toContain("Won't ask again anywhere in this space.");
  });
});
