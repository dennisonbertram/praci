// @vitest-environment jsdom

import type { FinanceSource } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const connect = vi.hoisted(() => vi.fn());
const cryptoRpc = vi.hoisted(() => ({
  crypto: vi.fn(),
  cryptoConnect: vi.fn(),
  exchanges: vi.fn(),
  exchangeConnect: vi.fn(),
  cryptoProviderConnect: vi.fn(),
  cryptoProviderRemove: vi.fn(),
}));
vi.mock("../../lib/finance-connect", () => ({ connectFinanceProvider: connect }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: cryptoRpc } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { FinanceSection, useFinanceStatus } from "./FinanceSection";

function Standalone(props: {
  sources: FinanceSource[];
  onChanged: () => void;
  extras?: Parameters<typeof FinanceSection>[0]["extras"];
}) {
  return <FinanceSection {...props} status={useFinanceStatus()} />;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = (provider: "mercury" | "brex", status: FinanceSource["status"]): FinanceSource => ({
  provider,
  serverId: status === "not_connected" ? null : "s1",
  status,
  lastSyncedAt: null,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function show(
  sources: FinanceSource[],
  onChanged = vi.fn(),
  extras?: Parameters<typeof FinanceSection>[0]["extras"],
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Standalone sources={sources} onChanged={onChanged} extras={extras} />
      </MemoryRouter>,
    ),
  );
  return onChanged;
}
const tile = (p: string) => container.querySelector(`[data-testid="finance-tile-${p}"]`);
const press = (p: string) =>
  act(async () => {
    (tile(p)?.querySelector("button") as HTMLButtonElement | null)?.click();
  });
beforeEach(() => {
  cryptoRpc.crypto.mockResolvedValue({ connected: false, hasApiKey: false });
  cryptoRpc.exchanges.mockResolvedValue([]);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("connects through the Finance API and shows Open Finance once connected", async () => {
  connect.mockResolvedValue("connected");
  const onChanged = await show([source("mercury", "not_connected"), source("brex", "ok")]);
  expect(tile("mercury")?.textContent).toContain("Not connected");
  expect(tile("brex")?.textContent).toContain("Connected");
  expect(tile("brex")?.querySelector("a")?.getAttribute("href")).toBe("/app/finance");
  expect(tile("brex")?.querySelector("img")?.getAttribute("src")).toContain("brex");
  expect(tile("mercury")?.querySelector("img")?.getAttribute("src")).toBe("/logos/mercury.svg");

  await press("mercury");
  expect(connect).toHaveBeenCalledWith("mercury", false);
  expect(onChanged).toHaveBeenCalled();
});

it("shows a connected bank's extra line (its agents) like the other connected tiles", async () => {
  await show([source("mercury", "ok"), source("brex", "not_connected")], vi.fn(), {
    mercury: <span>Used by Finance agent</span>,
    brex: <span>Used by nobody</span>,
  });
  expect(tile("mercury")?.textContent).toContain("Used by Finance agent");
  // A tile that is not connected has no agents to show.
  expect(tile("brex")?.textContent).not.toContain("Used by");
});

it("reconnects a source that needs it and reports a cancelled sign-in", async () => {
  connect.mockResolvedValue("cancelled");
  await show([source("mercury", "needs_reconnect"), source("brex", "error")]);
  expect(tile("mercury")?.textContent).toContain("Needs reconnect");
  expect(tile("brex")?.textContent).toContain("Failed");
  // The same word pair as app tiles: Failed offers "Try again", Needs reconnect offers "Reconnect".
  expect(tile("brex")?.querySelector("button")?.textContent).toBe("Try again");
  expect(tile("mercury")?.querySelector("button")?.textContent).toBe("Reconnect");
  await press("mercury");
  expect(connect).toHaveBeenCalledWith("mercury", true);
  expect(tile("mercury")?.querySelector('[role="alert"]')?.textContent).toContain("cancelled");
});

it("shows a failed connect", async () => {
  connect.mockRejectedValue(new Error("Could not reach the server"));
  await show([source("mercury", "not_connected"), source("brex", "not_connected")]);
  await press("brex");
  expect(tile("brex")?.querySelector('[role="alert"]')?.textContent).toContain("Could not reach");
});

const crypto = () => container.querySelector('[data-testid="finance-tile-crypto"]') as Element;
const openCryptoMenu = () =>
  act(async () =>
    (crypto().querySelector('button[aria-label="More Blockscout actions"]') as HTMLElement).click(),
  );
const menuItems = () =>
  [...document.body.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent);
const typeKey = async (value: string) => {
  const input = document.body.querySelector('[role="dialog"] input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const press2 = (root: ParentNode, label: string) =>
  act(async () => {
    (
      [...root.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement
    ).click();
  });

it("shows a keyless Blockscout server as Connected and offers the optional key", async () => {
  cryptoRpc.crypto.mockResolvedValue({ connected: true, hasApiKey: false });
  await show([source("mercury", "ok"), source("brex", "ok")]);
  expect(crypto().querySelector('[data-status="connected"]')).not.toBeNull();
  expect(crypto().textContent).not.toContain("Not connected");
  // One main action like the other connected tiles; the optional key waits in the menu.
  const links = [...crypto().querySelectorAll("a")].map((a) => a.textContent);
  expect(links).toEqual(["Open Finance"]);
  expect(crypto().querySelector('a[href="/app/finance/crypto"]')).not.toBeNull();
  await openCryptoMenu();
  expect(menuItems()).toEqual(["Add API key"]);
});

it("opens a modal from Connect, saves the key and then shows Connected", async () => {
  cryptoRpc.crypto
    .mockResolvedValueOnce({ connected: false, hasApiKey: false })
    .mockResolvedValue({ connected: true, hasApiKey: true });
  cryptoRpc.cryptoConnect.mockResolvedValue({ serverId: "s2", hasApiKey: true });
  const onChanged = await show([source("mercury", "ok"), source("brex", "ok")]);
  expect(crypto().querySelector("input")).toBeNull();
  await press2(crypto(), "Connect");
  const dialog = document.body.querySelector('[role="dialog"]') as Element;
  expect(dialog.textContent).toContain("Get an API key");
  expect(dialog.querySelector("a")?.getAttribute("href")).toBe("https://dev.blockscout.com");
  await typeKey("k-123");
  await press2(dialog, "Save");
  expect(cryptoRpc.cryptoConnect).toHaveBeenCalledWith({ apiKey: "k-123" });
  expect(onChanged).toHaveBeenCalled(); // page data refreshes: the connect may create an MCP server
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  expect(crypto().textContent).toContain("Connected");
  await openCryptoMenu();
  expect(menuItems()).toEqual(["Replace API key"]);
});

it("shows the server's error inside the modal", async () => {
  cryptoRpc.cryptoConnect.mockRejectedValue(new Error("Invalid API key"));
  await show([source("mercury", "ok"), source("brex", "ok")]);
  await press2(crypto(), "Connect");
  await typeKey("bad");
  await press2(document.body.querySelector('[role="dialog"]') as Element, "Save");
  expect(document.body.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
    "Invalid API key",
  );
});

const exchange = (provider: string, connected: boolean) => ({
  id: `x-${provider}`,
  provider,
  connected,
  lastSyncedAt: connected ? "2026-10-15T12:00:00.000Z" : null,
  lastError: null,
  totalCents: 0,
  balances: [],
});

it("shows an exchange as Connected only after its first sync", async () => {
  cryptoRpc.exchanges.mockResolvedValue([exchange("coinbase", false), exchange("kraken", true)]);
  await show([source("mercury", "ok"), source("brex", "ok")]);
  expect(tile("coinbase")?.textContent).toContain("Not connected");
  expect(tile("kraken")?.textContent).toContain("Connected");
  expect(tile("kraken")?.textContent).toContain("Replace key");
});

it("connects Kraken from a dialog with the key help link, then shows Connected", async () => {
  let saved = false;
  cryptoRpc.exchanges.mockImplementation(async () => (saved ? [exchange("kraken", true)] : []));
  cryptoRpc.exchangeConnect.mockImplementation(async () => {
    saved = true;
    return exchange("kraken", true);
  });
  await show([source("mercury", "ok"), source("brex", "ok")]);
  await press2(tile("kraken") as Element, "Connect");
  const dialog = document.body.querySelector('[role="dialog"]') as Element;
  expect(dialog.querySelector("a")?.getAttribute("href")).toBe(
    "https://www.kraken.com/u/security/api",
  );
  const [key, secret] = [...dialog.querySelectorAll("input")] as HTMLInputElement[];
  expect(secret?.type).toBe("password");
  for (const [input, value] of [
    [key, "kk"],
    [secret, "ss"],
  ] as const)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await press2(dialog, "Connect");
  expect(cryptoRpc.exchangeConnect).toHaveBeenCalledWith({
    provider: "kraken",
    key: "kk",
    secret: "ss",
  });
  expect(tile("kraken")?.textContent).toContain("Connected");
});

it("shows the exchange's error inside the dialog and stays not connected", async () => {
  cryptoRpc.exchangeConnect.mockRejectedValue(new Error("This key can't read balances"));
  await show([source("mercury", "ok"), source("brex", "ok")]);
  await press2(tile("kraken") as Element, "Connect");
  const dialog = document.body.querySelector('[role="dialog"]') as Element;
  for (const input of dialog.querySelectorAll("input"))
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "x");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await press2(dialog, "Connect");
  expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("can't read balances");
  expect(tile("kraken")?.textContent).toContain("Not connected");
});

const alchemy = () => container.querySelector('[data-testid="finance-tile-alchemy"]') as Element;

it("connects Alchemy only after the server accepts the key, and shows its error inline", async () => {
  const off = {
    connected: false,
    hasApiKey: false,
    alchemy: { connected: false, lastError: null },
  };
  cryptoRpc.crypto
    .mockResolvedValueOnce(off)
    .mockResolvedValue({ ...off, alchemy: { connected: true, lastError: null } });
  cryptoRpc.cryptoProviderConnect
    .mockRejectedValueOnce(new Error("Alchemy rejected the API key"))
    .mockResolvedValue({ ok: true });
  await show([source("mercury", "ok"), source("brex", "ok")]);
  expect(alchemy().querySelector("img")?.getAttribute("src")).toBe("/logos/alchemy.svg");
  await press2(alchemy(), "Connect");
  const dialog = document.body.querySelector('[role="dialog"]') as Element;
  expect(dialog.querySelector("a")?.getAttribute("href")).toContain("alchemy.com");
  await typeKey("bad");
  await press2(dialog, "Save");
  expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("Alchemy rejected");
  expect(alchemy().textContent).toContain("Not connected");
  await typeKey("good");
  await press2(dialog, "Save");
  expect(cryptoRpc.cryptoProviderConnect).toHaveBeenLastCalledWith({
    provider: "alchemy",
    apiKey: "good",
  });
  expect(alchemy().textContent).toContain("Connected");
});
