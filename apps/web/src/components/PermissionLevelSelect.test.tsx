// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), "");
vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t }) }));
vi.mock("../lib/user-error", () => ({ errorText: (_e: unknown, fallback: string) => fallback }));
const api = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { permissions: api } }));

import { PermissionLevelSelect } from "./PermissionLevelSelect";

i18n.loadAndActivate({ locale: "en", messages: {} });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const select = () => container.querySelector("select") as HTMLSelectElement;
const render = async (agent?: Parameters<typeof PermissionLevelSelect>[0]["agent"]) => {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PermissionLevelSelect agent={agent} />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
};
const change = (value: string) =>
  act(async () => {
    select().value = value;
    select().dispatchEvent(new Event("change", { bubbles: true }));
  });

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  api.get.mockResolvedValue({ level: null, effectiveDefault: "open" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows the effective level and the Open sentence only at Open", async () => {
  api.get.mockResolvedValue({ level: "open", effectiveDefault: "open" });
  await render();
  expect(select().value).toBe("open");
  expect(container.textContent).toContain("always ask.");
  api.set.mockResolvedValue({ level: "ask_changes", effectiveDefault: "open" });
  await change("ask_changes");
  expect(api.set).toHaveBeenCalledWith({ level: "ask_changes" });
  expect(select().value).toBe("ask_changes");
  expect(container.textContent).not.toContain("always ask.");
});

it("offers the deployment default as the first option and saves null for it", async () => {
  api.get.mockResolvedValue({ level: "ask_changes", effectiveDefault: "ask_everything" });
  await render();
  expect(select().options[0]?.value).toBe("");
  expect(select().options[0]?.textContent).toBe("Default (Ask for everything)");
  expect(select().value).toBe("ask_changes");
  api.set.mockResolvedValue({ level: null, effectiveDefault: "ask_everything" });
  await change("");
  expect(api.set).toHaveBeenCalledWith({ level: null });
  expect(select().value).toBe("");
});

it("shows an inherited level through the default option, keeping the Open sentence", async () => {
  await render();
  expect(select().value).toBe("");
  expect(container.textContent).toContain("always ask.");
});

it("keeps an explicit choice that equals the deployment default", async () => {
  api.get.mockResolvedValue({ level: "open", effectiveDefault: "open" });
  await render();
  expect(select().value).toBe("open");
  api.set.mockResolvedValue({ level: "open", effectiveDefault: "open" });
  await change("open");
  expect(api.set).toHaveBeenCalledWith({ level: "open" });
  expect(select().value).toBe("open");
});

it("ignores further changes while a save is in flight", async () => {
  await render();
  let finish = (_value: { level: string | null; effectiveDefault: string }) => {};
  api.set.mockImplementation(
    () =>
      new Promise<{ level: string | null; effectiveDefault: string }>((resolve) => {
        finish = resolve;
      }),
  );
  await change("ask_changes");
  expect(api.set).toHaveBeenCalledTimes(1);
  expect(select().disabled).toBe(true);
  await change("ask_everything");
  expect(api.set).toHaveBeenCalledTimes(1);
  await act(async () => finish({ level: "ask_changes", effectiveDefault: "open" }));
  await act(async () => {});
  expect(select().disabled).toBe(false);
  expect(select().value).toBe("ask_changes");
});

it("shows an error when saving fails", async () => {
  await render();
  api.set.mockRejectedValue(new Error("nope"));
  await change("ask_everything");
  expect(container.textContent).toContain("Could not save permissions");
});

it("saves again after a failure", async () => {
  await render();
  api.set.mockRejectedValueOnce(new Error("nope"));
  await change("ask_changes");
  expect(container.textContent).toContain("Could not save permissions");
  api.set.mockResolvedValue({ level: "ask_changes", effectiveDefault: "open" });
  await change("ask_changes");
  expect(api.set).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("Could not save permissions");
  expect(select().value).toBe("ask_changes");
});

it("shows an error when loading fails", async () => {
  api.get.mockRejectedValue(new Error("nope"));
  await render();
  expect(container.textContent).toContain("Could not load permissions");
});

it("offers Retry when loading fails and recovers", async () => {
  api.get.mockRejectedValueOnce(new Error("nope"));
  await render();
  expect(select().disabled).toBe(true);
  const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  await act(async () => {});
  expect(container.textContent).not.toContain("Could not load permissions");
  expect(select().disabled).toBe(false);
});

it("tells the caller after a space save, not after a failed one", async () => {
  const onSaved = vi.fn();
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PermissionLevelSelect onSaved={onSaved} />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  api.set.mockRejectedValueOnce(new Error("nope"));
  await change("ask_changes");
  expect(onSaved).not.toHaveBeenCalled();
  api.set.mockResolvedValue({ level: "ask_changes", effectiveDefault: "open" });
  await change("ask_changes");
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("reports the space level without refetching when the caller stores it", async () => {
  function Caller() {
    const [level, setLevel] = useState<string | null>(null);
    return (
      <I18nProvider i18n={i18n}>
        <PermissionLevelSelect onLevel={setLevel} />
        <span>{level}</span>
      </I18nProvider>
    );
  }
  await act(async () => root.render(<Caller />));
  await act(async () => {});
  expect(container.textContent).toContain("open");
  expect(api.get).toHaveBeenCalledTimes(1);
});

it("per agent: Same as space is first and an override goes to onChange, not permissions.set", async () => {
  const onChange = vi.fn();
  await render({ level: null, clamped: false, onChange });
  expect(api.get).not.toHaveBeenCalled();
  expect(select().disabled).toBe(false);
  expect(select().options[0]?.textContent).toBe("Same as space");
  expect(select().value).toBe("");
  await change("ask_everything");
  expect(onChange).toHaveBeenCalledWith("ask_everything");
  await change("");
  expect(onChange).toHaveBeenCalledWith(null);
  expect(api.set).not.toHaveBeenCalled();
});

it("per agent: a clamped agent shows Ask for changes, disabled, without Open", async () => {
  await render({ level: null, clamped: true, onChange: vi.fn() });
  expect(select().disabled).toBe(true);
  expect(select().value).toBe("ask_changes");
  expect([...select().options].map((o) => o.value)).toEqual(["ask_changes", "ask_everything"]);
});
