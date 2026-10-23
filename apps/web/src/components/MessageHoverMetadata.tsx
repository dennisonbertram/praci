import type { ReactNode } from "react";

export function MessageHoverMetadata({
  side,
  pinned = false,
  below = false,
  hideOnTouch = false,
  children,
}: {
  side: "start" | "end";
  pinned?: boolean;
  /** A full-width message has no gutter, so the rail always sits under it. */
  below?: boolean;
  /** Touch hides the rail on a message made of cards that carry their own controls. */
  hideOnTouch?: boolean;
  /** Kept for callers; the rail sits beside the bubble, so it never reaches the reactions row below. */
  hasReactions?: boolean;
  children: ReactNode;
}) {
  // Every pointer puts the rail in the gutter beside the bubble's bottom corner, which the bubble's max width reserves (16% on touch), so it covers no text and adds no row.
  // Touch always shows it; hover-capable pointers reveal it on hover or focus.
  const reveal = pinned
    ? "pointer-events-auto opacity-100"
    : "pointer-events-auto opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-within:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:focus-within:opacity-100";

  return (
    <div
      data-testid="message-hover-rail"
      className={`absolute bottom-0 z-10 flex items-center transition-opacity ${
        // In a narrow transcript (the agent panel) there is no gutter, so the rail drops below.
        below
          ? side === "end"
            ? "start-0"
            : "end-0"
          : side === "end"
            ? "start-full ps-1.5 @max-sm:[@media(hover:hover)]:start-0 @max-sm:[@media(hover:hover)]:ps-0"
            : "end-full pe-1.5 @max-sm:[@media(hover:hover)]:end-0 @max-sm:[@media(hover:hover)]:pe-0"
      } ${
        below
          ? "[@media(hover:hover)]:top-full [@media(hover:hover)]:mt-6 [@media(hover:hover)]:bottom-auto"
          : "@max-sm:[@media(hover:hover)]:top-full @max-sm:[@media(hover:hover)]:mt-6 @max-sm:[@media(hover:hover)]:bottom-auto"
      } ${reveal} [@media(hover:none)]:p-0 ${
        // A card-only message has its own controls, so touch gets no rail there. A full-width row has no gutter, so its rail sits in the line reserved under it.
        hideOnTouch
          ? "[@media(hover:none)]:hidden"
          : below
            ? "[@media(hover:none)]:top-full [@media(hover:none)]:bottom-auto"
            : ""
      }`}
    >
      {children}
    </div>
  );
}
