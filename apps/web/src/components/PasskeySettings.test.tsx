// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authClient } from "../lib/auth";
import { fetchAuthCapabilities } from "../lib/auth-capabilities";
import { PasskeySettings } from "./PasskeySettings";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((out, part, i) => out + part + (values[i] ?? ""), ""),
  }),
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: (props: React.ComponentProps<"button">) => <button type="button" {...props} />,
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogCancel: (props: React.ComponentProps<"button">) => <button type="button" {...props} />,
  AlertDialogAction: ({
    variant: _v,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string }) => <button type="button" {...props} />,
}));
vi.mock("../lib/auth-capabilities", () => ({ fetchAuthCapabilities: vi.fn() }));
vi.mock("../lib/auth", () => ({
  authClient: {
    useListPasskeys: vi.fn(() => ({
      data: [{ id: "pk1", name: "Laptop", deviceType: "multiDevice", createdAt: "2026-10-01" }],
    })),
    passkey: {
      addPasskey: vi.fn(async () => ({ error: null })),
      deletePasskey: vi.fn(async () => ({ error: null })),
    },
  },
}));

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { PublicKeyCredential: class {} });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Reflect.deleteProperty(window, "PublicKeyCredential");
});
const render = async () => {
  await act(async () => root.render(<PasskeySettings />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
};
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;

it("renders nothing when the server has no passkeys", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    sso: null,
    passwordAuth: true,
    passwordReset: false,
    resetUrl: null,
  });
  await render();
  expect(host.textContent).toBe("");
});

it("lists passkeys, adds one and removes one", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    sso: null,
    passwordAuth: true,
    passwordReset: false,
    resetUrl: null,
    passkey: true,
  });
  await render();
  expect(host.textContent).toContain("Laptop");
  await act(async () => button("Add passkey").click());
  expect(authClient.passkey.addPasskey).toHaveBeenCalled();
  await act(async () => button("Remove").click());
  // Removing asks first; a deleted passkey cannot be restored.
  expect(authClient.passkey.deletePasskey).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Remove Laptop?");
  await act(async () => button("Cancel").click());
  expect(authClient.passkey.deletePasskey).not.toHaveBeenCalled();
  await act(async () => button("Remove").click());
  await act(async () => [...host.querySelectorAll("button")].at(-1)!.click());
  expect(authClient.passkey.deletePasskey).toHaveBeenCalledWith({ id: "pk1" });
});

it("shows a retry when the capability lookup fails", async () => {
  vi.mocked(fetchAuthCapabilities)
    .mockRejectedValueOnce(new Error("temporary failure"))
    .mockResolvedValueOnce({
      sso: null,
      passwordAuth: true,
      passwordReset: false,
      resetUrl: null,
      passkey: true,
    });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  expect(host.textContent).toContain("Passkeys");
  expect(host.textContent).not.toContain("Add passkey");
  await act(async () => button("Try again").click());
  expect(host.textContent).toContain("Add passkey");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("renders nothing when the server says passkeys are unsupported", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    sso: null,
    passwordAuth: true,
    passwordReset: false,
    resetUrl: null,
    passkey: false,
  });
  await render();
  expect(host.textContent).toBe("");
});

it("shows a retry when the passkey list fails", async () => {
  const refetch = vi.fn(async () => {});
  vi.mocked(authClient.useListPasskeys).mockReturnValue({
    data: null,
    error: new Error("temporary failure") as never,
    isPending: false,
    isRefetching: false,
    refetch,
  } as never);
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    sso: null,
    passwordAuth: true,
    passwordReset: false,
    resetUrl: null,
    passkey: true,
  });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  expect(host.textContent).not.toContain("Add passkey");
  await act(async () => button("Try again").click());
  expect(refetch).toHaveBeenCalled();
});
