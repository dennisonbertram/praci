// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const call = vi.hoisted(() => ({
  botId: "bot-ada",
  botName: "Ada",
  botColor: "",
  startedAt: 0,
  phase: "listening" as const,
  muted: false,
  transcriptOpen: false,
  caption: "Microphone failed",
  captionIsError: true,
  heard: "",
  exchanges: [],
}));

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s.join("") }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ botId: "bot-ada" }),
}));
vi.mock("@rakazo/ui-web", () => ({
  BotAvatar: () => <span />,
  Button: ({
    children,
    ...props
  }: {
    children?: ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  cn: (...values: string[]) => values.join(" "),
}));
vi.mock("lucide-react", () =>
  Object.fromEntries(
    ["Captions", "Mic", "MicOff", "PhoneOff", "Settings", "User"].map((name) => [
      name,
      () => <span />,
    ]),
  ),
);
vi.mock("../../lib/call-session", () => ({
  endCall: vi.fn(),
  toggleMute: vi.fn(),
  toggleTranscript: vi.fn(),
  useCallSession: () => call,
}));

import { CallCard } from "./CallCard";

let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

it("shows a microphone error in the collapsed card and constrains its width on phones", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<CallCard onSettings={() => undefined} />));

  const card = container.querySelector('[data-testid="call-view"]');
  expect(card?.textContent).toContain("Microphone failed");
  expect(card?.className).toContain("max-w-[calc(100vw-2rem)]");
  expect(card?.querySelector(".text-destructive")?.textContent).toContain("Microphone failed");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Microphone failed");
});

it("announces a transcript error caption as an alert", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  call.transcriptOpen = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<CallCard onSettings={() => undefined} />));
  expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Microphone failed");
  call.transcriptOpen = false;
});

it("hides an ordinary caption in the collapsed card", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  call.caption = "I am listening.";
  call.captionIsError = false;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<CallCard onSettings={() => undefined} />));
  expect(container.querySelector('[data-testid="call-view"]')?.textContent).not.toContain(
    "I am listening.",
  );
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
