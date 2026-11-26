// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePageQuery, usePollWhile, useReloadWhenAgentIdle, useUrlParam } from "./page-data";

vi.mock("./user-error", () => ({
  errorText: (cause: unknown, fallback = "Something went wrong") =>
    cause instanceof Error && !cause.message.startsWith("fetch") ? cause.message : fallback,
}));

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Query = ReturnType<typeof usePageQuery<string>>;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function mount(node: React.ReactNode) {
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
  return {
    root,
    render: (next: React.ReactNode) => act(() => root.render(<MemoryRouter>{next}</MemoryRouter>)),
  };
}

function QueryProbe({
  load,
  id,
  fallback,
  out,
}: {
  load: (id: string) => Promise<string>;
  id: string;
  fallback?: string;
  out: { current: Query | null };
}) {
  out.current = usePageQuery(() => load(id), [id], fallback ? { fallback } : undefined);
  return null;
}

it("ignores an answer that arrives after a newer request", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const load = vi.fn((id: string) => (id === "a" ? first.promise : second.promise));
  const out: { current: Query | null } = { current: null };
  const view = mount(<QueryProbe load={load} id="a" out={out} />);
  view.render(<QueryProbe load={load} id="b" out={out} />);
  await act(async () => second.resolve("B"));
  await act(async () => first.resolve("A"));
  expect(out.current?.data).toBe("B");
  view.root.unmount();
});

it("keeps the data when a reload fails, and drops it when the key changes", async () => {
  const load = vi
    .fn<(id: string) => Promise<string>>()
    .mockResolvedValueOnce("one")
    .mockRejectedValueOnce(new Error("Boom"))
    .mockResolvedValue("two");
  const out: { current: Query | null } = { current: null };
  const view = mount(<QueryProbe load={load} id="a" out={out} />);
  await act(async () => undefined);
  expect(out.current?.data).toBe("one");
  await act(async () => out.current?.reload());
  expect(out.current?.data).toBe("one");
  expect(out.current?.error).toBe("Boom");
  await act(async () => out.current?.retry());
  expect(out.current?.data).toBe("two");
  expect(out.current?.error).toBe("");
  view.render(<QueryProbe load={() => new Promise(() => undefined)} id="b" out={out} />);
  expect(out.current?.data).toBeNull();
  view.root.unmount();
});

it("sets notFound and the code, and uses the fallback copy for an unreadable error", async () => {
  const out: { current: Query | null } = { current: null };
  const missing = Object.assign(new Error("gone"), { code: "NOT_FOUND" });
  const view = mount(<QueryProbe load={() => Promise.reject(missing)} id="a" out={out} />);
  await act(async () => undefined);
  expect(out.current?.notFound).toBe(true);
  expect(out.current?.code).toBe("NOT_FOUND");
  view.render(
    <QueryProbe
      load={() => Promise.reject(new Error("fetch failed"))}
      id="b"
      fallback="Could not load it"
      out={out}
    />,
  );
  await act(async () => undefined);
  expect(out.current?.notFound).toBe(false);
  expect(out.current?.error).toBe("Could not load it");
  view.root.unmount();
});

it("gives reload and retry the same identity on every render", async () => {
  const out: { current: Query | null } = { current: null };
  const view = mount(<QueryProbe load={async () => "x"} id="a" out={out} />);
  const first = out.current;
  await act(async () => undefined);
  expect(out.current?.reload).toBe(first?.reload);
  expect(out.current?.retry).toBe(first?.retry);
  view.root.unmount();
});

it("reloads once when the agent stops answering, not when it starts", () => {
  const reload = vi.fn();
  const Probe = ({ busy }: { busy: boolean }) => {
    useReloadWhenAgentIdle(busy, reload);
    return null;
  };
  const view = mount(<Probe busy={false} />);
  view.render(<Probe busy />);
  expect(reload).not.toHaveBeenCalled();
  view.render(<Probe busy={false} />);
  expect(reload).toHaveBeenCalledTimes(1);
  view.root.unmount();
});

function setVisibility(state: "visible" | "hidden") {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
}

it("polls while active, stops when hidden, and gives up after the limit", () => {
  vi.useFakeTimers();
  const tick = vi.fn();
  const giveUp = vi.fn();
  const Probe = ({ active }: { active: boolean }) => {
    usePollWhile(active, 1000, tick, { giveUpMs: 3500, onGiveUp: giveUp });
    return null;
  };
  const view = mount(<Probe active />);
  act(() => vi.advanceTimersByTime(2000));
  expect(tick).toHaveBeenCalledTimes(2);
  setVisibility("hidden");
  act(() => vi.advanceTimersByTime(1000));
  expect(tick).toHaveBeenCalledTimes(2);
  setVisibility("visible");
  act(() => vi.advanceTimersByTime(500));
  expect(giveUp).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(5000));
  expect(tick).toHaveBeenCalledTimes(2);
  view.render(<Probe active={false} />);
  act(() => vi.advanceTimersByTime(5000));
  expect(tick).toHaveBeenCalledTimes(2);
  view.root.unmount();
});

it("sets one URL parameter and keeps the others; the fallback removes it", () => {
  const seen: string[] = [];
  let set: (value: string) => void = () => undefined;
  const Probe = () => {
    const [value, setValue] = useUrlParam("view", "contracts");
    set = setValue;
    seen.push(`${value} ${useLocation().search}`);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/legal?q=nda&group=off"]}>
        <Probe />
      </MemoryRouter>,
    ),
  );
  expect(seen.at(-1)).toBe("contracts ?q=nda&group=off");
  act(() => set("deadlines"));
  expect(seen.at(-1)).toBe("deadlines ?q=nda&group=off&view=deadlines");
  act(() => set("contracts"));
  expect(seen.at(-1)).toBe("contracts ?q=nda&group=off");
  act(() => root.unmount());
});
