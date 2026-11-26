import type { SharedArtifact } from "@rakazo/contracts";
import { SharedArtifactSchema } from "@rakazo/contracts";

/** Any refusal, whether the link is unknown, expired or revoked: the page shows one sentence. */
export class SharedArtifactGoneError extends Error {
  constructor() {
    super("This link is not available.");
    this.name = "SharedArtifactGoneError";
  }
}

/** The token goes in the POST body, never the URL, and no credentials are sent. */
export async function openSharedArtifact(token: string): Promise<SharedArtifact> {
  const response = await fetch("/api/share/open", {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  // A rate limit can be retried; other 4xx responses keep unknown, expired and revoked links alike.
  if (response.status === 429) throw new Error("Could not load");
  if (response.status >= 400 && response.status < 500) throw new SharedArtifactGoneError();
  if (!response.ok) throw new Error("Could not load");
  return SharedArtifactSchema.parse(await response.json());
}
