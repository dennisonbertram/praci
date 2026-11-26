import { t } from "@lingui/core/macro";
import type { ReactNode } from "react";
import { AccessPage } from "../../components/cap-table/access/AccessPage";
import { ActivityLog } from "../../components/cap-table/access/ActivityLog";
import { OptionsPlansPage } from "../../components/cap-table/options/OptionsPlansPage";
import { CapTableOverview } from "../../components/cap-table/overview/CapTableOverview";
import { SecuritiesTab } from "../../components/cap-table/securities/SecuritiesTab";
import { StakeholdersTab } from "../../components/cap-table/stakeholders/StakeholdersTab";
import { ReportsTab } from "../../components/cap-table/views/ReportsTab";
import { RoundsTab } from "../../components/cap-table/views/RoundsTab";
import { ShareClassesTab } from "../../components/cap-table/views/ShareClassesTab";

export type CapTableTabId =
  | "overview"
  | "stakeholders"
  | "securities"
  | "share-classes"
  | "plans"
  | "rounds"
  | "reports"
  | "access"
  | "activity";

export type CapTableTab = {
  id: CapTableTabId;
  /** A function so the label follows the active locale at render, not at module load. */
  label: () => string;
  /** The tab's content, so an area team adds it without touching the shell. */
  element: ReactNode;
};

/**
 * The tabs, in URL order. Each area owns its entries: an area replaces its empty state with its
 * real page as it lands, and this file is the only place the shell has to know about it.
 */
export const CAP_TABLE_TABS: readonly CapTableTab[] = [
  // ---- views area: replace this tab's element ----
  { id: "overview", label: () => t`Overview`, element: <CapTableOverview /> },
  // ---- stakeholders area: replace this tab's element ----
  { id: "stakeholders", label: () => t`Stakeholders`, element: <StakeholdersTab /> },
  // ---- securities area: replace this tab's element ----
  { id: "securities", label: () => t`Securities`, element: <SecuritiesTab /> },
  // ---- views area: replace this tab's element ----
  { id: "share-classes", label: () => t`Share classes`, element: <ShareClassesTab /> },
  // ---- options area: replace this tab's element ----
  { id: "plans", label: () => t`Plans`, element: <OptionsPlansPage /> },
  // ---- views area: replace this tab's element ----
  { id: "rounds", label: () => t`Rounds`, element: <RoundsTab /> },
  // ---- views area: replace this tab's element ----
  { id: "reports", label: () => t`Reports`, element: <ReportsTab /> },
  // ---- access area: replace this tab's element ----
  { id: "access", label: () => t`Access`, element: <AccessPage /> },
  // ---- access area: replace this tab's element ----
  { id: "activity", label: () => t`Activity`, element: <ActivityLog /> },
];

export const CAP_TABLE_TAB_IDS = CAP_TABLE_TABS.map((tab) => tab.id);

export function capTableTab(id: string | undefined): CapTableTab {
  return CAP_TABLE_TABS.find((tab) => tab.id === id) ?? CAP_TABLE_TABS[0]!;
}
