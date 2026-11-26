import type {
  EquityAccessLevel,
  EquityAccessView,
  PortalDocument,
  PortalMe,
  PortalUpdate,
} from "@rakazo/contracts";
import {
  EquityAccessViewSchema,
  PortalDocumentSchema,
  PortalMeSchema,
  PortalUpdateSchema,
} from "@rakazo/contracts";

/** The link or session is expired, revoked or unknown: the portal shows its one sentence. */
export class PortalDeadError extends Error {
  constructor() {
    super("This link no longer works.");
    this.name = "PortalDeadError";
  }
}

async function portalFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/portal/${path}`, { credentials: "same-origin", ...init });
  if (response.status === 401) throw new PortalDeadError();
  if (!response.ok) throw new Error(`Portal request failed (${response.status})`);
  return response;
}

/** The Open button: trades the link token for a session cookie. */
export async function openPortal(token: string): Promise<void> {
  await portalFetch("open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export async function signOutPortal(): Promise<void> {
  await portalFetch("sign-out", { method: "POST" });
}

export type PortalContent = {
  me: PortalMe;
  updates: PortalUpdate[];
  documents: PortalDocument[];
  /** The holder's cap table at their access level; absent when it could not load. */
  holdings?: EquityAccessView;
};

export async function loadPortal(): Promise<PortalContent> {
  const [me, updates, documents, holdings] = await Promise.all([
    portalFetch("me").then((r) => r.json()),
    portalFetch("updates").then((r) => r.json()),
    portalFetch("documents").then((r) => r.json()),
    // Holdings are extra: the rest of the portal still shows when they fail.
    portalFetch("holdings")
      .then((r) => r.json())
      .catch(() => null),
  ]);
  const view = EquityAccessViewSchema.safeParse(holdings);
  return {
    me: PortalMeSchema.parse(me),
    updates: PortalUpdateSchema.array().parse(updates),
    documents: PortalDocumentSchema.array().parse(documents),
    ...(view.success ? { holdings: view.data } : {}),
  };
}

/** Asks the company for a higher cap table access level. */
export async function requestPortalAccess(level: EquityAccessLevel): Promise<void> {
  await portalFetch("holdings/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ level }),
  });
}

export const portalDocumentUrl = (id: string) =>
  `/api/portal/documents/${encodeURIComponent(id)}/content`;

/** Proposes changes to the holder's own name, email or address; the company reviews them. */
export async function proposePortalProfile(proposed: {
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  address?: {
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
}): Promise<void> {
  await portalFetch("profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proposed),
  });
}
