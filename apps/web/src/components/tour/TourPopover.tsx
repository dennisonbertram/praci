import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Popover, PopoverContent } from "@rakazo/ui-web";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TourStep = {
  id: string;
  /** CSS selector of the element the step points at. A step whose element is missing is skipped. */
  anchor: string;
  text: string;
  /** The item the step explains. The card stays in one spot, so its first word names the target. Empty when the text names it. */
  name: string;
};

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

// A reload during the tour comes back to the same step. Storage can be blocked, so it is optional.
// The key carries the user id, so a second account in the same tab never inherits the step.
const stepKey = (userId: string | null | undefined) => (userId ? `tour-step:${userId}` : null);
const savedStep = (userId: string | null | undefined) => {
  try {
    const key = stepKey(userId);
    return key ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
};
const saveStep = (userId: string | null | undefined, id: string | null) => {
  try {
    const key = stepKey(userId);
    if (!key) return;
    if (id) sessionStorage.setItem(key, id);
    else sessionStorage.removeItem(key);
  } catch {}
};
/** True when this user left the tour part-way, so the shell can reopen it after a reload. */
export const tourInProgress = (userId: string | null | undefined) => savedStep(userId) !== null;
/** Call on sign-out. */
export const clearTourStep = (userId: string | null | undefined) => saveStep(userId, null);

/** Portaled to the body: the sidebar is transformed, which would otherwise move fixed children. */
function Ring({ rect, bounds }: { rect: DOMRect; bounds: DOMRect | null }) {
  // The 2px ring is drawn outside its box, so keep that box 4px inside the window (and the sidebar
  // column when the target is in it); a target at an edge then keeps the whole ring visible.
  const edge = 4;
  const left = Math.max(edge, (bounds?.left ?? 0) + edge, rect.left - 3);
  const top = Math.max(edge, rect.top - 3);
  const right = Math.min(
    window.innerWidth - edge,
    (bounds?.right ?? Infinity) - edge,
    rect.right + 3,
  );
  const bottom = Math.min(window.innerHeight - edge, rect.bottom + 3);
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
function useRect(element: Element | null, layoutKey = 0) {
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
  }, [element, layoutKey]);
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
  userId,
}: {
  /** Scopes the saved step; without it nothing is saved. */
  userId?: string | null;
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
  useLayoutEffect(() => {
    const find = () => steps.filter((step) => document.querySelector(step.anchor));
    const saved = savedStep(userId);
    // After a reload the sidebar fills in as data arrives. Hold the list back until the saved stop's
    // anchor exists (at most 3 s), so the tour comes back to the same stop out of the same count.
    if (!saved || !steps.some((step) => step.id === saved)) return setPresent(find());
    const started = Date.now();
    const settle = () => {
      const found = find();
      if (!found.some((step) => step.id === saved) && Date.now() - started < 3000) return false;
      setPresent(found);
      return true;
    };
    if (settle()) return;
    const timer = setInterval(() => settle() && clearInterval(timer), 100);
    return () => clearInterval(timer);
  }, [steps, userId]);
  const [index, setIndexState] = useState(0);
  const restored = useRef(false);
  const setIndex = (next: number) => {
    setIndexState(next);
    saveStep(userId, present?.[next]?.id ?? null);
  };
  useLayoutEffect(() => {
    if (!present || restored.current) return;
    restored.current = true;
    const at = present.findIndex((item) => item.id === savedStep(userId));
    if (at > 0) setIndexState(at);
  }, [present]);
  const step = present?.[index];
  const element = step ? document.querySelector(step.anchor) : null;
  // Bumped when the phone drawer is padded for the card, so the ring is measured again on its row.
  const [layoutKey, setLayoutKey] = useState(0);
  const rect = useRect(element, layoutKey);
  // Ending the tour clears the saved step; the next run starts at the first stop.
  const finish: typeof onFinish = (result, byEscape) => {
    if (result !== "empty") saveStep(userId, null);
    onFinish(result, byEscape);
  };
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
      saveStep(userId, null);
      onFinish("skip", true);
    };
    // On window, so it runs before any drawer listener on the document.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [card, onFinish, userId]);
  // Phone: the card sits at the foot at every stop. The drawer gets room for it, so the footer rows
  // (Integrations, Account) rise above the card, and the pointed-at row is scrolled into view.
  const cardRef = useRef<HTMLDivElement>(null);
  const onPhone = card && !wide;
  useLayoutEffect(() => {
    const drawer = element?.closest("aside");
    const cardBox = cardRef.current;
    if (!onPhone || !drawer || !cardBox) return;
    const height = cardBox.offsetHeight + 32;
    drawer.style.paddingBottom = `${height}px`;
    setLayoutKey((key) => key + 1);
    element?.scrollIntoView({ block: "nearest" });
    return () => {
      drawer.style.paddingBottom = "";
    };
  }, [onPhone, element, step]);
  if (!step) return null;

  const last = index === (present?.length ?? 0) - 1;
  const body = (
    <>
      <p className="min-h-10 text-sm" aria-live="polite">
        {step.name ? (
          <>
            <span className="font-medium">{step.name}</span>
            {": "}
          </>
        ) : null}
        {step.text}
      </p>
      {last && lastAction ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            finish("done");
            lastAction.run();
          }}
        >
          {lastAction.label}
        </Button>
      ) : lastAction ? (
        // Holds the button's room at earlier stops, so the card and the drawer rows above it keep their height.
        <div aria-hidden="true" className="h-7" />
      ) : null}
      {/* Skip tour is absent on the last stop, so the counter then starts at the card edge. */}
      <div className="flex items-center gap-2">
        {last ? null : (
          <Button variant="ghost" size="sm" className={`-ms-2`} onClick={() => finish("skip")}>
            <Trans>Skip tour</Trans>
          </Button>
        )}
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
          onClick={() => (last ? finish("done") : setIndex(index + 1))}
        >
          {last ? <Trans>Done</Trans> : <Trans>Next</Trans>}
        </Button>
      </div>
    </>
  );

  const ring = rect && rect.width > 0 && rect.right > 0 && rect.left < window.innerWidth;
  if (card) {
    const column = sidebar ? sidebar.getBoundingClientRect() : null;
    // One fixed spot at every stop, so Next stays put and no row below the target is hidden.
    // Desktop: inside the sidebar column, just above its footer links (the chat stays clear).
    // Phone: the foot of the screen, with the drawer padded above it.
    const footerTop = document
      .querySelector('[data-tour="sidebar-integrations"]')
      ?.getBoundingClientRect().top;
    const floor = wide && column && footerTop ? footerTop - 8 : window.innerHeight - 16;
    const place = { bottom: wide && column ? window.innerHeight - floor : 16 };
    const span = column
      ? { left: column.left + 14, width: Math.min(288, column.width - 28) }
      : undefined;
    return (
      <>
        {ring ? <Ring rect={rect} bounds={sidebar?.getBoundingClientRect() ?? null} /> : null}
        {createPortal(
          <div
            role="dialog"
            aria-label={t`Tour`}
            ref={cardRef}
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
      {ring ? <Ring rect={rect} bounds={null} /> : null}
      <Popover
        open
        modal={false}
        onOpenChange={(open, details) => {
          if (!open && details.reason === "escape-key") finish("skip");
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
