// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authClient } from "../lib/auth";
import type { AuthCapabilities } from "../lib/auth-capabilities";
import { fetchAuthCapabilities } from "../lib/auth-capabilities";
import { AuthPage, PasswordResetPage } from "./Auth";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    children,
    variant,
    size,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string; size?: string }) => (
    <button data-variant={variant ?? "default"} data-size={size} {...props}>
      {children}
    </button>
  ),
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, htmlFor, ...props }: React.ComponentProps<"label">) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));
vi.mock("../lib/auth-capabilities", () => ({ fetchAuthCapabilities: vi.fn() }));
vi.mock("../lib/auth", () => ({
  authClient: {
    signIn: { social: vi.fn(async () => ({})) },
    requestPasswordReset: vi.fn(async () => ({})),
    resetPassword: vi.fn(async () => ({})),
  },
}));
vi.mock("../lib/rpc", () => ({ clearSpaceSelection: vi.fn() }));
const capabilities: AuthCapabilities = {
  passwordAuth: false,
  sso: { name: "Example", availability: "unavailable" },
  passwordReset: false,
  resetUrl: null,
};
function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  delete window.rakazoDesktop;
});
async function render(mode: "in" | "up" | "forgot" = "in") {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AuthPage mode={mode} />
      </MemoryRouter>,
    ),
  );
}
it("shows no credential form while capabilities load", async () => {
  vi.mocked(fetchAuthCapabilities).mockReturnValue(new Promise(() => undefined));
  await render();
  expect(host.querySelector("input")).toBeNull();
  expect(host.textContent).toContain("Loading…");
});
it.each(["in", "up"] as const)("offers SSO and hides credentials on %s", async (mode) => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(capabilities);
  await render(mode);
  expect(host.textContent).toContain("Continue with Example");
  expect(host.querySelector("input")).toBeNull();
  const sso = host.querySelector("button")!;
  expect(sso.dataset.variant).toBe("default");
  expect(sso.className).toContain("w-full");
});
it("retries failed capabilities without exposing a password form", async () => {
  vi.mocked(fetchAuthCapabilities)
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce(capabilities);
  await render();
  expect(host.textContent).toContain("Could not load sign-in options");
  expect(host.querySelector("input")).toBeNull();
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry",
  )!;
  await act(async () => retry.click());
  expect(fetchAuthCapabilities).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("Continue with Example");
});
it.each(["in", "up"] as const)("puts quiet SSO below the primary action on %s", async (mode) => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render(mode);
  const email = host.querySelector('input[name="email"]')!;
  const password = host.querySelector('input[type="password"]')!;
  const submit = host.querySelector('button[type="submit"]')!;
  const sso = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Continue with Example",
  )!;
  for (const [first, second] of [
    [email, password],
    [password, submit],
    [submit, sso],
  ] as const) {
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(submit.getAttribute("data-variant")).toBe("default");
  expect(sso.dataset.variant).toBe("link");
  expect(sso.dataset.size).toBe("sm");
});

it("asks for a name at sign-up, so Chief can greet the founder by it", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("up");
  expect(host.querySelector<HTMLInputElement>("#name")?.required).toBe(true);
});

it("hides SSO in password recovery", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("forgot");
  expect(host.textContent).not.toContain("Continue with Example");
});

it("selects a non-redirecting SSO request on desktop", async () => {
  vi.spyOn(window, "open").mockReturnValue({ close: vi.fn() } as unknown as Window);
  window.rakazoDesktop = {} as NonNullable<Window["rakazoDesktop"]>;
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(capabilities);
  vi.mocked(authClient.signIn.social).mockResolvedValue({
    data: null,
    error: { message: "Unavailable", status: 503, statusText: "Unavailable" },
  });
  await render();
  const button = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Continue with"),
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
  expect(authClient.signIn.social).toHaveBeenCalledWith(
    expect.objectContaining({ provider: "oidc", disableRedirect: true }),
  );
});

it("keeps SSO available for retry while an authorization request is pending", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(capabilities);
  vi.mocked(authClient.signIn.social).mockReturnValue(new Promise(() => undefined));
  await render();
  const button = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Continue with"),
  )!;
  await act(async () => button.click());
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(authClient.signIn.social).toHaveBeenCalledTimes(2);
});

it("names the address after a reset request and can send it again", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    ...capabilities,
    sso: null,
    passwordAuth: true,
    passwordReset: true,
    resetUrl: "https://web.test/reset-password",
  });
  await render("forgot");
  const email = host.querySelector<HTMLInputElement>('input[name="email"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      email,
      "ada@example.test",
    );
    email.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(host.textContent).toContain("If ada@example.test has an account");
  expect(host.textContent).toContain("spam");
  const again = [...host.querySelectorAll("button")].find((b) => b.textContent === "Send again")!;
  await act(async () => again.click());
  expect(authClient.requestPasswordReset).toHaveBeenCalledTimes(2);
});

it("shows only the message and a new-link action for an invalid reset link", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/reset-password?error=INVALID_TOKEN"]}>
        <PasswordResetPage />
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector("h1")?.textContent).toBe("Reset link expired");
  expect(host.querySelector("input")).toBeNull();
  expect(host.querySelector('button[type="submit"]')).toBeNull();
  expect(host.querySelector('a[href="/forgot-password"]')?.textContent).toBe("Request a new link");
});

it("swaps to the expired page when a typed link's token is rejected", async () => {
  vi.mocked(authClient.resetPassword).mockResolvedValueOnce({
    error: { code: "INVALID_TOKEN", message: "Invalid token" },
  } as never);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/reset-password?token=bad"]}>
        <PasswordResetPage />
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector("h1")?.textContent).toBe("Choose a new password");
  await act(async () => {
    for (const input of host.querySelectorAll("input")) setValue(input, "longenough1");
  });
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector("h1")?.textContent).toBe("Reset link expired");
  expect(host.querySelector("input")).toBeNull();
});

it("names the sign-in button Sign in and keeps room for an error line", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    ...capabilities,
    sso: null,
    passwordAuth: true,
  });
  await render("in");
  expect(host.querySelector('button[type="submit"]')?.textContent).toBe("Sign in");
  // The alert line exists before any error, so showing one moves no field.
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("");
});

it("shows the 8-character rule in red on the page, not as a native bubble", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("up");
  const password = host.querySelector<HTMLInputElement>('input[type="password"]')!;
  expect(password.minLength).toBe(-1);
  await act(async () => {
    setValue(host.querySelector<HTMLInputElement>('input[name="name"]')!, "Maya");
    setValue(host.querySelector<HTMLInputElement>('input[name="email"]')!, "maya@example.com");
    setValue(password, "short");
  });
  const form = host.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  const hint = [...host.querySelectorAll("p")].find(
    (p) => p.textContent === "At least 8 characters.",
  );
  expect(hint?.className).toContain("text-destructive");
});

it("shows an inline red message for an empty name, not the browser's native bubble", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("up");
  const form = host.querySelector("form")!;
  expect(form.noValidate).toBe(true);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  const alert = host.querySelector('[role="alert"]');
  expect(alert?.textContent).toBe("Enter your name");
  expect(alert?.className).toContain("text-destructive");
});

it("keeps native required and minLength validation on the password-reset form", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/reset-password?token=t"]}>
        <PasswordResetPage />
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector("form")?.noValidate).toBe(false);
});
