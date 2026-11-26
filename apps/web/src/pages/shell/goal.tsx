import { Trans, useLingui } from "@lingui/react/macro";
import type { MessageBlock, ThreadGoal, ThreadSnapshot } from "@rakazo/contracts";
import { ThreadGoalSchema } from "@rakazo/contracts";
import { goalEvidenceRows } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { ChevronRight, CircleAlert, CircleStop, Target, X } from "lucide-react";
import { useState } from "react";
import { SuccessPop } from "../../components/ai/primitives";
import { ToolCallLabel } from "../../components/ai/ToolCallLabel";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";

/** The one-line goal status above the composer: the goal text, plus a status word when the bot is not working. */
export function GoalLine({
  goal,
  waiting,
  onClear,
}: {
  goal: ThreadGoal;
  /** The goal's run waits on a card or question for the owner. */
  waiting: boolean;
  onClear: () => void;
}) {
  const { t } = useLingui();
  const [expanded, setExpanded] = useState(false);
  const status = goal.status === "paused" ? t`Paused` : waiting ? t`Waiting on you` : null;
  return (
    <div
      role="group"
      aria-label={t`Goal`}
      data-testid="goal-line"
      className="mb-2 flex items-start gap-2 rounded-[14px] border border-border bg-muted py-1 ps-3 pe-1 text-[13px]"
    >
      <Target
        aria-hidden="true"
        size={14}
        strokeWidth={1.8}
        className="mt-[7px] shrink-0 text-muted-foreground"
      />
      <button
        type="button"
        aria-expanded={expanded}
        title={goal.text}
        onClick={() => setExpanded((open) => !open)}
        className="min-w-0 flex-1 rounded-sm py-1 text-start text-foreground"
      >
        <span
          dir="auto"
          className={expanded ? "block whitespace-pre-wrap break-words" : "block truncate"}
        >
          {goal.text}
        </span>
      </button>
      {status ? <span className="shrink-0 py-1 text-muted-foreground">{status}</span> : null}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t`Clear goal`}
        className="shrink-0"
        onClick={onClear}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** How a goal ended, in the transcript: one word after "Goal", then the reason. */
export function GoalBlockView({ block }: { block: Extract<MessageBlock, { kind: "goal" }> }) {
  const { t } = useLingui();
  // Tool results can carry money; the evidence follows the owner's Hide amounts switch.
  useHideAmounts();
  const title =
    block.outcome === "met"
      ? t`Goal met`
      : block.outcome === "blocked"
        ? t`Goal blocked`
        : t`Goal stopped`;
  const evidence = goalEvidenceRows(block);
  return (
    <div
      role="status"
      data-testid="goal-block"
      data-outcome={block.outcome}
      className="mx-auto flex max-w-full flex-col items-center gap-0.5 py-1 text-center"
    >
      {block.outcome === "met" ? (
        <SuccessPop label={title} />
      ) : (
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          {block.outcome === "blocked" ? (
            <CircleAlert aria-hidden="true" size={16} className="text-warning" />
          ) : (
            <CircleStop aria-hidden="true" size={16} className="text-muted-foreground" />
          )}
          {title}
        </span>
      )}
      {block.reason ? (
        <span dir="auto" className="text-[13.5px] text-muted-foreground">
          {block.reason}
        </span>
      ) : null}
      {/* Fit the block's column: a wider box is centred and overhangs the message column on both sides. */}
      {evidence.length > 0 ? (
        <details className="group mt-0.5 w-fit max-w-full text-start">
          <summary className="mx-auto flex min-h-6 w-fit cursor-pointer list-none items-center gap-1 rounded-md py-0.5 pe-1.5 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <ChevronRight
              aria-hidden
              size={14}
              strokeWidth={1.8}
              className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
            />
            <Trans>Evidence · {evidence.length}</Trans>
          </summary>
          <div className="ms-[7px] mt-0.5 max-w-full border-s border-border ps-3">
            {evidence.map((row, index) => {
              const result = maskCurrencyWhenHidden(row.result);
              return (
                <div key={index} className="py-0.5">
                  {row.tool ? <ToolCallLabel name={row.tool} state="done" /> : null}
                  {result ? (
                    <div
                      dir="auto"
                      title={result}
                      className="ms-5 line-clamp-1 text-[12px] leading-5 text-muted-foreground"
                    >
                      {result}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** The server answers a bare `/goal` or `/goal clear` through a send error marked `data.goalReply`. */
export function isGoalReply(error: unknown): boolean {
  return (error as { data?: { goalReply?: unknown } } | null)?.data?.goalReply === true;
}

/** That answer as a neutral line, not an error. */
export function GoalNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { t } = useLingui();
  return (
    <div
      role="status"
      data-testid="goal-notice"
      className="mb-2 flex items-center gap-2 rounded-[14px] border border-border bg-muted py-1 ps-4 pe-1 text-[13px] text-foreground"
    >
      <span dir="auto" className="min-w-0 flex-1 py-1">
        {message}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t`Dismiss`}
        className="shrink-0"
        onClick={onDismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Applies a `thread.goal.updated` payload; a payload that is not a goal or null leaves the snapshot alone. */
export function snapshotWithGoal(
  snapshot: ThreadSnapshot | null,
  payload: unknown,
): ThreadSnapshot | null {
  if (!snapshot) return snapshot;
  const raw = (payload as { goal?: unknown } | null)?.goal;
  if (raw === null) return { ...snapshot, goal: null };
  const goal = ThreadGoalSchema.safeParse(raw);
  return goal.success ? { ...snapshot, goal: goal.data } : snapshot;
}
