// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const { lingui, translate } = vi.hoisted(() => {
  const translate = (first: unknown, ...values: unknown[]) => {
    if (Array.isArray(first)) {
      return (first as string[]).reduce((out, part, i) => out + part + String(values[i] ?? ""), "");
    }
    if (first && typeof first === "object" && "message" in first) {
      const descriptor = first as { message: string; values?: Record<string, unknown> };
      return descriptor.message.replace(/\{(\w+)\}/g, (_, key: string) =>
        String(descriptor.values?.[key] ?? `{${key}}`),
      );
    }
    return String(first ?? "");
  };
  return {
    translate,
    lingui: () => ({ _: translate, t: translate, i18n: { locale: "en" } }),
  };
});
vi.mock("@lingui/react/macro", () => ({
  useLingui: lingui,
  Trans: ({ children, message }: { children?: ReactNode; message?: string }) => message ?? children,
}));
vi.mock("@lingui/react", () => ({
  useLingui: lingui,
  Trans: ({ children, message }: { children?: ReactNode; message?: string }) => message ?? children,
}));
vi.mock("@lingui/core/macro", () => ({ t: translate }));
vi.mock("@lingui/core", () => ({
  i18n: { _: translate, locale: "en", activate: () => undefined },
}));
vi.mock("@rakazo/ui-web", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ children, ...props }: { children?: ReactNode } & React.ComponentProps<"button">) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Skeleton: () => null,
    Switch: ({
      checked,
      disabled,
      onCheckedChange,
    }: {
      checked: boolean;
      disabled?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
      />
    ),
    Table: Box,
    TableBody: Box,
    TableCell: Box,
    TableHead: Box,
    TableHeader: Box,
    TableHeadRow: Box,
    TableRow: Box,
  };
});
const mcp = vi.hoisted(() => ({
  list: vi.fn(),
  pendingActions: vi.fn(async (): Promise<unknown[]> => []),
  update: vi.fn(),
  revoke: vi.fn(),
  createToken: vi.fn(),
  decideAction: vi.fn(),
  activity: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { mcpConnections: mcp } }));

import { McpConnectionsPanel } from "./McpConnectionsPanel";

const connection = {
  id: "c1",
  kind: "oauth" as const,
  label: "Claude",
  spaceId: "space-1",
  spaceName: "Northwind",
  readOnly: false,
  tokenPrefix: null,
  createdAt: "2026-10-20T12:00:00.000Z",
  lastUsedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

const pendingAction = {
  id: "action-1",
  tool: "send_email",
  args: {},
  connectionLabel: "Claude",
  createdAt: "2026-10-20T12:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function mount(list: unknown) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mcp.list.mockResolvedValue(list);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<McpConnectionsPanel />));
  await act(async () => {});
  return { container, root };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the MCP URL next to Create token and copies it", async () => {
  const { container, root } = await mount({
    mcpUrl: "https://example.ts.net/mcp",
    spaces: [{ id: "space-1", name: "Northwind", current: true }],
    connections: [connection],
  });
  expect(container.textContent).toContain("https://example.ts.net/mcp");
  expect(container.querySelector('[aria-label="Copy MCP URL"]')).not.toBeNull();
  await act(async () => root.unmount());
  container.remove();
});

it("leaves the URL box out when the server has no MCP URL", async () => {
  const { container, root } = await mount({
    mcpUrl: "",
    spaces: [{ id: "space-1", name: "Northwind", current: true }],
    connections: [connection],
  });
  expect(container.querySelector('[aria-label="Copy MCP URL"]')).toBeNull();
  expect(container.textContent).toContain("Claude");
  await act(async () => root.unmount());
  container.remove();
});

it("shows last used as a relative time and created as a date", async () => {
  const { container, root } = await mount({
    mcpUrl: "https://example.ts.net/mcp",
    spaces: [{ id: "space-1", name: "Northwind", current: true }],
    connections: [connection],
  });
  expect(container.textContent).toContain("5m ago");
  expect(container.textContent).toContain("Oct 20, 2026");
  await act(async () => root.unmount());
  container.remove();
});

it("announces an MCP action that failed after approval", async () => {
  mcp.pendingActions.mockResolvedValueOnce([pendingAction]).mockResolvedValue([]);
  mcp.decideAction.mockResolvedValue({ status: "failed" });
  const { container, root } = await mount({ mcpUrl: "", spaces: [], connections: [] });

  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Approve")
      ?.click();
  });

  expect(container.querySelector('[role="alert"]')?.textContent).toContain("send_email failed");
  await act(async () => root.unmount());
  container.remove();
});

it("keeps a dispatched MCP action approval silent", async () => {
  mcp.pendingActions.mockResolvedValueOnce([pendingAction]).mockResolvedValue([]);
  mcp.decideAction.mockResolvedValue({ status: "done" });
  const { container, root } = await mount({ mcpUrl: "", spaces: [], connections: [] });

  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Approve")
      ?.click();
  });

  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
  container.remove();
});

it("does not send a second revoke while the first revoke is pending", async () => {
  mcp.revoke.mockClear();
  const revoke = deferred<void>();
  mcp.revoke.mockReturnValue(revoke.promise);
  const { container, root } = await mount({ mcpUrl: "", spaces: [], connections: [connection] });
  const button = container.querySelector('[aria-label="Revoke Claude"]') as HTMLButtonElement;

  await act(async () => {
    button.click();
    button.click();
  });

  expect(mcp.revoke).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  expect((container.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBe(true);
  expect(
    (container.querySelector('[aria-label="Activity Claude"]') as HTMLButtonElement).disabled,
  ).toBe(false);
  revoke.resolve();
  await act(async () => {});
  await act(async () => root.unmount());
  container.remove();
});

it("ignores an older load that resolves after a newer load", async () => {
  mcp.list.mockClear();
  mcp.update.mockClear();
  mcp.revoke.mockClear();
  const second = { ...connection, id: "c2", label: "Other" };
  const staleLoad = deferred<unknown>();
  mcp.list
    .mockResolvedValueOnce({ mcpUrl: "", spaces: [], connections: [connection, second] })
    .mockReturnValueOnce(staleLoad.promise)
    .mockResolvedValueOnce({ mcpUrl: "", spaces: [], connections: [second] });
  mcp.update.mockResolvedValue(undefined);
  mcp.revoke.mockResolvedValue(undefined);
  const { container, root } = await mount({ mcpUrl: "", spaces: [], connections: [] });

  await act(async () => {
    container
      .querySelector('[role="switch"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await vi.waitFor(() => expect(mcp.list).toHaveBeenCalledTimes(2));

  await act(async () => {
    (container.querySelector('[aria-label="Revoke Other"]') as HTMLButtonElement).click();
  });
  await vi.waitFor(() => expect(mcp.list).toHaveBeenCalledTimes(3));

  staleLoad.resolve({ mcpUrl: "", spaces: [], connections: [connection, second] });
  await act(async () => {});

  expect(container.querySelector('[aria-label="Revoke Claude"]')).toBeNull();
  await act(async () => root.unmount());
  container.remove();
});
