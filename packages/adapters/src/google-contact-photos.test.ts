import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { GoogleApiClient } from "./google-api-request.js";
import { CONTACTS_OTHER_READONLY, CONTACTS_READONLY } from "./google-connector.js";
import { GoogleContactPhotoSource } from "./google-contact-photos.js";

const context: AdapterContext = {
  operationId: "op",
  traceId: "op",
  spaceId: "s",
  userId: "u",
  signal: new AbortController().signal,
};
const account = { connectorId: "google", app: "gmail", accountRef: "sub-1" };
const photo = (n: number, extra: object = {}) => ({
  url: `https://lh3.googleusercontent.com/p${n}=s100`,
  ...extra,
});

function source(pages: Record<string, unknown>, calls: string[] = []) {
  const connector = {
    proxy: async (request: { url: string }) => {
      calls.push(request.url);
      const url = new URL(request.url);
      const key = `${url.pathname}?${url.searchParams.get("pageToken") ?? ""}`;
      const data = pages[key];
      return typeof data === "number" ? { status: data, data: {} } : { status: 200, data };
    },
  } as unknown as ManagedConnectorProvider;
  return new GoogleContactPhotoSource({
    connectors: { managed: () => connector },
    client: new GoogleApiClient({ sleep: async () => {} }),
  });
}
const collect = async (s: GoogleContactPhotoSource) => {
  const refs = [];
  for await (const ref of s.list(account, context)) refs.push(ref);
  return refs;
};

describe("GoogleContactPhotoSource.list", () => {
  it("follows page tokens, skips default photos and lower-cases the addresses", async () => {
    const calls: string[] = [];
    const refs = await collect(
      source(
        {
          "/v1/people/me/connections?": {
            connections: [
              {
                photos: [photo(1)],
                emailAddresses: [{ value: "Ann@Example.test" }, { value: "ann@work.test" }],
              },
              {
                photos: [photo(2, { default: true })],
                emailAddresses: [{ value: "placeholder@example.test" }],
              },
            ],
            nextPageToken: "t2",
          },
          "/v1/people/me/connections?t2": {
            connections: [{ photos: [photo(3)], emailAddresses: [{ value: "bo@example.test" }] }],
          },
          "/v1/otherContacts?": {
            otherContacts: [
              { photos: [photo(4)], emailAddresses: [{ value: "cy@example.test" }] },
              { photos: [photo(5)] },
            ],
          },
        },
        calls,
      ),
    );
    expect(refs).toEqual([
      { emails: ["ann@example.test", "ann@work.test"], url: photo(1).url },
      { emails: ["bo@example.test"], url: photo(3).url },
      { emails: ["cy@example.test"], url: photo(4).url },
    ]);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("personFields=names%2CemailAddresses%2Cphotos");
    expect(calls[2]).toContain("readMask=names%2CemailAddresses%2Cphotos");
  });

  it("treats a feed the user did not grant (403) as empty", async () => {
    const refs = await collect(
      source({
        "/v1/people/me/connections?": 403,
        "/v1/otherContacts?": {
          otherContacts: [{ photos: [photo(4)], emailAddresses: [{ value: "cy@example.test" }] }],
        },
      }),
    );
    expect(refs.map((r) => r.emails)).toEqual([["cy@example.test"]]);
  });
});

describe("GoogleContactPhotoSource.download", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const fetchOf = (body: Uint8Array, headers: Record<string, string> = {}) =>
    (async () =>
      new Response(new Uint8Array(body), {
        headers: { "content-type": "image/png", ...headers },
      })) as typeof fetch;
  const make = (fetchImpl: typeof fetch) =>
    new GoogleContactPhotoSource({ connectors: { managed: () => undefined }, fetch: fetchImpl });

  it("downloads from googleusercontent.com only", async () => {
    const s = make(fetchOf(png));
    expect(await s.download("https://lh3.googleusercontent.com/p1", 1000, context)).toEqual({
      bytes: png,
      contentType: "image/png",
    });
    expect(await s.download("https://evil.example.test/p1", 1000, context)).toBeNull();
    expect(await s.download("http://lh3.googleusercontent.com/p1", 1000, context)).toBeNull();
    expect(
      await s.download("https://googleusercontent.com.evil.test/p1", 1000, context),
    ).toBeNull();
  });

  it("returns null for an image over the limit", async () => {
    const s = make(fetchOf(png));
    expect(await s.download("https://lh3.googleusercontent.com/p1", 3, context)).toBeNull();
  });
});

describe("GoogleContactPhotoSource against the Gmail/People emulator", () => {
  it("pages through both address books, skips placeholders and needs the scopes", async () => {
    const gmail = new GmailApiEmulator({
      mailboxes: { acct: { address: "me@example.test", messages: [] } },
    });
    const people = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        emails: [`P${i}@Example.test`],
        photoUrl: i % 2 ? null : `https://lh3.googleusercontent.com/e${i}`,
      }));
    gmail.setPeople("acct", { saved: people(5), other: people(1) });
    const connector = {
      proxy: async (request: { accountRef: string; url: string; method: "GET" }) =>
        gmail.handle(request.accountRef, `${request.url}`, request.method),
    } as unknown as ManagedConnectorProvider;
    const emulated = new GoogleContactPhotoSource({
      connectors: { managed: () => connector },
      client: new GoogleApiClient({ sleep: async () => {} }),
    });
    const acct = { ...account, accountRef: "acct" };
    const run = async () => {
      const refs = [];
      for await (const ref of emulated.list(acct, context)) refs.push(ref.emails[0]);
      return refs;
    };
    // No contacts scope: both feeds answer 403 and the account simply has no photos.
    expect(await run()).toEqual([]);
    gmail.grantScope("acct", CONTACTS_READONLY);
    gmail.grantScope("acct", CONTACTS_OTHER_READONLY);
    expect(await run()).toEqual([
      "p0@example.test",
      "p2@example.test",
      "p4@example.test",
      "p0@example.test",
    ]);
  });
});
