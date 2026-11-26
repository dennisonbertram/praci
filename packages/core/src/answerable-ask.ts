type AskSnapshot = {
  messages: readonly {
    id: string;
    runId?: string | null;
    blocks: readonly { kind: string; status?: string; input?: string; credential?: unknown }[];
  }[];
  run?: { id: string; status: string; userId?: string } | null;
  activeRuns?: readonly { id: string; status: string; userId?: string }[];
};

/**
 * A login or credential request is saved for the run's user, so only they fill it in. These are
 * the unanswered ones the given viewer must see without fields or buttons; with no known viewer
 * or run user, none is theirs.
 */
export function ownerOnlyCredentialAskMessageIds(
  snapshot: AskSnapshot | null,
  userId?: string,
): Set<string> {
  const ownerOnly = new Set<string>();
  if (!snapshot) return ownerOnly;
  const runs = snapshot.activeRuns ?? (snapshot.run ? [snapshot.run] : []);
  const owned = new Set(runs.filter((run) => userId && run.userId === userId).map((run) => run.id));
  for (const message of snapshot.messages) {
    if (message.runId && owned.has(message.runId)) continue;
    if (
      message.blocks.some(
        (block) =>
          block.kind === "ask" &&
          block.input === "secret" &&
          Boolean(block.credential) &&
          block.status !== "answered",
      )
    )
      ownerOnly.add(message.id);
  }
  return ownerOnly;
}

export function latestAnswerableAskMessageId(snapshot: AskSnapshot | null): string | null {
  if (!snapshot) return null;
  const waitingRunIds = new Set(
    (snapshot.activeRuns ?? (snapshot.run ? [snapshot.run] : []))
      .filter((run) => run.status === "waiting_input")
      .map((run) => run.id),
  );
  for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
    const message = snapshot.messages[index];
    if (!message?.runId || !waitingRunIds.has(message.runId)) continue;
    if (message.blocks.some((block) => block.kind === "ask" && block.status !== "answered")) {
      return message.id;
    }
  }
  return null;
}

export function selectedAskActionLabel(
  answer: string,
  actions?: readonly { id: string; label: string }[],
): string {
  return resolveAskChoice(answer, actions)?.label ?? answer;
}

export function resolveAskChoice(
  answer: string,
  actions?: readonly { id: string; label: string }[],
): { id: string; label: string } | undefined {
  if (!actions?.length) return undefined;
  const trimmed = answer.trim();
  if (!trimmed) return undefined;
  const byId = actions.find((action) => action.id === trimmed);
  if (byId) return byId;
  const lower = trimmed.toLowerCase();
  return actions.find((action) => action.label.trim().toLowerCase() === lower);
}

/**
 * Answers the server stores on an approval card it closed itself, so no later click can approve it:
 * a newer request for the same delegated work replaced it, its run failed or expired before it was
 * answered, or the user stopped the run.
 */
export const CLOSED_APPROVAL_ANSWERS = ["superseded", "expired", "stopped"] as const;
export type ClosedApprovalAnswer = (typeof CLOSED_APPROVAL_ANSWERS)[number];

export function isClosedApprovalAnswer(answer: string | undefined): answer is ClosedApprovalAnswer {
  return CLOSED_APPROVAL_ANSWERS.includes(answer as ClosedApprovalAnswer);
}

/**
 * The answer on an approval card the owner moved past by sending a message. It records a decline,
 * never an approval: nothing ran and no rule was saved.
 */
export const SKIPPED_APPROVAL_ANSWER = "skipped";

/** The tool result the agent gets for a skipped approval; the effect keeps it as its denial note. */
export const SKIPPED_APPROVAL_NOTE =
  "The owner moved on without approving this, so it was skipped and nothing was sent or changed. Do not retry it in this run. If it is still needed, ask the owner whether to try again.";

/** Marks every unanswered approval card in `blocks` as closed; other blocks are returned as given. */
export function closeApprovalAsks<
  T extends { kind: string; status?: string; answer?: string; approvalEffectId?: string },
>(blocks: readonly T[], answer: ClosedApprovalAnswer | typeof SKIPPED_APPROVAL_ANSWER): T[] {
  return blocks.map((block) =>
    block.kind === "ask" && block.approvalEffectId && block.status !== "answered"
      ? { ...block, status: "answered", answer }
      : block,
  );
}
