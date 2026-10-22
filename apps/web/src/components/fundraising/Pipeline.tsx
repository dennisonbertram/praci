import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactStage } from "@rakazo/contracts";
import { ContactStageSchema } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { usdFigure } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { SAVED_ROW_CLASS } from "../../lib/use-contact-notices";
import { contactStageNames } from "../ContactDialog";

function ProspectRow({
  prospect,
  saved,
  filledSend,
  onEdit,
  onMove,
  onSendSafe,
}: {
  prospect: Contact;
  saved: boolean;
  filledSend: boolean;
  onEdit: () => void;
  onMove: (stage: ContactStage) => void;
  onSendSafe?: () => void;
}) {
  const stageNames = contactStageNames();
  return (
    <li
      data-contact-id={prospect.id}
      className={`flex min-h-11 items-center gap-2 border-t border-border px-2 first:border-t-0 ${saved ? SAVED_ROW_CLASS : ""}`}
    >
      <button
        type="button"
        data-row-open
        className="min-w-0 flex-1 rounded-sm py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onEdit}
      >
        <span className="block truncate text-sm font-medium" title={prospect.name}>
          {prospect.name}
        </span>
        {prospect.nextStep ? (
          <span className="block truncate text-xs text-muted-foreground">{prospect.nextStep}</span>
        ) : null}
      </button>
      {/* A fixed column, so the amounts line up whatever the names are. */}
      <span className="w-24 shrink-0 text-end text-sm tabular-nums" data-testid="check-size">
        {usdFigure(
          prospect.checkSizeCents == null ? null : prospect.checkSizeCents / 100,
          0,
          i18n.locale || "en",
        )}
      </span>
      {onSendSafe ? (
        // The button has its own slot after the amount, so amounts and menus line up in every row.
        <span className="flex w-24 shrink-0 justify-end">
          {prospect.stage === "committed" ? (
            <Button
              variant={filledSend ? "default" : "outline"}
              size="sm"
              className="pointer-coarse:h-11"
              onClick={onSendSafe}
            >
              <Trans>Send SAFE</Trans>
            </Button>
          ) : null}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t`Actions for ${prospect.name}`} />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Trans>Move to</Trans>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ContactStageSchema.options
                .filter((stage) => stage !== prospect.stage)
                .map((stage) => (
                  <DropdownMenuItem key={stage} onClick={() => onMove(stage)}>
                    {stageNames[stage]}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={onEdit}>
            <Trans>Edit prospect</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Prospects grouped under their stage. Empty stages are not drawn; Passed is a button that expands in place. */
export function Pipeline({
  prospects,
  savedId = null,
  filledSend = false,
  onEdit,
  onMove,
  onSendSafe,
}: {
  prospects: readonly Contact[];
  /** The prospect just saved, whose row stands out. */
  savedId?: string | null;
  /** Whether Send SAFE is the page's one filled button (an open round); outline otherwise. */
  filledSend?: boolean;
  onEdit: (prospect: Contact) => void;
  onMove: (prospect: Contact, stage: ContactStage) => void;
  /** Shows Send SAFE on Committed rows. */
  onSendSafe?: (prospect: Contact) => void;
}) {
  useHideAmounts();
  const [showPassed, setShowPassed] = useState(false);
  const stageNames = contactStageNames();
  const inStage = (stage: ContactStage) => prospects.filter((p) => p.stage === stage);
  const passed = inStage("passed");
  const row = (prospect: Contact) => (
    <ProspectRow
      key={prospect.id}
      prospect={prospect}
      saved={prospect.id === savedId}
      filledSend={filledSend}
      onEdit={() => onEdit(prospect)}
      onMove={(stage) => onMove(prospect, stage)}
      onSendSafe={onSendSafe && (() => onSendSafe(prospect))}
    />
  );
  return (
    <div className="flex flex-col gap-4">
      {ContactStageSchema.options
        .filter((stage) => stage !== "passed" && inStage(stage).length > 0)
        .map((stage) => (
          <section key={stage} aria-label={stageNames[stage]}>
            <h3 className="mb-1 px-2 text-xs font-semibold text-muted-foreground">
              {stageNames[stage]}
            </h3>
            <ul>{inStage(stage).map(row)}</ul>
          </section>
        ))}
      {passed.length > 0 ? (
        <section aria-label={stageNames.passed}>
          <Button
            variant="ghost"
            size="sm"
            className="-mx-1 px-2 text-xs text-muted-foreground pointer-coarse:h-11"
            aria-expanded={showPassed}
            onClick={() => setShowPassed((open) => !open)}
          >
            <ChevronRight
              aria-hidden="true"
              className={showPassed ? "rotate-90 transition-transform" : "transition-transform"}
            />
            {stageNames.passed} {passed.length}
          </Button>
          {showPassed ? <ul>{passed.map(row)}</ul> : null}
        </section>
      ) : null}
    </div>
  );
}
