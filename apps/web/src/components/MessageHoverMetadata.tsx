import type { ReactNode } from "react";

export function MessageHoverMetadata({
  side,
  pinned = false,
  children,
}: {
  side: "start" | "end";
  pinned?: boolean;
  /** Kept for callers; the rail sits beside the bubble, so it never reaches the reactions row below. */
  hasReactions?: boolean;
  children: ReactNode;
}) {
  // Touch shows the rail in-flow below the bubble. Hover-capable pointers reveal it beside the
  // bubble's bottom corner, in the gutter the bubble's max width reserves, so it covers no text.
  const reveal = pinned
    ? "pointer-events-auto opacity-100"
    : "pointer-events-auto opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-within:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:focus-within:opacity-100";

  return (
    <div
      data-testid="message-hover-rail"
      className={`absolute bottom-0 z-10 flex items-center transition-opacity ${
        // In a narrow transcript (the agent panel) there is no gutter, so the rail drops below.
        side === "end"
          ? "start-full ps-1.5 @max-sm:[@media(hover:hover)]:start-0 @max-sm:[@media(hover:hover)]:ps-0"
          : "end-full pe-1.5 @max-sm:[@media(hover:hover)]:end-0 @max-sm:[@media(hover:hover)]:pe-0"
      } @max-sm:[@media(hover:hover)]:top-full @max-sm:[@media(hover:hover)]:mt-6 @max-sm:[@media(hover:hover)]:bottom-auto ${reveal} [@media(hover:none)]:static [@media(hover:none)]:mt-1 [@media(hover:none)]:w-full [@media(hover:none)]:p-0 ${
        side === "end"
          ? "[@media(hover:none)]:ms-0 [@media(hover:none)]:justify-start"
          : "[@media(hover:none)]:me-0 [@media(hover:none)]:justify-end"
      }`}
    >
      {children}
    </div>
  );
}
