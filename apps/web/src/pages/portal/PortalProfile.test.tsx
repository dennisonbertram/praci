// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const proposePortalProfile = vi.hoisted(() => vi.fn());
vi.mock("../../lib/portal", () => ({ proposePortalProfile }));

import { PortalProfile } from "./PortalProfile";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  proposePortalProfile.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
const type = async (label: string, value: string) => {
  const input = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

it("sends only the fields filled in, with the address together", async () => {
  await act(async () => root.render(<PortalProfile />));
  await act(async () => button("Update your details").click());
  expect(button("Send for review").disabled).toBe(true);
  await type("Last name", "Holder-Jones");
  await type("City", "Springfield");
  // A half-filled address would blank the rest of the stored one, so it cannot be sent.
  expect(button("Send for review").disabled).toBe(true);
  await type("Street", "1 Main St");
  await type("Postal code", "12345");
  await type("Country", "US");
  await act(async () => button("Send for review").click());
  expect(proposePortalProfile).toHaveBeenCalledWith({
    lastName: "Holder-Jones",
    address: { street: "1 Main St", city: "Springfield", postalCode: "12345", country: "US" },
  });
  expect(host.textContent).toContain("Sent to the company for review");
});
