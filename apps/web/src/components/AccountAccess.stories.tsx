import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { AccountAccess } from "./AccountAccess";

const security = {
  hasPassword: true,
  passwordChangeEnabled: true,
  freshOidcAuth: false,
  ssoLinked: false,
  emailDeletion: false,
  sso: null,
};

/** The component reads /api/auth/account-security with fetch, so each story answers that request. */
function answer(body: unknown, status = 200) {
  return () => {
    const original = window.fetch;
    window.fetch = async (input, init) =>
      String(input).includes("/api/auth/account-security")
        ? new Response(JSON.stringify(body), { status })
        : original(input, init);
    return () => {
      window.fetch = original;
    };
  };
}

const meta = {
  title: "Settings/Account access",
  component: AccountAccess,
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Delete account" }),
    );
  },
} satisfies Meta<typeof AccountAccess>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPassword: Story = { beforeEach: answer(security) };

export const SsoNotLinked: Story = {
  name: "SSO not linked (Link SSO button)",
  beforeEach: answer({ ...security, sso: { name: "Sample SSO" } }),
};

export const SsoNeedsFreshSignIn: Story = {
  beforeEach: answer({
    ...security,
    hasPassword: false,
    ssoLinked: true,
    sso: { name: "Sample SSO" },
  }),
};

export const EmailDeletionCode: Story = {
  beforeEach: answer({ ...security, hasPassword: false, emailDeletion: true }),
};

export const LoadFailedWithRetry: Story = {
  beforeEach: answer({}, 500),
};
