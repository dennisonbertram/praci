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
import { GOOGLE_DESKTOP_REDIRECT_URI } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { filterCatalog } from "./composio-connector.js";
import { asRecord, readBoundedBytes, readBoundedText } from "./connector-http.js";
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
// gmail.settings.basic manages filters. It is restricted, so it is requested only when the user first
// asks for a Gmail filter (`begin` with permission "mail_rules"), never in the default connect.
export const GMAIL_SETTINGS_BASIC = "https://www.googleapis.com/auth/gmail.settings.basic";
const GOOGLE_API_ORIGIN = "https://www.googleapis.com";
const CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events";
const DRIVE = "https://www.googleapis.com/auth/drive";
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Each provider is its own Connection row and OAuth consent. `required` is the scope the user must
 * not untick; `paths` are the only URL path prefixes its access token may be sent to.
 */
const PROVIDERS = {
  gmail: {
    name: "Gmail",
    scopes: ["openid", "email", GMAIL_READONLY, GMAIL_COMPOSE, GMAIL_MODIFY],
    required: GMAIL_READONLY,
    origin: GMAIL_ORIGIN,
    paths: ["/"],
  },
  googlecalendar: {
    name: "Google Calendar",
    scopes: ["openid", "email", CALENDAR_EVENTS],
    required: CALENDAR_EVENTS,
    origin: GOOGLE_API_ORIGIN,
    paths: ["/calendar/v3/"],
  },
  googledrive: {
    name: "Google Drive",
    scopes: ["openid", "email", DRIVE],
    required: DRIVE,
    origin: GOOGLE_API_ORIGIN,
    paths: ["/drive/v3/", "/upload/drive/v3/"],
  },
} as const;
type GoogleProvider = keyof typeof PROVIDERS;

function providerOf(value: string | undefined): GoogleProvider | undefined {
  const slug = (value ?? "").trim().toLowerCase();
  return Object.hasOwn(PROVIDERS, slug) ? (slug as GoogleProvider) : undefined;
}
const SECRET_KIND = "google-oauth";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_AUTH_RESPONSE_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
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
 * Praci's own Google OAuth client for Gmail, Google Calendar and Google Drive. Gmail reads mail, saves
 * and sends drafts, and changes labels. Google keeps one grant per Google user and OAuth client, so
 * revoking any token revokes all three; `revoke` and `complete` guard against that.
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
    const [directory, connected] = await Promise.all([
      this.catalogDirectory(),
      this.listConnectedExternalIds(context),
    ]);
    const connectedSet = new Set(connected);
    return filterCatalog(
      directory.map((item) => ({ ...item, connected: connectedSet.has(item.slug) })),
      query ?? "",
    );
  }

  async catalogDirectory(): Promise<Omit<ConnectorCatalogItem, "connected">[]> {
    return (
      Object.entries(PROVIDERS) as Array<[GoogleProvider, (typeof PROVIDERS)[GoogleProvider]]>
    ).map(([slug, { name }]) => ({
      connectorId: "google",
      slug,
      name,
      // Simple Icons slugs match the provider keys; the web app inverts the black glyph in dark mode.
      logo: `https://cdn.simpleicons.org/${slug}`,
      noAuth: false,
    }));
  }

  async discoverTools(): Promise<ConnectorTool[]> {
    return [];
  }

  async listConnectedExternalIds(context: AdapterContext): Promise<string[]> {
    const rows = await this.config.prisma.connection.findMany({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        connectorId: "google",
        status: "connected",
      },
      select: { provider: true },
    });
    const slugs = rows.flatMap((row) => providerOf(row.provider) ?? []);
    return [...new Set(slugs)];
  }

  /** Always false: the account becomes connected when the callback calls `complete({ state, code })`. */
  async connectionReady(): Promise<boolean> {
    return false;
  }

  async begin(
    request: { provider: string; redirectUrl: string; permission?: "mail_rules" },
    _context: AdapterContext,
  ): Promise<{ authorizationUrl: string | null; state: string }> {
    const provider = providerOf(request.provider);
    if (!provider) throw new Error("Only Gmail, Google Calendar and Google Drive can be connected");
    const state = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUriFor(request.redirectUrl),
      response_type: "code",
      scope: [
        ...PROVIDERS[provider].scopes,
        ...(provider === "gmail" && request.permission === "mail_rules"
          ? [GMAIL_SETTINGS_BASIC]
          : []),
      ].join(" "),
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
    request: { state: string; code?: string; redirectUrl?: string; provider?: string },
    context: AdapterContext,
  ): Promise<{ connectionRef: string; secretId: string; scope: string }> {
    if (!STATE_PATTERN.test(request.state) || !request.code)
      throw new Error("Google authorization is incomplete");
    // Without a provider the grant is Gmail's, as before providers were passed.
    const provider = providerOf(request.provider ?? "gmail");
    if (!provider) throw new Error("Only Gmail, Google Calendar and Google Drive can be connected");
    const { name, required } = PROVIDERS[provider];
    const secrets = [this.config.clientSecret, request.code];
    try {
      const token = await this.tokenRequest(
        {
          grant_type: "authorization_code",
          code: request.code,
          code_verifier: this.verifier(request.state),
          redirect_uri: this.redirectUriFor(request.redirectUrl),
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        context.signal,
      );
      secrets.push(token.accessToken);
      if (token.refreshToken) secrets.push(token.refreshToken);
      // Google lets the user untick individual scopes on the consent screen. The provider's main scope
      // is required. Without gmail.compose or gmail.modify the account still reads mail; those writes
      // ask the user to reconnect.
      if (!token.scope.split(" ").includes(required)) {
        // Revoking this token would also revoke the user's other connected Google apps, so the
        // profile is read first. If it cannot be read, nothing is revoked.
        const profile = await this.userinfo(token.accessToken, context.signal).catch(
          () => undefined,
        );
        if (profile && !(await this.hasConnectedSibling(profile.sub)))
          await this.revokeToken(token.refreshToken ?? token.accessToken, context.signal).catch(
            () => undefined,
          );
        throw new Error(`${name} access was not granted. Try connecting again and allow it.`);
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
      return { connectionRef: profile.sub, secretId: stored.id, scope: token.scope };
    } catch (error) {
      throw new Error(sanitizeConnectorError(error, secrets));
    }
  }

  async revoke(
    connectionRef: string,
    context: AdapterContext,
    options: { provider?: string } = {},
  ): Promise<void> {
    const provider = providerOf(options.provider ?? "gmail");
    if (!provider) return;
    // The router marks the row revoked before calling here, so status is not filtered. Rows of the
    // other Google apps share this providerRef; the one being revoked is picked by provider.
    const rows = await this.config.prisma.connection.findMany({
      where: {
        connectorId: "google",
        providerRef: connectionRef,
        spaceId: context.spaceId,
        userId: context.userId,
        secretId: { not: null },
      },
    });
    const row = rows.find((candidate) => providerOf(candidate.provider) === provider);
    if (!row?.secretId) return;
    const credential = await this.loadCredential(row.secretId, context);
    // Google ties every app's scopes to one grant: revoking this token would disconnect the siblings.
    const siblingRemains = await this.hasConnectedSibling(connectionRef, row.id);
    if (credential && !siblingRemains)
      await this.revokeToken(credential.refreshToken, context.signal);
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
    // Without this check an access token could be sent to another host or another app's API.
    const provider = providerOf(request.app);
    if (!provider || !METHODS.has(request.method) || !isProviderUrl(provider, request.url))
      throw new Error(
        `The Google connector only calls the ${PROVIDERS[provider ?? "gmail"].name} API`,
      );
    const row = await this.config.prisma.connection.findFirst({
      where: {
        connectorId: "google",
        provider,
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
      // A cancellation is not an upstream failure; callers tell the two apart.
      if (context.signal.aborted) throw context.signal.reason;
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
    const raw = typeof request.body === "string" && Boolean(request.contentType);
    // A streamed body can take hours; the time limit covers only the wait for the response headers.
    const streaming = request.responseType === "stream";
    const headerLimit = new AbortController();
    const headerTimer = streaming
      ? setTimeout(() => headerLimit.abort(), REQUEST_TIMEOUT_MS)
      : undefined;
    const response = await (this.config.fetch ?? fetch)(request.url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        ...(request.body === undefined
          ? {}
          : { "content-type": raw ? (request.contentType as string) : "application/json" }),
      },
      ...(request.body === undefined
        ? {}
        : { body: raw ? (request.body as string) : JSON.stringify(request.body) }),
      redirect: "error",
      signal: combineSignals(
        context.signal,
        streaming ? headerLimit.signal : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ),
    }).finally(() => clearTimeout(headerTimer));
    if (request.responseType === "bytes") return this.bytesResponse(response, request.maxBytes);
    if (streaming) return this.streamResponse(response);
    const body = await readBoundedText(response, MAX_RESPONSE_BYTES);
    if (body.truncated) return { status: 502, data: {} };
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      status: response.status,
      // Drive exports and media downloads are not JSON; hand those back as the text they are.
      data:
        request.responseType === "text" ||
        (body.text && !(response.headers.get("content-type") ?? "").includes("json"))
          ? body.text
          : parseJson(body.text),
      ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {}),
    };
  }

  /** A success body is handed back unread; an error body is small JSON, as for bytes. */
  private async streamResponse(response: Response): Promise<ConnectorProxyResponse> {
    const retryAfter = Number(response.headers.get("retry-after"));
    const retry =
      Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {};
    if (!response.ok) {
      const body = await readBoundedText(response, MAX_AUTH_RESPONSE_BYTES);
      return { status: response.status, data: parseJson(body.text), ...retry };
    }
    return {
      status: response.status,
      data: response.body ?? new ReadableStream<Uint8Array>({ start: (c) => c.close() }),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      ...retry,
    };
  }

  /** Success bodies are bytes; an error body is small JSON that callers inspect for the reason. */
  private async bytesResponse(
    response: Response,
    maxBytes: number | undefined,
  ): Promise<ConnectorProxyResponse> {
    if (!maxBytes || maxBytes < 0) throw new Error("A bytes response needs maxBytes");
    const retryAfter = Number(response.headers.get("retry-after"));
    const retry =
      Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {};
    if (!response.ok) {
      const body = await readBoundedText(response, MAX_AUTH_RESPONSE_BYTES);
      return { status: response.status, data: parseJson(body.text), ...retry };
    }
    const declared = Number(response.headers.get("content-length"));
    const body =
      declared > maxBytes
        ? { bytes: new Uint8Array(), truncated: true }
        : await readBoundedBytes(response, maxBytes);
    if (declared > maxBytes) await response.body?.cancel().catch(() => undefined);
    if (body.truncated) return { status: 413, data: {} };
    return {
      status: response.status,
      data: body.bytes,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      ...retry,
    };
  }

  /**
   * True when any other connected Google app holds a grant for this Google account. Google's grant
   * belongs to the account and OAuth client, not to a Praci space or user, so this looks across all
   * of them and returns only a boolean.
   */
  private async hasConnectedSibling(sub: string, excludeId?: string): Promise<boolean> {
    const sibling = await this.config.prisma.connection.findFirst({
      where: {
        connectorId: "google",
        providerRef: sub,
        status: "connected",
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return Boolean(sibling);
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

  /** Desktop's fixed loopback address, or the web callback. A caller cannot pick any other redirect. */
  private redirectUriFor(requested?: string): string {
    if (requested === GOOGLE_DESKTOP_REDIRECT_URI) return requested;
    return this.requireRedirectUri();
  }

  private requireRedirectUri(): string {
    if (!this.config.redirectUri) throw new Error("Google redirect URI is not configured");
    return this.config.redirectUri;
  }

  private now(): number {
    return (this.config.now ?? Date.now)();
  }
}

function isProviderUrl(provider: GoogleProvider, value: string): boolean {
  try {
    const url = new URL(value);
    const { origin, paths } = PROVIDERS[provider];
    return (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      paths.some((prefix) => url.pathname.startsWith(prefix))
    );
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
