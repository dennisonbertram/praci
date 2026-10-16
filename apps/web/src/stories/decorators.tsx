import type { Decorator } from "@storybook/react-vite";

/**
 * Dialogs render in a portal, so the story root would be empty. This puts a line of page text
 * behind them.
 */
export const withPageBehind =
  (label = "Page behind the dialog"): Decorator =>
  (Story) => (
    <>
      <p className="p-4 text-sm text-muted-foreground">{label}</p>
      <Story />
    </>
  );

/**
 * For components that render null in the shown state: puts a line of text after the story so the
 * root is not empty.
 */
export const withVisibleRoot =
  (message: string): Decorator =>
  (Story) => (
    <>
      <Story />
      <p className="text-sm text-muted-foreground">{message}</p>
    </>
  );
