import type { PortalDocument, PortalMe, PortalUpdate } from "@rakazo/contracts";
import { PortalDocumentSchema, PortalMeSchema, PortalUpdateSchema } from "@rakazo/contracts";

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

export type PortalContent = { me: PortalMe; updates: PortalUpdate[]; documents: PortalDocument[] };

export async function loadPortal(): Promise<PortalContent> {
  const [me, updates, documents] = await Promise.all([
    portalFetch("me").then((r) => r.json()),
    portalFetch("updates").then((r) => r.json()),
    portalFetch("documents").then((r) => r.json()),
  ]);
  return {
    me: PortalMeSchema.parse(me),
    updates: PortalUpdateSchema.array().parse(updates),
    documents: PortalDocumentSchema.array().parse(documents),
  };
}

export const portalDocumentUrl = (id: string) =>
  `/api/portal/documents/${encodeURIComponent(id)}/content`;
