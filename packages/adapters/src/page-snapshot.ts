import { randomUUID } from "node:crypto";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { BotPage, PageData, PageLiveBlock } from "@rakazo/contracts";
import { isShareableArtifactMimeType } from "@rakazo/contracts";
import {
  cellValue,
  DNS_PREFETCH_OFF_META,
  formatCell,
  htmlPageDataScript,
  markdownToSafeHtml,
  splitPage,
  tableColumns,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createArtifactShare, getArtifactShare } from "@rakazo/db";
import { renderPageChartSvg, revokePageShares } from "./pages.js";
import { attachWorkspaceFileToThread } from "./thread-artifacts.js";

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `:root{color-scheme:light dark;--fg:#171717;--bg:#fff;--line:#e5e5e5;--muted:#737373}
@media(prefers-color-scheme:dark){:root{--fg:#ededed;--bg:#0a0a0a;--line:#2e2e2e;--muted:#a3a3a3}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
section{border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0;overflow-x:auto}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line)}
pre{overflow-x:auto}svg{max-width:100%;height:auto}.l,.m,footer{color:var(--muted);font-size:13px}.v{font-size:26px;font-weight:600;margin:0}`;

/** What a live block shows while it has nothing to show; same wording as the page itself. */
function placeholder(block: PageLiveBlock | undefined): string {
  switch (block?.status) {
    case "pending":
      return "Waiting for approval";
    case "denied":
      return "Not approved";
    case "missing":
      return "Source not found";
    default:
      return "No data yet";
  }
}

const noValue = (block: PageLiveBlock | undefined) =>
  block?.status === "missing" || block?.status === "pending" || block?.status === "denied";

async function renderBlocks(
  page: Pick<BotPage, "content">,
  blocks: PageLiveBlock[],
): Promise<string> {
  let next = 0;
  const parts: string[] = [];
  for (const segment of splitPage(page.content)) {
    if (segment.kind === "markdown") {
      parts.push(markdownToSafeHtml(segment.text));
    } else if (segment.kind === "metric") {
      const live = blocks[next++];
      const body =
        live?.text !== undefined
          ? `<p class="v">${esc(live.text)}</p>`
          : `<p class="m">${placeholder(live)}</p>`;
      parts.push(`<section><div class="l">${esc(segment.block.label)}</div>${body}</section>`);
    } else if (segment.kind === "table") {
      const live = blocks[next++];
      const rows = live?.rows ?? [];
      let body = `<p class="m">${placeholder(live)}</p>`;
      if (rows.length) {
        const columns = tableColumns(segment.block.columns, rows);
        const head = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
        const trs = rows
          .map(
            (row) =>
              `<tr>${columns.map((c) => `<td>${esc(formatCell(cellValue(row, c.key), c.format))}</td>`).join("")}</tr>`,
          )
          .join("");
        body = `<table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table>`;
      }
      parts.push(`<section><div class="l">${esc(segment.block.name)}</div>${body}</section>`);
    } else if (segment.kind === "chart") {
      const live = segment.chart.source !== undefined ? blocks[next++] : undefined;
      const body = noValue(live)
        ? `<p class="m">${placeholder(live)}</p>`
        : (await renderPageChartSvg(segment.chart, live?.rows?.length ? live.rows : undefined))
            // Namespace declarations are only needed for standalone SVG files.
            .replace(/ xmlns(:\w+)?="[^"]*"/g, "");
      parts.push(`<section>${body}</section>`);
    }
  }
  return parts.join("\n");
}

/**
 * One self-contained, static HTML document for a page: no script of ours beyond the data hand-off,
 * no external resource, and only rendered values (never a source definition, call, URL or secret
 * name). A blocks page becomes static HTML; an html page keeps its own markup and gets its current
 * data delivered as the same "praci-data" message the live viewer sends, once the page has loaded.
 */
export async function renderPageSnapshotHtml(
  page: Pick<BotPage, "title" | "content"> & { kind?: string },
  data: PageData,
  now = new Date(),
): Promise<string> {
  switch (page.kind ?? "blocks") {
    case "blocks": {
      const body = await renderBlocks(page, "blocks" in data ? data.blocks : []);
      const taken = now.toISOString().slice(0, 16).replace("T", " ");
      return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><style>${CSS}</style></head><body><main><h1>${esc(page.title)}</h1>\n${body}\n<footer>Snapshot ${taken} UTC</footer></main></body></html>`;
    }
    case "html": {
      // Error text can name a call or URL, so only values and times are shared.
      const sources = Object.fromEntries(
        Object.entries("sources" in data ? data.sources : {}).map(
          ([name, { error: _, ...rest }]) => [name, rest],
        ),
      );
      const head = `${DNS_PREFETCH_OFF_META}<script>window.addEventListener("load",function(){${htmlPageDataScript(sources)}});</script>`;
      // Insert at the start of <head>; a page without one gets the tags after its doctype.
      const withHead = page.content.replace(/<head(\s[^>]*)?>/i, (open) => `${open}${head}`);
      if (withHead !== page.content) return withHead;
      const doctype = /^\s*<!doctype[^>]*>/i.exec(page.content)?.[0] ?? "";
      return `${doctype || "<!doctype html>"}${head}${page.content.slice(doctype.length)}`;
    }
    default:
      throw new Error(`Cannot snapshot a "${page.kind}" page.`);
  }
}

/**
 * Freezes the page into a new version of the bot's snapshot artifact (one family per page title)
 * and makes its share link; creating it ends the previous live link of the same family.
 */
export async function sharePageSnapshot(
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  input: { spaceId: string; userId: string; botId: string; page: BotPage; data: PageData },
): Promise<{ artifactId: string; token: string; expiresAt: Date }> {
  const html = await renderPageSnapshotHtml(input.page, input.data);
  const { artifactId } = await attachWorkspaceFileToThread(deps, {
    spaceId: input.spaceId,
    userId: input.userId,
    botId: input.botId,
    runId: `page-share:${input.page.id}`,
    filePath: "snapshot.html",
    name: `${input.page.title} snapshot`,
    bytes: new TextEncoder().encode(html),
    operationId: `page.share:${randomUUID()}`,
  });
  // A rename starts a new artifact family, so end every earlier link of this page first.
  await revokePageShares(deps.prisma, {
    spaceId: input.spaceId,
    botId: input.botId,
    pageId: input.page.id,
  });
  const { token, expiresAt } = await createArtifactShare(
    deps.prisma,
    { spaceId: input.spaceId, userId: input.userId },
    artifactId,
    isShareableArtifactMimeType,
  );
  return { artifactId, token, expiresAt };
}

/** The page's live share, if any: its newest snapshot artifact. Never returns a token (only hashes are stored). */
export async function pageShareStatus(
  prisma: PrismaClient,
  input: { spaceId: string; userId: string; botId: string; pageId: string },
): Promise<{ artifactId: string; expiresAt: string } | null> {
  const newest = await prisma.artifact.findFirst({
    where: {
      spaceId: input.spaceId,
      userId: input.userId,
      botId: input.botId,
      runId: `page-share:${input.pageId}`,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!newest) return null;
  const share = await getArtifactShare(prisma, input, newest.id);
  return share ? { artifactId: share.artifactId, expiresAt: share.expiresAt.toISOString() } : null;
}
