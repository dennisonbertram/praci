// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { IntegrationAgentSection } from "./IntegrationAgentSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

it("shows the agent link and both switches, and reports changes", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const onWrites = vi.fn();
  const onShared = vi.fn();
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <IntegrationAgentSection
          service="Mercury"
          agentName="Mercury agent"
          agentHref="/app/bot_1"
          writesEnabled={false}
          shared={false}
          disabled={false}
          onWrites={onWrites}
          onShared={onShared}
          usedBy={<p>Per-agent list</p>}
        />
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/app/bot_1");
  expect(container.textContent).toContain("Allow changes in Mercury");
  expect(container.textContent).toContain("Let other agents use Mercury directly");
  expect(container.textContent).toContain("Off: other agents reach Mercury only through");
  expect(container.textContent).not.toContain("Share with all agents");
  expect(container.textContent).not.toContain("Other agents ask");
  expect(container.textContent).not.toContain("Per-agent list");
  await act(async () => container.querySelector<HTMLElement>("#server-writes")?.click());
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(onWrites.mock.calls[0]?.[0]).toBe(true);
  expect(onShared.mock.calls[0]?.[0]).toBe(true);
});
