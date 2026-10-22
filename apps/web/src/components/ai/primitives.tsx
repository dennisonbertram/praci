import { t } from "@lingui/core/macro";
import { cn } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import "./beautiful-ui.css";

/* Beautiful UI primitives — hand-ported from beautifului.dev
   (github.com/TurboKach/ai-native-react-components, MIT © 2026 Turbo).
   The upstream components are demo showcases; these ports keep their visual
   and motion language (pixel-grid loader, shimmer sweep, pop-in success) and
   expose real props. */

/** A light sweep travelling across a text label. */
export function Shimmer({ children }: { children: React.ReactNode }) {
  return (
    <span className="animate-[bui-shimmer-text_1.4s_linear_infinite] bg-linear-to-r from-muted-foreground from-35% via-foreground via-50% to-muted-foreground to-65% bg-size-[200%_100%] bg-clip-text text-transparent">
      {children}
    </span>
  );
}

// Chevron wavefront: each 3×3 cell fires by column distance from the center row.
const CHEVRON_DELAYS = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const column = i % 3;
  return (column + Math.abs(row - 1)) * 90;
});

/** After this long a run offers Stop and Try again, and the timer drops its tenths. */
export const SLOW_RUN_AFTER_MS = 120_000;

/** Format wall-clock seconds since `startedAtMs` as `0.0s` / `1m 2.3s`, and `2m 5s` once slow. */
export function formatElapsed(startedAtMs: number, nowMs: number): string {
  const totalTenths = Math.round(Math.max(0, nowMs - startedAtMs) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  if (minutes === 0) return `${seconds.toFixed(1)}s`;
  if (totalTenths * 100 >= SLOW_RUN_AFTER_MS) return `${minutes}m ${Math.floor(seconds)}s`;
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** After this long without a new step, the time since the last one is shown next to it. */
export const QUIET_SECONDS_SHOWN_AFTER_MS = 15_000;
/** After this long, the line says the service is slow. */
export const QUIET_WAITING_AFTER_MS = 45_000;

/** Pixel-grid loader (or a custom indicator) with shimmering label, live elapsed timer and the latest step. */
function DefaultLoadingState({
  indicator,
  label,
  startedAt,
  detail,
  detailSince,
  waitingLabel,
  onStop,
  onRetry,
}: {
  indicator?: React.ReactNode;
  label: string;
  startedAt?: number;
  detail?: string;
  detailSince?: number;
  waitingLabel?: string;
  onStop?: () => void;
  onRetry?: () => void;
}) {
  const [mountedAt] = useState(() => Date.now());
  const now = useNow();
  const elapsed = formatElapsed(startedAt ?? mountedAt, now);
  useHideAmounts();
  // The quiet time restarts whenever the latest step changes.
  const [seen, setSeen] = useState({ detail, at: detailSince ?? now });
  if (seen.detail !== detail) setSeen({ detail, at: Date.now() });
  const quiet = detail ? now - seen.at : 0;
  return (
    <>
      {indicator ?? (
        <span aria-hidden className="grid grid-cols-[repeat(3,4px)] gap-[1.5px]">
          {CHEVRON_DELAYS.map((delay, i) => (
            <span
              key={i}
              className="h-[4px] w-[4px] rounded-[1px] bg-foreground opacity-15"
              style={{ animation: `bui-pixel-on 650ms ease-in-out ${delay}ms infinite` }}
            />
          ))}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-2.5">
          <span className="text-[13.5px] font-medium">
            <Shimmer>{label}</Shimmer>
          </span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {elapsed}
          </span>
        </span>
        {detail ? (
          <span
            data-testid="working-detail"
            className="line-clamp-2 break-words text-[12px] leading-5 text-muted-foreground"
          >
            {maskCurrencyWhenHidden(detail)}
            {quiet >= QUIET_SECONDS_SHOWN_AFTER_MS ? ` · ${Math.floor(quiet / 1000)}s` : ""}
            {quiet >= QUIET_WAITING_AFTER_MS && waitingLabel ? (
              <span data-testid="working-waiting">{` · ${waitingLabel}`}</span>
            ) : null}
          </span>
        ) : null}
        {onStop && now - (startedAt ?? mountedAt) >= SLOW_RUN_AFTER_MS ? (
          <span
            data-testid="working-slow"
            className="flex items-center gap-2 text-[12px] text-muted-foreground"
          >
            {t`Taking longer than usual`}
            <button type="button" className="underline hover:text-foreground" onClick={onStop}>
              {t`Stop`}
            </button>
            {onRetry ? (
              <button type="button" className="underline hover:text-foreground" onClick={onRetry}>
                {t`Try again`}
              </button>
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );
}

export function LoadingState({
  indicator,
  label = "working",
  startedAt,
  detail,
  detailSince,
  waitingLabel,
  onStop,
  onRetry,
}: {
  indicator?: React.ReactNode;
  label?: string;
  /** Epoch ms when the run started. Falls back to mount time when omitted. */
  startedAt?: number;
  /** The latest step the tool reported, such as "Searching mail: from Kevin". */
  detail?: string;
  /** Epoch ms of the step, when it is older than this screen. Falls back to mount time. */
  detailSince?: number;
  /** Shown after a long quiet spell, such as "Still waiting on Gmail". */
  waitingLabel?: string;
  /** After two minutes the row offers Stop; with `onRetry`, also Try again. */
  onStop?: () => void;
  onRetry?: () => void;
}) {
  return (
    <span
      role={indicator ? "status" : undefined}
      className="flex w-fit max-w-full items-center gap-2.5"
    >
      <DefaultLoadingState
        indicator={indicator}
        label={label}
        startedAt={startedAt}
        detail={detail}
        detailSince={detailSince}
        waitingLabel={waitingLabel}
        onStop={onStop}
        onRetry={onRetry}
      />
    </span>
  );
}

/** Pop-in green check with a fading-up label — the approval-card success beat. */
export function SuccessPop({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-background"
        style={{ animation: "bui-pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <span
        className="text-[13px] font-medium text-foreground"
        style={{ animation: "bui-fade-up 350ms cubic-bezier(0.23,1,0.32,1) 100ms both" }}
      >
        {label}
      </span>
    </span>
  );
}

/** Card shell. */
export function BuiCard({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}
    />
  );
}
