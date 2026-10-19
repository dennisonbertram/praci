"use client";

import { Toast } from "@base-ui/react/toast";
import { cn } from "@rakazo/ui-web/lib/utils";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

export const MAX_VISIBLE_NOTIFICATION_TOASTS = 3;

export type NotificationToastData = {
  avatar?: ReactNode;
  href?: string;
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
}: {
  onOpen: (href: string) => void | Promise<void>;
  dismissLabel: string;
}) {
  const { toasts, close } = Toast.useToastManager<NotificationToastData>();
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
              "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-warning bg-card p-3 text-left text-card-foreground shadow-lg",
              "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              "data-[starting-style]:-translate-y-4 data-[starting-style]:opacity-0 motion-reduce:data-[starting-style]:translate-y-0",
              "data-[ending-style]:-translate-y-4 data-[ending-style]:opacity-0 motion-reduce:data-[ending-style]:translate-y-0",
            )}
          >
            {toast.data?.avatar ? <div className="shrink-0">{toast.data.avatar}</div> : null}
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Toast.Title render={<span />} className="block text-sm font-medium break-words" />
              <Toast.Description
                render={<span />}
                className="mt-0.5 block text-sm text-muted-foreground break-words"
              />
            </button>
            <Toast.Close
              className="-mr-1 -mt-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={dismissLabel}
            >
              <XIcon className="size-4" aria-hidden="true" />
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
  manager = notificationToastManager,
}: {
  onOpen: (href: string) => void | Promise<void>;
  dismissLabel?: string;
  manager?: typeof notificationToastManager;
}) {
  return (
    <Toast.Provider toastManager={manager} limit={MAX_VISIBLE_NOTIFICATION_TOASTS} timeout={0}>
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed top-4 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
          <ToastList onOpen={onOpen} dismissLabel={dismissLabel} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
