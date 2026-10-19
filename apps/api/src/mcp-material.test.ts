import { describe, expect, it } from "vitest";
import { buildMcpUpdateMaterial, mcpOrigin } from "./mcp-material.js";

describe("buildMcpUpdateMaterial", () => {
  it("keeps the stored blob untouched when the update carries no credential data", () => {
    expect(
      buildMcpUpdateMaterial(
        {},
        {
          transport: "streamable_http",
          slug: "x",
          name: "x",
          endpoint: "https://mcp.example.test",
          headers: {},
        },
      ),
    ).toEqual({ action: "keep" });
  });

  it("stores a merged blob when a new secret is supplied, preserving OAuth state", () => {
    const existing = { secret: "old-token", oauth: { tokens: { access_token: "t" } } };
    const result = buildMcpUpdateMaterial(existing, {
      transport: "streamable_http",
      slug: "x",
      name: "x",
      endpoint: "https://mcp.example.test",
      headers: {},
      secret: "new-token",
    });
    expect(result).toEqual({
      action: "store",
      material: { secret: "new-token", oauth: { tokens: { access_token: "t" } }, headers: {} },
    });
  });

  it("persists env/headers even without any static secret (no silent drop)", () => {
    const result = buildMcpUpdateMaterial(
      {},
      {
        transport: "stdio",
        slug: "x",
        name: "x",
        command: "/bin/mcp",
        env: { API_KEY: "k" },
      },
    );
    expect(result).toEqual({ action: "store", material: { env: { API_KEY: "k" } } });
  });

  it("clearing removes static credentials but keeps OAuth state", () => {
    const existing = { secret: "token", env: { A: "b" }, oauth: { tokens: { access_token: "t" } } };
    const result = buildMcpUpdateMaterial(existing, {
      transport: "streamable_http",
      slug: "x",
      name: "x",
      endpoint: "https://mcp.example.test",
      headers: {},
      clearCredential: true,
    });
    expect(result).toEqual({
      action: "store",
      material: { oauth: { tokens: { access_token: "t" } } },
    });
  });

  it("clearing with no OAuth state yields an empty blob so the caller can delete the secret row", () => {
    const result = buildMcpUpdateMaterial(
      { secret: "token" },
      {
        transport: "streamable_http",
        slug: "x",
        name: "x",
        endpoint: "https://mcp.example.test",
        headers: {},
        clearCredential: true,
      },
    );
    expect(result).toEqual({ action: "store", material: {} });
  });

  it("clears endpoint-bound OAuth state while preserving static credentials", () => {
    const result = buildMcpUpdateMaterial(
      { secret: "token", oauth: { tokens: { access_token: "endpoint-token" } } },
      {
        transport: "streamable_http",
        slug: "x",
        name: "x",
        endpoint: "https://new-mcp.example.test",
        headers: {},
      },
      { clearOAuth: true },
    );
    expect(result).toEqual({
      action: "store",
      material: { secret: "token", headers: {} },
    });
  });

  it("deletes an OAuth-only blob when its endpoint changes", () => {
    const result = buildMcpUpdateMaterial(
      { oauth: { tokens: { access_token: "endpoint-token" } } },
      {
        transport: "streamable_http",
        slug: "x",
        name: "x",
        endpoint: "https://new-mcp.example.test",
        headers: {},
      },
      { clearOAuth: true },
    );
    expect(result).toEqual({ action: "store", material: {} });
  });

  it("replaces headers on update and leaves env untouched when the transport cannot express it", () => {
    const result = buildMcpUpdateMaterial(
      { secret: "s", env: { OLD: "x" }, headers: { Authorization: "a" } },
      {
        transport: "streamable_http",
        slug: "x",
        name: "x",
        endpoint: "https://mcp.example.test",
        headers: { Authorization: "b" },
      },
    );
    expect(result).toEqual({
      action: "store",
      material: { secret: "s", env: { OLD: "x" }, headers: { Authorization: "b" } },
    });
  });
});

describe("credentials when the endpoint moves to another origin", () => {
  const base = {
    transport: "streamable_http" as const,
    slug: "x",
    name: "x",
    endpoint: "https://new.example.test/mcp",
    headers: {},
  };
  const stored = () => ({
    secret: "synthetic-key",
    headers: { "X-Api-Key": "synthetic-header" },
    oauth: { tokens: { access_token: "t" } },
  });

  it("clears the stored secret, headers and OAuth when no new credentials are supplied", () => {
    expect(buildMcpUpdateMaterial(stored(), base, { clearOAuth: true, clearStatic: true })).toEqual(
      { action: "store", material: {} },
    );
  });

  it("stores only the new credentials when they are supplied with the change", () => {
    expect(
      buildMcpUpdateMaterial(
        stored(),
        { ...base, secret: "synthetic-new-key" },
        { clearOAuth: true, clearStatic: true },
      ),
    ).toEqual({ action: "store", material: { secret: "synthetic-new-key", headers: {} } });
  });

  it("keeps the secret when only the path changes", () => {
    expect(buildMcpUpdateMaterial(stored(), base, {})).toMatchObject({
      action: "store",
      material: { secret: "synthetic-key" },
    });
    expect(mcpOrigin("https://a.test/mcp")).toBe(mcpOrigin("https://a.test/sse"));
    expect(mcpOrigin("https://a.test/mcp")).not.toBe(mcpOrigin("https://b.test/mcp"));
    expect(mcpOrigin(null)).toBeNull();
  });
});
