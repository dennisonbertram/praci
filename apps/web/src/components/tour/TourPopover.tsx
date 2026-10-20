import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Popover, PopoverContent } from "@rakazo/ui-web";
import { useEffect, useLayoutEffect, useState } from "react";

export type TourStep = {
  id: string;
  /** CSS selector of the element the step points at. A step whose element is missing is skipped. */
  anchor: string;
  text: string;
};

/** Below the `lg` breakpoint the sidebar is off screen, so steps show as a card at the bottom. */
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

/** Follows the anchor's box so the ring stays on it while the layout settles or scrolls. */
function useRect(element: Element | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!element) return setRect(null);
    const update = () => setRect(element.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
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
}: {
  steps: readonly TourStep[];
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
  const rect = useRect(wide ? element : null);

  // Nothing to point at: close without recording, so the tour can still run once the page has loaded.
  const empty = present?.length === 0;
  useEffect(() => {
    if (empty) onFinish("empty");
  }, [empty, onFinish]);
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
        <Button size="sm" autoFocus onClick={() => (last ? onFinish("done") : setIndex(index + 1))}>
          {last ? <Trans>Done</Trans> : <Trans>Next</Trans>}
        </Button>
      </div>
    </>
  );

  if (!wide) {
    return (
      <div
        role="dialog"
        aria-label={t`Tour`}
        data-testid="tour-card"
        className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      >
        {body}
      </div>
    );
  }
  return (
    <>
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary"
          style={{
            left: rect.left - 3,
            top: rect.top - 3,
            width: rect.width + 6,
            height: rect.height + 6,
          }}
        />
      ) : null}
      <Popover
        open
        modal={false}
        onOpenChange={(open, details) => {
          if (!open && details.reason === "escape-key") onFinish("skip");
        }}
      >
        <PopoverContent
          anchor={element}
          side={step.anchor.includes("user-menu") ? "top" : "right"}
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
