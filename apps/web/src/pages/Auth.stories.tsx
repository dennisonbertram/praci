import type { AuthCapabilities } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthFrame, AuthPage, PasswordResetPage } from "./Auth";

/**
 * AuthPage reads /api/auth/capabilities through a cached module-level request, so in a running
 * Storybook the first successful answer is reused until the page reloads. Answers with an SSO
 * entry whose availability is not "available" are never cached, so the SSO stories use "checking".
 */
const passwordOnly: AuthCapabilities = {
  sso: null,
  passwordAuth: true,
  passwordReset: true,
  resetUrl: "https://app.example.com/reset-password",
};

function capabilities(answer: () => Promise<Response>) {
  const original = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes("/api/auth/capabilities")
      ? answer()
      : original(input, init)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

const json = (body: unknown) => () => Promise.resolve(Response.json(body));

function At({ path, element, to }: { path: string; element: React.ReactNode; to: string }) {
  return (
    <Routes>
      <Route path={path} element={element} />
      <Route path="*" element={<Navigate to={to} replace />} />
    </Routes>
  );
}

const meta = {
  title: "Auth/AuthPage",
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Also shows: PasswordField (PasswordResetPage)." } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const SignIn: Story = {
  render: () => <AuthPage mode="in" />,
  beforeEach: () => capabilities(json(passwordOnly)),
};

export const SignUp: Story = {
  render: () => <AuthPage mode="up" />,
  beforeEach: () => capabilities(json(passwordOnly)),
};

export const ForgotPassword: Story = {
  render: () => <AuthPage mode="forgot" />,
  beforeEach: () => capabilities(json(passwordOnly)),
};

export const SignInWithSso: Story = {
  render: () => <AuthPage mode="in" />,
  beforeEach: () =>
    capabilities(json({ ...passwordOnly, sso: { name: "Example SSO", availability: "checking" } })),
};

export const SsoOnly: Story = {
  render: () => <AuthPage mode="in" />,
  beforeEach: () =>
    capabilities(
      json({
        sso: { name: "Example SSO", availability: "checking" },
        passwordAuth: false,
        passwordReset: false,
        resetUrl: null,
      }),
    ),
};

export const LoadingOptions: Story = {
  render: () => <AuthPage mode="in" />,
  beforeEach: () => capabilities(() => new Promise<Response>(() => undefined)),
};

export const OptionsFailed: Story = {
  render: () => <AuthPage mode="in" />,
  beforeEach: () => capabilities(() => Promise.resolve(new Response("nope", { status: 500 }))),
};

export const CheckYourEmail: Story = {
  render: () => <At path="/sign-up" element={<AuthPage mode="up" />} to="/sign-up?verify=email" />,
  beforeEach: () => capabilities(json(passwordOnly)),
};

export const LinkError: Story = {
  render: () => (
    <At path="/sign-in" element={<AuthPage mode="in" />} to="/sign-in?error=access_denied" />
  ),
  beforeEach: () => capabilities(json(passwordOnly)),
};

export const ResetPassword: Story = {
  render: () => <At path="/reset" element={<PasswordResetPage />} to="/reset?token=demo-token" />,
};

export const ResetLinkInvalid: Story = {
  render: () => <PasswordResetPage />,
};

export const Frame: Story = {
  render: () => (
    <AuthFrame title="Frame title" onSubmit={(event) => event.preventDefault()}>
      <p>Frame content</p>
    </AuthFrame>
  ),
};
