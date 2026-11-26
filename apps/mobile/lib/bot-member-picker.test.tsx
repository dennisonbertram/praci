// @vitest-environment jsdom
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BotMemberPicker } from "../components/bot-member-picker";

vi.mock("../lib/native", () => ({
  useMobileTokens: () => ({
    foreground: "black",
    primaryForeground: "white",
    primary: "blue",
    border: "gray",
  }),
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
vi.mock("../components/native-switch", () => ({
  NativeSwitch: ({
    accessibilityLabel,
    value,
    onValueChange,
  }: {
    accessibilityLabel: string;
    value: boolean;
    onValueChange: (next: boolean) => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      aria-pressed={value}
      onClick={() => onValueChange(!value)}
    />
  ),
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

it("shows Firewall only for Firewall agents and Answers first on the first selected member", async () => {
  const onChange = vi.fn();
  const bots = [
    {
      id: "regular",
      name: "Regular",
      color: "#000",
      status: "idle",
      firewall: false,
    },
    {
      id: "guard",
      name: "Guard",
      color: "#000",
      status: "idle",
      firewall: true,
    },
  ];
  await act(async () =>
    root.render(<BotMemberPicker bots={bots as never} selected={[]} onChange={onChange} />),
  );
  expect(host.textContent?.match(/Firewall/g)).toHaveLength(1);
  expect(host.textContent).not.toContain("Answers first");
  await act(async () =>
    root.render(
      <BotMemberPicker bots={bots as never} selected={["guard", "regular"]} onChange={onChange} />,
    ),
  );
  expect(host.textContent).toContain("Firewall");
  expect(host.textContent).toContain("Answers first");
  const rows = [...host.querySelectorAll("div")].filter(
    (row) => row.textContent?.includes("Regular") || row.textContent?.includes("Guard"),
  );
  expect(
    rows.some((row) => row.textContent?.includes("Guard") && row.textContent.includes("Firewall")),
  ).toBe(true);
  expect(
    rows.some(
      (row) => row.textContent?.includes("Guard") && row.textContent.includes("Answers first"),
    ),
  ).toBe(true);
  expect(
    rows.some(
      (row) => row.textContent?.includes("Regular") && row.textContent.includes("Answers first"),
    ),
  ).toBe(false);
});
