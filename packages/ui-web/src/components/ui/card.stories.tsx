import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

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
