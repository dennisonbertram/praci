import { Trans } from "@lingui/react/macro";

/** The id of the element "Skip to content" moves focus to. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * The first stop for a keyboard user: hidden until focused, it moves focus past the sidebar to the
 * page itself. The target needs `id={MAIN_CONTENT_ID}` and `tabIndex={-1}`.
 */
export function SkipToContent() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:border focus:border-border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      onClick={(event) => {
        // Focus only: changing the URL hash would scroll the page or trip hash-based anchors.
        event.preventDefault();
        document.getElementById(MAIN_CONTENT_ID)?.focus();
      }}
    >
      <Trans>Skip to content</Trans>
    </a>
  );
}
