import { useLingui } from "@lingui/react/macro";
import type { Bot, ThreadSnapshot } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import { BotAvatar, Button } from "@rakazo/ui-web";
import { PanelRightClose } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { Composer } from "../../pages/shell/composer";
import { Transcript } from "../../pages/shell/transcript";

const noop = () => undefined;
const asyncNoop = async () => {};
const POLL_MS = 2_500;

/**
 * An email's own agent, docked inside the message dialog. It is the Shell's page-agent panel (header,
 * Transcript, Composer) for the thread agent that Ask agent finds or creates. Prototype: the thread is
 * read by polling while a run is active, not by the Shell's event subscription.
 */
export function EmailAgentPanel({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const { t } = useLingui();
  const [snapshot, setSnapshot] = useState<ThreadSnapshot | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentHere = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () => rpc.threads.get({ botId: bot.id }).then(setSnapshot, () => undefined),
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
  const artifactTarget = { botId: bot.id };
  return (
    <aside
      data-testid="email-agent-panel"
      aria-label={bot.name}
      className="flex h-full min-h-0 w-full flex-col border-s border-sidebar-border bg-background"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <BotAvatar color={bot.color} identity={bot.id} size={22} status={bot.status} />
          <span className="truncate text-sm font-medium" dir="auto">
            {bot.name}
          </span>
        </span>
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
            showToolActivity // the lookups are the point of this panel, so they show whatever the chat setting says
            olderCursor={snapshot.olderCursor}
            loadingOlder={false}
            answerableAskMessageId={null}
            running={running}
            workingBots={[]}
            onLoadOlder={asyncNoop}
            onOpenBot={noop}
            onAnswer={asyncNoop}
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
      <Composer
        draftKey={`bot:${bot.id}`}
        activeName={bot.name}
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
        onSend={async (text, _mentions, clientNonce) => {
          try {
            sentHere.current = true;
            await rpc.threads.send({
              botId: bot.id,
              clientNonce: clientNonce || newClientId(),
              text,
            });
            await load();
            return true;
          } catch (cause) {
            setSendError(cause instanceof Error ? cause.message : String(cause));
            return false;
          }
        }}
        onStop={async () => {
          await rpc.threads.stop({ botId: bot.id });
          await load();
        }}
        artifactTarget={artifactTarget}
      />
    </aside>
  );
}
