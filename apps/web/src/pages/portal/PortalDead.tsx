import { Trans } from "@lingui/react/macro";

/** An expired, revoked or unknown link: one sentence and nothing else. `/portal` is the page without it. */
export function PortalDead({ quiet = false }: { quiet?: boolean }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      {quiet ? null : (
        <p className="text-center text-base">
          <Trans>This link no longer works.</Trans>
        </p>
      )}
    </main>
  );
}
