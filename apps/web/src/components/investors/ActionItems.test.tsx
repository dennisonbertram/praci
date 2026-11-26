// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ActionItems } from "./ActionItems";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("collapses to a count on a phone until the toggle is pressed", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <ActionItems
        drafts={[
          {
            id: "u1",
            subject: "Example update",
            createdAt: "2026-10-01T09:00:00.000Z",
          } as never,
        ]}
        onOpen={() => {}}
      />,
    ),
  );
  const list = el.querySelector("ul") as HTMLElement;
  const toggle = el.querySelector("button[aria-expanded]") as HTMLElement;
  expect(list.className).toContain("max-sm:hidden");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggle.click());
  expect(list.className).not.toContain("max-sm:hidden");
});

const audit = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  fund: "Example Audit LLP",
  asOf: null,
  asOfMatched: true,
  dueDate: null,
  status: "open",
  mailThreadId: "t1",
  connectionId: "k1",
  draftRef: null,
  senderKnown: true,
  notes: "",
  dataRoomItemId: null,
  drafting: false,
  newMail: false,
  createdAt: "2026-10-20T10:00:00.000Z",
  ...over,
});

it("links a Draft ready row to its Gmail thread with Open draft", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <ActionItems
        drafts={[]}
        audits={[audit({ status: "drafted", mailThreadId: "t2" }) as never]}
        mailAccounts={[{ connectionId: "k1", label: "Me", address: "me@example.test" }]}
        onOpen={() => {}}
      />,
    ),
  );
  const link = [...el.querySelectorAll("a")].find((a) => a.textContent === "Open draft");
  expect(link?.getAttribute("href")).toBe(
    "https://mail.google.com/mail/u/me%40example.test/#all/t2",
  );
  expect(link?.getAttribute("target")).toBe("_blank");
});

it("falls back to /u/0/ and to Drafts when the request names no account or thread", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <ActionItems
        drafts={[]}
        audits={[audit({ status: "drafted", mailThreadId: null, connectionId: "other" }) as never]}
        mailAccounts={[{ connectionId: "k1", label: "Me", address: "me@example.test" }]}
        onOpen={() => {}}
      />,
    ),
  );
  const link = [...el.querySelectorAll("a")].find((a) => a.textContent === "Open draft");
  expect(link?.getAttribute("href")).toBe("https://mail.google.com/mail/u/0/#drafts");
});

it("keeps Draft reply on an open request and adds no Open draft", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <ActionItems drafts={[]} audits={[audit({}) as never]} onOpen={() => {}} />,
    ),
  );
  expect(
    [...el.querySelectorAll("button")].find((b) => b.textContent === "Draft reply"),
  ).toBeDefined();
  expect([...el.querySelectorAll("a")].find((a) => a.textContent === "Open draft")).toBeUndefined();
});

it("shows 3 items on a phone once opened and the rest after See all", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  try {
    const el = document.createElement("div");
    document.body.append(el);
    const drafts = Array.from(
      { length: 5 },
      (_, i) =>
        ({ id: `u${i}`, subject: `Update ${i}`, createdAt: "2026-10-01T09:00:00.000Z" }) as never,
    );
    await act(async () => createRoot(el).render(<ActionItems drafts={drafts} onOpen={() => {}} />));
    await act(async () => (el.querySelector("button[aria-expanded]") as HTMLElement).click());
    expect(el.querySelectorAll("li").length).toBe(3);
    const seeAll = [...el.querySelectorAll("button")].find((b) => b.textContent === "See all (5)");
    await act(async () => seeAll?.click());
    expect(el.querySelectorAll("li").length).toBe(5);
  } finally {
    vi.unstubAllGlobals();
  }
});
