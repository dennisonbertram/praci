import {
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  MISSING_TOOL_FINAL_RESPONSE_ERROR,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposerError } from "./composer-error";

const meta = {
  title: "Shell/Composer error",
  component: ComposerError,
  args: {
    onDismiss: () => {},
    onOpenModelSettings: () => {},
    onNavigate: () => {},
    onRetry: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposerError>;
export default meta;

type Story = StoryObj<typeof meta>;

export const RunFailed: Story = { args: { message: "The run stopped: the model timed out." } };

/** The Legal agent cannot use the space's model: the fix is one click away. */

/** The provider rejected the API key: the error says so and opens Models settings. */
export const KeyRejected: Story = {
  args: {
    message: "The model provider did not accept your API key. Check it in Settings > Models.",
  },
};

/** The Legal agent's Data Room consent is missing: the error offers the page that grants it. */
export const ConsentRequired: Story = {
  args: {
    message: LEGAL_CONSENT_REQUIRED_MESSAGE,
  },
};

/** The run ended without a reply: Retry sends the last message again. */
export const NoReply: Story = { args: { message: MISSING_TOOL_FINAL_RESPONSE_ERROR } };
