import type { StorybookConfig } from "@storybook/react-vite";

// The framework loads apps/web/vite.config.ts itself, so the Tailwind and Lingui plugins
// are shared with the app and not repeated here.
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/**/*.stories.tsx",
    "../../../packages/ui-web/src/**/*.stories.tsx",
    "../../../packages/chat-ui/src/**/*.stories.tsx",
  ],
  addons: ["@storybook/addon-a11y"],
};

export default config;
