import { useLingui } from "@lingui/react/macro";
import type { Me, ThreadSnapshot } from "@rakazo/contracts";
import { useCallback, useMemo } from "react";
import { rpc } from "../../lib/rpc";
import type { TourStep } from "./TourPopover";
import { TourPopover } from "./TourPopover";

/** True while a Connect card waits for an answer: still pending, and the user has not written since. */
export function connectCardsOpen(messages: ThreadSnapshot["messages"]) {
  const lastUser = messages.findLastIndex((message) => message.role === "user");
  return messages.some(
    (message, i) =>
      i > lastUser &&
      message.blocks.some((block) => block.kind === "app_connect" && block.status === "pending"),
  );
}

/**
 * The first-run tour. It runs when `open` is true; finishing or skipping it records `tourSeen`
 * for the user on the server, so it does not return on another device.
 */
export function FirstRunTour({
  open,
  onClose,
  onAsk,
}: {
  open: boolean;
  /** The last step's button: finishes the tour and focuses the composer on a sample question. */
  onAsk: () => void;
  /** Called as soon as the tour ends. */
  onClose: (me: Me | null) => void;
}) {
  const { t } = useLingui();
  // Top to bottom, in the order the sidebar shows them. Each line says what Maya can do there.
  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "search",
        anchor: '[data-tour="sidebar-search"]',
        text: t`Type here to find any chat, file or email.`,
      },
      {
        id: "create",
        anchor: '[data-tour="create-menu"]',
        text: t`Press + to create an agent or a group chat.`,
      },
      {
        id: "inbox",
        anchor: '[data-tour="sidebar-inbox"]',
        text: t`Read your mail sorted by what needs you, and send replies you approve.`,
      },
      {
        id: "finance",
        anchor: '[data-tour="sidebar-finance"]',
        text: t`See your cash, burn and runway, pulled from your bank.`,
      },
      {
        id: "legal",
        anchor: '[data-tour="sidebar-legal"]',
        text: t`Keep contracts here, and see who owns what in Cap table.`,
      },
      {
        id: "files",
        anchor: '[data-tour="sidebar-data-room"]',
        text: t`Upload files for agents to use. Artifacts holds what agents make.`,
      },
      {
        id: "chat",
        anchor: '[data-tour="sidebar-chat"]',
        text: t`Ask Chief anything. Agents ask before they send, pay or change anything.`,
      },
      {
        id: "apps",
        anchor: '[data-tour="sidebar-integrations"]',
        text: t`Connect Gmail, Calendar and other apps so agents can read your mail and files.`,
      },
      {
        id: "account",
        anchor: '[data-tour="user-menu"]',
        text: t`Change settings, export your data or retake this tour from here.`,
      },
    ],
    [t],
  );
  const finish = useCallback(
    (result: "done" | "skip" | "empty") => {
      // With nothing to point at (the page has not loaded) nothing is recorded, so it can run later.
      if (result === "empty") return onClose(null);
      // Close at once; the save runs behind it so the popover never lingers on the next page.
      rpc.preferences.update({ tourSeen: true }).catch(() => undefined);
      onClose(null);
    },
    [onClose],
  );
  if (!open) return null;
  return (
    <TourPopover steps={steps} onFinish={finish} doneLabel={t`Ask a question`} onDone={onAsk} />
  );
}
