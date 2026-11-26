import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";

/** 754 seconds is "12:34"; an hour or more adds the hours. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export type RecordingPillState =
  | {
      kind: "recording";
      title: string;
      elapsedMs: number;
      noCallAudio?: boolean;
      offline?: boolean;
      /** Why recording call audio again failed. */
      callAudioError?: string;
    }
  /** The last chunks are still on this computer: uploads failed and are retried. */
  | { kind: "transcribing"; micStopped?: boolean; offline?: boolean }
  /** The capture was closed by the server; the person reads why and dismisses it. */
  | { kind: "failed"; message: string };

/** The recording indicator at the top of the app. It has no close button: stopping is the only way out. */
export function RecordingPill({
  state,
  onStop,
  onDismiss,
  onShareTab,
  systemAudio = false,
  className,
}: {
  state: RecordingPillState;
  onStop: () => void;
  onDismiss?: () => void;
  /** Shown on "No call audio" when the call tab can be shared again. */
  onShareTab?: () => void;
  /** The desktop app records call audio itself, so the retry is not about a tab. */
  systemAudio?: boolean;
  className?: string;
}) {
  const { t } = useLingui();
  const pill = (
    <div
      role="status"
      data-testid="recording-pill"
      className={cn(
        "pointer-events-auto flex max-w-[calc(100%-1rem)] items-center gap-2.5 rounded-full bg-card py-1 ps-3.5 pe-1.5 text-sm text-card-foreground shadow-md ring-1 ring-foreground/10",
        className,
      )}
    >
      {state.kind === "failed" ? (
        <>
          <span className="py-1 text-destructive">{state.message}</span>
          <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onDismiss}>
            <Trans>Dismiss</Trans>
          </Button>
        </>
      ) : state.kind === "transcribing" ? (
        <span className="py-1 pe-2 text-muted-foreground">
          {state.micStopped ? (
            <>
              <Trans>Microphone stopped</Trans>
              {" · "}
            </>
          ) : null}
          <Trans>Transcribing…</Trans>
          {state.offline ? (
            <>
              {" · "}
              <Trans>Offline, saved here</Trans>
            </>
          ) : null}
        </span>
      ) : (
        <>
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive" />
          <span className="min-w-0 truncate font-medium">{state.title}</span>
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
          >
            {formatElapsed(state.elapsedMs)}
          </span>
          {state.offline ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              <Trans>Offline, saved here</Trans>
            </span>
          ) : state.noCallAudio && onShareTab ? (
            <button
              type="button"
              className="shrink-0 text-xs text-warning underline-offset-2 hover:underline"
              title={systemAudio ? t`Record call audio again` : t`Share the call tab again`}
              onClick={onShareTab}
            >
              <Trans>No call audio</Trans>
            </button>
          ) : state.noCallAudio ? (
            <span className="shrink-0 text-xs text-warning">
              <Trans>No call audio</Trans>
            </span>
          ) : null}
          <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onStop}>
            <Trans>Stop</Trans>
          </Button>
        </>
      )}
    </div>
  );
  return state.kind === "recording" && state.callAudioError ? (
    <div className="pointer-events-auto flex max-w-[calc(100%-1rem)] flex-col items-center gap-1">
      {pill}
      <p role="alert" className="max-w-md text-center text-xs text-destructive">
        {state.callAudioError}
      </p>
    </div>
  ) : (
    pill
  );
}
