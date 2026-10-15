import type { ConnectorProxyResponse } from "@rakazo/adapter-kit";

const DOC = "application/vnd.google-apps.document";
const SHEET = "application/vnd.google-apps.spreadsheet";
const SLIDES = "application/vnd.google-apps.presentation";

export interface EmulatedDriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Text content; for Docs, Sheets (CSV) and Slides it is what the text export returns. */
  text?: string;
  modifiedTime?: string;
  owners?: string[];
  size?: string;
  trashed?: boolean;
}

export interface DriveSeed {
  /** Keyed by the connector account reference. */
  accounts?: Record<string, { email: string; files: EmulatedDriveFile[] }>;
}

const DEFAULT_SEED: DriveSeed = {
  accounts: {
    "acct-a": {
      email: "ann@example.test",
      files: [
        { id: "doc1", name: "Roadmap", mimeType: DOC, text: "Q4 roadmap\nShip Drive tools" },
        { id: "sheet1", name: "Budget", mimeType: SHEET, text: "item,cost\nlaptop,1200" },
        { id: "txt1", name: "notes.txt", mimeType: "text/plain", text: "plain notes" },
        { id: "pdf1", name: "scan.pdf", mimeType: "application/pdf", size: "1024" },
      ],
    },
  },
};

const fail = (status: number): ConnectorProxyResponse => ({
  status,
  data: { error: { code: status, message: "emulated" } },
});

/** Offline stand-in for the slice of Drive API v3 the agent tools use. Mirrors `GmailApiEmulator.handle`. */
export class DriveApiEmulator {
  private readonly accounts: Map<string, { email: string; files: Map<string, EmulatedDriveFile> }>;
  /** Every request seen, so tests can assert on queries and upload types. */
  readonly requests: Array<{ method: string; url: string; body?: unknown; contentType?: string }> =
    [];
  private nextId = 1;

  constructor(seed: DriveSeed = DEFAULT_SEED) {
    this.accounts = new Map(
      Object.entries(seed.accounts ?? {}).map(([ref, a]) => [
        ref,
        { email: a.email, files: new Map(a.files.map((f) => [f.id, { ...f }])) },
      ]),
    );
  }

  file(accountRef: string, id: string): EmulatedDriveFile | undefined {
    return this.accounts.get(accountRef)?.files.get(id);
  }

  handle(
    accountRef: string,
    rawUrl: string,
    method = "GET",
    body?: unknown,
    contentType?: string,
  ): ConnectorProxyResponse {
    this.requests.push({ method, url: rawUrl, body, contentType });
    const account = this.accounts.get(accountRef);
    if (!account) return fail(401);
    const url = new URL(rawUrl);
    const path = url.pathname;
    if (path === "/drive/v3/about" && method === "GET")
      return { status: 200, data: { user: { emailAddress: account.email } } };
    if (path === "/drive/v3/files" && method === "GET") return this.list(account, url);
    if (path === "/drive/v3/files" && method === "POST") return this.create(account, body);
    const upload = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (upload && method === "PATCH")
      return this.upload(account, upload[1] ?? "", body, contentType);
    const exported = /^\/drive\/v3\/files\/([^/]+)\/export$/.exec(path);
    if (exported && method === "GET") return this.export(account, exported[1] ?? "", url);
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (one && method === "GET") return this.get(account, decodeURIComponent(one[1] ?? ""), url);
    if (one && method === "PATCH")
      return this.rename(account, decodeURIComponent(one[1] ?? ""), body);
    return fail(404);
  }

  private meta(file: EmulatedDriveFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime ?? "2026-10-01T12:00:00.000Z",
      owners: (file.owners ?? ["ann@example.test"]).map((emailAddress) => ({ emailAddress })),
      webViewLink: `https://drive.example.test/file/${file.id}`,
      ...(file.size ? { size: file.size } : {}),
    };
  }

  private list(
    account: { files: Map<string, EmulatedDriveFile> },
    url: URL,
  ): ConnectorProxyResponse {
    const q = url.searchParams.get("q") ?? "";
    // Only the clauses the tools emit: `name|fullText contains '…'` (ORed), `mimeType = '…'`, `trashed = false`.
    const quoted = String.raw`'((?:\\.|[^'\\])*)'`;
    const unquote = (s: string) => s.replace(/\\(.)/g, "$1");
    const contains = [
      ...q.matchAll(new RegExp(String.raw`(name|fullText) contains ${quoted}`, "g")),
    ];
    const mime = new RegExp(String.raw`mimeType = ${quoted}`).exec(q);
    const rest = q
      .replace(new RegExp(String.raw`(name|fullText) contains ${quoted}`, "g"), "")
      .replace(new RegExp(String.raw`mimeType = ${quoted}`, "g"), "")
      .replace(/trashed = false/g, "")
      .replace(/\b(and|or)\b|[()\s]/g, "");
    if (rest) return fail(400);
    const size = Number(url.searchParams.get("pageSize") ?? 100);
    const files = [...account.files.values()]
      .filter((f) => !f.trashed)
      .filter((f) => !mime || f.mimeType === unquote(mime[1] ?? ""))
      .filter(
        (f) =>
          contains.length === 0 ||
          contains.some((m) => {
            const needle = unquote(m[2] ?? "").toLowerCase();
            const hay = m[1] === "name" ? f.name : `${f.name}\n${f.text ?? ""}`;
            return hay.toLowerCase().includes(needle);
          }),
      )
      .slice(0, size);
    return { status: 200, data: { files: files.map((f) => this.meta(f)) } };
  }

  private get(
    account: { files: Map<string, EmulatedDriveFile> },
    id: string,
    url: URL,
  ): ConnectorProxyResponse {
    const file = account.files.get(id);
    if (!file) return fail(404);
    if (url.searchParams.get("alt") !== "media") return { status: 200, data: this.meta(file) };
    // Google-native files have no bytes to download; they must be exported.
    if (file.mimeType.startsWith("application/vnd.google-apps.")) return fail(403);
    return { status: 200, data: file.text ?? "" };
  }

  private export(
    account: { files: Map<string, EmulatedDriveFile> },
    id: string,
    url: URL,
  ): ConnectorProxyResponse {
    const file = account.files.get(id);
    if (!file) return fail(404);
    const want = url.searchParams.get("mimeType");
    const ok =
      (file.mimeType === SHEET && want === "text/csv") ||
      ((file.mimeType === DOC || file.mimeType === SLIDES) && want === "text/plain");
    return ok ? { status: 200, data: file.text ?? "" } : fail(403);
  }

  private create(
    account: { files: Map<string, EmulatedDriveFile> },
    body: unknown,
  ): ConnectorProxyResponse {
    const b = body as { name?: unknown; mimeType?: unknown } | undefined;
    if (typeof b?.name !== "string" || typeof b.mimeType !== "string") return fail(400);
    const file: EmulatedDriveFile = {
      id: `new${this.nextId++}`,
      name: b.name,
      mimeType: b.mimeType,
      text: "",
    };
    account.files.set(file.id, file);
    return { status: 200, data: this.meta(file) };
  }

  private upload(
    account: { files: Map<string, EmulatedDriveFile> },
    id: string,
    body: unknown,
    contentType?: string,
  ): ConnectorProxyResponse {
    const file = account.files.get(decodeURIComponent(id));
    if (!file) return fail(404);
    if (typeof body !== "string" || !contentType?.startsWith("text/")) return fail(400);
    file.text = body;
    return { status: 200, data: this.meta(file) };
  }

  private rename(
    account: { files: Map<string, EmulatedDriveFile> },
    id: string,
    body: unknown,
  ): ConnectorProxyResponse {
    const file = account.files.get(id);
    if (!file) return fail(404);
    const name = (body as { name?: unknown } | undefined)?.name;
    if (typeof name !== "string") return fail(400);
    file.name = name;
    return { status: 200, data: this.meta(file) };
  }
}
