import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta: Meta<typeof DropdownMenu> = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  // Opens on load so the menu is visible without a click.
  args: { defaultOpen: true },
  decorators: [
    (Story) => (
      <div className="flex h-72 items-start justify-center pt-4">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const trigger = <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>
            Profile <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem disabled>Billing</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithSubmenu: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuItem>New file</DropdownMenuItem>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuItem>Send to a teammate</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const CheckboxItems: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show columns</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked>Name</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>Status</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked disabled>
            Owner
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

function Radios(args: React.ComponentProps<typeof DropdownMenu>) {
  const [value, setValue] = useState("system");
  return (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const RadioItems: Story = { render: (args) => <Radios {...args} /> };

export const InsetItems: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>Aligned label</DropdownMenuLabel>
          <DropdownMenuItem inset>Aligned item</DropdownMenuItem>
          <DropdownMenuCheckboxItem inset checked>
            Aligned checkbox
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithExplicitPortal: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuPortal>
        <DropdownMenuContent>
          <DropdownMenuItem>Portaled item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  ),
};

export const LongContent: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      {trigger}
      <DropdownMenuContent className="max-h-48 min-w-48">
        {Array.from({ length: 20 }, (_, i) => (
          <DropdownMenuItem key={i}>Sample item {i + 1} with a longer label</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
