// @vitest-environment jsdom

import type { PipelineImportCard as CardData, MessageBlock } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineImportCard } from "./PipelineImportCard";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + (values[i] ?? ""), ""),
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    variant: _variant,
    size: _size,
    render,
    ...props
  }: ComponentProps<"button"> & { variant?: string; size?: string; render?: ReactNode }) =>
    render ? <span>{props.children}</span> : <button type="button" {...props} />,
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));
vi.mock("./ListControls", () => ({ usePhone: () => false }));
const { rpc } = vi.hoisted(() => ({
  rpc: { threads: { pipelineImport: vi.fn(), applyPipelineImport: vi.fn() } },
}));
vi.mock("../lib/rpc", () => ({ rpc }));

// Every name is invented.
const reviewing = (extra: Partial<CardData> = {}): CardData => ({
  status: "reviewing",
  hash: "hash-1",
  add: 3,
  update: 0,
  questions: [
    {
      id: "p:0:0",
      row: 0,
      kind: "person",
      name: "Drew Example",
      firm: "Peak Fund",
      referred: 0,
      newRecord: true,
      candidates: [
        {
          id: "c1",
          name: "Drew Example",
          email: "drew@example.test",
          organization: "Elsewhere",
          stays: null,
        },
      ],
      allowNew: true,
    },
    {
      id: "r:sam",
      row: null,
      kind: "referrer",
      name: "Sam Example",
      firm: null,
      referred: 12,
      newRecord: false,
      candidates: [{ id: "c2", name: "Sam Example", email: null, organization: null, stays: null }],
      allowNew: true,
    },
  ],
  newContacts: ["Riley Example · Fund A"],
  savedContacts: ["Kai Sample · kai@example.test"],
  noPerson: ["Fund C"],
  existing: [],
  result: null,
  ...extra,
});
const block = (extra: object = {}) =>
  ({
    kind: "ask",
    text: "Add 3 prospects to Fundraising",
    detail: "Plain",
    approvalEffectId: "effect-1",
    status: "pending",
    pipelineImport: { importId: "imp-1" },
    actions: [{ id: "deny", label: "Deny" }],
    ...extra,
  }) as Extract<MessageBlock, { kind: "ask" }>;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onAnswer = vi.fn(async () => undefined);

const render = async (data: CardData, askBlock = block(), canAnswer = true) => {
  rpc.threads.pipelineImport.mockResolvedValue(data);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PipelineImportCard
          block={askBlock}
          botId="bot-1"
          message={{ id: "m1", runId: "r1" }}
          canAnswer={canAnswer}
          onAnswer={onAnswer}
          fallback={<div>plain card</div>}
        />
      </MemoryRouter>,
    );
  });
};
const button = (name: string | RegExp) =>
  [...host.querySelectorAll("button")].find((item) =>
    typeof name === "string" ? item.textContent === name : name.test(item.textContent ?? ""),
  );
const radio = (label: string, group = 0) => {
  const set = host.querySelectorAll("fieldset")[group] as HTMLElement;
  return [...set.querySelectorAll("label")]
    .find((item) => item.textContent?.startsWith(label))
    ?.querySelector("input") as HTMLInputElement;
};
const click = (element: Element) =>
  act(async () => {
    (element as HTMLElement).click();
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  rpc.threads.applyPipelineImport.mockResolvedValue({ ok: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("PipelineImportCard", () => {
  it("states the title, its questions and one noun per count, with nothing pre-answered", async () => {
    await render(reviewing());
    const text = host.textContent ?? "";
    expect(text).toContain("Add 3 prospects to Fundraising");
    expect(text).toContain("Saved contacts are not overwritten.");
    expect(text).toContain("Which contact is this?");
    expect(text).toContain("Who made these introductions?");
    expect(text).toContain("referred 12 prospects");
    expect(text).toContain("1 new contact");
    expect(text).toContain("1 contact already saved");
    expect(text).toContain("1 prospect with no person yet");
    // The lists start open.
    expect(text).toContain("Riley Example · Fund A");
    expect(text).toContain("Kai Sample · kai@example.test");
    expect(text).toContain("Fund C");
    expect(text).toContain("2 left to choose");
    expect([...host.querySelectorAll("input")].some((input) => input.checked)).toBe(false);
    expect(button("Add 3 prospects")?.disabled).toBe(true);
    expect(text).not.toMatch(/always allow/i);
  });

  it("sends the answers with the hash it read, once all are chosen", async () => {
    await render(reviewing());
    await click(radio("Drew Example"));
    expect(host.textContent).toContain("1 left to choose");
    await click(radio("New contact", 1));
    expect(host.textContent).not.toContain("left to choose");
    await click(button("Add 3 prospects") as Element);
    expect(rpc.threads.applyPipelineImport).toHaveBeenCalledWith({
      botId: "bot-1",
      runId: "r1",
      messageId: "m1",
      hash: "hash-1",
      answers: { "p:0:0": "c1", "r:sam": "new" },
    });
  });

  it("Skip this row counts one prospect fewer, Leave Referred by empty does not", async () => {
    await render(reviewing());
    await click(radio("Skip this row"));
    await click(radio("Leave Referred by empty", 1));
    expect(button("Add 2 prospects")?.disabled).toBe(false);
  });

  it("two skipped people on one firm count as one row", async () => {
    const base = reviewing().questions[0] as CardData["questions"][number];
    await render(
      reviewing({
        add: 1,
        questions: [
          { ...base, id: "p:0:0", row: 0 },
          { ...base, id: "p:0:1", row: 0, name: "Blake Example" },
        ],
      }),
    );
    await click(radio("Skip this row", 0));
    await click(radio("Skip this row", 1));
    // Skipping the only firm leaves nothing to add; it was never below zero.
    expect(button("Add 0 prospects")?.disabled).toBe(true);
  });

  it("counts a skipped existing row, so the only update can become nothing to do", async () => {
    const base = reviewing().questions[0] as CardData["questions"][number];
    await render(
      reviewing({
        add: 0,
        update: 1,
        questions: [{ ...base, id: "p:0:0", row: 0, newRecord: false }],
      }),
    );
    await click(radio("Skip this row"));
    expect(button("Update 0 prospects")?.disabled).toBe(true);
  });

  it("counts a skipped new row, so the button names the update that is left", async () => {
    const base = reviewing().questions[0] as CardData["questions"][number];
    await render(
      reviewing({
        add: 1,
        update: 1,
        questions: [
          { ...base, id: "p:0:0", row: 0, newRecord: true },
          { ...base, id: "p:1:0", row: 1, name: "Blake Example", newRecord: false },
        ],
      }),
    );
    await click(radio("Skip this row", 0));
    await click(radio("Drew Example", 1));
    expect(button("Update 1 prospect")?.disabled).toBe(false);
  });

  it("two skipped people on one of two firms still add the other", async () => {
    const base = reviewing().questions[0] as CardData["questions"][number];
    await render(
      reviewing({
        add: 2,
        questions: [
          { ...base, id: "p:0:0", row: 0 },
          { ...base, id: "p:0:1", row: 0, name: "Blake Example" },
        ],
      }),
    );
    await click(radio("Skip this row", 0));
    await click(radio("Skip this row", 1));
    expect(button("Add 1 prospect")?.disabled).toBe(false);
  });

  it("says when a match stays on another prospect", async () => {
    const data = reviewing();
    const candidate = data.questions[0]?.candidates[0];
    if (candidate) candidate.stays = "First Fund";
    await render(data);
    expect(host.textContent).toContain("Stays on First Fund");
  });

  it("offers no new contact when one would repeat an email", async () => {
    const data = reviewing();
    if (data.questions[0]) data.questions[0].allowNew = false;
    await render(data);
    const options = host.querySelectorAll("fieldset")[0]?.textContent ?? "";
    expect(options).not.toContain("New contact");
  });

  it("Cancel denies the card", async () => {
    await render(reviewing());
    await click(button("Cancel") as Element);
    expect(onAnswer).toHaveBeenCalledWith("deny");
  });

  it("an update with no new prospect says Update", async () => {
    await render(reviewing({ add: 0, update: 2, questions: [] }));
    expect(host.textContent).toContain("Update 2 prospects in Fundraising");
    expect(button("Update 2 prospects")?.disabled).toBe(false);
  });

  it("shows the result, failed rows and the way to the Pipeline", async () => {
    await render(
      reviewing({
        status: "done",
        result: {
          added: 95,
          updated: 0,
          newContacts: 84,
          savedContacts: 23,
          failed: [{ firm: "Maple Fund 21", reason: "Could not be saved." }],
        },
      }),
      block({ status: "answered", answer: "allow" }),
    );
    const text = host.textContent ?? "";
    expect(text).toContain("Added 95 prospects to Fundraising");
    expect(text).toContain("84 new contacts · 23 contacts already saved · 1 row failed");
    expect(text).toContain("Could not save:");
    expect(text).toContain("Maple Fund 21");
    expect(text).toContain("View in Pipeline");
  });

  it("falls back to the plain card when closed, denied or unreadable", async () => {
    await render(reviewing({ status: "closed" }));
    expect(host.textContent).toContain("plain card");
    await render(reviewing(), block({ status: "answered", answer: "deny" }));
    expect(host.textContent).toContain("plain card");
    rpc.threads.pipelineImport.mockRejectedValue(new Error("no"));
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PipelineImportCard
            block={block({ text: "Another" })}
            botId="bot-1"
            message={{ id: "m2", runId: "r1" }}
            canAnswer
            onAnswer={onAnswer}
            fallback={<div>plain card</div>}
          />
        </MemoryRouter>,
      );
    });
    expect(host.textContent).toContain("plain card");
  });
});
