const LEGAL_PATH = "/app/legal";

export type LegalUiState = {
  selectedNode?: string;
  expandedGroups?: string[];
  /** Previous history entries stored only the most recently expanded group. */
  expandedGroup?: string;
};

type LegalLocation = { pathname: string; search: string; hash: string; state?: unknown };

/** Read the compact, non-shareable UI details from React Router history state. */
export function legalUiStateFromHistory(state: unknown): LegalUiState | undefined {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return undefined;
  const candidate = (state as { legalUiState?: unknown }).legalUiState;
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return undefined;
  const value = candidate as LegalUiState;
  const expandedGroups = Array.isArray(value.expandedGroups)
    ? value.expandedGroups.filter(
        (group): group is string => typeof group === "string" && group.length > 0,
      )
    : [];
  if (
    typeof value.expandedGroup === "string" &&
    value.expandedGroup.length > 0 &&
    !expandedGroups.includes(value.expandedGroup)
  ) {
    expandedGroups.push(value.expandedGroup);
  }
  const result: LegalUiState = {
    ...(typeof value.selectedNode === "string" ? { selectedNode: value.selectedNode } : {}),
    ...(expandedGroups.length ? { expandedGroups: [...new Set(expandedGroups)] } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

/** Preserve the current Legal view in router history state without adding it to shareable URLs. */
export function legalReturnPath(location: LegalLocation): string {
  return location.pathname === LEGAL_PATH || location.pathname === `${LEGAL_PATH}/`
    ? `${location.pathname}${location.search}${location.hash}`
    : LEGAL_PATH;
}

/** Carry the source route and its compact UI state through a document link, not its URL. */
export function legalDataRoomState(
  location: LegalLocation,
  uiState?: LegalUiState,
): { from: "legal"; returnTo: string; legalUiState?: LegalUiState } {
  const saved = legalUiStateFromHistory({
    legalUiState: { ...legalUiStateFromHistory(location.state), ...uiState },
  });
  return {
    from: "legal",
    returnTo: legalReturnPath(location),
    ...(saved ? { legalUiState: saved } : {}),
  };
}

/** Restore only this UI state after the Data room's visible return link. */
export function legalUiStateForReturn(state: unknown): { legalUiState?: LegalUiState } | undefined {
  const saved = legalUiStateFromHistory(state);
  return saved ? { legalUiState: saved } : undefined;
}

/** Only restore a same-app Legal URL; malformed or external targets fall back to the Legal home. */
export function legalReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const base = "https://rakazo.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || (url.pathname !== LEGAL_PATH && url.pathname !== `${LEGAL_PATH}/`)) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}
