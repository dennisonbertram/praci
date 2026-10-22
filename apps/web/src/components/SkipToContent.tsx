import { Trans } from "@lingui/react/macro";
import { useState } from "react";

/** The id of the element "Skip to content" moves focus to. */
export const MAIN_CONTENT_ID = "main-content";

const skipClass =
  "sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:border focus:border-border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * The first stops for a keyboard user: hidden until focused, they move focus past the sidebar to
 * the page itself, or on a chat past every message to the message box. The page target needs
 * `id={MAIN_CONTENT_ID}` and `tabIndex={-1}`; the message box is `[data-composer-input]`.
 */
export function SkipToContent() {
  const [hasComposer, setHasComposer] = useState(false);
  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className={skipClass}
        onFocus={() => setHasComposer(Boolean(document.querySelector("[data-composer-input]")))}
        onClick={(event) => {
          // Focus only: changing the URL hash would scroll the page or trip hash-based anchors.
          event.preventDefault();
          document.getElementById(MAIN_CONTENT_ID)?.focus();
        }}
      >
        <Trans>Skip to content</Trans>
      </a>
      {hasComposer ? (
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className={skipClass}
          onClick={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>("[data-composer-input]")?.focus();
          }}
        >
          <Trans>Skip to message box</Trans>
        </a>
      ) : null}
    </>
  );
}
