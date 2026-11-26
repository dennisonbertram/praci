import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, cn, Spinner, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { Maximize2, PanelRightClose, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ContextPerson } from "./ContextPanel";
import { ContextPanel } from "./ContextPanel";

export type EmailPanelTab = "context" | "agent";

/**
 * The panel beside an email: Context (who this is) and, when the host has an agent for the
 * message, Agent. The agent stays mounted once it exists, so its chat survives a switch of tab.
 */
export function EmailSidePanel({
  people,
  tab,
  onTab,
  agent,
  agentLoading,
  fullScreenTo,
  onClose,
}: {
  people: ContextPerson[];
  tab: EmailPanelTab;
  /** Absent when there is no agent to switch to, such as in the composer. */
  onTab?: (tab: EmailPanelTab) => void;
  /** The agent chat, once it has been opened. */
  agent?: ReactNode;
  agentLoading?: boolean;
  /** Where the agent's own page is, once there is an agent. */
  fullScreenTo?: string;
  onClose: () => void;
}) {
  return (
    <aside
      data-testid="email-side-panel"
      aria-label={t`Context`}
      className="flex h-full min-h-0 w-full flex-col border-s border-sidebar-border bg-background"
    >
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        {onTab ? (
          <Tabs value={tab} onValueChange={(value) => onTab(value as EmailPanelTab)}>
            <TabsList variant="line">
              <TabsTrigger value="context">
                <Trans>Context</Trans>
              </TabsTrigger>
              <TabsTrigger value="agent">
                <Trans>Agent</Trans>
                {agentLoading ? <Spinner aria-hidden="true" /> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <span className="text-sm font-medium">
            <Trans>Context</Trans>
          </span>
        )}
        <span className="flex-1" />
        {tab === "agent" && fullScreenTo ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Open email agent full screen`}
            render={<Link to={fullScreenTo} />}
          >
            <Maximize2 aria-hidden="true" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-sm" aria-label={t`Close`} onClick={onClose}>
          <PanelRightClose aria-hidden="true" className="max-md:hidden" />
          <X aria-hidden="true" className="md:hidden" />
        </Button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", tab !== "context" && "hidden")}>
        <ContextPanel people={people} />
      </div>
      {agent ? (
        <div className={cn("flex min-h-0 flex-1 flex-col", tab !== "agent" && "hidden")}>
          {agent}
        </div>
      ) : null}
    </aside>
  );
}
