// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    signIn: {
      social: vi.fn(async () => ({})),
      email: vi.fn(async () => ({ error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "no" } })),
      passkey: vi.fn(async () => ({ error: { code: "AUTH_CANCELLED", message: "cancelled" } })),
    },
    signUp: { email: vi.fn(async () => ({ data: null })) },
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
  sessionStorage.clear();
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
async function render(mode: "in" | "up" | "forgot" = "in", entry = "/") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
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

it.each([
  ["in", "email"],
  ["forgot", "email"],
  ["up", "name"],
] as const)("focuses the first field once the form appears on %s", async (mode, first) => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    ...capabilities,
    passwordAuth: true,
    passwordReset: true,
  });
  await render(mode);
  expect(document.activeElement).toBe(host.querySelector(`#${first}`));
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

const passwordOnly: AuthCapabilities = {
  ...capabilities,
  sso: null,
  passwordAuth: true,
  passwordReset: true,
  resetUrl: "https://web.test/reset-password",
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

async function submitSignUp(entry: string, address: string) {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(passwordOnly);
  vi.mocked(authClient.signUp.email).mockResolvedValue({ data: { token: null } } as never);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuthPage mode="up" />
        <LocationProbe />
      </MemoryRouter>,
    ),
  );
  await act(async () => {
    setValue(host.querySelector<HTMLInputElement>("#name")!, "New User");
    setValue(host.querySelector<HTMLInputElement>('input[name="email"]')!, address);
    setValue(host.querySelector<HTMLInputElement>('input[type="password"]')!, "password123");
  });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
}

it("names the address on the sign-up check-your-email screen and links back to sign-up", async () => {
  sessionStorage.setItem("rakazo.auth.verify-email", "new.user@example.test");
  const next = "&next=%2Fapp%2Fartifacts%3Fx%3D1";
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(passwordOnly);
  await render("up", `/sign-up?verify=email${next}`);
  expect(host.textContent).toContain("A verification link is on its way to new.user@example.test.");
  expect(hrefOf("Use a different email")).toBe(`/sign-up?${next.slice(1)}`);
  await act(async () =>
    [...host.querySelectorAll("a")]
      .find((a) => a.textContent === "Use a different email")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
  );
  expect(sessionStorage.getItem("rakazo.auth.verify-email")).toBeNull();
});

it("keeps next when sign-up asks for email verification", async () => {
  await submitSignUp("/sign-up?next=%2Fapp%2Fartifacts%3Fx%3D1", "new.user@example.test");
  const location = host.querySelector('[data-testid="location"]')!.textContent!;
  expect(location).toContain("verify=email");
  expect(location).toContain("next=%2Fapp%2Fartifacts%3Fx%3D1");
  expect(location).not.toContain("new.user");
  expect(sessionStorage.getItem("rakazo.auth.verify-email")).toBe("new.user@example.test");
  expect(host.textContent).toContain("A verification link is on its way to new.user@example.test.");
});

it("shows only Back to sign in when the address is unknown", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(passwordOnly);
  await render("up", "/sign-up?verify=email");
  expect(hrefOf("Back to sign in")).toBe("/sign-in");
  expect(host.textContent).not.toContain("verification link");
  expect(hrefOf("Use a different email")).toBeUndefined();
});

it("reads the stored verification address once, so a later visit in this tab never shows it", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue(passwordOnly);
  sessionStorage.setItem("rakazo.auth.verify-email", "new.user@example.test");
  await render("up", "/sign-up?verify=email");
  expect(host.textContent).toContain("new.user@example.test");
  expect(sessionStorage.getItem("rakazo.auth.verify-email")).toBeNull();
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

it("puts focus back on the email field after a failed sign-in", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    ...capabilities,
    sso: null,
    passwordAuth: true,
  });
  await render("in");
  await act(async () => {
    setValue(host.querySelector<HTMLInputElement>('input[name="email"]')!, "maya@example.com");
    setValue(host.querySelector<HTMLInputElement>('input[type="password"]')!, "wrong-password");
  });
  (host.querySelector('button[type="submit"]') as HTMLButtonElement).focus();
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(host.querySelector('input[name="email"]'));
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

it("marks each invalid sign-up field with its own message and leaves valid fields alone", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("up");
  const form = host.querySelector("form")!;
  const submit = () =>
    act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  const field = (name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const message = (name: string) =>
    document.getElementById(field(name).getAttribute("aria-describedby") ?? "")?.textContent;

  await submit();
  expect(["name", "email", "password"].map((n) => field(n).getAttribute("aria-invalid"))).toEqual([
    "true",
    "true",
    "true",
  ]);
  expect(message("name")).toBe("Enter your name");
  expect(message("email")).toBe("Enter a valid email");

  await act(async () => {
    setValue(field("name"), "Maya");
    setValue(field("email"), "maya@bad");
    setValue(field("password"), "abc");
  });
  expect(field("name").getAttribute("aria-invalid")).toBeNull();
  await submit();
  expect(field("name").getAttribute("aria-invalid")).toBeNull();
  expect(message("email")).toBe("Enter a valid email");
  expect(field("password").getAttribute("aria-invalid")).toBe("true");
  expect(message("password")).toBe("At least 8 characters.");
});

async function renderReset(entry = "/reset-password?token=t") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <PasswordResetPage />
      </MemoryRouter>,
    ),
  );
}

const resetField = (id: string) => host.querySelector<HTMLInputElement>(`#${id}`)!;
const submitReset = () =>
  act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

it("shows the 8-character rule in red on the reset form, not as a native bubble", async () => {
  await renderReset();
  expect(host.querySelector("form")?.noValidate).toBe(true);
  expect(resetField("new-password").minLength).toBe(-1);
  await act(async () => {
    setValue(resetField("new-password"), "short");
    setValue(resetField("confirm-password"), "short");
  });
  await submitReset();
  const hint = [...host.querySelectorAll("p")].find(
    (p) => p.textContent === "At least 8 characters.",
  );
  expect(hint?.className).toContain("text-destructive");
  expect(hint?.getAttribute("role")).toBe("alert");
  expect(authClient.resetPassword).not.toHaveBeenCalled();
});

it("puts the mismatch message under the confirm field", async () => {
  await renderReset();
  await act(async () => {
    setValue(resetField("new-password"), "password123");
    setValue(resetField("confirm-password"), "password124");
  });
  await submitReset();
  const confirm = resetField("confirm-password");
  expect(confirm.getAttribute("aria-invalid")).toBe("true");
  const message = document.getElementById(confirm.getAttribute("aria-describedby") ?? "");
  expect(message?.textContent).toBe("Passwords do not match");
  expect(authClient.resetPassword).not.toHaveBeenCalled();
});

it("toggles visibility on each reset password field", async () => {
  await renderReset();
  const toggles = [
    ...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Show password"]'),
  ];
  const [first, second] = toggles;
  expect(toggles).toHaveLength(2);
  expect(resetField("new-password").type).toBe("password");
  await act(async () => first?.click());
  expect(resetField("new-password").type).toBe("text");
  expect(resetField("confirm-password").type).toBe("password");
  await act(async () => second?.click());
  expect(resetField("new-password").type).toBe("text");
  expect(resetField("confirm-password").type).toBe("text");
});

describe("passkey sign-in", () => {
  const withPasskey = { ...capabilities, sso: null, passwordAuth: true, passkey: true };
  const button = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === "Sign in with passkey");
  beforeEach(() => {
    Object.assign(window, { PublicKeyCredential: class {} });
  });
  afterEach(() => {
    Reflect.deleteProperty(window, "PublicKeyCredential");
  });
  it("offers the button and passkey autofill on the email field", async () => {
    vi.mocked(fetchAuthCapabilities).mockResolvedValue(withPasskey);
    await render();
    expect(button()).toBeTruthy();
    expect(host.querySelector('input[name="email"]')?.getAttribute("autocomplete")).toBe(
      "username webauthn",
    );
  });
  it("is hidden when the server or the browser lacks passkeys", async () => {
    vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...withPasskey, passkey: undefined });
    await render();
    expect(button()).toBeUndefined();
    Reflect.deleteProperty(window, "PublicKeyCredential");
    vi.mocked(fetchAuthCapabilities).mockResolvedValue(withPasskey);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(button()).toBeUndefined();
  });
  it("shows nothing when the prompt is cancelled and the error style otherwise", async () => {
    vi.mocked(fetchAuthCapabilities).mockResolvedValue(withPasskey);
    await render();
    await act(async () => button()!.click());
    expect(authClient.signIn.passkey).toHaveBeenCalledWith({ autoFill: false });
    expect(host.querySelector('p[role="alert"]:not(:empty)')).toBeNull();
    vi.mocked(authClient.signIn.passkey).mockResolvedValueOnce({
      error: { code: "PASSKEY_NOT_FOUND", message: "Passkey not found" },
    } as never);
    await act(async () => button()!.click());
    expect(host.querySelector('p[role="alert"]:not(:empty)')).toBeTruthy();
  });
});

const hrefOf = (text: string) =>
  [...host.querySelectorAll("a")].find((a) => a.textContent === text)?.getAttribute("href");

it("keeps next on the links between the auth pages", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({
    ...capabilities,
    passwordAuth: true,
    passwordReset: true,
  });
  const next = "?next=%2Fapp%2Fartifacts%3Fx%3D1";
  await render("in", `/sign-in${next}`);
  expect(hrefOf("Sign up")).toBe(`/sign-up${next}`);
  expect(hrefOf("Forgot password?")).toBe(`/forgot-password${next}`);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render("forgot", `/forgot-password${next}`);
  expect(hrefOf("Back to sign in")).toBe(`/sign-in${next}`);
});

it("drops a next that points outside the app", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("in", "/sign-in?next=https%3A%2F%2Fevil.test");
  expect(hrefOf("Sign up")).toBe("/sign-up");
});

it("offers a way back when password recovery is off", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, sso: null });
  await render("forgot");
  expect(host.textContent).toContain("Password recovery is not configured for this server");
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
});

it("sends the name without surrounding spaces", async () => {
  vi.mocked(fetchAuthCapabilities).mockResolvedValue({ ...capabilities, passwordAuth: true });
  await render("up");
  await act(async () => {
    setValue(host.querySelector<HTMLInputElement>("#name")!, " Dana ");
    setValue(host.querySelector<HTMLInputElement>('input[name="email"]')!, "dana@example.test");
    setValue(host.querySelector<HTMLInputElement>('input[type="password"]')!, "password123");
  });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(authClient.signUp.email).toHaveBeenCalledWith(expect.objectContaining({ name: "Dana" }));
});
