import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContactAvatar, ContactAvatarGroup } from "./contact-avatar";

const meta = {
  title: "UI/ContactAvatar",
  component: ContactAvatar,
  args: { name: "Ada Example" },
} satisfies Meta<typeof ContactAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No photo: initials on the muted token background. */
export const Initials: Story = {};

/** An organization: a trailing "Inc." is not an initial. */
export const Organization: Story = { args: { name: "Example Labs Inc." } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(["sm", "default", "lg"] as const).map((size) => (
        <ContactAvatar key={size} name="Ada Example" size={size} />
      ))}
    </div>
  ),
};

/** A photo URL; a failed load falls back to initials. */
export const BrokenPhoto: Story = {
  args: { src: "https://invalid.invalid/none.png" },
};

const people = ["Ada Example", "Ben Sample", "Cy Fixture", "Dee Mock", "Eli Invented"].map(
  (name) => ({ name }),
);

/** At most three, then "+N". Hover or focus shows every name. */
export const Group: StoryObj<typeof ContactAvatarGroup> = {
  render: () => (
    <div className="flex h-32 items-start gap-6 p-6">
      <ContactAvatarGroup people={people} />
      <ContactAvatarGroup people={people.slice(0, 2)} />
      <ContactAvatarGroup people={people.slice(0, 1)} size="default" />
    </div>
  ),
};
