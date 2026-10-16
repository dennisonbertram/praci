import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = { title: "UI/Popover", component: Popover } satisfies Meta<typeof Popover>;
export default meta;

export const Open: StoryObj<typeof meta> = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Sample title</PopoverTitle>
          <PopoverDescription>Invented description for the story.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
};

export const Closed: StoryObj<typeof meta> = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Sample title</PopoverTitle>
          <PopoverDescription>Opens when the trigger is clicked.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
};
