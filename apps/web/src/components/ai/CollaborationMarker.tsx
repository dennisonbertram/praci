import type { GroupAvatarMember } from "@rakazo/ui-web";
import { BotAvatar, GroupAvatar } from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import { LoadingState } from "./primitives";

/** Lightweight peer event shown without exposing the exchanged message body. */
export function CollaborationMarker({
  ariaLabel,
  color,
  identity,
  label,
  onClick,
}: {
  ariaLabel: string;
  color: string;
  identity: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-start">
      <button
        type="button"
        data-testid="peer-receipt-chip"
        aria-label={ariaLabel}
        onClick={onClick}
        className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/75"
      >
        <BotAvatar color={color} identity={identity} size={16} />
        <span dir="auto" className="truncate">
          {label}
        </span>
        <ChevronRight aria-hidden size={14} strokeWidth={1.8} className="shrink-0 rtl:rotate-180" />
      </button>
    </div>
  );
}

export function ActiveBotGlyph({
  bots,
  label,
  startedAt,
  detail,
  detailSince,
  waitingLabel,
  onStop,
  onRetry,
}: {
  bots: GroupAvatarMember[];
  label: string;
  startedAt?: number;
  detail?: string;
  detailSince?: number;
  waitingLabel?: string;
  onStop?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center px-1">
      <LoadingState
        indicator={<GroupAvatar members={bots} size={28} />}
        label={label}
        startedAt={startedAt}
        detail={detail}
        detailSince={detailSince}
        waitingLabel={waitingLabel}
        onStop={onStop}
        onRetry={onRetry}
      />
    </div>
  );
}
