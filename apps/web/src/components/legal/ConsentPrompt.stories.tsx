import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { consentFixture } from "../../pages/legal/fixtures";
import { LegalConsentPrompt } from "./ConsentPrompt";

const meta = {
  title: "Legal/ConsentPrompt",
  component: LegalConsentPrompt,
  args: { consent: { ...consentFixture, allowed: false }, onChange: () => {} },
} satisfies Meta<typeof LegalConsentPrompt>;
export default meta;

export const Default: StoryObj<typeof meta> = {
  beforeEach: () => mockRpc({ "legal.consentGrant": consentFixture }),
};

export const NoModel: StoryObj<typeof meta> = {
  args: { consent: { ...consentFixture, allowed: false, recipients: [] } },
};
