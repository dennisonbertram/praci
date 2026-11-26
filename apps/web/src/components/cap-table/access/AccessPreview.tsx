import { t } from "@lingui/core/macro";
import type { EquityAccessLevel, EquityAccessView } from "@rakazo/contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { PortalHoldings } from "../../../pages/portal/PortalHoldings";
import { ACCESS_LEVELS, levelLabel } from "./access-levels";

/**
 * What one holder sees in the portal, built by the server at their level or at a level to try.
 * It renders the portal's own holdings sections, so the preview is the holder's page.
 */
export function AccessPreview({
  stakeholderId,
  name,
  open,
  onOpenChange,
}: {
  stakeholderId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hideAmounts = useHideAmounts();
  const [level, setLevel] = useState<EquityAccessLevel | "">("");
  const [view, setView] = useState<EquityAccessView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    setView(null);
    setError("");
    rpc.equity.accessView
      .get({ stakeholderId, ...(level ? { level } : {}) })
      .then((loaded) => {
        if (live) setView(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [open, stakeholderId, level]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <NativeSelect
          aria-label={t`Level`}
          value={level}
          onChange={(event) => setLevel(event.target.value as EquityAccessLevel | "")}
        >
          <NativeSelectOption value="">{t`Their level`}</NativeSelectOption>
          {ACCESS_LEVELS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {levelLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : view == null ? (
          <Skeleton className="h-40 w-full" />
        ) : view.level === "none" ? (
          <p className="text-sm text-muted-foreground">{t`No access`}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <PortalHoldings view={view} preview hideAmounts={hideAmounts} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
