// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const portal = vi.hoisted(() => ({ loadPortal: vi.fn(), signOutPortal: vi.fn() }));
vi.mock("../../lib/portal", async () => {
  class PortalDeadError extends Error {}
  return {
    loadPortal: portal.loadPortal,
    signOutPortal: portal.signOutPortal,
    PortalDeadError,
    portalDocumentUrl: (id: string) => `/api/portal/documents/${id}/content`,
  };
});

import { PortalDeadError } from "../../lib/portal";
import { PortalHome } from "./PortalHome";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const me = { company: "Example Co", name: "Ada" };
const update = (id: string, subject: string, body: string, sentAt: string) => ({
  id,
  subject,
  body,
  sentAt,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const show = async (content: unknown, onSignedOut?: () => void) => {
  portal.loadPortal.mockResolvedValue(content);
  await act(async () => root.render(<PortalHome onSignedOut={onSignedOut} />));
};

it("shows the company, the newest update in full and earlier updates as collapsed rows", async () => {
  await show({
    me,
    updates: [
      update("u2", "Q2 update", "Revenue grew **fast**", "2026-07-10T00:00:00.000Z"),
      update("u1", "Q1 update", "Hiring went well", "2026-04-10T00:00:00.000Z"),
    ],
    documents: [],
  });
  expect(container.querySelector("h1")?.textContent).toBe("Example Co");
  expect(container.textContent).toContain("Q2 update");
  expect(container.querySelector("strong")?.textContent).toBe("fast");
  expect(container.textContent).toContain("Earlier updates");
  expect(container.textContent).toContain("Q1 update");
  expect(container.textContent).not.toContain("Hiring went well");
  const row = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Q1 update"),
  );
  await act(async () => row?.click());
  expect(container.textContent).toContain("Hiring went well");
});

it("lists shared documents with a Download link and has a Sign out in the footer", async () => {
  const onSignedOut = vi.fn();
  portal.signOutPortal.mockResolvedValue(undefined);
  await show(
    { me, updates: [], documents: [{ id: "d1", name: "Deck.pdf", size: 10 }] },
    onSignedOut,
  );
  const download = container.querySelector<HTMLAnchorElement>("a[download]");
  expect(download?.getAttribute("href")).toBe("/api/portal/documents/d1/content");
  expect(download?.textContent).toBe("Download");
  expect(container.textContent).toContain("Deck.pdf");
  expect(container.textContent).not.toContain("Nothing shared yet.");
  const signOut = [...container.querySelectorAll<HTMLElement>("footer button")].find(
    (b) => b.textContent === "Sign out",
  );
  await act(async () => signOut?.click());
  expect(portal.signOutPortal).toHaveBeenCalled();
  expect(onSignedOut).toHaveBeenCalled();
});

it("says Nothing shared yet. when there is no update and no document", async () => {
  await show({ me, updates: [], documents: [] });
  expect(container.textContent).toContain("Nothing shared yet.");
  expect(container.textContent).not.toContain("Earlier updates");
  expect(container.textContent).not.toContain("Documents");
});

it("a session that no longer works lands on the dead link sentence", async () => {
  portal.loadPortal.mockRejectedValue(new PortalDeadError());
  await act(async () => root.render(<PortalHome />));
  expect(container.textContent).toBe("This link no longer works.");
});

it("a failed load offers Try again and reloads", async () => {
  portal.loadPortal.mockRejectedValueOnce(new Error("offline"));
  await act(async () => root.render(<PortalHome />));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not load this page");
  portal.loadPortal.mockResolvedValue({ me, updates: [], documents: [] });
  const retry = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => retry?.click());
  expect(container.querySelector("h1")?.textContent).toBe("Example Co");
});
