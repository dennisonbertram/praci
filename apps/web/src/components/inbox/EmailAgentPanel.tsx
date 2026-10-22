import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, ThreadMessage, ThreadSnapshot } from "@rakazo/contracts";
import { latestAnswerableAskMessageId, newClientId } from "@rakazo/core";
import { BotAvatar, Button } from "@rakazo/ui-web";
import { PanelRightClose } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { Composer } from "../../pages/shell/composer";
import { Transcript } from "../../pages/shell/transcript";

const noop = () => undefined;
const asyncNoop = async () => {};
const POLL_MS = 2_500;

/**
 * The reply the agent proposed: the body of its newest mail card that is still waiting for the
 * owner. The agent writes replies with mail_send, so the card is its draft; nothing is sent until
 * the owner approves it or sends from the composer.
 */
export function latestPendingDraft(messages: readonly ThreadMessage[]): string | undefined {
  for (const message of [...messages].reverse()) {
    for (const block of [...message.blocks].reverse()) {
      if (
        block.kind === "ask" &&
        block.mail?.tool === "mail_send" &&
        block.mail.reply &&
        block.status !== "answered" &&
        !block.mail.outcome
      )
        return block.mail.body;
    }
  }
  return undefined;
}

const DRAFT_REQUEST = "Draft a reply";
const asksForDraft = (text: string) =>
  /\b(draft|write)\b.*\breply\b/i.test(text) && !/\b(don'?t|do not|no)\b.*\breply\b/i.test(text);

/**
 * A message the owner wrote. Agent-to-agent deliveries also carry role "user", and the seeded email
 * context card is a system message, so both are excluded.
 */
const isOwnerMessage = (message: ThreadMessage) =>
  message.role === "user" &&
  !message.blocks.some((b) =>
    ["bot_message_received", "channel_message", "handoff"].includes(b.kind),
  );

/**
 * The text of the agent's first plain-text answer after the owner's latest request, when that
 * request asks to draft or write a reply. It is for a model that writes the draft as text instead
 * of proposing a mail_send card. Later agent messages do not move it; questions and other
 * requests have none.
 */
export function latestTextDraft(messages: readonly ThreadMessage[]): string | undefined {
  const at = messages.findLastIndex(isOwnerMessage);
  if (at < 0 || !asksForDraft(textOf(messages[at] as ThreadMessage))) return undefined;
  for (const message of messages.slice(at + 1)) {
    const answer = message.role === "bot" ? textOf(message) : "";
    // A question is the agent asking for more, not a draft.
    if (answer && !answer.endsWith("?")) return answer.replace(/^draft( reply)?:\s*/i, "");
  }
  return undefined;
}

const textOf = (message: ThreadMessage) =>
  message.blocks
    .flatMap((block) => (block.kind === "text" ? [block.text] : []))
    .join("\n\n")
    .trim();

/**
 * An email's own agent, docked inside the message dialog. It is the Shell's page-agent panel (header,
 * Transcript, Composer) for the thread agent that Ask agent finds or creates. The thread is read by
 * polling while a run is active: the Shell's event subscription is part of its 6,800-line state
 * and is not separable, and the poll stops with the run and with the panel.
 */
export function EmailAgentPanel({
  bot,
  onClose,
  onReplyWithDraft,
}: {
  bot: Bot;
  onClose: () => void;
  /** Opens the Reply composer with the agent's draft as its text. */
  onReplyWithDraft: (draft: string) => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<ThreadSnapshot | null>(null);
  // True from a send until a fresh snapshot arrives: the draft button would offer an old answer.
  const [stale, setStale] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentHere = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () =>
      rpc.threads.get({ botId: bot.id }).then(
        (next) => {
          setSnapshot(next);
          setStale(false);
        },
        () => undefined,
      ),
    [bot.id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const running = Boolean(
    snapshot?.run && ["running", "queued", "leased"].includes(snapshot.run.status),
  );
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  // Show the newest answer from its start, on opening and when a run ends. The Transcript follows
  // the tail of a chat, which would hide the top of a long answer, so this moves the view once the
  // answer has been laid out.
  const lastBotId = [...(snapshot?.messages ?? [])].reverse().find((m) => m.role === "bot")?.id;
  const shown = useRef<{ id?: string; running: boolean }>({ running: false });
  useEffect(() => {
    if (!snapshot || running) {
      shown.current.running = running;
      return;
    }
    const wanted = lastBotId && (shown.current.id !== lastBotId || shown.current.running);
    shown.current = { id: lastBotId, running: false };
    if (!wanted) return;
    // No cleanup: a later snapshot must not cancel the move, and the callback checks the refs. It
    // runs twice because a slow layout can finish after the first.
    for (const delay of [300, 1_200]) {
      window.setTimeout(() => {
        const scroller = scrollRef.current;
        const row = scroller?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(lastBotId)}"]`,
        );
        if (!scroller || !row) return;
        const gap = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += gap - 8;
      }, delay);
    }
  }, [snapshot, running, lastBotId]);

  const draft =
    latestPendingDraft(snapshot?.messages ?? []) ?? latestTextDraft(snapshot?.messages ?? []);
  const send = async (text: string, clientNonce?: string) => {
    setStale(true);
    setSending(true);
    try {
      sentHere.current = true;
      await rpc.threads.send({ botId: bot.id, clientNonce: clientNonce || newClientId(), text });
      await load();
      return true;
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setSending(false);
    }
  };
  const artifactTarget = { botId: bot.id };
  return (
    <aside
      data-testid="email-agent-panel"
      aria-label={t`Email agent`}
      className="flex h-full min-h-0 w-full flex-col border-s border-sidebar-border bg-background"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          aria-label={t`Open email agent full screen`}
          title={t`Open full screen`}
          onClick={() => navigate(`/app/${bot.id}`)}
          className="-mx-1.5 flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
        >
          <BotAvatar color={bot.color} identity={bot.id} size={22} status={bot.status} />
          <span className="truncate text-sm font-medium" dir="auto">
            <Trans>Email agent</Trans>
          </span>
        </button>
        <Button variant="ghost" size="icon-sm" aria-label={t`Close agent`} onClick={onClose}>
          <PanelRightClose aria-hidden="true" />
        </Button>
      </div>
      {snapshot ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Transcript
            scrollRef={scrollRef}
            sentHere={sentHere}
            scrollRequest={null}
            onScrollRequestHandled={noop}
            artifactTarget={artifactTarget}
            messages={snapshot.messages}
            // The lookups are the point of this panel, so they show whatever the chat setting says.
            showToolActivity
            olderCursor={snapshot.olderCursor}
            loadingOlder={false}
            answerableAskMessageId={latestAnswerableAskMessageId(snapshot)}
            running={running}
            workingBots={[]}
            onLoadOlder={asyncNoop}
            onOpenBot={noop}
            onAnswer={async (message, text, username, mail) => {
              await rpc.threads.answer({
                botId: bot.id,
                runId: message.runId ?? "",
                messageId: message.id,
                answer: text,
                ...(username ? { username } : {}),
                ...(mail ? { mail } : {}),
              });
              await load();
            }}
            onReply={noop}
            onQuote={noop}
            onReact={asyncNoop}
            onJumpToMessage={noop}
            onOpenPeerMessages={noop}
            peerBot={() => undefined}
            onRefresh={async () => void (await load())}
            onBotChanged={asyncNoop}
            onAddRoutine={noop}
            voiceReady={false}
            speakingMessageId={null}
            onSpeak={noop}
            onOpenComputer={noop}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}
      {snapshot && !snapshot.messages.some(isOwnerMessage) ? (
        <div className="shrink-0 px-7 pb-2">
          <Button
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => void send(DRAFT_REQUEST)}
          >
            <Trans>Draft a reply</Trans>
          </Button>
        </div>
      ) : null}
      {draft && !running && !stale ? (
        <div className="shrink-0 px-7 pb-2">
          <Button variant="outline" size="sm" onClick={() => onReplyWithDraft(draft)}>
            <Trans>Reply with draft</Trans>
          </Button>
        </div>
      ) : null}
      <Composer
        draftKey={`bot:${bot.id}`}
        activeName={t`Email agent`}
        placeholder={t`Ask about this email`}
        running={running}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={sendError}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={noop}
        onDismissError={() => setSendError(null)}
        sending={false}
        fileInputRef={fileInputRef}
        onAttachmentPick={() => false}
        onRemoveAttachment={noop}
        onSend={(text, _mentions, clientNonce) => send(text, clientNonce)}
        onStop={async () => {
          await rpc.threads.stop({ botId: bot.id });
          await load();
        }}
        artifactTarget={artifactTarget}
      />
    </aside>
  );
}
