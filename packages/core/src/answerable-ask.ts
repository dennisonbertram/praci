type AskSnapshot = {
  messages: readonly {
    id: string;
    runId?: string | null;
    blocks: readonly { kind: string; status?: string }[];
  }[];
  run?: { id: string; status: string } | null;
  activeRuns?: readonly { id: string; status: string }[];
};

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
 * a newer request for the same delegated work replaced it, or its run failed before it was answered.
 */
export const CLOSED_APPROVAL_ANSWERS = ["superseded", "expired"] as const;
export type ClosedApprovalAnswer = (typeof CLOSED_APPROVAL_ANSWERS)[number];

export function isClosedApprovalAnswer(answer: string | undefined): answer is ClosedApprovalAnswer {
  return CLOSED_APPROVAL_ANSWERS.includes(answer as ClosedApprovalAnswer);
}

/** Marks every unanswered approval card in `blocks` as closed; other blocks are returned as given. */
export function closeApprovalAsks<
  T extends { kind: string; status?: string; answer?: string; approvalEffectId?: string },
>(blocks: readonly T[], answer: ClosedApprovalAnswer): T[] {
  return blocks.map((block) =>
    block.kind === "ask" && block.approvalEffectId && block.status !== "answered"
      ? { ...block, status: "answered", answer }
      : block,
  );
}
