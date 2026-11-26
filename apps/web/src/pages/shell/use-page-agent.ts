import type { PageAgentKind } from "@rakazo/contracts";
import { PAGE_AGENTS } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/user-error";

/** A panel kind: every page agent with a page, plus the connector's Devin agent that has no registry row. */
export type PagePanelKind =
  | Exclude<PageAgentKind, "company-importer" | "voice" | "carta">
  | "devin";

/** The registry's spawn prefix without its colon, which names the panel and its test id. */
export const pagePanelName = (kind: PagePanelKind | "company-importer") =>
  kind === "devin" ? "devin-agent" : PAGE_AGENTS[kind].prefix.replace(/:$/, "");

export interface PagePanelCopy {
  collapseLabel: string;
  createLabel: string;
  suggestions?: string[];
}

export interface PageAgentPanelConfig extends PagePanelCopy {
  name: string;
  testId: string;
  open: boolean;
  collapse: () => void;
  create?: () => Promise<unknown>;
  creating: boolean;
  error: string;
}

/** A panel's fixed shape, from its kind and copy; the caller supplies only live state. */
export function pagePanel(
  kind: PagePanelKind | "company-importer",
  copy: PagePanelCopy,
  state: Pick<PageAgentPanelConfig, "open" | "collapse" | "creating" | "error"> &
    Pick<PageAgentPanelConfig, "create">,
): PageAgentPanelConfig {
  const name = pagePanelName(kind);
  return { name, testId: `${name}-panel`, ...copy, ...state };
}

interface Options {
  /** Makes the agent. */
  create: () => Promise<unknown>;
  /** Shown when `create` fails and gives no reason of its own. */
  errorLabel: string;
  /** The agent exists, so Ask only opens the panel. */
  hasAgent: boolean;
  refreshBots: () => Promise<unknown>;
  /** The user is on this agent's page; leaving it closes the panel. */
  onPage: boolean;
  /** Changes with the user and space, so a result for the old ones is dropped. */
  scope: string;
  /** Ask also makes a missing agent (Scanner's Ask only opens the panel). */
  createOnAsk?: boolean;
  /** Entering the page forgets an earlier failure. */
  clearErrorOnVisit?: boolean;
}

/** One page agent's panel state: open, creating, error, create and ask. */
export function usePageAgent(options: Options) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(options);
  latest.current = options;
  const scopeRef = useRef(options.scope);
  scopeRef.current = options.scope;

  const create = useCallback(async () => {
    const scope = scopeRef.current;
    setCreating(true);
    setError("");
    try {
      await latest.current.create();
      if (scopeRef.current === scope) await latest.current.refreshBots();
    } catch (failure) {
      if (scopeRef.current === scope) setError(errorText(failure, latest.current.errorLabel));
      return false;
    } finally {
      if (scopeRef.current === scope) setCreating(false);
    }
  }, []);

  const { onPage, clearErrorOnVisit } = options;
  useEffect(() => {
    if (!onPage) setOpen(false);
    else if (clearErrorOnVisit) setError("");
  }, [onPage, clearErrorOnVisit]);

  const ask = () => {
    setOpen(true);
    if (options.createOnAsk !== false && !options.hasAgent && !creating) void create();
  };
  return { open, setOpen, creating, error, create, ask };
}
