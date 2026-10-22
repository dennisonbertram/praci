"use client";

import { Toast } from "@base-ui/react/toast";
import { Button } from "@rakazo/ui-web/components/ui/button";
import { cn } from "@rakazo/ui-web/lib/utils";
import { XIcon } from "lucide-react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export const MAX_VISIBLE_NOTIFICATION_TOASTS = 3;
/** Phones have no room for a stack: one toast, docked above the composer so it never covers the page header or its buttons. */
export const MAX_VISIBLE_NOTIFICATION_TOASTS_PHONE = 1;

const PHONE_QUERY = "(max-width: 639px)";
const phoneQuery = () => (window.matchMedia ? window.matchMedia(PHONE_QUERY) : undefined);
const subscribePhone = (notify: () => void) => {
  const query = phoneQuery();
  if (!query) return () => undefined;
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const isPhone = () => phoneQuery()?.matches ?? false;

export type NotificationToastData = {
  /** A button on the toast (Undo, Try again). The toast stays until it is used or dismissed. */
  action?: { label: string; onClick: () => void };
  avatar?: ReactNode;
  href?: string;
  /** ISO time the notification was created; shown through the toaster's `formatTime`. */
  createdAt?: string;
  onSeen?: () => void;
};

export type NotificationToastInput = NotificationToastData & {
  /** Runs when the toast closes for any reason, including `close(id)`. */
  onClose?: () => void;
  id: string;
  title: string;
  body?: string;
  /** Milliseconds before it fades out; 0 keeps it until dismissed. */
  timeout?: number;
};

export const notificationToastManager = Toast.createToastManager<NotificationToastData>();

/** Each toast fades out on its own; the timer pauses while the stack is hovered or focused. */
export const NOTIFICATION_TOAST_TIMEOUT_MS = 6000;

/** Fading out only dismisses from view: `onSeen` runs on click, never on timeout. */
export function enqueueNotificationToast({
  id,
  title,
  body,
  timeout,
  onClose,
  ...data
}: NotificationToastInput) {
  return notificationToastManager.add({
    id,
    title,
    description: body,
    timeout,
    onClose,
    priority: "high",
    data,
  });
}

type ToastItem = ReturnType<typeof Toast.useToastManager<NotificationToastData>>["toasts"][number];

function ToastBody({
  toast,
  formatTime,
  onOpen,
  close,
}: {
  toast: ToastItem;
  formatTime?: (iso: string) => string;
  onOpen: (href: string) => void | Promise<void>;
  close: (id: string) => void;
}) {
  const hasAction = Boolean(toast.data?.action);
  const content = (
    <>
      {toast.data?.avatar ? <span className="shrink-0">{toast.data.avatar}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <Toast.Title
            render={<span />}
            className={cn(
              "min-w-0 flex-1 text-sm font-medium break-words",
              hasAction && "line-clamp-2",
            )}
          />
          {formatTime && toast.data?.createdAt ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(toast.data.createdAt)}
            </span>
          ) : null}
        </span>
        <Toast.Description
          render={<span />}
          className="mt-1 line-clamp-3 text-sm text-muted-foreground break-words"
        />
      </span>
    </>
  );
  // Clicking a toast with an action must not dismiss it: that would take the action away.
  if (hasAction)
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3 p-4 pe-2 text-left">{content}</div>
    );
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-4 pr-10 pointer-coarse:pr-12 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={async () => {
        const { href, onSeen } = toast.data ?? {};
        try {
          if (href) await onOpen(href);
        } catch {
          // A failed navigation must not leave the toast open or unseen.
        } finally {
          onSeen?.();
          close(toast.id);
        }
      }}
    >
      {content}
    </button>
  );
}

const GAP_ABOVE_PX = 8;
const TOAST_GUTTER_PX = 16;

/** Hides the toasts while an open dialog, menu or navigation drawer would sit under them. */
const COVERED_BY_OVERLAY =
  "[body:has([role=dialog][data-open],[role=alertdialog][data-open],[role=menu][data-open],[data-drawer-open])_&]:invisible";

/**
 * How far the toasts must sit above the bottom edge to clear every `data-toast-avoid` element (the
 * composer, a suggestion chip row) that they would overlap sideways. Zero when nothing is in the way.
 */
function liftAbove(viewport: HTMLElement): number {
  const box = viewport.getBoundingClientRect();
  let lift = 0;
  for (const el of document.querySelectorAll<HTMLElement>("[data-toast-avoid]")) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.right <= box.left || rect.left >= box.right) continue;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
    lift = Math.max(lift, window.innerHeight - rect.top + GAP_ABOVE_PX);
  }
  return lift;
}

/**
 * The toasts stay inside an open side panel (`data-toast-panel`) instead of covering the page
 * beside it: this is the widest a toast may be there. Null on a phone or with no panel open.
 */
function panelToastWidth(): number | null {
  const panel = document.querySelector<HTMLElement>("[data-toast-panel]");
  if (!panel || isPhone()) return null;
  const { left, width } = panel.getBoundingClientRect();
  return left < window.innerWidth ? Math.max(0, width - 2 * TOAST_GUTTER_PX) : null;
}

function ToastList({
  onOpen,
  dismissLabel,
  formatTime,
  viewportRef,
}: {
  onOpen: (href: string) => void | Promise<void>;
  dismissLabel: string;
  formatTime?: (iso: string) => string;
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const { toasts, close } = Toast.useToastManager<NotificationToastData>();
  const shownCount = toasts.length;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || shownCount === 0) return;
    const place = () => {
      const lift = liftAbove(viewport);
      viewport.style.setProperty("--toast-lift", `${lift}px`);
      const inPanel = panelToastWidth();
      if (inPanel === null) viewport.style.removeProperty("--toast-max-width");
      else viewport.style.setProperty("--toast-max-width", `${inPanel}px`);
    };
    place();
    // The composer grows with its text and the window resizes; a short poll covers both.
    const timer = setInterval(place, 400);
    window.addEventListener("resize", place);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", place);
      viewport.style.removeProperty("--toast-lift");
      viewport.style.removeProperty("--toast-max-width");
    };
  }, [shownCount, viewportRef]);
  const [, tick] = useState(0);
  // The relative time is refreshed while any toast is open.
  const open = toasts.length > 0 && Boolean(formatTime);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [open]);
  // Toasts with an action sit in a flat column above the stack of plain toasts, so a new plain
  // toast never covers an action button. Base UI's own `limit` is off (see the provider) because it
  // would count actions against the plain toasts; the limit is applied to the plain stack here.
  const actions = toasts.filter((t) => t.data?.action);
  const plain = toasts.filter((t) => !t.data?.action);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const limit = phone ? MAX_VISIBLE_NOTIFICATION_TOASTS_PHONE : MAX_VISIBLE_NOTIFICATION_TOASTS;
  let active = 0;
  const visible = plain.filter((t) => t.transitionStatus === "ending" || active++ < limit);
  const hidden = plain.length - visible.length;
  // Stack height once fanned out: each visible toast's height plus the gap between them.
  const GAP_PX = 8;
  const heights = visible.map((t) => t.height || 0);
  const fanned = heights.reduce((sum, h) => sum + h, 0) + GAP_PX * Math.max(0, visible.length - 1);
  // Offset of each toast from the bottom when fanned out.
  // A closing toast's height is 0 during its exit, so the front is the first one still open.
  const frontIndex = visible.findIndex((t) => t.transitionStatus !== "ending");
  // When none is left open the last measured height is kept, so the closing card fades without shrinking.
  const lastFront = useRef(0);
  if (frontIndex >= 0 && heights[frontIndex]) lastFront.current = heights[frontIndex];
  const front = frontIndex < 0 ? lastFront.current : heights[frontIndex] || 0;
  // Rear sheets stick up above the front one by PEEK_PX each; the wrapper reserves that too.
  const PEEK_PX = 16;
  const rear = Math.max(0, visible.filter((t) => t.transitionStatus !== "ending").length - 1);
  const offsets = heights.map((_, i) => heights.slice(0, i).reduce((sum, h) => sum + h, 0));
  const renderCard = (
    toast: ToastItem,
    className: string,
    style?: CSSProperties,
    extra?: ReactNode,
    behind?: boolean,
  ) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      data-slot="notification-toast"
      // Base UI hides a high-priority toast from assistive technology until it has focus, which
      // leaves its Dismiss button unreachable.
      aria-hidden={false}
      data-has-action={toast.data?.action ? "" : undefined}
      data-behind={behind ? "" : undefined}
      style={style}
      className={cn(
        "group pointer-events-auto rounded-xl border border-border bg-card text-left text-card-foreground shadow-lg data-[has-action]:flex data-[has-action]:items-center",
        "transition-[opacity,transform,height] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-opacity motion-reduce:duration-150",
        "data-[ending-style]:opacity-0",
        className,
      )}
    >
      {extra}
      <ToastBody toast={toast} formatTime={formatTime} onOpen={onOpen} close={close} />
      {toast.data?.action ? (
        <Button
          size="sm"
          className="me-10 pointer-coarse:me-12 shrink-0 self-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          onClick={() => {
            toast.data?.action?.onClick();
            close(toast.id);
          }}
        >
          {toast.data.action.label}
        </Button>
      ) : null}
      <Toast.Close
        className="absolute top-2 right-2 inline-flex size-6 pointer-coarse:top-0 pointer-coarse:right-0 pointer-coarse:size-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={dismissLabel}
        aria-hidden={false}
      >
        <XIcon className="size-3.5" aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  );
  let shown = 0;
  return (
    <>
      {actions.length > 0 ? (
        <div className="pointer-events-auto mb-2 flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
          {actions.map((toast) =>
            renderCard(
              toast,
              "relative data-[starting-style]:translate-y-[150%] data-[starting-style]:opacity-0 motion-reduce:data-[starting-style]:translate-y-0",
            ),
          )}
        </div>
      ) : null}
      {visible.length > 0 ? (
        <div
          className="relative group-data-[expanded]/viewport:h-[var(--fanned)] h-[var(--stack)] transition-[height] duration-300"
          style={
            {
              "--front": `${front}px`,
              "--stack": `${front + rear * PEEK_PX}px`,
              "--fanned": `${fanned}px`,
            } as CSSProperties
          }
        >
          {visible.map((toast, i) => {
            const index = toast.transitionStatus === "ending" ? i : shown++;
            return renderCard(
              toast,
              cn(
                // Sheets of paper: every toast is pinned to the bottom edge and moved up and
                // scaled down by its index; hover or focus fans them into a column.
                "absolute right-0 bottom-0 left-0 z-[calc(100-var(--i))] origin-bottom",
                "[--gap:0.5rem] [--peek:1rem] [--height:var(--front)]",
                "min-h-[var(--height)] [&[data-behind]]:h-[var(--height)] translate-y-[calc(var(--i)*var(--peek)*-1)] scale-[calc(1-var(--i)*0.05)]",
                "data-[expanded]:h-auto data-[expanded]:min-h-[var(--toast-height)] data-[expanded]:translate-y-[calc(var(--oy)*-1-var(--i)*var(--gap))] data-[expanded]:scale-100",
                "[&[data-behind]:not([data-expanded])]:border-foreground/25! [&[data-behind]:not([data-expanded])]:bg-muted! [&[data-behind]:not([data-expanded])>*]:opacity-0",
                "data-[starting-style]:translate-y-[150%] data-[starting-style]:opacity-0 motion-reduce:data-[starting-style]:translate-y-[calc(var(--i)*var(--peek)*-1)]",
              ),
              { "--i": index, "--oy": `${offsets[i]}px` } as CSSProperties,
              i === 0 && hidden > 0 ? (
                <div
                  data-slot="notification-toast-overflow"
                  className="pointer-events-none absolute -top-9 right-3 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground group-data-[expanded]:hidden"
                >
                  +{hidden}
                </div>
              ) : null,
              i > 0,
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/** Mount once near the app root. `onOpen` receives a toast's in-app link. */
export function NotificationToaster({
  onOpen,
  dismissLabel = "Dismiss",
  formatTime,
  manager = notificationToastManager,
}: {
  onOpen: (href: string) => void | Promise<void>;
  dismissLabel?: string;
  formatTime?: (iso: string) => string;
  manager?: typeof notificationToastManager;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <Toast.Provider
      toastManager={manager}
      limit={Number.POSITIVE_INFINITY}
      timeout={NOTIFICATION_TOAST_TIMEOUT_MS}
    >
      <Toast.Portal>
        <Toast.Viewport
          ref={viewportRef}
          role="status"
          aria-live="polite"
          // Bottom-right, below the page header and its buttons and above the agent composer, and above
          // dialogs and their scrim (z-50). On phones: centred, above the composer. It rises above any
          // `data-toast-avoid` element it would cover, and is hidden while a dialog, menu or the
          // navigation drawer is open, since it would cover their content.
          className={cn(
            "group/viewport pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(6rem,var(--toast-lift,0px))] z-[110] w-[min(28rem,calc(100vw-2rem),var(--toast-max-width,100vw))] max-sm:right-auto max-sm:bottom-[max(calc(env(safe-area-inset-bottom)+1rem),var(--toast-lift,0px))] max-sm:left-1/2 max-sm:-translate-x-1/2",
            COVERED_BY_OVERLAY,
          )}
        >
          <ToastList
            onOpen={onOpen}
            dismissLabel={dismissLabel}
            formatTime={formatTime}
            viewportRef={viewportRef}
          />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
