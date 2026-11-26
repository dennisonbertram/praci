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

it("shows the trail a vendor was opened from through a charge", () => {
  const spend = { label: "Spend", to: "/app/finance?by=vendor#spend" };
  const chargeFromSpend = {
    label: "Globex charge",
    to: "/app/finance/transaction/t1",
    back: spend,
  };
  const vendor = [
    finance,
    { label: "Subscriptions", to: "/app/finance#subscriptions" },
    { label: "Globex", to: "/app/finance/vendor/globex" },
  ];
  expect(trailFor(vendor, chargeFromSpend).map((c) => c.label)).toEqual([
    "Finance",
    "Spend",
    "Globex charge",
    "Globex",
  ]);
});

it("drops a loop back to the page itself: vendor, charge, vendor", () => {
  const subs = { label: "Subscriptions", to: "/app/finance#subscriptions" };
  const vendorCrumb = { label: "Globex", to: "/app/finance/vendor/globex", back: subs };
  const chargeCrumb = {
    label: "Globex charge",
    to: "/app/finance/transaction/t1",
    back: vendorCrumb,
  };
  const vendor = [finance, subs, { label: "Globex", to: "/app/finance/vendor/globex" }];
  expect(trailFor(vendor, chargeCrumb, "/app/finance/vendor/globex").map((c) => c.label)).toEqual([
    "Finance",
    "Subscriptions",
    "Globex",
  ]);
});
