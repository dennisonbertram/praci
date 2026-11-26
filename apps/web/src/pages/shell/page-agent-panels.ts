import { t } from "@lingui/core/macro";
import { dataRoomAgentSuggestions } from "../../lib/data-room-agent";
import { financeAgentSuggestions } from "../../lib/finance-agent";
import { investorsAgentSuggestions } from "../../lib/investors-agent";
import { scannerAgentSuggestions } from "../../lib/scanner-agent";
import type {
  PageAgentPanelConfig,
  PagePanelCopy,
  PagePanelKind,
  usePageAgent,
} from "./use-page-agent";
import { pagePanel } from "./use-page-agent";

export type PanelKind = PagePanelKind | "company-importer";

/** Each panel's own words. Literal strings, so the message catalog can extract them. */
function panelCopy(): Record<PanelKind, PagePanelCopy> {
  return {
    inbox: {
      collapseLabel: t`Collapse Inbox agent`,
      createLabel: t`Create Inbox agent`,
      // InboxAgentIntro is its empty thread, with its own questions.
      suggestions: [],
    },
    finance: {
      collapseLabel: t`Collapse Finance agent`,
      createLabel: t`Create Finance agent`,
      suggestions: financeAgentSuggestions(),
    },
    scanner: {
      collapseLabel: t`Collapse Scanner agent`,
      createLabel: t`Create Scanner agent`,
      suggestions: scannerAgentSuggestions(),
    },
    "data-room": {
      collapseLabel: t`Collapse Data room agent`,
      createLabel: t`Create Data room agent`,
      suggestions: dataRoomAgentSuggestions(),
    },
    devin: {
      collapseLabel: t`Collapse Devin agent`,
      createLabel: t`Create Devin agent`,
      suggestions: [t`Anything merged today?`, t`What did Devin do this week?`],
    },
    legal: {
      collapseLabel: t`Collapse Legal agent`,
      createLabel: t`Create Legal agent`,
    },
    gtm: {
      collapseLabel: t`Collapse GTM agent`,
      createLabel: t`Create GTM agent`,
      suggestions: [t`Help me find our first 50 design partners`],
    },
    company: {
      collapseLabel: t`Collapse Company agent`,
      createLabel: t`Create Company agent`,
      suggestions: [t`Who works here?`, t`What dates are coming up?`],
    },
    "company-importer": {
      collapseLabel: t`Collapse Company importer`,
      createLabel: t`Create Company importer`,
      suggestions: [t`Show my import plan`, t`How is my import going?`],
    },
    investors: {
      collapseLabel: t`Collapse Investors agent`,
      createLabel: t`Try again`,
      suggestions: investorsAgentSuggestions(),
    },
  };
}

type Agent = ReturnType<typeof usePageAgent>;
type Prefs = { open: boolean; collapse: () => void };

/**
 * The panel of the open page's agent, or null on bot and group routes. Inbox and Investors open
 * from a saved collapsed preference (`prefs`); the others from their agent's own open state.
 * Investors offers Create only to retry a failure, since its agent appears by itself.
 */
export function pagePanelFor(input: {
  kind: PanelKind | null;
  agents: Record<PanelKind, Agent>;
  inbox: Prefs;
  investors: Prefs;
}): PageAgentPanelConfig | null {
  const { kind, agents } = input;
  if (!kind) return null;
  const agent = agents[kind];
  const prefs = kind === "inbox" ? input.inbox : kind === "investors" ? input.investors : null;
  return pagePanel(kind, panelCopy()[kind], {
    open: prefs ? prefs.open : agent.open,
    collapse: prefs ? prefs.collapse : () => agent.setOpen(false),
    creating: agent.creating,
    error: agent.error,
    create: kind === "investors" && !agent.error ? undefined : agent.create,
  });
}
