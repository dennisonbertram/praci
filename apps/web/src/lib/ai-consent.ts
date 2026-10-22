import { rpc } from "./rpc";

export const aiConsentStatus = () => rpc.aiConsent.status({});

/** Allows one recipient under the scope and disclosure version the server reports right now. */
export async function allowRecipient(key: string) {
  const { scope, version } = await aiConsentStatus();
  return rpc.aiConsent.allow({ scope, version, keys: [key] });
}

export const revokeRecipient = (key: string) => rpc.aiConsent.revoke({ key });

export const documentConsent = () => rpc.dataRoom.consent();

/** Allows the Data room's models for documents, under the key and version the server reports right now. */
export async function allowDocuments() {
  const { key, version } = await documentConsent();
  return rpc.dataRoom.consentGrant({ key, version });
}
