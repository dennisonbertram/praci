import { rpc } from "./rpc";

export const aiConsentStatus = (uses?: ("model" | "voice" | "memory")[]) =>
  rpc.aiConsent.status(uses ? { uses } : {});

/** Allows one recipient. With `shown`, it binds the grant to the scope and version the user reviewed; the server refuses it if they changed. */
export async function allowRecipient(key: string, shown?: { scope: string; version: string }) {
  const { scope, version } = shown ?? (await aiConsentStatus());
  return rpc.aiConsent.allow({ scope, version, keys: [key] });
}

export const revokeRecipient = (key: string) => rpc.aiConsent.revoke({ key });

export const documentConsent = () => rpc.dataRoom.consent();

/** Allows only the document consent that was shown (key, version, Space); the server refuses it if any changed. */
export const allowDocuments = (shown: { key: string; version: string; spaceId?: string }) =>
  rpc.dataRoom.consentGrant({
    key: shown.key,
    version: shown.version,
    spaceId: shown.spaceId,
    documentsOnly: true,
  });
