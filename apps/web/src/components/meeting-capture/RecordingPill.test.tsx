// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const tag = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tag }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: tag }));

import { RecordingPill } from "./RecordingPill";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
});

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return container;
}

/** What a screen reader gets from a status region: its text without aria-hidden parts. */
const announced = (element: Element) => {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent ?? "";
};

it("keeps the ticking elapsed time out of the status announcement", async () => {
  const container = await mount(
    <RecordingPill
      state={{ kind: "recording", title: "Pricing review with Dana", elapsedMs: 754_000 }}
      onStop={() => undefined}
    />,
  );
  const status = container.querySelector('[role="status"]');
  expect(status).not.toBeNull();

  const elapsed = [...container.querySelectorAll("*")].find(
    (element) => element.textContent === "12:34",
  );
  expect(elapsed?.getAttribute("aria-hidden")).toBe("true");
  expect(announced(status!)).not.toContain("12:34");
  expect(announced(status!)).toContain("Pricing review with Dana");
  // The clock stays on screen and Stop is still there.
  expect(container.textContent).toContain("12:34");
  expect(container.querySelector("button")?.textContent).toBe("Stop");
});

it("says the last chunks are saved here while transcribing offline", async () => {
  const container = await mount(
    <RecordingPill state={{ kind: "transcribing", offline: true }} onStop={() => undefined} />,
  );
  const status = container.querySelector('[role="status"]');
  expect(status).not.toBeNull();
  expect(announced(status!)).toBe("Transcribing… · Offline, saved here");
  expect(container.querySelector("button")).toBeNull();
});

it("keeps the microphone notice ahead of the offline note", async () => {
  const container = await mount(
    <RecordingPill
      state={{ kind: "transcribing", micStopped: true, offline: true }}
      onStop={() => undefined}
    />,
  );
  expect(container.textContent).toBe("Microphone stopped · Transcribing… · Offline, saved here");
});
