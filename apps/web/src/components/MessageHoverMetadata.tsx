import type { ReactNode } from "react";

export function MessageHoverMetadata({
  side,
  pinned = false,
  hasReactions = false,
  children,
}: {
  side: "start" | "end";
  pinned?: boolean;
  // The reactions row renders below the bubble frame; clear it so actions never cover it.
  hasReactions?: boolean;
  children: ReactNode;
}) {
  // Touch shows the rail in-flow below the bubble; hover-capable pointers reveal it under the bubble's end edge on demand.
  const reveal = pinned
    ? "pointer-events-auto opacity-100"
    : "pointer-events-auto opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-within:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:focus-within:opacity-100";

  return (
    <div
      data-testid="message-hover-rail"
      className={`absolute end-0 top-full z-10 flex items-center transition-opacity ${
        hasReactions ? "pt-9" : "pt-1"
      } ${reveal} [@media(hover:none)]:static [@media(hover:none)]:mt-1 [@media(hover:none)]:w-full [@media(hover:none)]:pt-0 ${
        side === "end"
          ? "[@media(hover:none)]:ms-0 [@media(hover:none)]:justify-start"
          : "[@media(hover:none)]:me-0 [@media(hover:none)]:justify-end"
      }`}
    >
      {children}
    </div>
  );
}
