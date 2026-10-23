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
  back: vi.fn(),
  params: {} as Record<string, string>,
  apiBase: "http://api.test",
  spaceId: "space-1",
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
    AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
    ScrollView: box,
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) =>
      createElement("span", { role: accessibilityRole }, children),
    TextInput: ({
      accessibilityLabel,
      value,
      onChangeText,
    }: {
      accessibilityLabel?: string;
      value?: string;
      onChangeText?: (value: string) => void;
    }) =>
      createElement("input", {
        "aria-label": accessibilityLabel,
        value,
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
  }) => createElement("button", { type: "button", disabled, onClick: onPress }, label),
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
    confidence: 0.7,
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
  state.rpc.mockReset().mockImplementation(async (procedure: string) => {
    if (procedure === "company/review") return review;
    if (procedure === "company/fact") return personFact;
    if (procedure === "company/page")
      return { entities: [], edges: [], events: [], latestRun: null };
    throw new Error(`Unexpected RPC: ${procedure}`);
  });
  state.alert.mockReset();
  state.push.mockReset();
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
