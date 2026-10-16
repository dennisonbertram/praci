import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";
import { bootstrapI18n } from "../src/lib/i18n";
import { applyResolvedAppearance } from "../src/lib/ui-appearance";
import { resolveUiLocale } from "../src/lib/ui-locale";
import "../src/styles.css";

// Replaced by src/lib/__mocks__/rpc.ts; see .storybook/README.md.
sb.mock(import("../src/lib/rpc.ts"));

const ready = bootstrapI18n(resolveUiLocale());

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Appearance",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  loaders: [async () => void (await ready)],
  decorators: [
    (Story, { globals }) => {
      const theme = globals.theme === "dark" ? "dark" : "light";
      applyResolvedAppearance(theme);
      return (
        <I18nProvider i18n={i18n}>
          <Story />
        </I18nProvider>
      );
    },
  ],
};

export default preview;
