// @vitest-environment jsdom
import type { CompanyFact, CompanyReview, CompanyReviewCandidate } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompanyScreen from "../app/company";
import CompanyFactScreen from "../app/company-fact";
import { useCompanyQuery } from "./use-company-query";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  alert: vi.fn(),
  push: vi.fn(),
  openURL: vi.fn(),
  back: vi.fn(),
  params: {} as Record<string, string>,
  apiBase: "http://api.test",
  spaceId: "space-1",
  actionHandlers: new Map<string, (() => void) | undefined>(),
  selectionGeneration: 0,
  sessionGeneration: 0,
  listeners: {
    api: new Set<() => void>(),
    selection: new Set<() => void>(),
    session: new Set<() => void>(),
  },
}));

vi.mock("expo-router", () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    router: { push: state.push, back: state.back },
    useFocusEffect: (callback: () => undefined | (() => void)) => useEffect(callback, [callback]),
    useLocalSearchParams: () => state.params,
  };
});
vi.mock("../lib/api", () => ({
  currentApiBase: () => state.apiBase,
  currentSpaceSelectionGeneration: () => state.selectionGeneration,
  rpc: state.rpc,
  selectedSpaceId: () => state.spaceId,
  subscribeApiBase: (listener: () => void) => {
    state.listeners.api.add(listener);
    return () => state.listeners.api.delete(listener);
  },
  subscribeSpaceSelection: (listener: () => void) => {
    state.listeners.selection.add(listener);
    return () => state.listeners.selection.delete(listener);
  },
}));
vi.mock("./session", () => ({
  currentSessionGeneration: () => state.sessionGeneration,
  subscribeSessionGeneration: (listener: () => void) => {
    state.listeners.session.add(listener);
    return () => state.listeners.session.delete(listener);
  },
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    ActivityIndicator: () => createElement("i", { "data-testid": "spinner" }),
    Alert: { alert: state.alert },
    Linking: { openURL: state.openURL },
    AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
    ScrollView: box,
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) =>
      createElement("span", { role: accessibilityRole }, children),
    TextInput: ({
      accessibilityLabel,
      value,
      onChangeText,
      maxLength,
    }: {
      accessibilityLabel?: string;
      value?: string;
      onChangeText?: (value: string) => void;
      maxLength?: number;
    }) =>
      createElement("input", {
        "aria-label": accessibilityLabel,
        value,
        maxLength,
        onChange: (event: Event) => onChangeText?.((event.target as HTMLInputElement).value),
      }),
    View: box,
  };
});
vi.mock("../components/company-list", () => ({
  CompanyList: ({
    rows,
  }: {
    rows: {
      id: string;
      title: string;
      onPress?: () => void;
      onConfirm?: () => void;
      onReject?: () => void;
    }[];
  }) =>
    createElement(
      "div",
      null,
      ...rows.map((row) =>
        createElement(
          "div",
          { key: row.id },
          createElement("span", null, row.title),
          row.onPress
            ? createElement("button", { type: "button", onClick: row.onPress }, `Open ${row.title}`)
            : null,
          row.onConfirm
            ? createElement(
                "button",
                { type: "button", onClick: row.onConfirm },
                `Confirm ${row.title}`,
              )
            : null,
          row.onReject
            ? createElement(
                "button",
                { type: "button", onClick: row.onReject },
                `Reject ${row.title}`,
              )
            : null,
        ),
      ),
    ),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    state.actionHandlers.set(label, onPress);
    return createElement("button", { type: "button", disabled, onClick: onPress }, label);
  },
}));
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({ children }: { children?: ReactNode }) =>
    createElement("section", null, children),
  SettingsRow: ({
    title,
    detail,
    onPress,
  }: {
    title: string;
    detail?: string;
    onPress?: () => void;
  }) =>
    onPress
      ? createElement("button", { type: "button", onClick: onPress }, title)
      : createElement("div", null, title, detail),
  SettingsSwitch: () => null,
}));
vi.mock("../components/menu-picker", () => ({
  MenuPicker: () => null,
}));
vi.mock("../lib/hide-amounts", () => ({
  maskAmountsWhenHidden: (text: string) => text,
  setHideAmounts: vi.fn(),
  useHideAmounts: () => false,
}));
vi.mock("../lib/i18n", () => {
  const t = (text: string) => text;
  return { t, useI18n: () => ({ t }) };
});
vi.mock("../lib/native", () => ({
  native: {
    groupedPage: "page",
    label: "label",
    page: "page",
    secondaryLabel: "secondary",
  },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/user-error", () => ({ errorText: (error: unknown) => String(error) }));

const candidate: CompanyReviewCandidate = {
  id: "candidate-1",
  version: "candidate-version-1",
  reason: "ambiguous_event_subjects",
  title: "Possible hire",
  quote: "Alex joined the team",
  sourceKind: "gmail",
  details: [],
  choices: [],
  allowSeparate: false,
  editableTitle: false,
  subjects: [],
  subjectChoices: [],
};
const personFact: CompanyFact = {
  kind: "entity",
  record: {
    id: "fact-1",
    kind: "person",
    displayName: "Alex Reed",
    normalizedName: "alex reed",
    attrs: {},
    confidence: 0.2,
    status: "suggested",
    visibility: "private",
    lockedFields: [],
    confirmedAt: null,
    confirmedByUserId: null,
    identities: [],
    evidence: [],
    mergedFrom: [],
    edges: [],
    events: [],
    contactId: null,
    legalContractId: null,
    dataRoomItemId: null,
  },
};
type EdgeCompanyFact = Extract<CompanyFact, { kind: "edge" }>;
type EventCompanyFact = Extract<CompanyFact, { kind: "event" }>;

const edgeFact: EdgeCompanyFact = {
  kind: "edge",
  record: {
    id: "edge-1",
    fromId: "fact-1",
    toId: "company-1",
    relation: "works_at",
    startsOn: null,
    endsOn: null,
    role: null,
    confidence: 0.7,
    status: "suggested",
    visibility: "private",
    lockedFields: [],
    confirmedAt: null,
    confirmedByUserId: null,
    evidence: [],
  },
};
const eventFact: EventCompanyFact = {
  kind: "event",
  record: {
    id: "event-1",
    stream: "company",
    kind: "other",
    title: "Company milestone",
    occursOn: null,
    endsOn: null,
    amountCents: null,
    currency: null,
    entityIds: [],
    confidence: 0.7,
    status: "suggested",
    visibility: "private",
    lockedFields: [],
    confirmedAt: null,
    confirmedByUserId: null,
    evidence: [],
  },
};
const review: CompanyReview = {
  items: [
    { kind: "fact", id: "fact-review-1", reason: "low_confidence", fact: personFact },
    { kind: "candidate", id: "candidate-row-1", candidate },
  ],
};

let root: Root;
let container: HTMLDivElement;

function render(node: ReactNode) {
  return act(async () => root.render(node));
}

async function renderFact(fact: CompanyFact) {
  state.params = { kind: fact.kind, id: fact.record.id };
  state.rpc.mockImplementation(async (procedure: string) => {
    if (procedure === "company/fact") return fact;
    if (procedure === "company/page")
      return { entities: [], edges: [], events: [], latestRun: null };
    throw new Error(`Unexpected RPC: ${procedure}`);
  });
  await render(<CompanyFactScreen />);
}

async function pressButton(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  await act(async () => button?.click());
}

async function changeInput(value: string) {
  const input = container.querySelector<HTMLInputElement>("input");
  if (!input) throw new Error("Expected an edit input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function confirmDialog() {
  const buttons = state.alert.mock.calls.at(-1)?.[2] as
    | { text: string; onPress?: () => void }[]
    | undefined;
  return buttons?.find((button) => button.text === "Reject")?.onPress;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.params = { view: "review" };
  state.apiBase = "http://api.test";
  state.spaceId = "space-1";
  state.selectionGeneration = 0;
  state.sessionGeneration = 0;
  state.actionHandlers.clear();
  state.rpc.mockReset().mockImplementation(async (procedure: string) => {
    if (procedure === "company/review") return review;
    if (procedure === "company/fact") return null;
    if (procedure === "company/page")
      return { entities: [], edges: [], events: [], latestRun: null };
    if (procedure === "company/editEntity") return {};
    throw new Error(`Unexpected RPC: ${procedure}`);
  });
  state.alert.mockReset();
  state.push.mockReset();
  state.openURL.mockReset().mockResolvedValue(undefined);
  state.back.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("native Company RPCs", () => {
  it("routes recognized cached inbox provenance internally and keeps external links external", async () => {
    const evidence = {
      id: "evidence-1",
      factKind: "entity" as const,
      factId: "fact-1",
      stance: "supports" as const,
      sourceKind: "gmail" as const,
      connectionId: "connection-1",
      mcpServerId: null,
      dataRoomItemId: null,
      sourceItemId: "provider-message-1",
      sourceKey: "gmail:provider-message-1",
      sourceUrl: "/app/inbox?mail=cached-message_1",
      quote: "A synthetic source quote.",
      contentHash: "synthetic-hash",
      extractedAt: "2026-01-02T03:04:05.000Z",
      extractorRunId: null,
      extractorModel: null,
      confidence: 0.8,
      confirmedByUserId: null,
      confirmedAt: null,
    };
    const fact: CompanyFact = {
      ...personFact,
      record: { ...personFact.record, evidence: [evidence] },
    };
    await renderFact(fact);
    await pressButton("Open source");
    expect(state.push).toHaveBeenCalledWith({
      pathname: "/inbox-message",
      params: { messageId: "cached-message_1" },
    });
    expect(state.openURL).not.toHaveBeenCalled();

    const externalFact: CompanyFact = {
      ...fact,
      record: {
        ...fact.record,
        id: "fact-external",
        evidence: [
          { ...evidence, factId: "fact-external", sourceUrl: "https://example.test/source" },
        ],
      },
    };
    await renderFact(externalFact);
    await pressButton("Open source");
    expect(state.openURL).toHaveBeenCalledWith("https://example.test/source");

    const arbitraryRelativeFact: CompanyFact = {
      ...fact,
      record: {
        ...fact.record,
        id: "fact-relative",
        evidence: [{ ...evidence, factId: "fact-relative", sourceUrl: "/app/other" }],
      },
    };
    await renderFact(arbitraryRelativeFact);
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "Open source",
      ),
    ).toBe(false);
  });

  it("opens and edits a low-confidence Review fact from review data", async () => {
    await render(<CompanyScreen />);
    const open = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Open Alex Reed",
    );
    await act(async () => open?.click());
    expect(state.push).toHaveBeenCalledWith({
      pathname: "/company-fact",
      params: { kind: "entity", id: "fact-1", origin: "review" },
    });

    state.params = { kind: "entity", id: "fact-1", origin: "review" };
    await render(<CompanyFactScreen />);
    const procedures = state.rpc.mock.calls.map(([procedure]) => procedure);
    expect(procedures).toContain("company/review");
    expect(procedures).not.toContain("company/fact");
    expect(
      [...container.querySelectorAll("button")].some((button) => button.textContent === "Edit"),
    ).toBe(true);

    const edit = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Edit",
    );
    await act(async () => edit?.click());
    const input = container.querySelector('input[aria-label="Name or title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Alex Reed Updated",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save",
    );
    await act(async () => save?.click());
    expect(state.rpc).toHaveBeenCalledWith("company/editEntity", {
      entityId: "fact-1",
      kind: "person",
      displayName: "Alex Reed Updated",
    });
  });

  it("confirms and rejects review facts with their entity references", async () => {
    await render(<CompanyScreen />);
    const confirm = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Confirm "),
    );
    await act(async () => confirm?.click());
    expect(state.rpc).toHaveBeenCalledWith("company/confirm", { kind: "entity", id: "fact-1" });

    const reject = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Reject "),
    );
    await act(async () => reject?.click());
    await act(async () => confirmDialog()?.());
    expect(state.rpc).toHaveBeenCalledWith("company/reject", { kind: "entity", id: "fact-1" });
  });

  it("uses the candidate id and version for review decisions", async () => {
    state.params = { kind: "candidate", id: candidate.id };
    await render(<CompanyFactScreen />);
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirm",
    );
    await act(async () => confirm?.click());
    expect(state.rpc).toHaveBeenCalledWith("company/resolveCandidate", {
      candidateId: candidate.id,
      version: candidate.version,
      action: "confirm",
      separate: false,
      subjects: {},
    });

    const reject = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Reject",
    );
    await act(async () => reject?.click());
    await act(async () => confirmDialog()?.());
    expect(state.rpc).toHaveBeenCalledWith("company/resolveCandidate", {
      candidateId: candidate.id,
      version: candidate.version,
      action: "reject",
    });
  });

  it.each([
    { label: "an unset role", fact: edgeFact, editValue: null },
    {
      label: "a role with whitespace-only changes",
      fact: { ...edgeFact, record: { ...edgeFact.record, role: " Founder " } },
      editValue: "Founder",
    },
  ])("disables unchanged edge-role saves for $label", async ({ fact, editValue }) => {
    await renderFact(fact);
    await pressButton("Edit");

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Role"]');
    expect(input?.value).toBe(fact.record.role ?? "");
    if (editValue !== null) await changeInput(editValue);

    const save = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save",
    );
    expect(save?.disabled).toBe(true);
    await act(async () => state.actionHandlers.get("Save")?.());
    expect(state.rpc).not.toHaveBeenCalledWith("company/editEdge", expect.anything());
  });

  it("clears an existing edge role with a null edit", async () => {
    const fact: CompanyFact = {
      ...edgeFact,
      record: { ...edgeFact.record, role: "Founder" },
    };
    await renderFact(fact);
    await pressButton("Edit");
    await changeInput("");

    const save = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save",
    );
    expect(save?.disabled).toBe(false);
    await pressButton("Save");
    expect(state.rpc).toHaveBeenCalledWith("company/editEdge", {
      edgeId: "edge-1",
      role: null,
    });
  });

  it.each([
    {
      label: "entity",
      fact: personFact,
      procedure: "company/editEntity",
      expected: (title: string) => ({ entityId: "fact-1", kind: "person", displayName: title }),
    },
    {
      label: "event",
      fact: eventFact,
      procedure: "company/editEvent",
      expected: (title: string) => ({ eventId: "event-1", title }),
    },
  ])("accepts a 200-character $label edit", async ({ fact, procedure, expected }) => {
    const title = "x".repeat(200);
    await renderFact(fact);
    await pressButton("Edit");
    await changeInput(title);

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.maxLength).toBe(200);
    expect(
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Save")
        ?.disabled,
    ).toBe(false);
    await pressButton("Save");
    expect(state.rpc).toHaveBeenCalledWith(procedure, expected(title));
  });

  it.each([
    { label: "entity", fact: personFact, procedure: "company/editEntity" },
    { label: "event", fact: eventFact, procedure: "company/editEvent" },
  ])("blocks an overlong programmatic $label edit", async ({ fact, procedure }) => {
    await renderFact(fact);
    await pressButton("Edit");
    await changeInput("x".repeat(201));

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.maxLength).toBe(200);
    expect(input?.value).toHaveLength(201);
    expect(
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Save")
        ?.disabled,
    ).toBe(true);
    await act(async () => state.actionHandlers.get("Save")?.());
    expect(state.rpc).not.toHaveBeenCalledWith(procedure, expect.anything());
  });

  it("clears stale Company query data when the selected space changes", async () => {
    let finishNext: ((value: { value: string }) => void) | undefined;
    state.rpc.mockResolvedValueOnce({ value: "Space one" }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNext = resolve;
        }),
    );
    function Probe() {
      const query = useCompanyQuery<{ value: string }>("company/page");
      return createElement("div", null, query.data?.value ?? (query.loading ? "Loading" : "Empty"));
    }

    await render(<Probe />);
    expect(container.textContent).toContain("Space one");

    await act(async () => {
      state.spaceId = "space-2";
      state.selectionGeneration += 1;
      for (const listener of state.listeners.selection) listener();
    });
    expect(container.textContent).not.toContain("Space one");
    expect(container.textContent).toContain("Loading");

    await act(async () => finishNext?.({ value: "Space two" }));
    expect(container.textContent).toContain("Space two");
  });
});
