import type { Decorator } from "@storybook/react-vite";

/** Dialogs render in a portal, so the story root would be empty. This puts a line of page text behind them. */
export const withPageBehind =
  (label = "Page behind the dialog"): Decorator =>
  (Story) => (
    <>
      <p className="p-4 text-sm text-muted-foreground">{label}</p>
      <Story />
    </>
  );
