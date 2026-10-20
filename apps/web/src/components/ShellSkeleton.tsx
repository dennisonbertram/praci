import { Trans } from "@lingui/react/macro";
import { Skeleton } from "@rakazo/ui-web";

/** The centered "Opening your Space…" line, shared by every wait between sign-in and the first chat. */
export function OpeningSpace() {
  return (
    <div className="flex flex-1 items-center justify-center text-[14px] text-muted-foreground">
      <Trans>Opening your Space…</Trans>
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
        <div className="h-[74px] border-b border-sidebar-border" />
        <OpeningSpace />
        <div className="mx-6 mb-6 h-[54px] rounded-full border border-border bg-background" />
      </main>
    </div>
  );
}
