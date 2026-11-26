// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ $fetch: vi.fn() }));

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  NativeSelect: (props: React.ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: React.ComponentProps<"option">) => <option {...props} />,
}));

vi.mock("../lib/auth", () => ({ authClient: auth }));
vi.mock("./Auth", () => ({
  AuthFrame: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

import { McpConsentPage } from "./McpConsent";

afterEach(() => {
  document.body.replaceChildren();
  auth.$fetch.mockReset();
});

it("shows the connection failure when the initial request rejects", async () => {
  auth.$fetch.mockRejectedValue(new Error("offline"));
  window.history.replaceState({}, "", "/mcp/consent?client_id=client-1");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<McpConsentPage />));

  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not connect");

  await act(async () => root.unmount());
});

const consentReply = (path: string) =>
  Promise.resolve(
    path === "/mcp/spaces"
      ? { data: { spaces: [{ id: "space-1", name: "Northwind" }] } }
      : path === "/oauth2/consent"
        ? { data: { redirect: true, url: "#" } }
        : { data: { client_name: "Claude Code" } },
  );

async function renderConsent(search: string) {
  auth.$fetch.mockImplementation(consentReply);
  window.history.replaceState({}, "", `/mcp/consent${search}`);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<McpConsentPage />));
  return { container, root };
}

const buttons = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].map((button) => button.textContent);

it("shows a safe error and no way to approve a malformed redirect_uri", async () => {
  const { container, root } = await renderConsent("?client_id=client-1&redirect_uri=not%20a%20url");

  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "This connection request is not valid",
  );
  expect(buttons(container)).toEqual(["Cancel"]);
  expect(
    auth.$fetch.mock.calls.some(
      ([path, init]) =>
        path === "/mcp/space" ||
        (init as { body?: { accept?: boolean } } | undefined)?.body?.accept === true,
    ),
  ).toBe(false);

  await act(async () => root.unmount());
});

it("still lets a malformed request be cancelled", async () => {
  const { container, root } = await renderConsent("?client_id=client-1&redirect_uri=not%20a%20url");

  const cancel = container.querySelector("button");
  expect(cancel?.textContent).toBe("Cancel");
  await act(async () => cancel!.click());

  expect(auth.$fetch).toHaveBeenCalledWith("/oauth2/consent", {
    method: "POST",
    body: { accept: false },
  });
  expect(auth.$fetch).not.toHaveBeenCalledWith("/mcp/space", expect.anything());

  await act(async () => root.unmount());
});

it("shows the redirect host on a well-formed request", async () => {
  const { container, root } = await renderConsent(
    "?client_id=client-1&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2Fcallback",
  );

  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("127.0.0.1:53682");
  expect(buttons(container)).toEqual(["Allow", "Cancel"]);

  await act(async () => root.unmount());
});
