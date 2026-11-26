/** Error codes that mean the person dismissed or replaced the browser prompt; they get no message. */
const CANCELLED = new Set([
  "AUTH_CANCELLED",
  "ERROR_CEREMONY_ABORTED",
  "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
]);

export function passkeyCancelled(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && CANCELLED.has(code);
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Passkey controls show only when the server has the plugin, the browser can do WebAuthn, and the
 * page is on a domain name: WebAuthn rejects IP-address hosts, so 127.0.0.1 can never work.
 */
export function passkeysAvailable(
  serverSupportsPasskeys: boolean | undefined,
  page: { hostname: string; webauthn: boolean } = {
    hostname: window.location.hostname,
    webauthn: typeof window.PublicKeyCredential !== "undefined",
  },
): boolean {
  // An IPv6 hostname always contains a colon.
  const ipHost = IPV4.test(page.hostname) || page.hostname.includes(":");
  return serverSupportsPasskeys === true && page.webauthn && !ipHost;
}
