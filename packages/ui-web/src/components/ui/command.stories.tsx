import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta = { title: "UI/Command", component: Command } satisfies Meta<typeof Command>;
export default meta;

function Palette() {
  return (
    <>
      <CommandInput placeholder="Type a command" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            Open calendar <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem>Search files</CommandItem>
          <CommandItem disabled>Disabled item</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>Profile</CommandItem>
          <CommandItem>Billing</CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

export const Default: StoryObj<typeof meta> = {
  render: () => (
    <Command className="h-auto w-80 border border-border">
      <Palette />
    </Command>
  ),
};

export const NoResults: StoryObj<typeof meta> = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByPlaceholderText("Type a command"), "zzzz");
  },
};

export const Dialog: StoryObj<typeof meta> = {
  render: () => (
    <>
      <p className="text-sm text-muted-foreground">The dialog renders in a portal above.</p>
      <CommandDialog open>
        <Command>
          <Palette />
        </Command>
      </CommandDialog>
    </>
  ),
};
