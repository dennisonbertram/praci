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
};

export const notificationToastManager = Toast.createToastManager<NotificationToastData>();

/** Only `attention` notifications toast, so every toast stays until dismissed. */
export function enqueueNotificationToast({ id, title, body, ...data }: NotificationToastInput) {
  return notificationToastManager.add({
    id,
    title,
    description: body,
    timeout: 0,
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
  // Toasts stay until dismissed, so the relative time is refreshed while any is open.
  const open = toasts.length > 0 && Boolean(formatTime);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [open]);
  const hidden = toasts.filter((t) => t.limited).length;
  return (
    <>
      {toasts
        .filter((t) => !t.limited)
        .map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            data-slot="notification-toast"
            className={cn(
              "group pointer-events-auto relative w-full rounded-xl border border-border bg-card text-left text-card-foreground shadow-lg",
              "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              "data-[starting-style]:-translate-y-4 data-[starting-style]:opacity-0 motion-reduce:data-[starting-style]:translate-y-0",
              "data-[ending-style]:-translate-y-4 data-[ending-style]:opacity-0 motion-reduce:data-[ending-style]:translate-y-0",
            )}
          >
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
      {hidden > 0 ? (
        <div
          data-slot="notification-toast-overflow"
          className="pointer-events-none self-center rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground"
        >
          +{hidden}
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
  return (
    <Toast.Provider toastManager={manager} limit={MAX_VISIBLE_NOTIFICATION_TOASTS} timeout={0}>
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed top-4 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
          <ToastList onOpen={onOpen} dismissLabel={dismissLabel} formatTime={formatTime} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
