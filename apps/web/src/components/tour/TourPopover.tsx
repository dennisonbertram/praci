import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Popover, PopoverContent } from "@rakazo/ui-web";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export type TourStep = {
  id: string;
  /** CSS selector of the element the step points at. A step whose element is missing is skipped. */
  anchor: string;
  text: string;
};

/** About as tall as a card; keeps a card placed under a target inside the window. */
const CARD_HEIGHT = 140;

/** Below the `lg` breakpoint the sidebar is a drawer (the shell opens it for the tour). */
const WIDE = "(min-width: 1024px)";

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/** Portaled to the body: the sidebar is transformed, which would otherwise move fixed children. */
function Ring({ rect }: { rect: DOMRect }) {
  // Kept inside the window, so a target at the edge does not lose its ring there.
  const left = Math.max(2, rect.left - 3);
  const top = Math.max(2, rect.top - 3);
  const right = Math.min(window.innerWidth - 2, rect.right + 3);
  const bottom = Math.min(window.innerHeight - 2, rect.bottom + 3);
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary"
      style={{ left, top, width: right - left, height: bottom - top }}
    />,
    document.body,
  );
}

/** Follows the anchor's box so the ring stays on it while the layout settles or scrolls. */
function useRect(element: Element | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!element) return setRect(null);
    const update = () => setRect(element.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // The mobile drawer slides in, so measure again when its transition ends.
    window.addEventListener("transitionend", update, true);
    return () => {
      window.removeEventListener("transitionend", update, true);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [element]);
  return rect;
}

/**
 * One popover at a time, pointing at a real element. The caller records the result: `done` after
 * the last step, `skip` for Skip tour or Escape. Steps whose element is not on screen are dropped.
 */
export function TourPopover({
  steps,
  onFinish,
  lastAction,
}: {
  steps: readonly TourStep[];
  /** A secondary button on the last step, next to Done: ends the tour, then runs. */
  lastAction?: { label: string; run: () => void };
  /** `byEscape` is set when the Escape key ended the tour, so the caller can leave the drawer open. */
  onFinish: (result: "done" | "skip" | "empty", byEscape?: boolean) => void;
}) {
  const { t } = useLingui();
  const wide = useWide();
  // Looked up after mount, once the page the anchors live in has been committed.
  const [present, setPresent] = useState<readonly TourStep[] | null>(null);
  useLayoutEffect(
    () => setPresent(steps.filter((step) => document.querySelector(step.anchor))),
    [steps],
  );
  const [index, setIndex] = useState(0);
  const step = present?.[index];
  const element = step ? document.querySelector(step.anchor) : null;
  const rect = useRect(element);
  // Sidebar targets get a card, not a popover: on desktop it stays inside the sidebar column so it
  // never covers the page title, chat or composer; on a phone it spans the screen.
  const sidebar = element?.closest("aside") ?? null;
  const card = !wide || sidebar !== null;

  // Nothing to point at: close without recording, so the tour can still run once the page has loaded.
  const empty = present?.length === 0;
  useEffect(() => {
    if (empty) onFinish("empty");
  }, [empty, onFinish]);
  // On a phone the card is not a popover, so Escape needs its own handler.
  useEffect(() => {
    if (!card) return;
    // Capture phase: the tour ends first, so the sidebar drawer behind it stays open for one more press.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onFinish("skip", true);
    };
    // On window, so it runs before any drawer listener on the document.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [card, onFinish]);
  if (!step) return null;

  const last = index === (present?.length ?? 0) - 1;
  const body = (
    <>
      <p className="min-h-10 text-sm" aria-live="polite">
        {step.text}
      </p>
      {last && lastAction ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            onFinish("done");
            lastAction.run();
          }}
        >
          {lastAction.label}
        </Button>
      ) : null}
      {/* Same slots at every stop; Skip tour only hides on the last one. */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={`-ms-2 ${last ? "invisible" : ""}`}
          onClick={() => onFinish("skip")}
        >
          <Trans>Skip tour</Trans>
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1}/{present?.length}
        </span>
        <span className="flex-1" />
        {index > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
            <Trans>Back</Trans>
          </Button>
        ) : null}
        <Button
          size="sm"
          className="min-w-16"
          autoFocus
          onClick={() => (last ? onFinish("done") : setIndex(index + 1))}
        >
          {last ? <Trans>Done</Trans> : <Trans>Next</Trans>}
        </Button>
      </div>
    </>
  );

  const ring = rect && rect.width > 0 && rect.right > 0 && rect.left < window.innerWidth;
  if (card) {
    const column = wide && sidebar ? sidebar.getBoundingClientRect() : null;
    // Beside the sidebar at the foot of the page (above the composer when there is one), the same
    // spot at every stop: it never covers the page title or the first lines of the chat, and Next stays put.
    const composerTop = document
      .querySelector('[data-testid="composer-bar"]')
      ?.getBoundingClientRect().top;
    const targetAbove = ring && rect.top + rect.height / 2 < window.innerHeight / 2;
    const place =
      column && ring
        ? { bottom: composerTop ? window.innerHeight - composerTop + 8 : 16 }
        : // A phone: right beside the target, below a high one and above a low one.
          ring
          ? targetAbove
            ? { top: Math.min(rect.bottom + 8, window.innerHeight - CARD_HEIGHT - 8) }
            : { bottom: Math.max(window.innerHeight - rect.top + 8, 8) }
          : { bottom: 16 };
    const span = column ? { left: column.right + 8, width: 288 } : undefined;
    return (
      <>
        {ring ? <Ring rect={rect} /> : null}
        {createPortal(
          <div
            role="dialog"
            aria-label={t`Tour`}
            data-testid="tour-card"
            style={{ ...place, ...span }}
            className={`fixed z-50 flex flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 ${span ? "" : "inset-x-4"}`}
          >
            {body}
          </div>,
          document.body,
        )}
      </>
    );
  }
  return (
    <>
      {ring ? <Ring rect={rect} /> : null}
      <Popover
        open
        modal={false}
        onOpenChange={(open, details) => {
          if (!open && details.reason === "escape-key") onFinish("skip");
        }}
      >
        <PopoverContent
          anchor={element}
          side="bottom"
          align="start"
          sideOffset={10}
          data-testid="tour-popover"
          className="w-72"
        >
          {body}
        </PopoverContent>
      </Popover>
    </>
  );
}
