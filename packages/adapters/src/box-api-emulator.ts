export interface EmulatedBoxItem {
  id: string;
  type: "file" | "folder" | "web_link";
  name: string;
  /** Folder id; an item without one is in the root ("0"). */
  parent?: string;
  bytes?: Uint8Array;
  /** Overrides the size Box reports. */
  size?: number;
  modifiedAt?: string;
  /** Where the content call redirects to; defaults to Box's download host. */
  downloadUrl?: string;
}

/** Offline stand-in for the slice of the Box API v2 the Data room import uses. */
export class BoxApiEmulator {
  private readonly items = new Map<string, EmulatedBoxItem>();
  /** Every request seen, so tests can assert on URLs and headers. */
  readonly requests: Array<{ url: string; authorization: string | null; method: string }> = [];
  /** Answer every API call with this status (401 for a lapsed sign-in). */
  failWith: number | undefined;
  /** Children per page; small values exercise pagination. */
  pageSize = 100;

  constructor(items: EmulatedBoxItem[]) {
    for (const item of items) this.items.set(item.id, item);
  }

  private children(folder: string) {
    return [...this.items.values()].filter((item) => (item.parent ?? "0") === folder);
  }

  private view(item: EmulatedBoxItem) {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      ...(item.type === "file" ? { size: item.size ?? item.bytes?.byteLength ?? 0 } : {}),
      modified_at: item.modifiedAt ?? "2026-01-02T03:04:05-08:00",
    };
  }

  private json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    this.requests.push({
      url: url.toString(),
      authorization: headers.get("authorization"),
      method: init?.method ?? "GET",
    });
    if (url.host === "dl.boxcloud.com") {
      const item = this.items.get(url.pathname.split("/").at(-1) ?? "");
      return new Response((item?.bytes ?? new Uint8Array()).slice().buffer, {
        headers: { "content-type": "application/octet-stream" },
      });
    }
    if (url.host !== "api.box.com") return new Response("unexpected host", { status: 500 });
    if (this.failWith) return this.json({ code: "emulated" }, this.failWith);
    const path = url.pathname.replace(/^\/2\.0/, "");
    const folderItems = /^\/folders\/(\d+)\/items$/.exec(path);
    if (folderItems?.[1]) {
      if (folderItems[1] !== "0" && this.items.get(folderItems[1])?.type !== "folder")
        return this.json({ code: "not_found" }, 404);
      const all = this.children(folderItems[1]);
      const start = Number(url.searchParams.get("marker") ?? 0);
      const page = all.slice(start, start + this.pageSize);
      const next = start + this.pageSize;
      return this.json({
        entries: page.map((item) => this.view(item)),
        limit: this.pageSize,
        ...(next < all.length ? { next_marker: String(next) } : { next_marker: null }),
      });
    }
    const one = /^\/(files|folders)\/(\d+)$/.exec(path);
    if (one?.[2]) {
      const item = this.items.get(one[2]);
      if (!item || item.type !== (one[1] === "files" ? "file" : "folder"))
        return this.json({ code: "not_found" }, 404);
      return this.json(this.view(item));
    }
    const content = /^\/files\/(\d+)\/content$/.exec(path);
    if (content?.[1]) {
      const item = this.items.get(content[1]);
      if (!item || item.type !== "file") return this.json({ code: "not_found" }, 404);
      return new Response(null, {
        status: 302,
        headers: { location: item.downloadUrl ?? `https://dl.boxcloud.com/d/${item.id}` },
      });
    }
    if (path === "/search") {
      const needle = (url.searchParams.get("query") ?? "").toLowerCase();
      const hits = [...this.items.values()].filter((item) =>
        item.name.toLowerCase().includes(needle),
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return this.json({
        entries: hits.slice(offset, offset + this.pageSize).map((item) => this.view(item)),
        total_count: hits.length,
      });
    }
    return this.json({ code: "not_found" }, 404);
  };
}
