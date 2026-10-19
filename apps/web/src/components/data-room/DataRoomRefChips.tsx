import { t } from "@lingui/core/macro";
import type { DataRoomReference } from "@rakazo/core";
import { Link } from "react-router-dom";
import { fileIcon } from "./ItemRows";

/** Data room files a sent message carries, as chips that open the file in the Data room. */
export function DataRoomRefChips({ refs }: { refs: DataRoomReference[] }) {
  return (
    <div className="flex max-w-full flex-wrap justify-end gap-2">
      {refs.map((ref) => {
        const Icon = fileIcon({ mimeType: "", name: ref.name });
        return (
          <Link
            key={ref.id}
            to={`/app/data-room?item=${encodeURIComponent(ref.id)}`}
            data-testid="data-room-ref-chip"
            aria-label={t`Open ${ref.name}`}
            className="flex max-w-full items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/75 hover:text-foreground"
          >
            <Icon aria-hidden="true" size={14} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate" dir="auto">
              {ref.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
