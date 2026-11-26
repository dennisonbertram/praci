import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import type { MeetingCaptureTrack } from "@rakazo/contracts";
import { desktopBridge } from "../desktop";
import { transcribeOnDevice } from "../device-speech";
import { rpc, withSpaceHeaders } from "../rpc";
import type { BufferedChunk, CaptureOwner, CaptureRecord } from "./buffer";
import {
  classifyUpload,
  createChunkStore,
  dropCapture,
  dropUser,
  flushChunks,
  pendingChunks,
  UploadRejected,
} from "./buffer";
import { callAudioMissing } from "./chunker";
import { TrackRecorder } from "./recorder";

/** What the recording pill shows. */
export type CaptureView =
  | { phase: "idle" }
  | {
      phase: "recording";
      captureId: string;
      title: string | null;
      startedAt: number;
      /** The shared tab has made no sound for its first 10 seconds. */
      noCallAudio: boolean;
      /** Chunks are waiting in this browser because an upload failed. */
      offline: boolean;
      /** The call tab can be shared again (after a reload, sharing needs a click). */
      canShareTab?: boolean;
      /** Why the last attempt to record call audio again failed. */
      callAudioError?: string;
    }
  | {
      phase: "transcribing";
      captureId: string;
      title: string | null;
      startedAt: number;
      /** The microphone went away, so the recording was stopped. */
      micStopped?: boolean;
      /** Chunks are still on this computer: the last upload or finish failed and is retried. */
      offline?: boolean;
    }
  /** The server closed the capture; what was recorded here could not be kept. */
  | { phase: "failed"; message: string }
  /** The meeting is stored; `meetingId` is null when the capture produced none. */
  | { phase: "stored"; meetingId: string | null };

export type StartOptions = {
  title?: string;
  consentConfirmed?: boolean;
  /** Also record the audio of a browser tab (Chrome and Edge). */
  tabAudio?: boolean;
};

const RETRY_MS = 5_000;
const POLL_MS = 2_000;
const RECOVER_RETRY_MS = 10_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One capture as this tab sees it. The tab holding the capture's Web Lock owns it: only that tab
 * records, uploads and finishes. Another tab is an observer: it shows the pill, sends Stop to the
 * owner, and takes the capture over when the owner lets go of the lock without ending it.
 */
type Session = {
  owner: CaptureOwner;
  record: CaptureRecord;
  startedAt: number;
  recorders: Map<MeetingCaptureTrack, TrackRecorder>;
  /** A tab was meant to be recorded, with or without sound. */
  expectsTabAudio: boolean;
  retry: ReturnType<typeof setTimeout> | null;
  /** New chunks are taken while true. */
  accepting: boolean;
  stopping: boolean;
  /** Sign-out, a closed capture or the end: nothing more may happen for this session. */
  ended: boolean;
  observer: boolean;
  releaseLock: (() => void) | null;
};

type Message =
  | { type: "stop"; captureId: string }
  | { type: "closed"; captureId: string; view: CaptureView }
  /** The owner's chunks are (or are no longer) waiting on its computer. */
  | { type: "offline"; captureId: string; offline: boolean };

let view: CaptureView = { phase: "idle" };
let session: Session | null = null;
let starting = false;
let recovering = false;
/** Grows on sign-out, so anything that was waiting knows it is out of date. */
let generation = 0;
/** Stop was asked for this capture, here or in another tab, maybe before this tab could act on it. */
let stopRequested: string | null = null;
let flushQueue: Promise<unknown> = Promise.resolve();
let silenceTimer: ReturnType<typeof setInterval> | null = null;
let recoverTimer: ReturnType<typeof setTimeout> | null = null;
let lastUserId: string | null = null;
let storedCount = 0;
let channel: BroadcastChannel | null = null;
/** Exposed for tests. */
export const chunkStore = createChunkStore();
const listeners = new Set<() => void>();

function set(next: CaptureView) {
  view = next;
  for (const listener of listeners) listener();
}

export const subscribeCapture = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const captureView = () => view;
/** Grows each time a recording becomes a stored meeting, so the list knows to reload. */
export const storedCaptures = () => storedCount;

const live = (s: Session) => session === s && !s.ended;
const context = (s: Session) => ({ context: { spaceId: s.owner.spaceId } });
/** A refusal that retrying cannot change. Signed out (401) is not one: the person signs in again. */
const refused = (error: unknown) =>
  error instanceof ORPCError && error.status >= 400 && error.status < 500 && error.status !== 401;
const closedMessage = () => t`This recording was closed and could not be saved.`;

/** One owner tab per capture needs Web Locks and BroadcastChannel, which every current browser has. */
const supported = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.locks) &&
  typeof BroadcastChannel !== "undefined";

/** Resolves with a release function once this tab holds the capture's lock; null when another tab holds it and `wait` is false. */
function lock(captureId: string, wait: boolean): Promise<(() => void) | null> {
  return new Promise((resolve) => {
    navigator.locks
      .request(`meeting-capture:${captureId}`, { ifAvailable: !wait }, (held) => {
        if (!held) return resolve(null);
        // The lock is held while this promise is pending.
        return new Promise<void>((release) => resolve(() => release()));
      })
      .catch(() => resolve(null));
  });
}

function listen() {
  if (channel) return;
  channel = new BroadcastChannel("praci-meeting-capture");
  channel.onmessage = ({ data }: MessageEvent<Message>) => {
    const s = session;
    const mine = s !== null && !s.ended && s.owner.captureId === data.captureId;
    if (data.type === "stop") {
      if (mine && !s.observer) void stopCapture();
      else stopRequested = data.captureId;
    } else if (data.type === "offline") {
      if (mine && s.observer) setOffline(s, data.offline);
    } else if (data.type === "closed" && mine && s.observer) {
      if (data.view.phase === "stored") storedCount += 1;
      void close(s, data.view, false);
    }
  };
}

const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
function watch(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.addEventListener("beforeunload", onBeforeUnload);
  else window.removeEventListener("beforeunload", onBeforeUnload);
}

/** Timers and the leave prompt; the lock stays until the session is over. */
function quiet(s: Session) {
  if (silenceTimer) clearInterval(silenceTimer);
  silenceTimer = null;
  if (s.retry) clearTimeout(s.retry);
  s.retry = null;
  watch(false);
}

/**
 * Ends a session. The buffer is dropped before the lock is released, so a tab that takes the lock
 * next never finds a finished capture's record. Observer tabs hear how it ended.
 */
async function close(s: Session, next: CaptureView, drop: boolean) {
  if (s.ended) return;
  const gen = generation;
  s.ended = true;
  if (session === s) session = null;
  for (const recorder of s.recorders.values()) recorder.abandon();
  quiet(s);
  if (drop) await dropCapture(chunkStore, s.owner).catch(() => undefined);
  if (!s.observer)
    channel?.postMessage({ type: "closed", captureId: s.owner.captureId, view: next });
  s.releaseLock?.();
  s.releaseLock = null;
  // Sign-out during the drop already set the view.
  if (gen === generation) set(next);
}

/** On-device capture: the chunk becomes text on this computer and only the text is sent. */
async function uploadText(chunk: BufferedChunk) {
  const result = await transcribeOnDevice(chunk.blob);
  if (!result.ok)
    throw result.retry ? new Error("Transcription failed") : new UploadRejected(422, false);
  try {
    await rpc.meetingCaptures.appendText(
      {
        captureId: chunk.captureId,
        track: chunk.track,
        seq: chunk.seq,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        text: result.text,
      },
      { context: { spaceId: chunk.spaceId } },
    );
  } catch (error) {
    throw (error instanceof ORPCError && classifyUpload(error.status, error.message)) || error;
  }
}

async function upload(chunk: BufferedChunk) {
  const query = new URLSearchParams({
    track: chunk.track,
    seq: String(chunk.seq),
    startMs: String(chunk.startMs),
    endMs: String(chunk.endMs),
  });
  const response = await fetch(
    `/api/meeting-captures/${encodeURIComponent(chunk.captureId)}/chunks?${query}`,
    {
      method: "POST",
      headers: withSpaceHeaders({ "content-type": "application/octet-stream" }, chunk.spaceId),
      credentials: "include",
      body: chunk.blob,
    },
  );
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw (
    classifyUpload(response.status, body?.error) ?? new Error(`Upload failed (${response.status})`)
  );
}

/** Shows whether chunks are waiting here, while recording or after Stop. Only for this session's view. */
function setOffline(s: Session, offline: boolean) {
  if (!live(s)) return;
  if (view.phase === "idle" || view.phase === "stored" || view.phase === "failed") return;
  if (view.captureId !== s.owner.captureId) return;
  if (Boolean(view.offline) === offline) return;
  if (view.phase === "recording") set({ ...view, offline });
  else set(offline ? { ...view, offline: true } : { ...view, offline: undefined });
  if (!s.observer)
    channel?.postMessage({
      type: "offline",
      captureId: s.owner.captureId,
      offline,
    } satisfies Message);
}

/** One upload pass over this capture's chunks, after any pass already running. */
function flush(s: Session): Promise<{ failed: boolean }> {
  const run = flushQueue.then(() => pass(s));
  flushQueue = run.catch(() => undefined);
  return run;
}

async function pass(s: Session): Promise<{ failed: boolean }> {
  if (!live(s) || s.observer) return { failed: false };
  const { failed, rejected } = await flushChunks(
    chunkStore,
    s.owner,
    s.record.engine === "device" ? uploadText : upload,
  );
  if (!live(s)) return { failed: false };
  if (rejected.some((r) => r.endsCapture)) {
    await close(s, { phase: "failed", message: closedMessage() }, true);
    return { failed: false };
  }
  if (rejected.length > 0) {
    // Kept in the record, so a reload still tells finish that the meeting is partial.
    s.record = { ...s.record, lostChunks: s.record.lostChunks + rejected.length };
    await chunkStore.putRecord(s.record);
    if (!live(s)) return { failed: false };
  }
  setOffline(s, failed);
  if (failed && !s.stopping && !s.retry) {
    s.retry = setTimeout(() => {
      s.retry = null;
      void flush(s);
    }, RETRY_MS);
  }
  return { failed };
}

async function accept(s: Session, chunk: BufferedChunk) {
  if (!s.accepting || s.ended) return;
  await chunkStore.put(chunk);
  // Sign-out or an ended capture while the write was running: leave nothing behind.
  if (s.ended) {
    await chunkStore.remove(chunk.key);
    return;
  }
  void flush(s);
}

function watchSilence(s: Session) {
  if (silenceTimer) clearInterval(silenceTimer);
  silenceTimer = setInterval(() => {
    if (!live(s) || view.phase !== "recording") return;
    const system = s.recorders.get("system");
    const missing = s.expectsTabAudio
      ? !system || callAudioMissing(system.peak, Date.now() - s.startedAt)
      : false;
    const canShareTab = s.expectsTabAudio && !system;
    if (missing !== view.noCallAudio || canShareTab !== Boolean(view.canShareTab))
      set({ ...view, noCallAudio: missing, canShareTab });
  }, 1_000);
}

function addRecorder(s: Session, track: MeetingCaptureTrack, stream: MediaStream, seqBase: number) {
  const recorder = new TrackRecorder({
    stream,
    track,
    owner: s.owner,
    startedAt: s.startedAt,
    seqBase,
    onChunk: (chunk) => accept(s, chunk),
    ...(track === "microphone"
      ? { onEnded: () => void stopCapture({ micStopped: true }) }
      : track === "system"
        ? {
            // Keep what was recorded, then let go so the pill offers to record call audio again.
            onEnded: () => {
              void recorder.stop();
              if (s.recorders.get("system") === recorder) s.recorders.delete("system");
            },
          }
        : {}),
  });
  s.recorders.set(track, recorder);
  recorder.start();
}

function begin(s: Session, streams: Map<MeetingCaptureTrack, MediaStream>, seqBase: number) {
  for (const [track, stream] of streams) addRecorder(s, track, stream, seqBase);
  watchSilence(s);
  watch(true);
}

/** Unique among a resumed capture's earlier chunks, which cannot be more than one per second. */
const resumeSeq = (s: Session) => Math.floor((Date.now() - s.startedAt) / 1000);

async function microphone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
  } catch {
    throw new Error(t`Microphone access is blocked. Allow it in your browser and try again.`);
  }
}

function callAudioError(): Error {
  const platform = desktopBridge()?.platform;
  if (platform === "darwin")
    return new Error(
      t`Praci can't hear call audio. In System Settings, open Privacy & Security, then Screen & System Audio Recording, and turn on Praci.`,
    );
  if (platform === "win32")
    return new Error(t`Praci can't hear call audio. Try again, or turn off Record call audio.`);
  return new Error(t`No tab was shared. Start again to pick one.`);
}

async function tabAudio(): Promise<MediaStream | null> {
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  } catch {
    throw callAudioError();
  }
  // macOS hands back an audio track that has already ended when System Audio Recording is denied.
  if (display.getAudioTracks().some((track) => track.readyState !== "live")) {
    stopTracks([display]);
    throw callAudioError();
  }
  for (const video of display.getVideoTracks()) video.stop();
  // Nothing to record when the tab was shared without its sound.
  return display.getAudioTracks().length > 0 ? new MediaStream(display.getAudioTracks()) : null;
}

const stopTracks = (streams: Iterable<MediaStream>) => {
  for (const stream of streams) for (const track of stream.getTracks()) track.stop();
};

const recordingView = (s: Session, noCallAudio = false): CaptureView => ({
  phase: "recording",
  captureId: s.owner.captureId,
  title: s.record.title,
  startedAt: s.startedAt,
  noCallAudio,
  offline: false,
  ...(noCallAudio ? { canShareTab: true } : {}),
});

const transcribingView = (s: Session, micStopped?: boolean): CaptureView => ({
  phase: "transcribing",
  captureId: s.owner.captureId,
  title: s.record.title,
  startedAt: s.startedAt,
  ...(micStopped ? { micStopped: true } : {}),
});

const newSession = (
  record: CaptureRecord,
  releaseLock: (() => void) | null,
  observer: boolean,
): Session => ({
  owner: { userId: record.userId, spaceId: record.spaceId, captureId: record.captureId },
  record,
  startedAt: record.startedAt,
  recorders: new Map(),
  expectsTabAudio: record.tracks.includes("system"),
  retry: null,
  accepting: false,
  stopping: false,
  ended: false,
  observer,
  releaseLock,
});

/** Starts a recording from the Record popover. Throws a readable message when it cannot. */
export async function startCapture(options: StartOptions): Promise<void> {
  if (session || starting || recovering) throw new Error(t`A recording is already running.`);
  if (!supported()) throw new Error(t`This browser cannot record meetings.`);
  listen();
  starting = true;
  const gen = generation;
  const check = () => {
    if (gen !== generation) throw new Error(t`You were signed out.`);
  };
  const streams = new Map<MeetingCaptureTrack, MediaStream>();
  let s: Session | null = null;
  let owner: CaptureOwner | null = null;
  let release: (() => void) | null = null;
  try {
    const me = await rpc.me();
    check();
    lastUserId = me.userId;
    streams.set("microphone", await microphone());
    check();
    if (options.tabAudio) {
      const tab = await tabAudio();
      if (tab) streams.set("system", tab);
      check();
    }
    const title = options.title?.trim() || undefined;
    // Decided once: a capture never switches engine, and a device capture has no server fallback.
    const engine =
      (
        await desktopBridge()
          ?.speech?.status()
          .catch(() => null)
      )?.state === "ready"
        ? "device"
        : "server";
    check();
    const { captureId } = await rpc.meetingCaptures.start(
      {
        clientId: crypto.randomUUID(),
        engine,
        tracks: [...streams.keys()],
        ...(title ? { title } : {}),
        ...(options.consentConfirmed ? { consentConfirmed: true } : {}),
      },
      { context: { spaceId: me.spaceId } },
    );
    owner = { userId: me.userId, spaceId: me.spaceId, captureId };
    check();
    // The lock comes before the record: a record whose lock is free belongs to no open tab.
    release = await lock(captureId, false);
    check();
    if (!release) throw new Error(t`A recording is already running.`);
    const captureRecord: CaptureRecord = {
      ...owner,
      tracks: [...streams.keys()],
      title: title ?? null,
      startedAt: Date.now(),
      stopped: false,
      lostChunks: 0,
      engine,
    };
    await chunkStore.putRecord(captureRecord);
    check();
    s = newSession(captureRecord, release, false);
    s.expectsTabAudio = Boolean(options.tabAudio);
    s.accepting = true;
    session = s;
    set(recordingView(s));
    begin(s, streams, 0);
  } catch (error) {
    // Roll everything back: no session, no open microphone, no record, no half-made capture.
    stopTracks(streams.values());
    if (s) {
      s.ended = true;
      if (session === s) session = null;
      for (const recorder of s.recorders.values()) recorder.abandon();
      quiet(s);
    }
    if (owner) await dropCapture(chunkStore, owner).catch(() => undefined);
    release?.();
    if (s && gen === generation) set({ phase: "idle" });
    if (owner)
      await rpc.meetingCaptures
        .discard({ captureId: owner.captureId }, { context: { spaceId: owner.spaceId } })
        .catch(() => undefined);
    throw error;
  } finally {
    starting = false;
  }
  // Stop was pressed in another tab before this one was listening for it.
  if (stopRequested === owner?.captureId) void stopCapture();
}

/** Finds the stored meeting once the capture has left `active`. */
async function waitForStored(s: Session) {
  for (;;) {
    await sleep(POLL_MS);
    if (!live(s)) return;
    let active: Awaited<ReturnType<typeof rpc.meetingCaptures.active>>;
    try {
      active = await rpc.meetingCaptures.active(undefined, context(s));
    } catch {
      continue;
    }
    if (!live(s)) return;
    // ponytail: `active` names only the newest open capture, so an older one counts as stored once
    // a newer one is open; its meeting is then found by time or not opened automatically.
    if (active?.captureId === s.owner.captureId) continue;
    let meetingId: string | null = null;
    try {
      const page = await rpc.meetings.list({}, context(s));
      meetingId =
        page.items.find(
          (meeting) =>
            meeting.provider === "praci" && Date.parse(meeting.startedAt) >= s.startedAt - 60_000,
        )?.id ?? null;
    } catch {
      // The list refreshes on its own; only the automatic open is lost.
    }
    if (!live(s)) return;
    storedCount += 1;
    await close(s, { phase: "stored", meetingId }, true);
    return;
  }
}

/** Tells the server the recording is over. False when the session ended instead. */
async function finishRpc(s: Session): Promise<boolean> {
  while (live(s)) {
    try {
      await rpc.meetingCaptures.finish(
        {
          captureId: s.owner.captureId,
          endedAt: new Date().toISOString(),
          ...(s.record.lostChunks ? { lostChunks: s.record.lostChunks } : {}),
        },
        context(s),
      );
      if (live(s)) setOffline(s, false);
      return live(s);
    } catch (error) {
      if (!live(s)) return false;
      if (refused(error)) {
        await close(s, { phase: "failed", message: closedMessage() }, true);
        return false;
      }
      // The record is safe here; the pill says so while this asks again.
      setOffline(s, true);
      await sleep(RETRY_MS);
    }
  }
  return false;
}

/** Uploads what is left, tells the server the recording is over, and waits for the meeting. */
async function finishFlow(s: Session) {
  // Finishing before the last chunk arrived would leave it out of the meeting.
  for (;;) {
    if (!live(s)) return;
    const { failed } = await flush(s);
    if (!live(s)) return;
    if (!failed && (await pendingChunks(chunkStore, s.owner)).length === 0) break;
    await sleep(RETRY_MS);
  }
  if (await finishRpc(s)) await waitForStored(s);
}

/** Stops recording, uploads what is left, and waits for the meeting to be stored. */
export async function stopCapture(options: { micStopped?: boolean } = {}): Promise<void> {
  const s = session;
  if (!s || s.stopping || s.ended) return;
  s.stopping = true;
  stopRequested = s.owner.captureId;
  set(transcribingView(s, options.micStopped));
  if (s.observer) {
    // The owner tab stops. If it is gone, this tab gets the lock and finishes (see `observe`).
    channel?.postMessage({ type: "stop", captureId: s.owner.captureId } satisfies Message);
    return;
  }
  // Written before anything else, so a reload at any point after this finishes instead of recording.
  s.record = { ...s.record, stopped: true };
  await chunkStore.putRecord(s.record);
  if (!live(s)) return;
  await Promise.all([...s.recorders.values()].map((recorder) => recorder.stop()));
  s.accepting = false;
  quiet(s);
  await finishFlow(s);
}

/** Records the call tab again after a reload; must run from the click that asks for it. */
export async function shareTabAudio(): Promise<void> {
  const s = session;
  if (!s || !live(s) || s.observer || s.stopping || !s.expectsTabAudio) return;
  if (s.recorders.has("system")) return;
  let stream: MediaStream | null;
  try {
    stream = await tabAudio();
  } catch (cause) {
    if (live(s) && view.phase === "recording")
      set({ ...view, callAudioError: cause instanceof Error ? cause.message : String(cause) });
    return;
  }
  if (!stream) return;
  if (!live(s) || s.stopping || s.recorders.has("system")) return stopTracks([stream]);
  if (view.phase === "recording" && view.callAudioError !== undefined) {
    const { callAudioError: _cleared, ...rest } = view;
    set(rest);
  }
  addRecorder(s, "system", stream, resumeSeq(s));
}

function scheduleRecover() {
  if (recoverTimer) return;
  recoverTimer = setTimeout(() => {
    recoverTimer = null;
    void recoverCapture();
  }, RECOVER_RETRY_MS);
}

/** Shows a capture another tab owns, and carries it on if that tab lets go without ending it. */
function observe(captureRecord: CaptureRecord, userId: string, gen: number) {
  const s = newSession(captureRecord, null, true);
  session = s;
  set(captureRecord.stopped ? transcribingView(s) : recordingView(s));
  void lock(captureRecord.captureId, true).then(async (release) => {
    if (!release) return;
    if (!live(s) || gen !== generation) return release();
    // The owner tab closed or crashed: continue from its record.
    s.ended = true;
    session = null;
    if (!(await adopt(captureRecord.captureId, userId, release, gen)) && gen === generation)
      set({ phase: "idle" });
  });
}

/**
 * Continues a capture whose lock this tab holds: records again when the server still records it
 * and nobody pressed Stop; otherwise uploads what is left and finishes. Every question is asked in
 * the capture's own space. False when the capture was left alone (the lock is then released).
 */
async function adopt(
  captureId: string,
  userId: string,
  release: () => void,
  gen: number,
): Promise<boolean> {
  const stale = () => gen !== generation || session !== null || starting;
  const giveUp = () => {
    release();
    return false;
  };
  const captureRecord = (await chunkStore.records()).find((item) => item.captureId === captureId);
  if (!captureRecord || captureRecord.userId !== userId || stale()) return giveUp();
  const scope = { context: { spaceId: captureRecord.spaceId } };
  let me: Awaited<ReturnType<typeof rpc.me>>;
  let active: Awaited<ReturnType<typeof rpc.meetingCaptures.active>>;
  try {
    me = await rpc.me(undefined, scope);
    active = await rpc.meetingCaptures.active(undefined, scope);
  } catch (error) {
    // Not a member of that space any more: nothing here can finish the capture.
    if (refused(error)) {
      if (!stale()) await dropCapture(chunkStore, captureRecord);
    } else scheduleRecover();
    return giveUp();
  }
  // Another person's capture stays for them; it is finished when they sign in here again.
  if (stale() || me.userId !== captureRecord.userId || me.spaceId !== captureRecord.spaceId)
    return giveUp();
  lastUserId = me.userId;
  const s = newSession(captureRecord, release, false);
  session = s;
  const recording =
    active?.captureId === captureId &&
    active.status === "recording" &&
    !captureRecord.stopped &&
    stopRequested !== captureId;
  if (!recording) {
    // Stopped, finishing, or no longer the open capture: store what is here.
    s.stopping = true;
    set(transcribingView(s));
    await finishFlow(s);
    return true;
  }
  s.accepting = true;
  // Sharing a tab again needs a click, so a resumed call recording has no call audio until then.
  set(recordingView(s, s.expectsTabAudio));
  void flush(s);
  let mic: MediaStream;
  try {
    mic = await microphone();
  } catch {
    // The microphone is not available any more: store what arrived.
    await stopCapture();
    return true;
  }
  if (!live(s) || s.stopping) {
    stopTracks([mic]);
    return true;
  }
  try {
    begin(s, new Map([["microphone", mic]]), resumeSeq(s));
  } catch {
    // The recorder could not start: let go of the microphone and store what arrived.
    for (const recorder of s.recorders.values()) recorder.abandon();
    s.recorders.clear();
    stopTracks([mic]);
    await stopCapture();
  }
  return true;
}

/**
 * Picks up captures this browser started and lost track of (reload, crash, closed tab). A capture
 * another tab holds is shown read-only. Only captures with a local record are touched.
 */
export async function recoverCapture(): Promise<void> {
  if (session || starting || recovering || !supported()) return;
  listen();
  recovering = true;
  const gen = generation;
  try {
    const records = await chunkStore.records();
    if (records.length === 0) return;
    let userId: string;
    try {
      ({ userId } = await rpc.me());
    } catch {
      scheduleRecover();
      return;
    }
    // Another person's captures in this browser are never shown, continued or deleted here.
    for (const captureRecord of records.filter((item) => item.userId === userId)) {
      if (gen !== generation || session || starting) return;
      const release = await lock(captureRecord.captureId, false);
      if (gen !== generation || session || starting) return release?.();
      if (!release) return observe(captureRecord, userId, gen);
      if (await adopt(captureRecord.captureId, userId, release, gen)) return;
    }
  } finally {
    recovering = false;
  }
}

/** The pill goes once the meeting is stored (and opened, when the user was on the list) or the error is read. */
export function dismissStored() {
  if (view.phase === "stored" || view.phase === "failed") set({ phase: "idle" });
}

/** Sign-out: end the session first, then drop everything this user buffered. */
export async function clearCaptureOnSignOut(userId?: string | null): Promise<void> {
  generation += 1;
  stopRequested = null;
  if (recoverTimer) clearTimeout(recoverTimer);
  recoverTimer = null;
  const s = session;
  if (s) {
    s.ended = true;
    session = null;
    for (const recorder of s.recorders.values()) recorder.abandon();
    quiet(s);
  }
  set({ phase: "idle" });
  await dropUser(chunkStore, userId ?? s?.owner.userId ?? lastUserId);
  s?.releaseLock?.();
}
