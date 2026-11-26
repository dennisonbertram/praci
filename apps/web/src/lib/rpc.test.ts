import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSpaceSelection, createRpcFetch, selectedSpaceId, selectSpace } from "./rpc.js";

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

/** A stored Space selection plus a location whose assign() the test can observe. */
function stubSpace(initial: string | null, options: { failRemoval?: boolean } = {}) {
  let space = initial;
  const assign = vi.fn();
  const localStorage = {
    getItem: (key: string) => (key === "rakazo:space-id" ? space : null),
    setItem: (key: string, value: string) => {
      if (key === "rakazo:space-id") space = value;
    },
    removeItem: (key: string) => {
      if (options.failRemoval) throw new Error("storage is unavailable");
      if (key === "rakazo:space-id") space = null;
    },
  };
  vi.stubGlobal("window", {
    localStorage,
    location: { origin: "http://127.0.0.1", pathname: "/app", assign },
  });
  vi.stubGlobal("localStorage", localStorage);
  return {
    assign,
    selected: () => space,
    select: (id: string) => {
      space = id;
    },
  };
}

function deferred() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The first call 401s like a stale Space; every spaces/list probe answers with `probe`. */
function stubFetch(probe: () => Promise<Response>) {
  const doFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/rpc/spaces/list")) return probe();
    return new Response("{}", { status: 401 });
  });
  return doFetch;
}

function call(rpcFetch: ReturnType<typeof createRpcFetch>, context: { spaceId?: string | null }) {
  return rpcFetch(new Request("http://127.0.0.1/rpc/threads/get", { method: "POST" }), undefined, {
    context,
  });
}

describe("stale Space recovery", () => {
  it("clears the selection and reloads when the Space is gone", async () => {
    const space = stubSpace("space-gone");
    const doFetch = stubFetch(async () => new Response("{}", { status: 200 }));
    const response = await call(createRpcFetch(doFetch), {});
    expect(response.status).toBe(401);
    expect(space.selected()).toBeNull();
    expect(space.assign).toHaveBeenCalledWith("/app");
    expect(space.assign).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the stored selection cannot be cleared", async () => {
    const space = stubSpace("space-gone", { failRemoval: true });
    const doFetch = stubFetch(async () => new Response("{}", { status: 200 }));
    await call(createRpcFetch(doFetch), {});
    expect(space.selected()).toBe("space-gone");
    expect(space.assign).not.toHaveBeenCalled();
  });

  it("keeps the selection when the probe is rejected too", async () => {
    const space = stubSpace("space-gone");
    const doFetch = stubFetch(async () => new Response("{}", { status: 401 }));
    await call(createRpcFetch(doFetch), {});
    expect(space.selected()).toBe("space-gone");
    expect(space.assign).not.toHaveBeenCalled();
  });

  it("does not probe for a call that names its own Space", async () => {
    const space = stubSpace("space-gone");
    const doFetch = stubFetch(async () => new Response("{}", { status: 200 }));
    await call(createRpcFetch(doFetch), { spaceId: "space-explicit" });
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(space.selected()).toBe("space-gone");
    expect(space.assign).not.toHaveBeenCalled();
  });

  it("keeps a selection made while the probe was in flight", async () => {
    const space = stubSpace("space-gone");
    const probe = deferred();
    const doFetch = stubFetch(() => probe.promise);
    const recovery = call(createRpcFetch(doFetch), {});
    await vi.waitFor(() => expect(doFetch).toHaveBeenCalledTimes(2));
    space.select("space-new");
    probe.resolve(new Response("{}", { status: 200 }));
    await recovery;
    expect(space.selected()).toBe("space-new");
    expect(space.assign).not.toHaveBeenCalled();
  });

  it("probes once when several requests are rejected together", async () => {
    const space = stubSpace("space-gone");
    const probe = deferred();
    const doFetch = stubFetch(() => probe.promise);
    const rpcFetch = createRpcFetch(doFetch);
    const results = [call(rpcFetch, {}), call(rpcFetch, {})];
    await vi.waitFor(() => expect(doFetch).toHaveBeenCalledTimes(3));
    probe.resolve(new Response("{}", { status: 200 }));
    expect((await Promise.all(results)).map((response) => response.status)).toEqual([401, 401]);
    expect(
      doFetch.mock.calls.filter(([input]) =>
        String(input instanceof Request ? input.url : input).endsWith("/rpc/spaces/list"),
      ),
    ).toHaveLength(1);
    expect(space.assign).toHaveBeenCalledTimes(1);
  });
});
