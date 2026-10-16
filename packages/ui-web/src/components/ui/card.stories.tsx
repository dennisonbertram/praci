import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = { title: "UI/Card", component: Card } satisfies Meta<typeof Card>;
export default meta;

export const Default: StoryObj<typeof meta> = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Sample card</CardTitle>
        <CardDescription>Invented content for the story.</CardDescription>
      </CardHeader>
      <CardContent>Body text goes here.</CardContent>
      <CardFooter>
        <Button size="sm">Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: StoryObj<typeof meta> = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Card with action</CardTitle>
        <CardDescription>The action sits at the end of the header.</CardDescription>
        <CardAction>
          <Button size="xs" variant="outline">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Body text goes here.</CardContent>
    </Card>
  ),
};

export const Small: StoryObj<typeof meta> = {
  args: { size: "sm" },
  render: (args) => (
    <Card {...args} className="w-72">
      <CardHeader>
        <CardTitle>Small card</CardTitle>
        <CardDescription>Tighter spacing.</CardDescription>
      </CardHeader>
      <CardContent>Body text goes here.</CardContent>
      <CardFooter>
        <Button size="xs">Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const LongContent: StoryObj<typeof meta> = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>
          A card title that is long enough to wrap onto a second line in a narrow card
        </CardTitle>
        <CardDescription>
          A long description with enough words to wrap across several lines so the header spacing
          can be checked against real content.
        </CardDescription>
        <CardAction>
          <Button size="xs" variant="outline">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        Body text that also runs long, to confirm the content area keeps its padding when the text
        wraps over many lines inside a fixed width.
      </CardContent>
    </Card>
  ),
};

export const ContentOnly: StoryObj<typeof meta> = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardContent>Just content, no header or footer.</CardContent>
    </Card>
  ),
};
