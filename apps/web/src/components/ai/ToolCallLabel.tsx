import { toolPhrase } from "@rakazo/core";
import { cn } from "@rakazo/ui-web";
import { Check, Clock, X } from "lucide-react";
import { Shimmer } from "./primitives";

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
  className,
}: {
  /** The tool id, or the label saved for it. */
  name: string;
  state?: ToolCallState;
  count?: number;
  /** The agent's own service name, left out of the phrase. */
  service?: string;
  className?: string;
}) {
  const active = state === "running" || state === "waiting";
  const phrase = toolPhrase(name, active ? "activity" : "done", service) || name;
  return (
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
}
