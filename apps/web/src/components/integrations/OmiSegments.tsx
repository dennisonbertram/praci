import { Trans, useLingui } from "@lingui/react/macro";
import type { OmiSegmentDto } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { daysBetween, todayIso } from "../../lib/legal-format";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export const OMI_PATH = "/app/integrations/omi";
type Kind = OmiSegmentDto["kind"];
/** Whole local days shown, today included. The server gets one more so a time zone cannot cut a day short. */
const WINDOW_DAYS = 7;

function useSegments(reloadKey = 0, days?: number) {
  const [rows, setRows] = useState<OmiSegmentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows((await rpc.omi.segments.list(days ? { days } : {})) ?? []);
    } catch (err) {
      setError(errorText(err));
    }
  }, [days]);
  useEffect(() => {
    void load();
  }, [load, reloadKey]);
  async function move(segment: OmiSegmentDto, kind: Kind) {
    setError(null);
    try {
      await rpc.omi.segments.move({ segmentId: segment.id, kind });
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }
  return { rows, error, move };
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

function SegmentRow({ segment, onMove }: { segment: OmiSegmentDto; onMove: (kind: Kind) => void }) {
  const { t } = useLingui();
  const label: Record<Kind, string> = {
    meeting: t`Meeting`,
    note: t`Note`,
    trash: t`Trash`,
  };
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span
        className={`min-w-0 flex-1 truncate text-sm ${segment.kind === "trash" ? "text-muted-foreground" : ""}`}
      >
        <span className="tabular-nums">
          {clock(segment.startedAt)}–{clock(segment.endedAt)}
        </span>{" "}
        · {segment.title}
      </span>
      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {label[segment.kind]}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t`More`}
          render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["meeting", "note", "trash"] as const)
            .filter((kind) => kind !== segment.kind)
            .map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => onMove(kind)}>
                {kind === "meeting" ? (
                  <Trans>Move to Meeting</Trans>
                ) : kind === "note" ? (
                  <Trans>Move to Note</Trans>
                ) : (
                  <Trans>Move to Trash</Trans>
                )}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

const dayHeading = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

/** The last week's sorted stretches under their day, newest first, with a link to the trashed ones. Renders nothing before there is any. */
export function OmiSegments({ reloadKey = 0 }: { reloadKey?: number }) {
  const { t } = useLingui();
  const { rows: all, error, move } = useSegments(reloadKey, WINDOW_DAYS + 1);
  const today = todayIso();
  const trashed = (all ?? []).filter((row) => row.kind === "trash").length;
  const byDay = new Map<string, OmiSegmentDto[]>();
  for (const row of all ?? []) {
    const day = todayIso(new Date(row.startedAt));
    const age = daysBetween(day, today);
    if (row.kind === "trash" || age < 0 || age >= WINDOW_DAYS) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  // Today always shows when there is a Trash link or an error to put under it.
  if (!byDay.has(today) && (trashed > 0 || error)) byDay.set(today, []);
  const days = [...byDay.keys()].sort().reverse();
  return (
    <>
      {days.map((day) => {
        const heading = day === today ? t`Today` : dayHeading(day);
        return (
          <section key={day} aria-label={heading} className="mt-6">
            <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{heading}</h2>
            {day === today && error ? (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {(byDay.get(day) ?? []).map((segment) => (
                <SegmentRow
                  key={segment.id}
                  segment={segment}
                  onMove={(kind) => void move(segment, kind)}
                />
              ))}
              {day === today && trashed > 0 ? (
                <li className="px-3.5 py-2.5 text-sm">
                  <Link to={`${OMI_PATH}/trash`} className="hover:underline">
                    <Trans>Trash</Trans> <span className="text-muted-foreground">· {trashed}</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** Trashed stretches. Restore files one back as a Note. */
export function OmiTrash() {
  const { rows, error, move } = useSegments();
  const trashed = (rows ?? []).filter((row) => row.kind === "trash");
  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        <Link
          to={OMI_PATH}
          className="rk-tap mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Omi
        </Link>
        <h1 className="mb-4 text-xl font-semibold">
          <Trans>Trash</Trans>
        </h1>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {trashed.map((segment) => (
            <li key={segment.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="tabular-nums">
                  {clock(segment.startedAt)}–{clock(segment.endedAt)}
                </span>{" "}
                · {segment.title}
                <small className="ms-2 text-xs text-muted-foreground">
                  {new Date(segment.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </span>
              <Button size="sm" variant="outline" onClick={() => void move(segment, "note")}>
                <Trans>Restore</Trans>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
