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
}: {
  open: boolean;
  /** Called once the tour ends, with the updated profile when the server saved it. */
  onClose: (me: Me | null) => void;
}) {
  const { t } = useLingui();
  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "chat",
        anchor: "[data-sidebar-group]",
        text: t`Chat with Chief here. Agents ask before they send, pay or change anything.`,
      },
      {
        id: "create",
        anchor: '[data-tour="create-menu"]',
        text: t`Create your own agent, group or space.`,
      },
      {
        id: "inbox",
        anchor: '[data-tour="sidebar-inbox"]',
        text: t`Inbox sorts your mail and drafts replies you approve.`,
      },
      {
        id: "finance",
        anchor: '[data-tour="sidebar-finance"]',
        text: t`Finance shows cash, burn and runway from your bank.`,
      },
      {
        id: "legal",
        anchor: '[data-tour="sidebar-legal"]',
        text: t`Legal and Cap table keep contracts and ownership in one place.`,
      },
      {
        id: "files",
        anchor: '[data-tour="sidebar-data-room"]',
        text: t`The Data room holds your files. Artifacts holds what agents make.`,
      },
      {
        id: "apps",
        anchor: '[data-tour="sidebar-integrations"]',
        text: t`Connect the apps you already use.`,
      },
      {
        id: "search",
        anchor: '[data-tour="sidebar-search"]',
        text: t`Search chats, files and mail.`,
      },
      {
        id: "account",
        anchor: '[data-tour="user-menu"]',
        text: t`Settings, backups and Export my data are here, and so is Take the tour.`,
      },
    ],
    [t],
  );
  const finish = useCallback(
    (result: "done" | "skip" | "empty") => {
      // With nothing to point at (the page has not loaded) nothing is recorded, so it can run later.
      if (result === "empty") return onClose(null);
      rpc.preferences.update({ tourSeen: true }).then(onClose, () => onClose(null));
    },
    [onClose],
  );
  if (!open) return null;
  return <TourPopover steps={steps} onFinish={finish} />;
}
