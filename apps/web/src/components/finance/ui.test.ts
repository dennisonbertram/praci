import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({ Trans: () => null }));

import { trailFor } from "./ui";

const finance = { label: "Finance", to: "/app/finance" };
const charge = [
  finance,
  { label: "Subscriptions", to: "/app/finance#subscriptions" },
  { label: "Cloudnine", to: "/app/finance/vendor/cloudnine" },
  { label: "Oct 8", to: "/app/finance/transaction/t1" },
];

it("keeps the origin's own origin, so the trail is as deep as when opened directly", () => {
  const breakdown = { label: "Breakdown", to: "/app/finance?by=vendor#breakdown" };
  const vendor = { label: "Cloudnine", to: "/app/finance/vendor/cloudnine", back: breakdown };
  expect(trailFor(charge, vendor).map((c) => c.label)).toEqual([
    "Finance",
    "Breakdown",
    "Cloudnine",
    "Oct 8",
  ]);
  expect(trailFor(charge, null).map((c) => c.label)).toHaveLength(4);
});

it("does not repeat Finance when the origin is the dashboard itself", () => {
  expect(trailFor(charge, finance).map((c) => c.label)).toEqual(["Finance", "Oct 8"]);
});
