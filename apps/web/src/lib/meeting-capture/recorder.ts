import type { MeetingCaptureTrack } from "@rakazo/contracts";
import type { BufferedChunk, CaptureOwner } from "./buffer";
import { chunkKey } from "./buffer";
import type { ChunkLimits } from "./chunker";
import { createChunkCutter, DEFAULT_LIMITS } from "./chunker";

const TICK_MS = 50;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Records one audio track as separate pieces. Each piece comes from a fresh MediaRecorder, so it
 * decodes alone; a piece ends at the first quiet point once it is long enough, or at the cap.
 * ponytail: restarting the recorder can drop a few milliseconds at a boundary.
 */
export class TrackRecorder {
  /** Loudest level seen so far, for the "No call audio" check. */
  peak = 0;
  private seq: number;
  private recorder: MediaRecorder | null = null;
  private parts: Blob[] = [];
  private pieceStartMs = 0;
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly options: {
      stream: MediaStream;
      track: MeetingCaptureTrack;
      owner: CaptureOwner;
      /** Epoch ms of the capture's start; chunk offsets count from it. */
      startedAt: number;
      seqBase: number;
      limits?: ChunkLimits;
      onChunk: (chunk: BufferedChunk) => Promise<void>;
      /** The device or permission went away (the microphone being unplugged, say). */
      onEnded?: () => void;
    },
  ) {
    this.seq = options.seqBase;
  }

  start() {
    const { stream, limits } = this.options;
    this.context = new AudioContext();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    this.context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const cutter = createChunkCutter(limits ?? DEFAULT_LIMITS);
    this.startPiece();
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = Math.sqrt(sum / samples.length);
      this.peak = Math.max(this.peak, level);
      if (cutter.tick(level, now - last)) this.endPiece(false);
      last = now;
    }, TICK_MS);
    // The user stopped sharing the tab: keep what was recorded and carry on without it.
    for (const audio of stream.getAudioTracks())
      audio.onended = () => (this.options.onEnded ? this.options.onEnded() : void this.stop());
  }

  private startPiece() {
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(this.options.stream, mimeType ? { mimeType } : undefined);
    // Each recorder fills its own list: its last data event arrives after the next piece began.
    const parts: Blob[] = [];
    this.parts = parts;
    this.pieceStartMs = Date.now() - this.options.startedAt;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) parts.push(event.data);
    };
    recorder.start();
    this.recorder = recorder;
  }

  /** Closes the current piece; unless it is the last, a new one starts at once. */
  private endPiece(final: boolean): Promise<void> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") return this.pending;
    const parts = this.parts;
    const startMs = this.pieceStartMs;
    const endMs = Date.now() - this.options.startedAt;
    const seq = this.seq++;
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(parts, { type: recorder.mimeType });
        resolve(
          blob.size === 0
            ? undefined
            : this.options.onChunk({
                key: chunkKey(this.options.owner, this.options.track, seq),
                ...this.options.owner,
                track: this.options.track,
                seq,
                startMs,
                endMs,
                blob,
              }),
        );
      };
    });
    recorder.stop();
    if (final) this.recorder = null;
    else this.startPiece();
    this.pending = Promise.all([this.pending, finished]).then(() => undefined);
    return this.pending;
  }

  /** Ends the last piece (handed to `onChunk`) and releases the stream. */
  async stop(): Promise<void> {
    if (this.stopped) return this.pending;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.endPiece(true);
    for (const track of this.options.stream.getTracks()) track.stop();
    await this.context?.close().catch(() => undefined);
  }

  /** Releases the stream and drops what was recorded since the last piece. */
  abandon() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    for (const track of this.options.stream.getTracks()) track.stop();
    void this.context?.close().catch(() => undefined);
  }
}
