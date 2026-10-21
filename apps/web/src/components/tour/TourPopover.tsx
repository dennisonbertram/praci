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

/** Below the `lg` breakpoint the sidebar is a drawer (the shell opens it for the tour); the card sits on the screen half away from the ring. */
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
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary"
      style={{
        left: rect.left - 3,
        top: rect.top - 3,
        width: rect.width + 6,
        height: rect.height + 6,
      }}
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
  doneLabel,
  onDone,
}: {
  steps: readonly TourStep[];
  /** Label of the last step's button, and what it does after the tour is recorded. Default: Done. */
  doneLabel?: string;
  onDone?: () => void;
  onFinish: (result: "done" | "skip" | "empty") => void;
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

  // Nothing to point at: close without recording, so the tour can still run once the page has loaded.
  const empty = present?.length === 0;
  useEffect(() => {
    if (empty) onFinish("empty");
  }, [empty, onFinish]);
  // On a phone the card is not a popover, so Escape needs its own handler.
  useEffect(() => {
    if (wide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFinish("skip");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, onFinish]);
  if (!step) return null;

  const last = index === (present?.length ?? 0) - 1;
  const body = (
    <>
      <p className="text-sm" aria-live="polite">
        {step.text}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1}/{present?.length}
        </span>
        <span className="flex-1" />
        {last ? null : (
          <Button variant="ghost" size="sm" onClick={() => onFinish("skip")}>
            <Trans>Skip tour</Trans>
          </Button>
        )}
        {index > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
            <Trans>Back</Trans>
          </Button>
        ) : null}
        <Button
          size="sm"
          autoFocus
          onClick={() => {
            if (!last) return setIndex(index + 1);
            onFinish("done");
            onDone?.();
          }}
        >
          {last ? (doneLabel ?? <Trans>Done</Trans>) : <Trans>Next</Trans>}
        </Button>
      </div>
    </>
  );

  const ring = rect && rect.width > 0 && rect.right > 0 && rect.left < window.innerWidth;
  if (!wide) {
    // Keep the card off the ring: on top when the target is in the lower half of the screen.
    const top = ring && rect.top + rect.height / 2 > window.innerHeight / 2;
    return (
      <>
        {ring ? <Ring rect={rect} /> : null}
        {createPortal(
          <div
            role="dialog"
            aria-label={t`Tour`}
            data-testid="tour-card"
            className={`fixed inset-x-4 z-50 flex flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 ${top ? "top-4" : "bottom-4"}`}
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
          side={step.anchor.includes("user-menu") ? "top" : "bottom"}
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
