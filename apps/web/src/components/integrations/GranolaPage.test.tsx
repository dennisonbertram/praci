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
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { meetings: {}, connections: {} } }));
vi.mock("./CustomConnectionDialog", () => ({ CustomConnectionDialog: () => null }));
vi.mock("./McpDetail", () => ({ McpDetail: () => null }));

import { GranolaPage } from "./GranolaPage";
import type { IntegrationsData } from "./useIntegrations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("names the header button Sign in once the key is connected", async () => {
  const data = {
    loaded: true,
    servers: [],
    bots: [],
    refresh: vi.fn(),
    meetings: {
      connectionId: "conn_1",
      status: "connected",
      syncedThrough: "2026-10-20T10:00:00Z",
      lastSyncedAt: null,
      syncedCount: 3,
      consentOff: false,
      agentBotId: null,
    },
  } as unknown as IntegrationsData;
  const container = document.createElement("div");
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <GranolaPage data={data} />
      </MemoryRouter>,
    ),
  );
  const labels = [...container.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
  expect(labels).toContain("Sign in to Granola");
  expect(labels).not.toContain("Connect Granola");
});

it("shows no Connect form until the integrations have loaded", async () => {
  const data = {
    loaded: false,
    servers: [],
    bots: [],
    refresh: vi.fn(),
  } as unknown as IntegrationsData;
  const container = document.createElement("div");
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <GranolaPage data={data} />
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector("input")).toBeNull();
  expect(container.textContent).not.toContain("Connect");
  expect(container.textContent).toContain("Integrations");
});

it("shows Could not load with Try again, not the key form, when the status call failed", async () => {
  const refresh = vi.fn();
  const data = {
    loaded: true,
    servers: [],
    bots: [],
    refresh,
    meetings: undefined,
    meetingsFailed: true,
  } as unknown as IntegrationsData;
  const container = document.createElement("div");
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <GranolaPage data={data} />
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("Could not load");
  expect(container.querySelector("#granola-api-key")).toBeNull();
  const retry = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(refresh).toHaveBeenCalled();
});
