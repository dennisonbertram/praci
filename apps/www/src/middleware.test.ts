import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import middleware, { config } from "../middleware";

describe("marketing site middleware", () => {
  it("negotiates Markdown on the canonical page URL", async () => {
    const response = middleware(
      new Request("https://praci.ai/", {
        headers: { accept: "text/markdown,text/html;q=0.8" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
    await expect(response.text()).resolves.toContain("# Praci");
  });

  it("serves HTML for pages that have no Markdown version", () => {
    for (const path of ["/de/", "/ko/", "/zh/", "/de"]) {
      for (const accept of [null, "*/*", "text/markdown"]) {
        const headers = accept ? { accept } : undefined;
        const response = middleware(new Request(`https://praci.ai${path}`, { headers }));

        expect(response.status, `${path} ${accept ?? "(no accept)"}`).toBe(200);
        expect(response.headers.get("content-type")).not.toBe(
          "text/markdown; charset=utf-8",
        );
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
      }
    }
  });

  it("lets unknown URLs fall through to the HTML not-found page", () => {
    const response = middleware(
      new Request("https://praci.ai/does-not-exist", {
        headers: { accept: "*/*" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).not.toBe(
      "text/markdown; charset=utf-8",
    );
  });

  it("returns 406 for representations the site does not provide", async () => {
    const response = middleware(
      new Request("https://praci.ai/", {
        headers: { accept: "application/json" },
      }),
    );

    expect(response.status).toBe(406);
    expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
    await expect(response.text()).resolves.toContain(
      "text/html or text/markdown",
    );
  });

  it("continues browser requests with negotiation-safe response headers", () => {
    const response = middleware(
      new Request("https://praci.ai/", {
        headers: { accept: "text/html" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
    expect(response.headers.get("link")).toContain("/index.md");
  });

  it("redirects www to the apex host", () => {
    const response = middleware(
      new Request("https://www.praci.ai/de/?utm=site", { method: "HEAD" }),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://praci.ai/de/?utm=site");
  });

  it("redirects /sitemap.xml to the sitemap index", () => {
    const response = middleware(new Request("https://praci.ai/sitemap.xml"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://praci.ai/sitemap-index.xml",
    );
    expect(config.matcher).toContain("/sitemap.xml");
  });

  it("keeps the hosting redirect aligned with middleware", () => {
    const hosting = JSON.parse(
      readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
    ) as {
      redirects: Array<{
        source: string;
        destination: string;
        permanent?: boolean;
        has?: Array<{ type: string; value: string }>;
      }>;
    };

    expect(hosting.redirects).toEqual([
      expect.objectContaining({
        source: "/",
        destination: "https://praci.ai/",
        statusCode: 301,
        has: [{ type: "host", value: { eq: "www.praci.ai" } }],
      }),
      expect.objectContaining({
        source: "/:path*",
        destination: "https://praci.ai/:path*",
        statusCode: 301,
        has: [{ type: "host", value: { eq: "www.praci.ai" } }],
      }),
      expect.objectContaining({
        source: "/sitemap.xml",
        destination: "/sitemap-index.xml",
        statusCode: 301,
      }),
    ]);
  });
});
