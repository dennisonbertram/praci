// @vitest-environment jsdom

import type { RakazoDesktop, RakazoDesktopScanner, ScannerState } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    investors: { shares: async () => [] },
    inbox: { list: async () => [] },
    connections: { list: async () => [], catalog: async () => [] },
    mcp: { servers: { list: async () => [] } },
    dataRoom: {
      folders: async () => [],
      items: { list: async () => ({ items: [], nextCursor: null }) },
      search: async () => ({ items: [], nextCursor: null }),
      item: async () => null,
      consent: async () => ({ granted: true }),
      itemDelete: async () => ({ ok: true }),
      itemRetry: async () => ({ ok: true }),
      facetValues: async () => ({ types: [], parties: [], sources: [], hasDates: false }),
      stats: async () => ({ items: 0, ready: 0, failed: 0 }),
      processing: async () => ({ reading: 0, indexing: 0, tagging: 0, failed: 0, current: null }),
      imports: async () => [],
    },
    legal: { itemLinks: async () => ({ contractTitle: null, deadlines: 0 }) },
  },
  withSpaceHeaders: () => new Headers(),
  selectedSpaceId: () => "s1",
}));

import { ScannerPage } from "./Scanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const render = async (node: ReactNode) => {
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
  await flush();
};
const status = () => container.querySelector('[role="status"]')?.textContent ?? "";
const copyButtons = () =>
  [...container.querySelectorAll("button")].filter((b) => b.textContent === "Copy command");
const writeText = vi.fn(async () => undefined);

function bridge(kind: ScannerState["kind"], platform: string, patch: Partial<ScannerState> = {}) {
  let state: ScannerState = {
    kind,
    autoScan: true,
    folder: ["Scans"],
    ...patch,
  };
  const listeners = new Set<(next: ScannerState) => void>();
  const scanner: RakazoDesktopScanner = {
    state: async () => state,
    onState: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    scan: async () => undefined,
    cancel: async () => undefined,
    setAutoScan: async (autoScan) => {
      state = { ...state, autoScan };
      for (const listener of listeners) listener(state);
    },
    setFolder: async (folder) => {
      state = { ...state, folder };
    },
    setScope: async () => undefined,
    pending: async () => [],
    confirm: async () => ({ ok: true }),
    onDocument: () => () => undefined,
  };
  window.rakazoDesktop = { platform, scanner } as RakazoDesktop;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  writeText.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.rakazoDesktop = undefined;
  vi.resetAllMocks();
});

describe("scanner status line", () => {
  it("names the scanner and says it scans when paper is loaded", async () => {
    bridge("ready", "darwin", { device: "ScanSnap iX1600" });
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("ScanSnap iX1600 · Scans when paper is loaded");
  });

  it("shows only the scanner name when auto-scan is off", async () => {
    bridge("ready", "darwin", { device: "ScanSnap iX1600", autoScan: false });
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("ScanSnap iX1600");
  });

  it("falls back to Ready when an older desktop sends no device", async () => {
    bridge("ready", "darwin");
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("Ready");
  });

  it("accepts the placeholder name older desktops send", async () => {
    bridge("ready", "linux", { device: "Fujitsu scanner" });
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("Fujitsu scanner · Scans when paper is loaded");
  });
});

describe("missing SANE", () => {
  const error = "SANE is missing. Install SANE and restart the app.";

  it("on macOS offers one copyable Homebrew command and no repeated alert", async () => {
    bridge("sane-missing", "darwin", { error });
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("Install sane-backends with Homebrew");
    expect(container.textContent).toContain("brew install sane-backends");
    const buttons = copyButtons();
    expect(buttons).toHaveLength(1);
    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith("brew install sane-backends");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain(error);
  });

  it("elsewhere names the package without a copy button", async () => {
    bridge("sane-missing", "linux", { error });
    await render(<ScannerPage />);
    await flush();
    expect(status()).toBe("Install sane-backends");
    expect(copyButtons()).toHaveLength(0);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

it("does not repeat a scanning paragraph while a batch runs", async () => {
  bridge("scanning", "darwin", { device: "ScanSnap iX1600" });
  await render(<ScannerPage />);
  await flush();
  expect(container.textContent).not.toContain("Scanning pages…");
});

it("still shows a failed scan's reason", async () => {
  bridge("error", "darwin", { error: "Paper jam. Clear the feeder." });
  await render(<ScannerPage />);
  await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Paper jam. Clear the feeder.",
  );
});
