import type { McpServerConfigInput } from "@rakazo/contracts";

/** Shape of the encrypted MCP credential blob. `oauth` holds SDK OAuth state
 * (tokens, client registration, PKCE verifier) managed by McpOAuthBroker. */
export type McpSecretMaterial = {
  secret?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown>;
};

export type McpMaterialUpdate =
  | { action: "keep" }
  | { action: "store"; material: McpSecretMaterial };

/** Compute the next encrypted credential blob for an MCP server update.
 *
 * - "keep": the update carries no credential data; leave the stored blob as is.
 * - "store": rewrite the blob. An empty material means credentials were
 *   cleared entirely — the caller should delete the secret row and null the
 *   server's secretId instead of storing an empty object.
 *
 * env/headers use full-replace semantics (the update payload is the complete
 * set), matching the create handler. OAuth state is preserved unless the
 * endpoint changed, since tokens issued for one endpoint must never be sent to
 * another server. `clearStatic` (the origin changed) likewise drops the stored
 * secret, env and headers unless the update supplies new ones. */
export function buildMcpUpdateMaterial(
  existing: McpSecretMaterial,
  config: McpServerConfigInput,
  options: { clearOAuth?: boolean; clearStatic?: boolean } = {},
): McpMaterialUpdate {
  const material = options.clearOAuth || options.clearStatic ? { ...existing } : existing;
  // A key stored for one host must never be sent to another: drop it unless this update replaces it.
  const clearedStatic =
    options.clearStatic === true && Boolean(material.secret || material.env || material.headers);
  if (options.clearStatic) {
    delete material.secret;
    delete material.env;
    delete material.headers;
  }
  const clearedOAuth =
    (options.clearOAuth === true && material.oauth !== undefined) || clearedStatic;
  if (options.clearOAuth) delete material.oauth;
  const clearing = config.clearCredential === true;
  if (clearing) {
    return { action: "store", material: material.oauth ? { oauth: material.oauth } : {} };
  }
  const secret = "secret" in config && config.secret ? config.secret : undefined;
  const env = "env" in config ? config.env : undefined;
  const headers = "headers" in config ? config.headers : undefined;
  const existingHasMaterial = Boolean(
    material.secret ||
      (material.env && Object.keys(material.env).length > 0) ||
      (material.headers && Object.keys(material.headers).length > 0) ||
      material.oauth,
  );
  const suppliesMaterial = Boolean(
    secret || (env && Object.keys(env).length > 0) || (headers && Object.keys(headers).length > 0),
  );
  if (!existingHasMaterial && !suppliesMaterial) {
    return clearedOAuth ? { action: "store", material } : { action: "keep" };
  }
  return {
    action: "store",
    material: {
      ...material,
      ...(secret ? { secret } : {}),
      ...(env !== undefined ? { env } : {}),
      ...(headers !== undefined ? { headers } : {}),
    },
  };
}

/** The origin of an MCP endpoint, or null when there is none or it does not parse. */
export function mcpOrigin(endpoint: string | null | undefined): string | null {
  try {
    return endpoint ? new URL(endpoint).origin : null;
  } catch {
    return null;
  }
}
