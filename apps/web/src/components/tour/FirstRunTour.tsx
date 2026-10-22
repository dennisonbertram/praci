import { useLingui } from "@lingui/react/macro";
import type { Me } from "@rakazo/contracts";
import { useCallback, useMemo } from "react";
import { rpc } from "../../lib/rpc";
import type { TourStep } from "./TourPopover";
import { TourPopover } from "./TourPopover";

/**
 * The first-run tour. It runs when `open` is true; finishing or skipping it records `tourSeen`
 * for the user on the server, so it does not return on another device.
 */
export function FirstRunTour({
  open,
  onClose,
  onAsk,
  onSkip,
  userId,
}: {
  userId?: string | null;
  open: boolean;
  /** The last step's "Ask Chief": finishes the tour, opens Chief and sends a sample question. */
  onAsk: () => void;
  /** Skip tour or Escape: the shell keeps a one-tap "Ask Chief" in the composer. */
  onSkip?: () => void;
  /** Called as soon as the tour ends; `byEscape` when the Escape key ended it. */
  onClose: (me: Me | null, byEscape?: boolean) => void;
}) {
  const { t } = useLingui();
  // Top to bottom, in the order the sidebar shows them. Each line says what Maya can do there.
  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "search",
        name: t`Search`,
        anchor: '[data-tour="sidebar-search"]',
        text: t`Find any page, chat or email.`,
      },
      {
        id: "create",
        name: t`Create`,
        anchor: '[data-tour="create-menu"]',
        text: t`Press + to create a bot or a group chat.`,
      },
      {
        id: "inbox",
        name: t`Inbox`,
        anchor: '[data-tour="sidebar-inbox"]',
        text: t`Read your mail sorted by what needs you, and send replies you approve.`,
      },
      {
        id: "finance",
        name: t`Finance`,
        anchor: '[data-tour="sidebar-finance"]',
        text: t`See your cash, burn and runway, pulled from your bank.`,
      },
      {
        id: "legal",
        name: t`Legal`,
        anchor: '[data-tour="sidebar-legal"]',
        text: t`Keep your contracts here and see which are due soon.`,
      },
      {
        id: "files",
        name: t`Data room`,
        anchor: '[data-tour="sidebar-data-room"]',
        text: t`Upload files for bots to use.`,
      },
      {
        id: "chat",
        name: t`Chief`,
        anchor: '[data-tour="sidebar-chat"]',
        text: t`Ask Chief anything.`,
      },
      {
        id: "apps",
        name: t`Integrations`,
        anchor: '[data-tour="sidebar-integrations"]',
        text: t`See what bots can reach and add more.`,
      },
      {
        id: "account",
        name: t`Account`,
        anchor: '[data-tour="user-menu"]',
        text: t`Change settings, export your data or retake this tour from here.`,
      },
    ],
    [t],
  );
  const finish = useCallback(
    (result: "done" | "skip" | "empty", byEscape?: boolean) => {
      // With nothing to point at (the page has not loaded) nothing is recorded, so it can run later.
      if (result === "empty") return onClose(null);
      // Close at once; the save runs behind it so the popover never lingers on the next page.
      rpc.preferences.update({ tourSeen: true }).catch(() => undefined);
      if (result === "skip") onSkip?.();
      onClose(null, byEscape);
    },
    [onClose, onSkip],
  );
  if (!open) return null;
  return (
    <TourPopover
      userId={userId}
      steps={steps}
      onFinish={finish}
      lastAction={{ label: t`Ask Chief`, run: onAsk }}
    />
  );
}
