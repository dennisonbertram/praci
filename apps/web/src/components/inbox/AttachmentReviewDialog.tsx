import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import { Button, Dialog, DialogContent, DialogTitle, Input } from "@rakazo/ui-web";
import { SendHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { allowRecipient } from "../../lib/ai-consent";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";
import { LoadingState } from "../ai/primitives";

type Turn = { role: "user" | "assistant"; content: string };
type Status =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "failed" }
  | { kind: "consent"; recipient: { key: string; name: string } };

/**
 * A throwaway chat about one attachment. The turns live only in this component: the server keeps
 * nothing, so closing the dialog ends the chat. The first answer is the review; the box asks more.
 */
export function AttachmentReviewDialog({
  messageId,
  attachment,
  onClose,
}: {
  messageId: string;
  attachment: { id: string; filename: string };
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const retry = useRef<() => void>(() => {});
  const live = useRef(true);
  const started = useRef(false);

  const ask = (history: Turn[], question?: string) => {
    retry.current = () => ask(history, question);
    setPending(question ?? null);
    setStatus({ kind: "loading" });
    rpc.inbox.reviewAttachment({ messageId, attachmentId: attachment.id, question, history }).then(
      (result) => {
        if (!live.current) return;
        if (result.status === "ok") {
          setTurns([
            ...history,
            ...(question ? [{ role: "user" as const, content: question }] : []),
            { role: "assistant", content: result.answer },
          ]);
          setPending(null);
          setStatus({ kind: "idle" });
        } else if (result.status === "needs_consent") {
          setStatus({ kind: "consent", recipient: result.recipient });
        } else setStatus({ kind: "failed" });
      },
      () => live.current && setStatus({ kind: "failed" }),
    );
  };
  useEffect(() => {
    live.current = true;
    if (!started.current) {
      started.current = true;
      ask([]);
    }
    return () => {
      live.current = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the review starts once per dialog.
  }, [ask]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || status.kind === "loading") return;
    setDraft("");
    ask(turns, question);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-dvh max-h-none w-full max-w-none flex-col gap-3 rounded-none sm:max-w-none md:h-[85vh] md:w-[min(720px,94vw)] md:rounded-xl">
        <DialogTitle dir="auto" className="min-w-0 truncate pe-8 text-sm font-medium">
          {attachment.filename}
        </DialogTitle>
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-auto" aria-live="polite">
          {turns.map((turn, index) =>
            turn.role === "user" ? (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: turns only append
                key={index}
                dir="auto"
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
              >
                {turn.content}
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: turns only append
              <div key={index} dir="auto" className="text-sm">
                <ChatMarkdown>{turn.content}</ChatMarkdown>
              </div>
            ),
          )}
          {pending ? (
            <p
              dir="auto"
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
            >
              {pending}
            </p>
          ) : null}
          {status.kind === "loading" ? <LoadingState label={t`Reviewing`} /> : null}
          {status.kind === "consent" ? (
            <ConsentCard
              id="attachment-review-consent"
              heading={<Trans>Review with AI</Trans>}
              sends={<Trans>The file's text is sent to the AI model that runs your bots.</Trans>}
              onAllow={() => allowRecipient(status.recipient.key).then(() => retry.current())}
            />
          ) : null}
          {status.kind === "failed" ? (
            <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
              <Trans>Couldn't review this attachment.</Trans>
              <Button variant="outline" size="sm" onClick={() => retry.current()}>
                <Trans>Retry</Trans>
              </Button>
            </div>
          ) : null}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <Input
            value={draft}
            maxLength={2000}
            aria-label={t`Ask about this file`}
            placeholder={t`Ask about this file`}
            disabled={turns.length === 0}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t`Send`}
            disabled={!draft.trim() || status.kind === "loading"}
          >
            <SendHorizontal aria-hidden="true" className="rtl:-scale-x-100" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
