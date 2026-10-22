import { randomUUID } from "node:crypto";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { PortalDocument, PortalMe, PortalUpdate } from "@rakazo/contracts";
import type { PortalPrincipal, PrismaClient } from "@rakazo/db";
import {
  endPortalSession,
  exchangePortalToken,
  getSharedDocument,
  listPortalDocuments,
  listPortalUpdates,
  portalIdentity,
  resolvePortalSession,
} from "@rakazo/db";
import type { Context, Hono, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import * as z from "zod";
import { contentDisposition, downloadType } from "./inbox-attachment.js";

const COOKIE = "rakazo_portal";
const PATH = "/api/portal";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

/** What the portal reads and writes. Every method is scoped by the principal it is given. */
export interface PortalStore {
  exchange(token: string): Promise<{ session: string; principal: PortalPrincipal } | null>;
  resolve(session: string): Promise<PortalPrincipal | null>;
  end(session: string): Promise<void>;
  identity(principal: PortalPrincipal): Promise<PortalMe | null>;
  updates(principal: PortalPrincipal): Promise<PortalUpdate[]>;
  documents(principal: PortalPrincipal): Promise<PortalDocument[]>;
  document(
    principal: PortalPrincipal,
    itemId: string,
  ): Promise<{ name: string; mimeType: string; size: number; storageKey: string } | null>;
}

export const prismaPortalStore = (prisma: PrismaClient): PortalStore => ({
  exchange: (token) => exchangePortalToken(prisma, token),
  resolve: (session) => resolvePortalSession(prisma, session),
  end: (session) => endPortalSession(prisma, session),
  identity: (principal) => portalIdentity(prisma, principal),
  updates: (principal) => listPortalUpdates(prisma, principal),
  documents: (principal) => listPortalDocuments(prisma, principal),
  document: (principal, itemId) => getSharedDocument(prisma, principal, itemId),
});

/** Every portal response, including a refusal, is private and never stored by a client or a cache. */
export const portalNoStore: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("cache-control", "private, no-store");
};
export const PORTAL_PATH = `${PATH}/*`;

const OpenBody = z.object({ token: z.string().min(1).max(512) });

/**
 * The investor portal API. Its principal is one investor contact resolved from the session cookie:
 * never an Actor, never a user, and it never reaches /rpc. The landing page itself is a web route
 * (`/portal/open`); the link token is in its fragment, so no request here ever carries it in a URL.
 */
export function mountInvestorPortal(
  app: Hono,
  deps: {
    store: PortalStore;
    artifacts: ArtifactStore;
    /** Whether an Origin header names the web app (the app's own `isTrustedOrigin`). */
    isTrustedOrigin: (origin: string) => boolean;
  },
): void {
  const { store } = deps;

  // The POSTs change state, so a request from another site is refused. No Origin (curl, tests) passes.
  const foreign = (c: Context) => {
    const origin = c.req.header("origin");
    return origin !== undefined && !deps.isTrustedOrigin(origin);
  };

  const authenticate = async (c: Context) => {
    const session = getCookie(c, COOKIE);
    return session ? { session, principal: await store.resolve(session) } : null;
  };

  app.post(`${PATH}/open`, async (c) => {
    if (foreign(c)) return c.json({ error: "Forbidden" }, 403);
    const body = OpenBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Bad request" }, 400);
    const opened = await store.exchange(body.data.token);
    if (!opened) return c.json({ error: "This link no longer works." }, 401);
    setCookie(c, COOKIE, opened.session, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: PATH,
      maxAge: SESSION_SECONDS,
    });
    return c.json({ ok: true });
  });

  app.post(`${PATH}/sign-out`, async (c) => {
    if (foreign(c)) return c.json({ error: "Forbidden" }, 403);
    const session = getCookie(c, COOKIE);
    if (session) await store.end(session);
    deleteCookie(c, COOKIE, { path: PATH, secure: true });
    return c.json({ ok: true });
  });

  const get = (
    path: string,
    handler: (c: Context, principal: PortalPrincipal) => Promise<Response>,
  ) =>
    app.get(`${PATH}/${path}`, async (c) => {
      const auth = await authenticate(c);
      if (!auth?.principal) return c.json({ error: "Unauthorized" }, 401);
      return handler(c, auth.principal);
    });

  get("me", async (c, principal) => {
    const me = await store.identity(principal);
    return me ? c.json(me) : c.json({ error: "Unauthorized" }, 401);
  });
  get("updates", async (c, principal) => c.json(await store.updates(principal)));
  get("documents", async (c, principal) => c.json(await store.documents(principal)));
  get("documents/:id/content", async (c, principal) => {
    // The share row is checked before anything reaches artifact storage.
    const item = await store.document(principal, c.req.param("id") ?? "");
    if (!item) return c.json({ error: "Not found" }, 404);
    const operationId = `portal.download:${randomUUID()}`;
    const stream = await deps.artifacts.getStream(item.storageKey, {
      operationId,
      traceId: operationId,
      spaceId: principal.spaceId,
      userId: principal.userId,
      signal: c.req.raw.signal,
    });
    // Documents are untrusted: always a download, never active content on the API origin.
    return new Response(stream, {
      headers: {
        "content-type": downloadType(item.mimeType),
        "content-length": String(item.size),
        "content-disposition": contentDisposition(item.name),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  });
}
