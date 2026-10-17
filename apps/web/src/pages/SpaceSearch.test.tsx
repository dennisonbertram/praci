import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../lib/hide-amounts-preference";
import { SpaceSearchResults } from "./SpaceSearch";

it("shows a matching Data room document and a mail search instead of No results", () => {
  const html = renderToStaticMarkup(
    <SpaceSearchResults
      query="SAFE"
      hits={[]}
      loading={false}
      documents={[{ id: "doc-1", label: "MOCK SAFE - Quill Capital.pdf" }]}
      onSelect={() => undefined}
      onSearchMail={() => undefined}
    />,
  );
  expect(html).toContain("MOCK SAFE - Quill Capital.pdf");
  expect(html).toContain("Search mail for “SAFE”");
  expect(html).not.toContain("No results");
});

it("does not repeat a conversation's name before its snippet", () => {
  const html = renderToStaticMarkup(
    <SpaceSearchResults
      hits={[
        {
          kind: "conversation",
          botId: "bot-1",
          botName: "Finance agent",
          title: "Finance agent",
          snippet: "Answers questions about cash",
        },
      ]}
      loading={false}
      pages={[{ id: "finance", label: "Finance" }]}
      onSelect={() => undefined}
    />,
  );
  expect(html).toContain("Finance agent");
  expect(html).not.toContain("Finance agent · ");
  expect(html).toContain(">Chat<");
  expect(html).toContain(">Finance<");
});

it("masks amounts in document names while amounts are hidden", () => {
  setHideAmounts(true);
  try {
    const html = renderToStaticMarkup(
      <SpaceSearchResults
        hits={[]}
        loading={false}
        documents={[{ id: "doc-1", label: "SAFE $1,000,000.pdf" }]}
        onSelect={() => undefined}
      />,
    );
    expect(html).not.toContain("1,000,000");
    expect(html).toContain("SAFE $•••.pdf");
  } finally {
    setHideAmounts(false);
  }
});

it("says nothing matched when only the mail search is left", () => {
  const html = renderToStaticMarkup(
    <SpaceSearchResults
      query="qwxzv"
      hits={[]}
      loading={false}
      onSelect={() => undefined}
      onSearchMail={() => undefined}
    />,
  );
  expect(html).toContain("No matches in chats, pages or documents.");
  expect(html).toContain("Search mail for “qwxzv”");
});

it("lists matching artifacts", () => {
  const html = renderToStaticMarkup(
    <SpaceSearchResults
      query="investor"
      hits={[]}
      loading={false}
      artifacts={[{ id: "a1", label: "MOCK Investor Update - September.md" }]}
      onSelect={() => undefined}
      onSearchMail={() => undefined}
    />,
  );
  expect(html).toContain("MOCK Investor Update - September.md");
  expect(html).not.toContain("No matches in chats");
});
