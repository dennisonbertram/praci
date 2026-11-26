import type {
  AdapterContext,
  ContactPhotoRef,
  ContactPhotoSource,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { asRecord, readBoundedBytes } from "./connector-http.js";
import { GoogleApiClient, GoogleApiError } from "./google-api-request.js";

const PEOPLE = "https://people.googleapis.com/v1";
const PAGE_SIZE = 1000;
/** A hard stop on paging so a misbehaving API cannot keep a job running forever. */
const MAX_PAGES = 50;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export interface GoogleContactPhotoDeps {
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  client?: GoogleApiClient;
  fetch?: typeof fetch;
}

/** Google serves profile photos from googleusercontent.com; nothing else is ever downloaded. */
function isPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

/** The first non-placeholder photo of a People API person, with their lower-cased addresses. */
export function photoOf(person: unknown): ContactPhotoRef | undefined {
  const record = asRecord(person);
  if (!record) return undefined;
  const photos = Array.isArray(record.photos) ? record.photos : [];
  const photo = photos
    .map(asRecord)
    .find((p) => p && p.default !== true && typeof p.url === "string");
  const emails = (Array.isArray(record.emailAddresses) ? record.emailAddresses : [])
    .map((e) => asRecord(e)?.value)
    .filter((v): v is string => typeof v === "string" && v.includes("@"))
    .map((v) => v.trim().toLowerCase());
  if (!photo || emails.length === 0) return undefined;
  return { emails: [...new Set(emails)], url: photo.url as string };
}

/** Photos of saved contacts and of "other contacts" (people the user has emailed) through the People API. */
export class GoogleContactPhotoSource implements ContactPhotoSource {
  private readonly client: GoogleApiClient;

  constructor(private readonly deps: GoogleContactPhotoDeps) {
    this.client = deps.client ?? new GoogleApiClient();
  }

  async *list(
    account: { connectorId: string; app: string; accountRef: string },
    context: AdapterContext,
  ): AsyncIterable<ContactPhotoRef> {
    const connector = this.deps.connectors.managed(account.connectorId);
    if (!connector) throw new Error("Google is not configured");
    const feeds = [
      {
        path: "/people/me/connections",
        query: "personFields=names,emailAddresses,photos",
        key: "connections",
      },
      {
        path: "/otherContacts",
        query: "readMask=names,emailAddresses,photos",
        key: "otherContacts",
      },
    ];
    for (const feed of feeds) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams(feed.query);
        params.set("pageSize", String(PAGE_SIZE));
        if (pageToken) params.set("pageToken", pageToken);
        const response = await this.client
          .request({
            connector,
            account: {
              connectorId: account.connectorId,
              providerRef: account.accountRef,
              app: account.app,
            },
            method: "GET",
            url: `${PEOPLE}${feed.path}?${params}`,
            context,
          })
          .catch((error: unknown) => {
            // The user may have granted only one of the two scopes; that feed is simply empty.
            if (error instanceof GoogleApiError && error.response?.status === 403) return undefined;
            throw error;
          });
        if (!response) break;
        const body = asRecord(response.data);
        for (const person of Array.isArray(body?.[feed.key]) ? (body[feed.key] as unknown[]) : []) {
          const ref = photoOf(person);
          if (ref) yield ref;
        }
        pageToken = typeof body?.nextPageToken === "string" ? body.nextPageToken : undefined;
        if (!pageToken) break;
      }
    }
  }

  async download(url: string, maxBytes: number, context: AdapterContext) {
    if (!isPhotoUrl(url)) return null;
    const response = await (this.deps.fetch ?? fetch)(url, {
      redirect: "error",
      signal: AbortSignal.any([context.signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]),
    });
    if (!response.ok) return null;
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    const { bytes, truncated } = await readBoundedBytes(response, maxBytes);
    if (truncated || bytes.byteLength === 0) return null;
    return {
      bytes,
      contentType: (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase(),
    };
  }
}
