import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { ThreadMessage } from "@rakazo/contracts";
import { commandVariableName, connectorToolLabel, MEETING_MARK_REASON } from "@rakazo/contracts";
import {
  formatMessageTime,
  isApprovalAskBlock,
  isClosedApprovalAnswer,
  isSecretAskBlock,
  resolveAskChoice,
  SKIPPED_APPROVAL_ANSWER,
} from "@rakazo/core";
import { Button, Input } from "@rakazo/ui-web";
import { Check, ChevronDown, KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { errorText } from "../lib/user-error";
import { useBotToolControls } from "./BotToolControls";
import { SecretRequestDialog } from "./SecretRequestDialog";

export type AskBlock = Extract<ThreadMessage["blocks"][number], { kind: "ask" }>;

function formatAnsweredState(
  answer: string | undefined,
  approval: boolean,
  secret: boolean,
  outcome?: "created" | "cancelled",
  actions?: AskBlock["actions"],
  consent?: boolean,
  share?: boolean,
  waitsFor?: string,
): string {
  if (secret) return t`Saved`;
  if (!answer) return t`Answered`;
  // A card the server closed itself reads the same whatever kind of approval it was.
  if (approval && answer === "superseded") return t`Replaced by a newer request`;
  if (approval && answer === "expired") return t`Expired`;
  if (approval && answer === SKIPPED_APPROVAL_ANSWER) return t`Skipped`;
  if (share && approval) return answer === "allow" ? t`Shared` : t`Not shared`;
  if (consent && approval) return answer === "allow" ? t`Allowed` : t`Not now`;
  // A typed answer is already the user's own bubble; only a chosen option is named here.
  if (!approval) {
    const choice = resolveAskChoice(answer, actions);
    return choice ? t`Answered: ${choice.label}` : t`Answered`;
  }
  if (answer === "stopped") return t`Stopped`;
  if (outcome === "created") return t`Created`;
  if (outcome === "cancelled") return t`Cancelled`;
  if (answer === "allow") return waitsFor ? t`Approved here. Waiting for ${waitsFor}` : t`Approved`;
  if (answer === "always") return t`Always allowed`;
  if (answer === "always_bot_sites") return t`Allowed for all sites`;
  if (answer === "always_routine") return t`Always allowed for this routine`;
  if (answer === "deny") return t`Denied`;
  return t`Answered: ${answer}`;
}

/** Success green is for completed actions; an approval answer only records the choice. */
function answeredTone(
  answer: string | undefined,
  approval: boolean,
  secret: boolean,
  outcome?: "created" | "cancelled",
): { className: string; Icon?: typeof Check } {
  if (secret || outcome === "created") return { className: "text-success" };
  if (
    !approval ||
    outcome === "cancelled" ||
    isClosedApprovalAnswer(answer) ||
    answer === SKIPPED_APPROVAL_ANSWER
  )
    return { className: "text-muted-foreground" };
  if (answer === "deny") return { className: "text-destructive", Icon: X };
  if (
    answer === "allow" ||
    answer === "always" ||
    answer === "always_bot_sites" ||
    answer === "always_routine"
  )
    return { className: "text-foreground", Icon: Check };
  return { className: "text-muted-foreground" };
}

/** Answers that save a standing permission; shown as quiet links under the one-off answers. */
/** The server's label for Always on a request_access card. */
const ACCESS_ALWAYS_LABEL = "Always for this agent";
/** Answers that leave a rule Settings > Privacy and approvals can remove. */
const STANDING_ANSWERS = new Set(["always", "always_routine", "always_bot_sites"]);

const STANDING_ACTIONS: ReadonlySet<string> = new Set([
  "always",
  "always_bot_sites",
  "always_routine",
]);

function approvalActionLabel(
  id: string,
  fallback: string,
  outcome?: "created" | "cancelled",
  consent?: boolean,
  share?: boolean,
  site?: string,
): string {
  if (share && id === "allow") return t`Share`;
  if (share && id === "deny") return t`Don't share`;
  if (consent && id === "allow") return t`Allow`;
  if (consent && id === "deny") return t`Not now`;
  if (outcome === "created") return t`Create space`;
  if (outcome === "cancelled") return t`Cancel`;
  // A payment's label already carries the amount ("Send $300.00"): keep it.
  if (id === "allow" && fallback === "Allow for this run") return t`Allow for this run`;
  if (id === "allow")
    return fallback.startsWith("Send ") ? maskCurrencyWhenHidden(fallback) : t`Allow once`;
  // A request-access card's Always changes one agent's settings, not a space-wide rule.
  if (id === "always" && fallback === ACCESS_ALWAYS_LABEL) return t`Always for this agent`;
  if (id === "always") return site ? t`Always allow ${site}` : t`Always allow this`;
  if (id === "deny") return t`Deny`;
  if (id === "always_routine") return t`Always for this routine`;
  if (id === "always_bot_sites" && fallback === "Allow all sites for this agent")
    return t`Allow all sites for this agent`;
  return fallback;
}

function secretFieldLabel(purpose: AskBlock["purpose"]): string {
  if (purpose === "password") return t`Password`;
  if (purpose === "api_key") return t`API key`;
  return t`Code`;
}

/** When a card here was last answered; the next card to appear soon after may land under the pointer. */
let lastAnsweredAt = 0;
const RECENT_ANSWER_MS = 30_000;
const SETTLE_MS = 1000;

export function AskCard({
  block,
  canAnswer,
  ownerOnly = false,
  requestedAt,
  onAnswer,
}: {
  block: AskBlock;
  canAnswer: boolean;
  /** A login or credential is saved for the run's user, so others see the card without fields. */
  ownerOnly?: boolean;
  /** When the card was posted, shown beside its result so similar cards can be told apart. */
  requestedAt?: string;
  onAnswer: (text: string, username?: string) => Promise<void>;
}) {
  const { t } = useLingui();
  // Re-render when Hide amounts changes: a payment button carries its amount.
  useHideAmounts();
  const botToolControls = useBotToolControls();
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolIdOpen, setToolIdOpen] = useState(false);
  const questionId = useId();
  const toolIdPanel = useId();
  const answeredHere = useRef(false);
  // A card that replaces one just answered keeps its buttons off for a second, so a second click
  // meant for the old card cannot approve the new one.
  const [settling, setSettling] = useState(
    () => block.status !== "answered" && Date.now() - lastAnsweredAt < RECENT_ANSWER_MS,
  );
  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [settling]);
  const submitting = pendingAction !== null;
  const approvalActions = isApprovalAskBlock(block) ? block.actions : undefined;
  const askActions = block.actions;
  const secretInput = isSecretAskBlock(block);
  const loginInput = secretInput && block.credential?.auth.type === "login";
  const secretLabel = loginInput ? t`Password` : secretFieldLabel(block.purpose);
  const secretName = block.credential
    ? block.credential.auth.type === "command"
      ? commandVariableName(block.credential.name)
      : block.credential.name
    : secretLabel;

  // The answer lands in the thread a moment after the click, and the re-render can drop focus to
  // the page. Put it back on the composer, but only for a card this reader just answered.
  useEffect(() => {
    if (block.status !== "answered" || !answeredHere.current) return;
    answeredHere.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>("[data-composer-input]")?.focus();
  }, [block.status]);

  async function submitAnswer(value: string, secretUsername?: string) {
    if (submitting) return;
    if (secretInput ? value.length === 0 : !value.trim()) return;
    const submitUsername = loginInput ? secretUsername?.trim() : undefined;
    if (loginInput && !submitUsername) return;
    const submitValue = secretInput ? value : value.trim();
    setPendingAction(secretInput ? "submit" : submitValue);
    setError(null);
    if (secretInput) {
      setDialogOpen(false);
    }
    try {
      await onAnswer(submitValue, submitUsername);
      lastAnsweredAt = Date.now();
      answeredHere.current = true;
      // The card's buttons vanish with the answer; keep the keyboard in the conversation.
      if (!secretInput) document.querySelector<HTMLElement>("[data-composer-input]")?.focus();
    } catch (err) {
      // A secret answer's failure may echo the secret, so never show its message.
      setError(
        secretInput
          ? t`Could not submit this answer`
          : errorText(err, t`Could not submit this answer`),
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset brings its own border and sizing to a card
    <div
      role="group"
      aria-labelledby={questionId}
      data-testid={secretInput ? "secret-ask-card" : undefined}
      className="w-160 max-w-full rounded-2xl border border-border bg-card px-5 py-4"
    >
      {secretInput && block.status !== "answered" && canAnswer ? (
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          <KeyRound aria-hidden className="size-4 text-muted-foreground" />
          <span>
            <Trans>Credentials requested:</Trans> <span className="font-mono">{secretName}</span>
          </span>
        </div>
      ) : null}
      <div id={questionId} className="text-[15.5px] leading-[1.5] text-foreground">
        <ChatMarkdown>{block.text}</ChatMarkdown>
      </div>
      {block.toolId ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2">
          <button
            type="button"
            aria-expanded={toolIdOpen}
            aria-controls={toolIdPanel}
            className="inline-flex items-center gap-1 rounded text-[13px] text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
            onClick={() => setToolIdOpen((open) => !open)}
          >
            {connectorToolLabel(block.toolId)}
            <ChevronDown
              aria-hidden
              className={`size-4 transition-transform ${toolIdOpen ? "rotate-180" : ""}`}
            />
          </button>
          {toolIdOpen ? (
            <code
              id={toolIdPanel}
              className="break-all font-mono text-[12.5px] text-muted-foreground"
            >
              {block.toolId}
            </code>
          ) : null}
        </div>
      ) : null}
      {secretInput && block.credential ? (
        <div
          data-testid="secret-ask-destination"
          className="mt-2 break-all text-[13px] text-muted-foreground"
        >
          {block.credential.auth.type === "command"
            ? `${t`Command variable`} · $${commandVariableName(block.credential.name)}`
            : block.credential.origin}
        </div>
      ) : null}
      {secretInput && block.credential?.auth.type === "command" ? (
        <p className="mt-1 text-[12px] text-muted-foreground">
          <Trans>The bot can read this value.</Trans>
        </p>
      ) : null}
      {block.detail && block.consent ? (
        <details className="mt-2 text-[13px] text-muted-foreground">
          <summary className="w-fit cursor-pointer">
            <Trans>Details</Trans>
          </summary>
          <p className="mt-1">{block.detail}</p>
        </details>
      ) : block.detail && !secretInput && block.detailFolded ? (
        <details key={block.status} className="mt-3 text-[13px] text-muted-foreground">
          <summary className="w-fit cursor-pointer">
            <Trans>Details</Trans>
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted px-3.5 py-3 font-mono text-[12.5px] leading-[1.7]">
            {block.detail.trim()}
          </pre>
        </details>
      ) : block.detail && !secretInput ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-muted-foreground">
          {block.detail.trim()}
        </p>
      ) : null}
      {block.approvalReason ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {block.approvalReason}
          {block.approvalReason === MEETING_MARK_REASON &&
          block.status !== "answered" &&
          canAnswer &&
          botToolControls?.clearConversation ? (
            <>
              {" "}
              <Button
                variant="link"
                className="h-auto p-0 text-[13px]"
                onClick={() => botToolControls.clearConversation?.()}
              >
                <Trans>Clear conversation</Trans>
              </Button>
            </>
          ) : null}
        </p>
      ) : null}
      {block.status === "answered" ? (
        (() => {
          const outcome = approvalActions?.find((action) => action.id === block.answer)?.outcome;
          const { className, Icon } = answeredTone(
            block.answer,
            Boolean(approvalActions),
            secretInput,
            outcome,
          );
          return (
            <div
              className={`mt-3.5 flex items-center gap-1.5 text-[13.5px] font-medium ${className}`}
            >
              {Icon ? <Icon aria-hidden className="size-4" /> : null}
              {formatAnsweredState(
                block.answer,
                Boolean(approvalActions),
                secretInput,
                outcome,
                askActions,
                Boolean(block.consent || block.pageSource),
                Boolean(block.share),
                block.waitsFor,
              )}
              {approvalActions &&
              STANDING_ANSWERS.has(block.answer ?? "") &&
              !approvalActions.some((action) => action.label === ACCESS_ALWAYS_LABEL) &&
              botToolControls?.openApprovalSettings ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-[13px] font-normal text-muted-foreground"
                  onClick={() => botToolControls.openApprovalSettings?.()}
                >
                  <Trans>Change</Trans>
                </Button>
              ) : null}
              {requestedAt && approvalActions ? (
                <time
                  dateTime={requestedAt}
                  className="ms-auto shrink-0 whitespace-nowrap font-normal text-muted-foreground"
                >
                  {formatMessageTime(requestedAt, i18n.locale || "en")}
                </time>
              ) : null}
            </div>
          );
        })()
      ) : !canAnswer ? (
        <div className="mt-3.5 text-[13.5px] font-medium text-muted-foreground">
          <Trans>No longer active</Trans>
        </div>
      ) : ownerOnly && secretInput && block.credential ? null : askActions?.length ? (
        <div className="mt-3.5 space-y-1.5">
          {[...askActions]
            .sort(
              (a, b) =>
                Number(approvalActions && STANDING_ACTIONS.has(a.id)) -
                Number(approvalActions && STANDING_ACTIONS.has(b.id)),
            )
            .map((action) =>
              // A standing permission is a quiet text action under the one-off answers.
              approvalActions && STANDING_ACTIONS.has(action.id) ? (
                <div key={action.id} className="flex flex-wrap items-baseline gap-x-2 px-1 pt-1">
                  <Button
                    variant="link"
                    className="h-auto min-w-0 shrink whitespace-normal p-0 text-start underline"
                    disabled={submitting || settling}
                    onClick={() => void submitAnswer(action.id)}
                  >
                    {pendingAction === action.id ? (
                      <Trans>Sending…</Trans>
                    ) : (
                      approvalActionLabel(
                        action.id,
                        action.label,
                        undefined,
                        undefined,
                        undefined,
                        block.site,
                      )
                    )}
                  </Button>
                  {action.id === "always" && action.label !== ACCESS_ALWAYS_LABEL ? (
                    <span className="text-[13px] text-muted-foreground">
                      <Trans>Won't ask again anywhere in this space.</Trans>
                    </span>
                  ) : null}
                </div>
              ) : (
                <Button
                  key={action.id}
                  variant={approvalActions && action.id === "allow" ? "default" : "outline"}
                  className="h-auto w-full justify-start whitespace-normal px-3.5 py-3 text-start font-normal"
                  disabled={submitting || settling}
                  onClick={() => void submitAnswer(action.id)}
                >
                  {pendingAction === action.id ? (
                    <Trans>Sending…</Trans>
                  ) : approvalActions ? (
                    approvalActionLabel(
                      action.id,
                      action.label,
                      action.outcome,
                      Boolean(block.consent || block.pageSource),
                      Boolean(block.share),
                      block.site,
                    )
                  ) : (
                    action.label
                  )}
                </Button>
              ),
            )}
        </div>
      ) : secretInput ? (
        <div className="mt-3.5 border-t border-border pt-3.5">
          <Button disabled={submitting || settling} onClick={() => setDialogOpen(true)}>
            {submitting ? <Trans>Saving…</Trans> : <Trans>Provide secret</Trans>}
          </Button>
          <SecretRequestDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            name={secretName}
            description={block.text}
            login={loginInput}
            onSubmit={(value, user) => {
              void submitAnswer(value, user);
            }}
          />
        </div>
      ) : editing ? (
        <form
          className="mt-3.5 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer(answer);
          }}
        >
          <Input
            aria-label={t`Answer`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={t`Type your answer`}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!answer.trim() || submitting}>
              {submitting ? <Trans>Sending…</Trans> : <Trans>Send answer</Trans>}
            </Button>
            <Button
              variant="outline"
              disabled={submitting || settling}
              onClick={() => {
                setAnswer("");
                setEditing(false);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3.5 flex gap-2">
          <Button disabled={submitting || settling} onClick={() => void submitAnswer("approved")}>
            {submitting ? <Trans>Sending…</Trans> : <Trans>Send it</Trans>}
          </Button>
          <Button
            variant="outline"
            disabled={submitting || settling}
            onClick={() => setEditing(true)}
          >
            <Trans>Edit first</Trans>
          </Button>
        </div>
      )}
      {error && block.status !== "answered" && canAnswer ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
