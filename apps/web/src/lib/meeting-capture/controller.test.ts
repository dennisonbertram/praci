// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BufferedChunk, CaptureRecord, ChunkStore } from "./buffer";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
const rpc = vi.hoisted(() => ({
  me: vi.fn(),
  meetingCaptures: {
    start: vi.fn(),
    appendText: vi.fn(),
    active: vi.fn(),
    finish: vi.fn(),
    discard: vi.fn(),
  },
  meetings: { list: vi.fn() },
}));
vi.mock("../rpc", () => ({
  rpc,
  withSpaceHeaders: (init?: HeadersInit) => new Headers(init),
}));
const device = vi.hoisted(() => ({ transcribe: vi.fn(), speech: undefined as unknown }));
vi.mock("../device-speech", () => ({ transcribeOnDevice: device.transcribe }));
vi.mock("../desktop", async (original) => {
  const actual = await original<typeof import("../desktop")>();
  return {
    ...actual,
    desktopBridge: () => {
      const real = actual.desktopBridge();
      return device.speech ? ({ ...real, speech: device.speech } as typeof real) : real;
    },
  };
});
// Every "tab" (a fresh copy of the controller) shares one store, as IndexedDB is shared.
const shared = vi.hoisted(() => ({ store: null as unknown as ChunkStore }));
vi.mock("./buffer", async (original) => ({
  ...(await original<typeof import("./buffer")>()),
  createChunkStore: () => shared.store,
}));

type Opts = {
  onChunk: (chunk: unknown) => Promise<void>;
  onEnded?: () => void;
  owner: Record<string, string>;
  track: string;
};
type Fake = { options: Opts; stopped: boolean; abandoned: boolean };
const fakes = vi.hoisted(() => ({ list: [] as unknown[], failStart: false }));
vi.mock("./recorder", () => ({
  TrackRecorder: class {
    peak = 0;
    stopped = false;
    abandoned = false;
    constructor(public options: Opts) {
      fakes.list.push(this);
    }
    start() {
      if (fakes.failStart) throw new Error("no recorder");
    }
    async stop() {
      this.stopped = true;
      await this.options.onChunk(fakeChunk(this.options, 9));
    }
    abandon() {
      this.abandoned = true;
    }
  },
}));

function fakeChunk(options: Opts, seq: number) {
  return {
    key: `${options.owner.userId}:${options.owner.spaceId}:${options.owner.captureId}:${options.track}:${seq}`,
    ...options.owner,
    track: options.track,
    seq,
    startMs: 0,
    endMs: 1000,
    blob: new Blob(["x"]),
  };
}

/** Web Locks for the tabs of one browser: exclusive, queued, `ifAvailable`; `crash` frees a lock as a closed tab would. */
class FakeLocks {
  held = new Map<string, () => void>();
  queues = new Map<string, Array<() => void>>();
  async request(
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: unknown) => unknown,
  ) {
    const queue = this.queues.get(name) ?? [];
    this.queues.set(name, queue);
    if (this.held.has(name) || queue.length > 0) {
      if (options.ifAvailable) return callback(null);
      await new Promise<void>((granted) => queue.push(granted));
    }
    let free = () => {};
    const crashed = new Promise<void>((resolve) => (free = resolve));
    this.held.set(name, free);
    try {
      return await Promise.race([callback({ name }), crashed]);
    } finally {
      this.held.delete(name);
      queue.shift()?.();
    }
  }
  crash(name: string) {
    this.held.get(name)?.();
  }
}
class FakeChannel {
  static all = new Set<FakeChannel>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.all.add(this);
  }
  postMessage(data: unknown) {
    for (const other of FakeChannel.all)
      if (other !== this && other.name === this.name)
        queueMicrotask(() => other.onmessage?.({ data: structuredClone(data) }));
  }
  close() {
    FakeChannel.all.delete(this);
  }
}

type Controller = typeof import("./controller");
let c: Controller;
let locks: FakeLocks;
const gum = vi.fn();
const micTrack = (readyState = "live") => ({ stop: vi.fn(), readyState });
const stream = (track = micTrack()) => ({
  getTracks: () => [track],
  getVideoTracks: () => [],
  getAudioTracks: () => [track],
});
const active = (status = "recording", captureId = "c1") => ({
  captureId,
  title: null,
  engine: "server",
  tracks: ["microphone"],
  status,
  startedAt: new Date().toISOString(),
});
const record = (extra: Partial<CaptureRecord> = {}): CaptureRecord => ({
  captureId: "c1",
  userId: "u1",
  spaceId: "sA",
  tracks: ["microphone"],
  title: null,
  startedAt: Date.now(),
  stopped: false,
  lostChunks: 0,
  ...extra,
});
const seeded = (seq = 1, captureId = "c1"): BufferedChunk => ({
  key: `u1:sA:${captureId}:microphone:${seq}`,
  userId: "u1",
  spaceId: "sA",
  captureId,
  track: "microphone" as const,
  seq,
  startMs: 0,
  endMs: 1000,
  blob: new Blob(["x"]),
});
const respond = (status = 201, error = "Capture is closed") =>
  vi.fn(async () => new Response(JSON.stringify({ error }), { status }));
/** Another tab of the same browser: a fresh copy of the controller. */
const openTab = async (): Promise<Controller> => {
  vi.resetModules();
  return import("./controller");
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fakes.list.length = 0;
  fakes.failStart = false;
  FakeChannel.all.clear();
  shared.store = (await vi.importActual<typeof import("./buffer")>("./buffer")).memoryChunkStore();
  gum.mockReset().mockImplementation(async () => stream());
  locks = new FakeLocks();
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: gum },
    configurable: true,
  });
  Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  rpc.me.mockResolvedValue({ userId: "u1", spaceId: "sA" });
  rpc.meetingCaptures.start.mockResolvedValue({ captureId: "c1" });
  rpc.meetingCaptures.finish.mockResolvedValue({ ok: true });
  rpc.meetingCaptures.discard.mockResolvedValue({ ok: true });
  rpc.meetingCaptures.active.mockResolvedValue(null);
  rpc.meetings.list.mockResolvedValue({ items: [] });
  vi.stubGlobal("fetch", respond(201));
  device.speech = undefined;
  rpc.meetingCaptures.appendText.mockResolvedValue({ ok: true });
  c = await openTab();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

it("Stop waits for a slow upload before it finishes the capture", async () => {
  await c.startCapture({});
  let finishUpload: () => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>(
          (resolve) => (finishUpload = () => resolve(new Response("{}", { status: 201 }))),
        ),
    ),
  );
  void c.stopCapture();
  await settle(100);
  expect(rpc.meetingCaptures.finish).not.toHaveBeenCalled();
  finishUpload();
  await settle(100);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(await c.chunkStore.all()).toEqual([]);
});

it("keeps the buffer when the server cannot be asked, then stores it once the server answers", async () => {
  await c.chunkStore.putRecord(record());
  await c.chunkStore.put(seeded());
  rpc.meetingCaptures.active.mockRejectedValue(new Error("offline"));
  await c.recoverCapture();
  expect(await c.chunkStore.all()).toHaveLength(1);
  expect(await c.chunkStore.records()).toHaveLength(1);
  rpc.meetingCaptures.active.mockResolvedValue(null);
  await settle(10_000); // the retry
  await settle(5_000);
  expect(fetch).toHaveBeenCalledTimes(1); // the chunk was uploaded, not thrown away
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(await c.chunkStore.all()).toHaveLength(0);
  expect(await c.chunkStore.records()).toHaveLength(0);
});

it("a capture without a local record is not adopted", async () => {
  rpc.meetingCaptures.active.mockResolvedValue(active());
  await c.recoverCapture();
  expect(c.captureView().phase).toBe("idle");
  expect(gum).not.toHaveBeenCalled();
});

it("a microphone permission granted after Stop starts nothing", async () => {
  await c.chunkStore.putRecord(record());
  rpc.meetingCaptures.active.mockResolvedValue(active());
  let grant: (value: unknown) => void = () => {};
  gum.mockImplementation(() => new Promise((resolve) => (grant = resolve)));
  const recovering = c.recoverCapture();
  await settle(10);
  rpc.meetingCaptures.active.mockResolvedValue(null);
  void c.stopCapture();
  await settle(10);
  const tracks = [{ stop: vi.fn() }];
  grant({ getTracks: () => tracks });
  await recovering;
  expect(fakes.list).toHaveLength(0);
  expect(tracks[0]?.stop).toHaveBeenCalled();
});

it("a late chunk after sign-out writes nothing", async () => {
  await c.startCapture({});
  const recorder = fakes.list[0] as Fake;
  await c.clearCaptureOnSignOut("u1");
  await recorder.options.onChunk(fakeChunk(recorder.options, 5));
  expect(await c.chunkStore.all()).toEqual([]);
  expect(c.captureView().phase).toBe("idle");
});

it("a second tab shows the pill but does not record", async () => {
  await c.startCapture({});
  const tabB = await openTab();
  await tabB.recoverCapture();
  expect(tabB.captureView().phase).toBe("recording");
  expect(gum).toHaveBeenCalledTimes(1);
  expect(fakes.list).toHaveLength(1);
});

it("a closed capture (409) ends Transcribing with an error", async () => {
  await c.startCapture({});
  vi.stubGlobal("fetch", respond(409));
  rpc.meetingCaptures.active.mockResolvedValue(active());
  void c.stopCapture();
  await settle(100);
  expect(c.captureView()).toEqual({
    phase: "failed",
    message: "This recording was closed and could not be saved.",
  });
  expect(await c.chunkStore.all()).toEqual([]);
  c.dismissStored();
  expect(c.captureView().phase).toBe("idle");
});

it("a reload after Stop uploads the leftovers and finishes without opening the microphone", async () => {
  await c.chunkStore.putRecord(record({ stopped: true }));
  await c.chunkStore.put(seeded());
  rpc.meetingCaptures.active.mockResolvedValueOnce(active()).mockResolvedValue(null);
  const done = c.recoverCapture();
  await settle(5000);
  await done;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(gum).not.toHaveBeenCalled();
  expect(c.captureView().phase).toBe("stored");
});

it("a failed startup leaves no session, no record and an idle pill", async () => {
  fakes.failStart = true;
  await expect(c.startCapture({})).rejects.toThrow("no recorder");
  expect(c.captureView().phase).toBe("idle");
  expect(await c.chunkStore.records()).toEqual([]);
  expect(rpc.meetingCaptures.discard).toHaveBeenCalled();
  fakes.failStart = false;
  await c.startCapture({}); // a new recording may start: the lock was let go
  expect(c.captureView().phase).toBe("recording");
});

it("a microphone that ends stops the capture and says so", async () => {
  await c.startCapture({});
  rpc.meetingCaptures.active.mockResolvedValue(active());
  const recorder = fakes.list[0] as Fake;
  recorder.options.onEnded?.();
  await settle(50);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", micStopped: true });
});

it("a recovered call recording records the microphone and offers to share the call tab again", async () => {
  await c.chunkStore.putRecord(record({ tracks: ["microphone", "system"] }));
  rpc.meetingCaptures.active.mockResolvedValue(active());
  await c.recoverCapture();
  expect(c.captureView()).toMatchObject({
    phase: "recording",
    noCallAudio: true,
    canShareTab: true,
  });
  expect(fakes.list).toHaveLength(1);
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(readonly tracks: unknown[]) {}
      getTracks = () => this.tracks;
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: gum, getDisplayMedia: vi.fn(async () => stream()) },
    configurable: true,
  });
  await c.shareTabAudio();
  expect((fakes.list[1] as Fake).options.track).toBe("system");
});

it.each([
  ["darwin", "Screen & System Audio Recording"],
  ["win32", "turn off Record call audio"],
  [undefined, "No tab was shared"],
])("call audio that cannot start on %s says what to do", async (platform, text) => {
  vi.stubGlobal("window", { rakazoDesktop: platform ? { platform } : undefined });
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: gum,
      getDisplayMedia: vi.fn(async () => Promise.reject(new Error("x"))),
    },
    configurable: true,
  });
  await expect(c.startCapture({ tabAudio: true })).rejects.toThrow(text);
});

const stubDesktop = (platform: string) =>
  vi.stubGlobal("window", {
    rakazoDesktop: { platform },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
const stubDisplay = (display: () => unknown) => {
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(readonly tracks: unknown[]) {}
      getTracks = () => this.tracks;
      getAudioTracks = () => this.tracks;
      getVideoTracks = () => [];
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: gum, getDisplayMedia: vi.fn(async () => display()) },
    configurable: true,
  });
};

it("a call audio track that ends offers to record it again and keeps what was recorded", async () => {
  stubDesktop("darwin");
  stubDisplay(() => stream());
  await c.startCapture({ tabAudio: true });
  const system = fakes.list.find((r) => (r as Fake).options.track === "system") as Fake;
  system.options.onEnded?.();
  await settle(1_500);
  expect(system.stopped).toBe(true);
  expect(c.captureView()).toMatchObject({
    phase: "recording",
    noCallAudio: true,
    canShareTab: true,
  });
  // The microphone still ends the capture as before.
  const mic = fakes.list.find((r) => (r as Fake).options.track === "microphone") as Fake;
  expect(mic.options.onEnded).toBeTypeOf("function");
});

it("an already ended call audio track is the same failure as a refused share", async () => {
  vi.stubGlobal("window", { rakazoDesktop: { platform: "darwin" } });
  const ended = micTrack("ended");
  stubDisplay(() => stream(ended));
  await expect(c.startCapture({ tabAudio: true })).rejects.toThrow(
    "Screen & System Audio Recording",
  );
  expect(ended.stop).toHaveBeenCalled();
});

it("a failed retry shows why on the recording view, and a good one clears it", async () => {
  stubDesktop("win32");
  stubDisplay(() => stream());
  await c.startCapture({ tabAudio: true });
  const system = fakes.list.find((r) => (r as Fake).options.track === "system") as Fake;
  system.options.onEnded?.();
  await settle(1_500);
  stubDisplay(() => stream(micTrack("ended")));
  await c.shareTabAudio();
  expect(c.captureView()).toMatchObject({
    callAudioError: "Praci can't hear call audio. Try again, or turn off Record call audio.",
  });
  stubDisplay(() => stream());
  await c.shareTabAudio();
  expect(c.captureView()).not.toHaveProperty("callAudioError");
});

// 1. Stop in an observer tab stops the tab that holds the microphone.
it("Stop in another tab stops the recording tab, which stores the meeting once", async () => {
  await c.startCapture({});
  const owner = fakes.list[0] as Fake;
  const tabB = await openTab();
  await tabB.recoverCapture();
  await tabB.stopCapture();
  await settle(3_000);
  expect(owner.stopped).toBe(true);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(c.captureView().phase).toBe("stored");
  expect(tabB.captureView().phase).toBe("stored");
  expect(await shared.store.records()).toEqual([]);
});

it("Stop in an observer tab whose recording tab is gone finishes there without the microphone", async () => {
  await c.startCapture({});
  const tabB = await openTab();
  await tabB.recoverCapture();
  // Tab A closes: it hears nothing more and its lock is freed.
  FakeChannel.all.clear();
  await tabB.stopCapture();
  rpc.meetingCaptures.active.mockResolvedValueOnce(active()).mockResolvedValue(null);
  locks.crash("meeting-capture:c1");
  await settle(5_000);
  expect(gum).toHaveBeenCalledTimes(1); // only tab A's
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(tabB.captureView().phase).toBe("stored");
});

it("an observer tab carries the recording on when the recording tab closes", async () => {
  await c.startCapture({});
  const tabB = await openTab();
  await tabB.recoverCapture();
  rpc.meetingCaptures.active.mockResolvedValue(active());
  FakeChannel.all.clear();
  locks.crash("meeting-capture:c1");
  await settle(10);
  expect(gum).toHaveBeenCalledTimes(2);
  expect(tabB.captureView().phase).toBe("recording");
});

// 2. Sign-out while startup waits on a write.
it("sign-out while the startup writes its record starts nothing", async () => {
  let written: () => void = () => {};
  const putRecord = shared.store.putRecord;
  shared.store.putRecord = (item) =>
    new Promise((resolve) => (written = () => void putRecord(item).then(resolve)));
  const mic = micTrack();
  gum.mockResolvedValue(stream(mic));
  const starting = c.startCapture({}).catch((error: Error) => error.message);
  await settle(10);
  await c.clearCaptureOnSignOut("u1");
  written();
  expect(await starting).toBe("You were signed out.");
  expect(fakes.list).toHaveLength(0);
  expect(mic.stop).toHaveBeenCalled();
  expect(c.captureView().phase).toBe("idle");
  expect(await shared.store.records()).toEqual([]);
  expect(rpc.meetingCaptures.discard).toHaveBeenCalled();
});

// 3. A piece the server refuses for good is reported, so the meeting is marked partial.
it("tells finish how many pieces the server refused", async () => {
  await c.startCapture({});
  vi.stubGlobal("fetch", respond(413, "Too large"));
  void c.stopCapture();
  await settle(3_000);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledWith(
    expect.objectContaining({ captureId: "c1", lostChunks: 1 }),
    { context: { spaceId: "sA" } },
  );
});

// 4. A capture another tab is recording is never cleaned up by recovery.
it("recovery leaves a capture another tab records alone, even when the server names a newer one", async () => {
  await c.startCapture({});
  await shared.store.put(seeded(1));
  rpc.meetingCaptures.active.mockResolvedValue(active("recording", "c-newer"));
  const tabB = await openTab();
  await tabB.recoverCapture();
  expect(await shared.store.records()).toHaveLength(1);
  expect(await shared.store.all()).toHaveLength(1);
});

it("recovery stores an abandoned older capture instead of deleting its audio", async () => {
  await shared.store.putRecord(record());
  await shared.store.put(seeded(1));
  rpc.meetingCaptures.active.mockResolvedValue(active("recording", "c-newer"));
  void c.recoverCapture();
  await settle(3_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledWith(
    expect.objectContaining({ captureId: "c1" }),
    { context: { spaceId: "sA" } },
  );
  expect(gum).not.toHaveBeenCalled();
});

// 5. Recovery asks everything in the capture's own space, whatever this tab has selected.
it("recovery asks who and what is active in the capture's own space", async () => {
  await shared.store.putRecord(record({ spaceId: "sB" }));
  rpc.me.mockResolvedValue({ userId: "u1", spaceId: "sB" });
  rpc.meetingCaptures.active.mockResolvedValue(active());
  await c.recoverCapture();
  expect(rpc.me).toHaveBeenCalledWith(undefined, { context: { spaceId: "sB" } });
  expect(rpc.meetingCaptures.active).toHaveBeenCalledWith(undefined, {
    context: { spaceId: "sB" },
  });
  expect(c.captureView().phase).toBe("recording");
});

it("recovery leaves a record alone when the server answers for another space", async () => {
  await shared.store.putRecord(record({ spaceId: "sB" }));
  rpc.me.mockResolvedValue({ userId: "u1", spaceId: "sA" });
  await c.recoverCapture();
  expect(await shared.store.records()).toHaveLength(1);
  expect(c.captureView().phase).toBe("idle");
});

// 6. Without Web Locks no tab can be sure it is the only one recording.
it("refuses to record without Web Locks", async () => {
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
  await expect(c.startCapture({})).rejects.toThrow("This browser cannot record meetings.");
  expect(gum).not.toHaveBeenCalled();
});

// 7. A permanent refusal of finish ends the session instead of retrying forever.
it("stops retrying finish when the capture is gone", async () => {
  await c.startCapture({});
  rpc.meetingCaptures.finish.mockRejectedValue(new ORPCError("NOT_FOUND"));
  void c.stopCapture();
  await settle(30_000);
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(c.captureView()).toMatchObject({ phase: "failed" });
  expect(await shared.store.records()).toEqual([]);
});

it("keeps retrying finish while offline", async () => {
  await c.startCapture({});
  rpc.meetingCaptures.finish.mockRejectedValue(new TypeError("Failed to fetch"));
  void c.stopCapture();
  await settle(12_000);
  expect(rpc.meetingCaptures.finish.mock.calls.length).toBeGreaterThan(1);
  expect(c.captureView().phase).toBe("transcribing");
});

it("says the last chunks are saved here while an upload fails after Stop", async () => {
  await c.startCapture({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  void c.stopCapture();
  await settle(12_000);
  expect(c.captureView()).toMatchObject({
    phase: "transcribing",
    captureId: "c1",
    offline: true,
  });
  // The chunk is still here: only a 2xx deletes it.
  expect(await shared.store.all()).toHaveLength(1);

  vi.stubGlobal("fetch", respond(201));
  await settle(12_000);
  expect(c.captureView().phase).toBe("stored");
});

it("clears the saved-here note once the upload succeeds", async () => {
  await c.startCapture({});
  let failing = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (failing) throw new TypeError("Failed to fetch");
      return new Response("{}", { status: 201 });
    }),
  );
  void c.stopCapture();
  await settle(12_000);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", offline: true });

  failing = false;
  await settle(5_000);
  const view = c.captureView();
  if (view.phase === "transcribing") expect(view.offline).toBeFalsy();
  else expect(view.phase).toBe("stored");
});

it("says the last chunks are saved here while finish fails after Stop", async () => {
  await c.startCapture({});
  rpc.meetingCaptures.finish.mockRejectedValue(new TypeError("Failed to fetch"));
  void c.stopCapture();
  await settle(12_000);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", offline: true });

  rpc.meetingCaptures.finish.mockResolvedValue({ ok: true });
  await settle(12_000);
  expect(c.captureView().phase).toBe("stored");
});

it("a stale finish response never clears the next capture's saved-here note", async () => {
  await c.startCapture({});
  let resolveA: () => void = () => {};
  rpc.meetingCaptures.finish.mockImplementationOnce(
    () => new Promise((resolve) => (resolveA = () => resolve({ ok: true }))),
  );
  void c.stopCapture();
  await settle(1_000);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", captureId: "c1" });

  // Sign out while capture A's finish is still pending, then record again.
  await c.clearCaptureOnSignOut("u1");
  rpc.meetingCaptures.start.mockResolvedValue({ captureId: "c2" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await c.startCapture({});
  void c.stopCapture();
  await settle(12_000);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", captureId: "c2", offline: true });

  resolveA();
  // No retry of B runs before this check: only A's stale answer can clear the note.
  await settle(0);
  expect(c.captureView()).toMatchObject({ captureId: "c2", offline: true });
  await settle(12_000);
  expect(c.captureView()).toMatchObject({ captureId: "c2", offline: true });
});

it("an observer tab hears when the owner's last chunks are saved here", async () => {
  await c.startCapture({});
  const tabB = await openTab();
  await tabB.recoverCapture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  // B asks A to stop; A's uploads then fail.
  await tabB.stopCapture();
  await settle(12_000);
  expect(c.captureView()).toMatchObject({ phase: "transcribing", offline: true });
  expect(tabB.captureView()).toMatchObject({ phase: "transcribing", offline: true });

  vi.stubGlobal("fetch", respond(201));
  await settle(12_000);
  const heard = tabB.captureView();
  if (heard.phase === "transcribing") expect(heard.offline).toBeFalsy();
  else expect(heard.phase).toBe("stored");
});

// 10. A recorder that fails while resuming lets go of the microphone and stores what arrived.
it("a recorder failure while resuming releases the microphone", async () => {
  await shared.store.putRecord(record());
  rpc.meetingCaptures.active.mockResolvedValueOnce(active()).mockResolvedValue(null);
  const mic = micTrack();
  gum.mockResolvedValue(stream(mic));
  fakes.failStart = true;
  void c.recoverCapture();
  await settle(3_000);
  expect(mic.stop).toHaveBeenCalled();
  expect(rpc.meetingCaptures.finish).toHaveBeenCalledTimes(1);
  expect(c.captureView().phase).toBe("stored");
});

// Another person's capture in this browser is never shown or deleted.
it("does not show another person's capture that a tab holds", async () => {
  await shared.store.putRecord(record({ userId: "u2" }));
  void locks.request("meeting-capture:c1", {}, () => new Promise(() => {}));
  await settle(0);
  await c.recoverCapture();
  expect(c.captureView().phase).toBe("idle");
});

it("keeps another person's capture when its space refuses this user", async () => {
  await shared.store.putRecord(record({ userId: "u2" }));
  await shared.store.put(seeded(1));
  rpc.me.mockImplementation(async (_input: unknown, options?: unknown) => {
    if (options) throw new ORPCError("FORBIDDEN");
    return { userId: "u1", spaceId: "sA" };
  });
  await c.recoverCapture();
  expect(await shared.store.records()).toHaveLength(1);
  expect(await shared.store.all()).toHaveLength(1);
  expect(c.captureView().phase).toBe("idle");
});

describe("on-device capture", () => {
  const ready = () => {
    device.speech = { status: async () => ({ state: "ready" }) };
    device.transcribe.mockResolvedValue({ ok: true, text: "hello" });
  };
  const startDevice = async () => {
    ready();
    await c.startCapture({});
  };
  const first = () => fakes.list[0] as { options: Opts };

  it("starts with engine device and keeps it in the record", async () => {
    await startDevice();
    expect(rpc.meetingCaptures.start).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "device" }),
      { context: { spaceId: "sA" } },
    );
    expect((await shared.store.records())[0]?.engine).toBe("device");
  });

  it("starts with engine server when on-device speech is not ready, and for old records", async () => {
    device.speech = { status: async () => ({ state: "not-prepared" }) };
    await c.startCapture({});
    expect(rpc.meetingCaptures.start).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "server" }),
      expect.anything(),
    );
    expect((await shared.store.records())[0]?.engine).toBe("server");
  });

  it("uploads text through appendText and never the chunk route", async () => {
    await startDevice();
    await first().options.onChunk(fakeChunk(first().options, 1));
    await settle(100);
    expect(rpc.meetingCaptures.appendText).toHaveBeenCalledWith(
      { captureId: "c1", track: "microphone", seq: 1, startMs: 0, endMs: 1000, text: "hello" },
      { context: { spaceId: "sA" } },
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(await c.chunkStore.all()).toEqual([]);
  });

  it("keeps the chunk until appendText resolves", async () => {
    await startDevice();
    let done: () => void = () => {};
    rpc.meetingCaptures.appendText.mockReturnValue(new Promise<void>((r) => (done = r)));
    await first().options.onChunk(fakeChunk(first().options, 1));
    await settle(100);
    expect(await c.chunkStore.all()).toHaveLength(1);
    done();
    await settle(100);
    expect(await c.chunkStore.all()).toEqual([]);
  });

  it("keeps and retries a chunk when the helper asks for a retry", async () => {
    await startDevice();
    device.transcribe.mockResolvedValueOnce({ ok: false, retry: true });
    await first().options.onChunk(fakeChunk(first().options, 1));
    await settle(100);
    expect(await c.chunkStore.all()).toHaveLength(1);
    await settle(6_000);
    expect(rpc.meetingCaptures.appendText).toHaveBeenCalledTimes(1);
    expect(await c.chunkStore.all()).toEqual([]);
  });

  it("drops a chunk that cannot be transcribed and reports it lost", async () => {
    await startDevice();
    device.transcribe.mockResolvedValue({ ok: false, retry: false });
    await first().options.onChunk(fakeChunk(first().options, 1));
    await settle(100);
    expect(await c.chunkStore.all()).toEqual([]);
    expect((await shared.store.records())[0]?.lostChunks).toBe(1);
  });

  it("classifies appendText errors like chunk upload errors", async () => {
    await startDevice();
    rpc.meetingCaptures.appendText.mockRejectedValue(new ORPCError("NOT_FOUND"));
    await first().options.onChunk(fakeChunk(first().options, 1));
    await settle(100);
    expect(c.captureView().phase).toBe("failed");
  });
});
