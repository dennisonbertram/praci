// @vitest-environment jsdom
import type { AccountExport } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rpc } from "../lib/rpc";
import { DataExportSection } from "./DataExport";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings.join(""),
    i18n: { date: (date: Date) => date.toISOString().slice(0, 10) },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    variant: _variant,
    render,
    ...props
  }: ComponentProps<"button"> & { variant?: string; render?: ReactNode }) =>
    render ? (
      <a {...(render as { props: object }).props} {...(props as ComponentProps<"a">)} />
    ) : (
      <button {...props} />
    ),
}));
vi.mock("../lib/rpc", () => ({
  rpc: { account: { exportLatest: vi.fn(), exportRequest: vi.fn() } },
}));

const job = (over: Partial<AccountExport>): AccountExport => ({
  id: "exp 1",
  status: "ready",
  progress: 100,
  expiresAt: "2030-01-08T12:00:00.000Z",
  ...over,
});
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const latest = vi.mocked(rpc.account.exportLatest);
const request = vi.mocked(rpc.account.exportRequest);
const settle = () => act(async () => {});
const mount = async () => {
  await act(async () => root.render(<DataExportSection />));
  await settle();
};

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("offers the button, then shows progress after it is pressed", async () => {
  latest.mockResolvedValue(null);
  request.mockResolvedValue(job({ status: "running", progress: 0 }));
  await mount();
  expect(host.querySelector("h3")?.textContent).toBe("Export my data");
  expect(host.querySelector("button")?.textContent).toBe("Request export");
  await act(async () => host.querySelector("button")?.click());
  expect(request).toHaveBeenCalledOnce();
  expect(host.querySelector("h3")?.textContent).toBe("Export my data");
  expect(host.textContent).toBe("Export my dataPreparing… 0%");
  expect(host.querySelector("button")).toBeNull();
});

it("polls while preparing and shows the download and expiry when ready", async () => {
  latest.mockResolvedValueOnce(job({ status: "running", progress: 40 }));
  await mount();
  expect(host.textContent).toBe("Export my dataPreparing… 40%");
  latest.mockResolvedValue(job({}));
  await act(async () => vi.advanceTimersByTimeAsync(2100));
  const link = host.querySelector("a");
  expect(link?.getAttribute("href")).toBe("/api/account/exports/exp%201/download");
  expect(host.querySelector("h3")?.textContent).toBe("Export my data");
  expect(host.querySelector("a")?.textContent).toBe("Download");
  expect(host.textContent).toContain("Request new export");
  expect(host.textContent).toContain("Ready until 2030-01-08");
  const calls = latest.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(latest.mock.calls.length).toBe(calls);
});

it("shows the button again after a failed export and reports a request error", async () => {
  latest.mockResolvedValue(job({ status: "failed", progress: 30 }));
  request.mockRejectedValue(new Error("boom"));
  await mount();
  expect(host.textContent).toContain("The export failed. Try again.");
  expect(host.querySelector("button")?.textContent).toBe("Request export");
  await act(async () => host.querySelector("button")?.click());
  expect(host.querySelector("[role=alert]")).not.toBeNull();
});

it("says Preparing right after the click, before the server answers", async () => {
  latest.mockResolvedValue(null);
  request.mockReturnValue(new Promise(() => {}));
  await mount();
  await act(async () => host.querySelector("button")?.click());
  expect(host.querySelector("[role=status]")?.textContent).toBe("Preparing…");
});

it("offers a new export when one is ready", async () => {
  latest.mockResolvedValue(job({}));
  request.mockResolvedValue(job({ status: "running", progress: 0 }));
  await mount();
  const again = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Request new export",
  );
  await act(async () => again?.click());
  expect(request).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Preparing… 0%");
});
