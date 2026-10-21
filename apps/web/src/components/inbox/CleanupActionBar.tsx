import { useLingui } from "@lingui/react/macro";
import type { CleanupKind } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from "@rakazo/ui-web";
import { Archive, Ellipsis } from "lucide-react";

/** The choices for the ticked senders, each with the number of conversations it touches. A choice that touches nothing, such as Unsubscribe when no ticked sender has a link, is left out. */
export function CleanupActionBar({
  counts,
  busy = false,
  onApply,
}: {
  counts: Record<CleanupKind, number>;
  busy?: boolean;
  onApply: (kind: CleanupKind) => void;
}) {
  const { t } = useLingui();
  const off = (kind: CleanupKind) => busy || counts[kind] === 0;
  return (
    <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center gap-2 bg-background py-2">
      <Button size="sm" disabled={off("archive")} onClick={() => onApply("archive")}>
        {busy ? <Spinner aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {t`Archive ${counts.archive}`}
      </Button>
      {counts.unsubscribe > 0 ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onApply("unsubscribe")}
        >
          {t`Unsubscribe ${counts.unsubscribe}`}
        </Button>
      ) : null}
      {counts.skip_inbox > 0 ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onApply("skip_inbox")}
        >
          {t`Skip inbox ${counts.skip_inbox}`}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" disabled={busy} aria-label={t`More`} />}
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={counts.spam === 0} onClick={() => onApply("spam")}>
            {t`Spam ${counts.spam}`}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
