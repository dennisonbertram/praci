import { createHash, createHmac, randomBytes } from "node:crypto";
import type {
  AdapterContext,
  ConnectorCall,
  ConnectorCatalogItem,
  ConnectorEvent,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  ConnectorTool,
  ManagedConnectorProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { filterCatalog } from "./composio-connector.js";
import { asRecord, readBoundedText } from "./connector-http.js";
import { combineSignals, sanitizeConnectorError } from "./connector-safety.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_ORIGIN = "https://gmail.googleapis.com";
const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
// gmail.compose adds drafts and sending. It cannot read mail, so gmail.readonly stays.
const GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";
// gmail.modify adds labels: mark read or unread and archive. Like compose it is optional at connect.
const GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";
const SCOPES = ["openid", "email", GMAIL_READONLY, GMAIL_COMPOSE, GMAIL_MODIFY];
const GMAIL_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
const SECRET_KIND = "google-oauth";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_AUTH_RESPONSE_BYTES = 256 * 1024;
const MAX_GMAIL_RESPONSE_BYTES = 10 * 1024 * 1024;
const EXPIRY_MARGIN_MS = 60_000;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GoogleConnectorConfig {
  clientId: string;
  clientSecret: string;
  /** Deployment-wide secret. The PKCE verifier is derived from it, so any process can finish a callback. */
  identitySecret: string;
  /** Where Google sends the browser back. Only API processes that call `begin` need it. */
  redirectUri?: string;
  prisma: Pick<PrismaClient, "connection" | "secret">;
  secrets: SecretStore;
  fetch?: typeof fetch;
  now?: () => number;
}

interface StoredCredential {
  refreshToken: string;
  scope: string;
  sub: string;
  email: string;
}

class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** True when Google says the grant is no longer usable, so the user must reconnect. */
    readonly invalidGrant = false,
  ) {
    super(message);
  }
}

/**
 * Rakazo's own Google OAuth client. Reads mail, saves and sends drafts, and changes labels.
 * Accounts connected before gmail.compose or gmail.modify was requested lack that access, and
 * Google answers 403 insufficientPermissions to those writes, which the mail provider reports as
 * "reconnect". Reading keeps working.
 */
export class GoogleConnector implements ManagedConnectorProvider {
  /** ponytail: per-process access-token cache; each process refreshes on its own, which Google allows. */
  private readonly tokens = new Map<string, { value: string; expiresAt: number }>();
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(private readonly config: GoogleConnectorConfig) {}

  describe() {
    return {
      id: "google",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { discover: false, oauth: true, secretsBrokered: true },
    };
  }

  async catalog(context: AdapterContext, query?: string): Promise<ConnectorCatalogItem[]> {
    const connected = (await this.listConnectedExternalIds(context)).includes("gmail");
    return filterCatalog(
      [
        {
          connectorId: "google",
          slug: "gmail",
          name: "Gmail",
          logo: null,
          connected,
          noAuth: false,
        },
      ],
      query ?? "",
    );
  }

  async discoverTools(): Promise<ConnectorTool[]> {
    return [];
  }

  async listConnectedExternalIds(context: AdapterContext): Promise<string[]> {
    const row = await this.config.prisma.connection.findFirst({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        connectorId: "google",
        status: "connected",
      },
      select: { id: true },
    });
    return row ? ["gmail"] : [];
  }

  /** Always false: the account becomes connected when the callback calls `complete({ state, code })`. */
  async connectionReady(): Promise<boolean> {
    return false;
  }

  async begin(
    request: { provider: string; redirectUrl: string },
    _context: AdapterContext,
  ): Promise<{ authorizationUrl: string | null; state: string }> {
    if (request.provider.trim().toLowerCase() !== "gmail")
      throw new Error("Only Gmail can be connected with Google");
    const state = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.requireRedirectUri(),
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
      code_challenge: createHash("sha256").update(this.verifier(state)).digest("base64url"),
      code_challenge_method: "S256",
      access_type: "offline",
      // Always show consent so Google returns a refresh token.
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return { authorizationUrl: `${AUTH_URL}?${params}`, state };
  }

  async complete(
    request: { state: string; code?: string },
    context: AdapterContext,
  ): Promise<{ connectionRef: string; secretId: string }> {
    if (!STATE_PATTERN.test(request.state) || !request.code)
      throw new Error("Google authorization is incomplete");
    const secrets = [this.config.clientSecret, request.code];
    try {
      const token = await this.tokenRequest(
        {
          grant_type: "authorization_code",
          code: request.code,
          code_verifier: this.verifier(request.state),
          redirect_uri: this.requireRedirectUri(),
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        context.signal,
      );
      secrets.push(token.accessToken);
      if (token.refreshToken) secrets.push(token.refreshToken);
      // Google lets the user untick individual scopes on the consent screen. Reading is required.
      // Without gmail.compose or gmail.modify the account still reads mail; those writes ask the user to reconnect.
      if (!token.scope.split(" ").includes(GMAIL_READONLY)) {
        await this.revokeToken(token.refreshToken ?? token.accessToken, context.signal).catch(
          () => undefined,
        );
        throw new Error("Gmail access was not granted. Try connecting again and allow it.");
      }
      if (!token.refreshToken)
        throw new Error("Google did not allow offline access. Try connecting again.");
      const profile = await this.userinfo(token.accessToken, context.signal);
      const credential: StoredCredential = {
        refreshToken: token.refreshToken,
        scope: token.scope,
        sub: profile.sub,
        email: profile.email,
      };
      const stored = await this.config.secrets.put(JSON.stringify(credential), context);
      await this.config.prisma.secret.create({
        data: {
          id: stored.id,
          userId: context.userId,
          spaceId: context.spaceId,
          kind: SECRET_KIND,
          ciphertext: stored.ciphertext,
        },
      });
      return { connectionRef: profile.sub, secretId: stored.id };
    } catch (error) {
      throw new Error(sanitizeConnectorError(error, secrets));
    }
  }

  async revoke(connectionRef: string, context: AdapterContext): Promise<void> {
    // The router marks the row revoked before calling here, so status is not filtered.
    const row = await this.config.prisma.connection.findFirst({
      where: {
        connectorId: "google",
        providerRef: connectionRef,
        spaceId: context.spaceId,
        userId: context.userId,
        secretId: { not: null },
      },
    });
    if (!row?.secretId) return;
    const credential = await this.loadCredential(row.secretId, context);
    if (credential) await this.revokeToken(credential.refreshToken, context.signal);
    this.tokens.delete(row.id);
    await this.config.prisma.secret.deleteMany({
      where: { id: row.secretId, userId: context.userId, spaceId: context.spaceId },
    });
    await this.config.prisma.connection.updateMany({
      where: { id: row.id, spaceId: context.spaceId, userId: context.userId },
      data: { secretId: null },
    });
  }

  async proxy(
    request: ConnectorProxyRequest,
    context: AdapterContext,
  ): Promise<ConnectorProxyResponse> {
    // Without this check an access token could be sent to another host.
    if (!GMAIL_METHODS.has(request.method) || !isGmailUrl(request.url))
      throw new Error("The Google connector only calls the Gmail API");
    const row = await this.config.prisma.connection.findFirst({
      where: {
        connectorId: "google",
        providerRef: request.accountRef,
        spaceId: context.spaceId,
        userId: context.userId,
        status: "connected",
      },
    });
    if (!row?.secretId) return { status: 401, data: {} };
    try {
      // A 401 means Gmail did not act on the request, so repeating it with a fresh token is safe.
      const first = await this.gmailFetch(row, request, context, false);
      return first.status === 401 ? await this.gmailFetch(row, request, context, true) : first;
    } catch (error) {
      if (error instanceof GoogleAuthError && error.invalidGrant) return { status: 401, data: {} };
      throw new Error(sanitizeConnectorError(error, [this.config.clientSecret]));
    }
  }

  /** Agent mail tools are built in; this connector has no tools of its own. */
  async *execute(_call: ConnectorCall): AsyncIterable<ConnectorEvent> {
    yield { type: "error", message: "The Google connector does not run tools" };
  }

  private async gmailFetch(
    row: { id: string; secretId: string | null },
    request: ConnectorProxyRequest,
    context: AdapterContext,
    forceRefresh: boolean,
  ): Promise<ConnectorProxyResponse> {
    const token = await this.accessToken(row, context, forceRefresh);
    const response = await (this.config.fetch ?? fetch)(request.url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      redirect: "error",
      signal: combineSignals(context.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
    });
    const body = await readBoundedText(response, MAX_GMAIL_RESPONSE_BYTES);
    if (body.truncated) return { status: 502, data: {} };
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      status: response.status,
      data: parseJson(body.text),
      ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {}),
    };
  }

  private accessToken(
    row: { id: string; secretId: string | null },
    context: AdapterContext,
    forceRefresh: boolean,
  ): Promise<string> {
    const cached = this.tokens.get(row.id);
    if (!forceRefresh && cached && cached.expiresAt - EXPIRY_MARGIN_MS > this.now())
      return Promise.resolve(cached.value);
    const pending = this.refreshing.get(row.id);
    if (pending) return pending;
    const refresh = this.refresh(row, context).finally(() => this.refreshing.delete(row.id));
    this.refreshing.set(row.id, refresh);
    return refresh;
  }

  private async refresh(
    row: { id: string; secretId: string | null },
    context: AdapterContext,
  ): Promise<string> {
    this.tokens.delete(row.id);
    const credential = row.secretId ? await this.loadCredential(row.secretId, context) : undefined;
    if (!credential) throw new GoogleAuthError("Google credentials are missing", true);
    const token = await this.tokenRequest(
      {
        grant_type: "refresh_token",
        refresh_token: credential.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      },
      context.signal,
    );
    this.tokens.set(row.id, {
      value: token.accessToken,
      expiresAt: this.now() + token.expiresInMs,
    });
    return token.accessToken;
  }

  private async loadCredential(
    secretId: string,
    context: AdapterContext,
  ): Promise<StoredCredential | undefined> {
    const secret = await this.config.prisma.secret.findFirst({
      where: { id: secretId, userId: context.userId, spaceId: context.spaceId, kind: SECRET_KIND },
    });
    if (!secret) return undefined;
    const parsed = asRecord(
      JSON.parse(await this.config.secrets.load(secret.ciphertext, secret.id)),
    );
    return typeof parsed?.refreshToken === "string"
      ? (parsed as unknown as StoredCredential)
      : undefined;
  }

  private async tokenRequest(form: Record<string, string>, signal?: AbortSignal) {
    const response = await (this.config.fetch ?? fetch)(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
      signal: combineSignals(signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
    });
    const body = asRecord(
      parseJson((await readBoundedText(response, MAX_AUTH_RESPONSE_BYTES)).text),
    );
    if (!response.ok || typeof body?.access_token !== "string") {
      // Report only Google's error code: its description can echo request values.
      const code = typeof body?.error === "string" ? body.error : "unknown_error";
      throw new GoogleAuthError(
        `Google token request failed (HTTP ${response.status}, ${code})`,
        code === "invalid_grant",
      );
    }
    return {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : undefined,
      scope: typeof body.scope === "string" ? body.scope : "",
      expiresInMs: (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000,
    };
  }

  private async userinfo(accessToken: string, signal?: AbortSignal) {
    const response = await (this.config.fetch ?? fetch)(USERINFO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: combineSignals(signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
    });
    const body = asRecord(
      parseJson((await readBoundedText(response, MAX_AUTH_RESPONSE_BYTES)).text),
    );
    if (!response.ok || typeof body?.sub !== "string" || !body.sub)
      throw new Error(`Google profile lookup failed (HTTP ${response.status})`);
    return { sub: body.sub, email: typeof body.email === "string" ? body.email : "" };
  }

  /** Google answers 400 when the token is already revoked or expired, which is fine. */
  private async revokeToken(token: string, signal?: AbortSignal): Promise<void> {
    const response = await (this.config.fetch ?? fetch)(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: combineSignals(signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
    });
    if (!response.ok && response.status !== 400)
      throw new Error(`Google revoke failed (HTTP ${response.status})`);
  }

  private verifier(state: string): string {
    return createHmac("sha256", this.config.identitySecret)
      .update(`google-pkce:${state}`)
      .digest("base64url");
  }

  private requireRedirectUri(): string {
    if (!this.config.redirectUri) throw new Error("Google redirect URI is not configured");
    return this.config.redirectUri;
  }

  private now(): number {
    return (this.config.now ?? Date.now)();
  }
}

function isGmailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === GMAIL_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
