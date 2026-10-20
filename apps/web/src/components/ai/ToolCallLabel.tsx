import { toolPhrase } from "@rakazo/core";
import { cn } from "@rakazo/ui-web";
import { Check, Clock, X } from "lucide-react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { Shimmer } from "./primitives";

export type ToolCallLine = { text: string; failed?: true };

export type ToolCallState = "running" | "done" | "failed" | "waiting";

/**
 * One tool call as a plain phrase ("Checking banking transactions"), with the raw tool id only in
 * the tooltip. Running shimmers; done, failed and waiting get an icon.
 */
export function ToolCallLabel({
  name,
  state = "done",
  count = 1,
  service,
  summary,
  lines,
  className,
}: {
  /** The tool id, or the label saved for it. */
  name: string;
  state?: ToolCallState;
  count?: number;
  /** The agent's own service name, left out of the phrase. */
  service?: string;
  /** What the finished call found, such as "Searched mail · 23 found". Replaces the phrase. */
  summary?: string;
  /** The steps the call took. They list under the row when there are any. */
  lines?: readonly ToolCallLine[];
  className?: string;
}) {
  useHideAmounts();
  const active = state === "running" || state === "waiting";
  const phrase =
    (!active && summary ? maskCurrencyWhenHidden(summary) : "") ||
    toolPhrase(name, active ? "activity" : "done", service) ||
    name;
  const row = (
    <span
      className={cn("flex min-w-0 items-center gap-2 leading-5", className)}
      data-testid="tool-call"
      data-state={state}
      title={name}
    >
      <span
        className={cn(
          "shrink-0",
          state === "done" && "text-success",
          state === "failed" && "text-destructive",
          state === "waiting" && "text-warning",
        )}
        aria-hidden
      >
        {state === "done" ? (
          <Check size={12} />
        ) : state === "failed" ? (
          <X size={12} />
        ) : state === "waiting" ? (
          <Clock size={12} />
        ) : (
          <Clock size={12} className="animate-pulse text-warning motion-reduce:animate-none" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {state === "running" ? <Shimmer>{phrase}</Shimmer> : phrase}
        {count > 1 ? ` ×${count}` : ""}
      </span>
    </span>
  );
  if (!lines?.length) return row;
  return (
    <details className="group/steps" data-testid="tool-call-details">
      <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {row}
      </summary>
      <ul className="ms-5 space-y-0.5 py-0.5">
        {lines.map((line, index) => (
          <li
            key={index}
            className={cn(
              "truncate text-[12px] leading-5",
              line.failed ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {maskCurrencyWhenHidden(line.text)}
          </li>
        ))}
      </ul>
    </details>
  );
}
