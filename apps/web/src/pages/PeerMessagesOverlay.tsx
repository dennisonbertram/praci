import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { ThreadMessage } from "@rakazo/contracts";
import { BotAvatar, Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { useEffect, useMemo, useState } from "react";
import { loadPeerHistory } from "../lib/peer-history";
import { peerConversations } from "../lib/peer-messages";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";

/**
 * Full-screen view-only transcript of a bot-to-bot exchange.
 * Opened from a Messaged / Message from chip in the human thread.
 */
export function PeerMessagesOverlay({
  botId,
  botName,
  botColor,
  peerBotId,
  peerBotName: initialPeerBotName,
  peerBotColor,
  onClose,
}: {
  botId: string;
  botName: string;
  botColor: string;
  peerBotId: string;
  peerBotName: string;
  peerBotColor: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [messages, setMessages] = useState<readonly ThreadMessage[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [olderFailed, setOlderFailed] = useState(false);
  const [resumeBefore, setResumeBefore] = useState<number | undefined>();
  // Where an older-page retry resumes, for the agent it was taken from only.
  const [retryBefore, setRetryBefore] = useState<{ botId: string; before: number } | undefined>();
  const [reloadKey, setReloadKey] = useState(0);
  const conversation = useMemo(() => {
    if (!historyReady) return null;
    return peerConversations(messages).find((entry) => entry.peerBotId === peerBotId) ?? null;
  }, [historyReady, messages, peerBotId]);
  const peerBotName = conversation?.peerBotName ?? initialPeerBotName;

  useEffect(() => {
    const abort = new AbortController();
    const startingBefore = retryBefore?.botId === botId ? retryBefore.before : undefined;
    let loadedPage = false;
    let nextBefore = startingBefore;
    if (startingBefore === undefined) {
      setHistoryReady(false);
      setHistoryFailed(false);
      setOlderFailed(false);
      setResumeBefore(undefined);
      setMessages([]);
    } else {
      setOlderFailed(false);
    }
    void loadPeerHistory({
      signal: abort.signal,
      before: startingBefore,
      loadPage: (before, signal) =>
        rpc.threads.messages({ botId, before, includePeerRuns: true }, { signal }),
      onPage: (page) => {
        if (abort.signal.aborted) return;
        loadedPage = true;
        nextBefore = page.olderCursor ?? undefined;
        setResumeBefore(nextBefore);
        setMessages((current) => {
          const existing = new Set(current.map(({ id }) => id));
          return [...page.messages.filter(({ id }) => !existing.has(id)), ...current];
        });
        setHistoryReady(true);
      },
    }).catch(() => {
      if (abort.signal.aborted) return;
      if (!loadedPage && startingBefore === undefined) {
        setHistoryFailed(true);
        setHistoryReady(true);
      } else if (nextBefore !== undefined) {
        setResumeBefore(nextBefore);
        setOlderFailed(true);
      }
    });
    return () => {
      abort.abort();
    };
  }, [botId, reloadKey]);

  const retryOlderMessages = () => {
    if (resumeBefore !== undefined) setRetryBefore({ botId, before: resumeBefore });
    setReloadKey((value) => value + 1);
  };
  const title = `${botName} · ${peerBotName}`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        data-testid="peer-conversation-view"
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 text-foreground ring-0 sm:max-w-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-sidebar-border px-[18px] py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex items-center -space-x-2">
              <BotAvatar color={botColor} identity={botId} size={28} />
              <BotAvatar color={peerBotColor} identity={peerBotId} size={28} />
            </div>
            <DialogTitle className="truncate text-[15.5px] font-medium text-foreground" dir="auto">
              {title}
            </DialogTitle>
          </div>
          <DialogClose aria-label={t`Close`} render={<Button variant="ghost" size="sm" />}>
            <Trans>Close</Trans>
          </DialogClose>
        </div>

        {!historyReady ? (
          <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
            <Trans>Loading…</Trans>
          </div>
        ) : historyFailed ? (
          <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
            <div className="flex flex-col items-center gap-3">
              <Trans>Could not load this chat.</Trans>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRetryBefore(undefined);
                  setReloadKey((value) => value + 1);
                }}
              >
                <Trans>Retry now</Trans>
              </Button>
            </div>
          </div>
        ) : !conversation || conversation.messages.length === 0 ? (
          olderFailed ? (
            <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
              <div className="flex flex-col items-center gap-3">
                <Trans>Could not load this chat.</Trans>
                <Button variant="outline" size="sm" onClick={retryOlderMessages}>
                  <Trans>Retry now</Trans>
                </Button>
              </div>
            </div>
          ) : resumeBefore !== undefined ? (
            <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
              <Trans>Loading…</Trans>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
              <Trans>No messages with {peerBotName} yet.</Trans>
            </div>
          )
        ) : (
          <div
            data-testid="peer-conversation-transcript"
            className="rk-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5 md:px-7 md:py-6"
          >
            {/* Older messages load at the top, so their failure shows there too. */}
            {olderFailed && (
              <div className="flex items-center justify-center gap-2 py-2 text-[12px] text-muted-foreground/80">
                <Trans>Could not load older messages</Trans>
                <Button variant="ghost" size="sm" onClick={retryOlderMessages}>
                  <Trans>Retry now</Trans>
                </Button>
              </div>
            )}
            {conversation.messages.map((peerMessage, index) => {
              const sent = peerMessage.direction === "sent";
              return (
                <div
                  key={`${peerMessage.messageId}-${index}`}
                  className={`flex ${sent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      sent ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    <div className="mb-1 text-[12px] text-muted-foreground/70" dir="auto">
                      {sent ? botName : peerBotName}
                    </div>
                    <div className="text-[14.5px] leading-[1.5] text-foreground/90" dir="auto">
                      <ChatMarkdown>{peerMessage.text}</ChatMarkdown>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground/70" dir="auto">
                      {formatRelativeTime(peerMessage.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-sidebar-border px-[18px] py-3.5">
          <p className="text-[13.5px] text-muted-foreground/80">
            <Trans>This chat is view-only</Trans>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
