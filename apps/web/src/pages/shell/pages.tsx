import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { LucideIcon } from "lucide-react";
import {
  BookUser,
  Building2,
  CalendarDays,
  ChartColumn,
  CodeXml,
  CreditCard,
  Files,
  FolderOpen,
  HandCoins,
  LayoutGrid,
  Mail,
  Megaphone,
  Mic,
  PieChart,
  Scale,
  ScanLine,
  SquareKanban,
} from "lucide-react";
import { matchPath } from "react-router-dom";

/** What decides whether a page is on offer: the account's sidebar glance and the board flag. */
export type PageGate = {
  glance: { brexConnected: boolean; devinConnected: boolean; hasTickets: boolean };
  ticketBoardEnabled: boolean;
};

export type AppPage = {
  /** The id in `hiddenPages`, the palette and the sidebar test id; the page lives at `/app/<key>`. */
  key: string;
  label: MessageDescriptor;
  /** Words a founder may type for this page; matched along with the label. */
  keywords?: MessageDescriptor;
  icon: LucideIcon;
  /** The command palette's icon where it differs from the sidebar's. */
  paletteIcon?: LucideIcon;
  /** Route patterns the page renders at, under /app. */
  paths: string[];
  /** False for pages the sidebar does not list (Integrations, the board). */
  sidebar: boolean;
  /** Only when the account has the board enabled; the route itself is absent otherwise. */
  needsTicketBoard?: true;
  visible?: (gate: PageGate) => boolean;
};

/** One list of the app's pages, in sidebar and palette order: routes, sidebar, palette and hiding read it. */
export const APP_PAGES: readonly AppPage[] = [
  { key: "inbox", label: msg`Inbox`, icon: Mail, paths: ["/app/inbox"], sidebar: true },
  {
    key: "finance",
    label: msg`Finance`,
    icon: ChartColumn,
    paths: ["/app/finance/*"],
    sidebar: true,
  },
  {
    key: "brex",
    label: msg`Brex`,
    icon: CreditCard,
    paths: ["/app/brex/*"],
    sidebar: true,
    visible: (gate) => gate.glance.brexConnected,
  },
  {
    key: "legal",
    label: msg`Legal`,
    keywords: msg`contracts, NDA, deadlines`,
    icon: Scale,
    paths: ["/app/legal"],
    sidebar: true,
  },
  { key: "gtm", label: msg`GTM`, icon: Megaphone, paths: ["/app/gtm"], sidebar: true },
  {
    key: "devin",
    label: msg`Devin`,
    icon: CodeXml,
    paths: ["/app/devin"],
    sidebar: true,
    // Only once Devin is connected; before that its Integrations card is the way in.
    visible: (gate) => gate.glance.devinConnected,
  },
  {
    key: "investors",
    label: msg`Investors`,
    keywords: msg`cap table, equity, ownership, Carta`,
    icon: PieChart,
    paths: ["/app/investors/*"],
    sidebar: true,
  },
  {
    key: "cap-table",
    label: msg`Cap table`,
    keywords: msg`equity, ownership, shares, ledger, stakeholders`,
    icon: PieChart,
    paths: ["/app/cap-table/*"],
    sidebar: true,
  },
  {
    key: "fundraising",
    label: msg`Fundraising`,
    keywords: msg`safe, round, raise`,
    icon: HandCoins,
    paths: ["/app/fundraising"],
    sidebar: true,
  },
  {
    key: "company",
    label: msg`Company`,
    icon: Building2,
    paths: ["/app/company/*"],
    sidebar: true,
  },
  {
    key: "calendar",
    label: msg`Calendar`,
    icon: CalendarDays,
    paths: ["/app/calendar"],
    sidebar: true,
  },
  {
    key: "meetings",
    label: msg`Meetings`,
    icon: Mic,
    paths: ["/app/meetings", "/app/meetings/:meetingId"],
    sidebar: true,
  },
  {
    key: "contacts",
    label: msg`Contacts`,
    icon: BookUser,
    paths: ["/app/contacts", "/app/contacts/:contactId"],
    sidebar: true,
  },
  {
    key: "data-room",
    label: msg`Data room`,
    icon: FolderOpen,
    paths: ["/app/data-room"],
    sidebar: true,
  },
  {
    key: "scanner",
    label: msg`Scanner`,
    icon: ScanLine,
    // The palette has always shown the Artifacts icon here.
    paletteIcon: Files,
    paths: ["/app/scanner"],
    sidebar: true,
  },
  {
    key: "artifacts",
    label: msg`Artifacts`,
    // Not the Data room's folder icon: these are files bots made.
    icon: Files,
    paths: ["/app/artifacts", "/app/artifacts/:artifactId"],
    sidebar: true,
  },
  {
    key: "board",
    label: msg`Task board`,
    keywords: msg`tasks, tickets`,
    icon: SquareKanban,
    paths: ["/app/board"],
    sidebar: false,
    needsTicketBoard: true,
    visible: (gate) => gate.ticketBoardEnabled && gate.glance.hasTickets,
  },
  {
    key: "integrations",
    label: msg`Integrations`,
    keywords: msg`apps, connections`,
    icon: LayoutGrid,
    paths: ["/app/integrations/*"],
    sidebar: false,
  },
];

/** The page a path belongs to, or null for chats, groups and bot pages. */
export function matchPage(pathname: string): AppPage | null {
  return (
    APP_PAGES.find((page) => page.paths.some((path) => matchPath({ path }, pathname) != null)) ??
    null
  );
}

/** The pages on offer to this account, in order. */
export function pagesOnOffer(gate: PageGate): AppPage[] {
  return APP_PAGES.filter((page) => page.visible?.(gate) ?? true);
}
