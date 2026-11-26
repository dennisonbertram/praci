import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BREX_TOKEN_REJECTED } from "@rakazo/contracts";
import { Skeleton } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { ErrorNotice } from "../finance/ui";
import { BrexCardsConnectDialog } from "../integrations/BrexCardsConnectDialog";
import { StillLoading } from "../ShellSkeleton";

export type BrexSectionQuery<T> = {
  data: T | null;
  error: string;
  code?: string | undefined;
  retry: () => void;
};

/** Reloads the page's other Brex reads (the Overview) after a token is replaced in a tab. */
export const BrexTokenReplaced = createContext<() => void>(() => {});

/**
 * The error of a Brex read. When Brex rejected the stored token, Try again cannot help, so it
 * offers Replace token (the Integrations dialog) and reloads once the new token is saved.
 */
export function BrexErrorNotice({ query }: { query: BrexSectionQuery<unknown> }) {
  const [replacing, setReplacing] = useState(false);
  const reloadPage = useContext(BrexTokenReplaced);
  if (query.code !== BREX_TOKEN_REJECTED)
    return <ErrorNotice message={query.error} onRetry={query.retry} />;
  return (
    <>
      <ErrorNotice
        message={query.error}
        action={{ label: t`Replace token`, onClick: () => setReplacing(true) }}
      />
      {replacing ? (
        <BrexCardsConnectDialog
          mode="replace"
          onConnected={() => {
            query.retry();
            reloadPage();
          }}
          onClose={() => setReplacing(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Loading, error and ready chrome for one Brex section's RPC. `children` renders only
 * once `data` is here, so sections never handle the empty answer themselves.
 */
export function BrexSection<T>({
  query,
  children,
}: {
  query: BrexSectionQuery<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.error) return <BrexErrorNotice query={query} />;
  if (!query.data) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="text-xs text-muted-foreground">
          <Trans>Loading…</Trans>
        </span>
        <Skeleton className="h-40 w-full" />
        <StillLoading onRetry={query.retry} />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
