import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Skeleton } from "@rakazo/ui-web";
import { useEffect, useState } from "react";

/** After this long the wait is no longer normal, so the line changes and offers a retry. */
export const OPENING_SLOW_MS = 8000;

/** A page skeleton that is still showing after this long is stuck, not slow. */
export const STILL_LOADING_MS = 20_000;

/** Goes beside any page skeleton: after 20 s it says so and offers Try again (default: reload the page). */
export function StillLoading({
  onRetry = () => window.location.reload(),
}: {
  onRetry?: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), STILL_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);
  return slow ? (
    <div role="status" className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <Trans>Still loading…</Trans>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  ) : null;
}

/**
 * Message placeholders, shared by every wait between sign-in and the first chat.
 * A slow wait says "Still opening…" and offers Try again, which loads the page afresh.
 */
export function OpeningSpace({
  onRetry = () => window.location.reload(),
}: {
  onRetry?: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), OPENING_SLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-1 flex-col">
      <ThreadSkeleton />
      {slow ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 pb-4 text-[14px] text-muted-foreground"
        >
          <Trans>Still opening…</Trans>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The app shell with placeholders, shown from sign-in until the first chat is ready. */
export function ShellSkeleton() {
  return (
    <div
      className="flex h-full overflow-hidden bg-background"
      data-rakazo-app-state="session-pending"
    >
      <aside className="hidden w-[316px] shrink-0 border-e border-sidebar-border bg-sidebar px-3.5 pt-16 md:block">
        <Skeleton className="h-10 rounded-xl" />
        <div className="mt-5 space-y-2 px-1">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-2.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-6">
          <Skeleton className="h-4 w-40" />
        </div>
        <OpeningSpace />
        <div className="mx-6 mb-6 h-[54px] rounded-full border border-border bg-background" />
      </main>
    </div>
  );
}

/** Message placeholders for a chat whose thread is still loading. */
export function ThreadSkeleton() {
  const { t } = useLingui();
  return (
    <div
      role="status"
      aria-label={t`Loading messages`}
      data-testid="thread-skeleton"
      className="flex flex-1 flex-col justify-end gap-4 px-6 py-6 md:px-[max(1.75rem,calc((100%-900px)/2))]"
    >
      <Skeleton className="h-10 w-2/5 self-end rounded-[20px]" />
      <Skeleton className="h-16 w-3/5 rounded-[20px]" />
      <Skeleton className="h-10 w-1/3 self-end rounded-[20px]" />
    </div>
  );
}
