import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";

const meta = { title: "UI/Spinner", component: Spinner } satisfies Meta<typeof Spinner>;
export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Large: StoryObj<typeof meta> = { args: { className: "size-8" } };

export const Muted: StoryObj<typeof meta> = { args: { className: "size-6 text-muted-foreground" } };
