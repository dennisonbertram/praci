import type { Meta, StoryObj } from "@storybook/react-vite";
import { WelcomePage } from "./Welcome";

const meta = { title: "Pages/Welcome", component: WelcomePage } satisfies Meta<typeof WelcomePage>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
