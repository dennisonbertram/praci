import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSpaceSelection, coalescedFetch, selectedSpaceId, selectSpace } from "./rpc.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("space selection storage", () => {
  it("reports localStorage write failures without throwing", () => {
    const localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {
        throw new Error("quota exceeded");
      },
    };
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);

    expect(selectSpace("space-support")).toBe(false);
    expect(() => clearSpaceSelection()).not.toThrow();
    expect(selectedSpaceId()).toBeNull();
  });

  it("treats an already-persisted selection as success when writes fail", () => {
    const localStorage = {
      getItem: (key: string) => (key === "rakazo:space-id" ? "space-support" : null),
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);

    expect(selectSpace("space-support")).toBe(true);
    expect(selectSpace("space-other")).toBe(false);
  });

  it("reports when a space selection was persisted", () => {
    const setItem = vi.fn();
    const localStorage = { getItem: () => null, setItem, removeItem: vi.fn() };
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);

    expect(selectSpace("space-support")).toBe(true);
    expect(setItem).toHaveBeenCalledWith("rakazo:space-id", "space-support");
  });
});

describe("coalescedFetch", () => {
  const call = (path: string, send: (r: Request) => Promise<Response>, space = "a") =>
    coalescedFetch(
      new Request(`http://x/rpc${path}`, { method: "POST", body: "{}" }),
      send,
      "{}",
      space,
    );

  it("shares one request between identical in-flight list calls", async () => {
    const send = vi.fn(async () => new Response('{"ok":1}'));
    const [a, b] = await Promise.all([call("/bots/list", send), call("/bots/list", send)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await a.text()).toBe('{"ok":1}');
    expect(await b.text()).toBe('{"ok":1}');
  });

  it("does not share across spaces or other procedures", async () => {
    const send = vi.fn(async () => new Response("{}"));
    await Promise.all([call("/bots/list", send, "a"), call("/bots/list", send, "b")]);
    await Promise.all([call("/bots/create", send), call("/bots/create", send)]);
    expect(send).toHaveBeenCalledTimes(4);
  });
});
