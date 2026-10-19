"use client";

import { Toast } from "@base-ui/react/toast";
import { cn } from "@rakazo/ui-web/lib/utils";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export const MAX_VISIBLE_NOTIFICATION_TOASTS = 3;

export type NotificationToastData = {
  avatar?: ReactNode;
  href?: string;
  /** ISO time the notification was created; shown through the toaster's `formatTime`. */
  createdAt?: string;
  onSeen?: () => void;
};

export type NotificationToastInput = NotificationToastData & {
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
  ...data
}: NotificationToastInput) {
  return notificationToastManager.add({
    id,
    title,
    description: body,
    timeout,
    priority: "high",
    data,
  });
}

function ToastList({
  onOpen,
  dismissLabel,
  formatTime,
}: {
  onOpen: (href: string) => void | Promise<void>;
  dismissLabel: string;
  formatTime?: (iso: string) => string;
}) {
  const { toasts, close } = Toast.useToastManager<NotificationToastData>();
  const [, tick] = useState(0);
  // The relative time is refreshed while any toast is open.
  const open = toasts.length > 0 && Boolean(formatTime);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [open]);
  const hidden = toasts.filter((t) => t.limited).length;
  // Newest first: the first visible toast is the front sheet of the deck.
  const visible = toasts.filter((t) => !t.limited);
  return (
    <>
      {visible.map((toast, i) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          data-slot="notification-toast"
          className={cn(
            // Sheets of paper: every toast is pinned to the bottom edge and moved up and
            // scaled down by its index; hover or focus fans them into a column.
            "group pointer-events-auto absolute right-0 bottom-0 left-0 z-[calc(100-var(--toast-index))] origin-bottom rounded-xl border border-border bg-card text-left text-card-foreground shadow-lg",
            "[--gap:0.5rem] [--peek:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))]",
            "h-[var(--height)] translate-y-[calc(var(--toast-index)*var(--peek)*-1)] scale-[calc(1-var(--toast-index)*0.05)]",
            "data-[expanded]:h-[var(--toast-height)] data-[expanded]:translate-y-[calc(var(--toast-offset-y)*-1-var(--toast-index)*var(--gap))] data-[expanded]:scale-100",
            "[&[data-behind]:not([data-expanded])]:brightness-90 [&[data-behind]:not([data-expanded])]:dark:brightness-75 [&[data-behind]:not([data-expanded])>*]:opacity-0",
            "transition-[opacity,transform,height] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-opacity motion-reduce:duration-150",
            "data-[starting-style]:translate-y-[150%] data-[starting-style]:opacity-0 motion-reduce:data-[starting-style]:translate-y-[calc(var(--toast-index)*var(--peek)*-1)]",
            "data-[ending-style]:opacity-0",
          )}
        >
          {i === 0 && hidden > 0 ? (
            <div
              data-slot="notification-toast-overflow"
              className="pointer-events-none absolute -top-9 right-3 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground group-data-[expanded]:hidden"
            >
              +{hidden}
            </div>
          ) : null}
          <button
            type="button"
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-4 pr-10 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
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
            {toast.data?.avatar ? <span className="shrink-0">{toast.data.avatar}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <Toast.Title
                  render={<span />}
                  className="min-w-0 flex-1 text-sm font-medium break-words"
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
          </button>
          <Toast.Close
            className="absolute top-2 right-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
            aria-label={dismissLabel}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Toast.Close>
        </Toast.Root>
      ))}
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
  return (
    <Toast.Provider
      toastManager={manager}
      limit={MAX_VISIBLE_NOTIFICATION_TOASTS}
      timeout={NOTIFICATION_TOAST_TIMEOUT_MS}
    >
      <Toast.Portal>
        <Toast.Viewport
          role="status"
          aria-live="polite"
          // Bottom-right with 16 px side insets; lifted above the chat composer. Centred on phones.
          className="pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+1rem))] z-50 w-[min(28rem,calc(100vw-2rem))] max-sm:right-auto max-sm:left-1/2 max-sm:-translate-x-1/2"
        >
          <ToastList onOpen={onOpen} dismissLabel={dismissLabel} formatTime={formatTime} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
