import { afterEach, expect, it, vi } from "vitest";
import { downmix, encodeWav, transcribeOnDevice } from "./device-speech.js";

afterEach(() => vi.unstubAllGlobals());

it("writes a 44-byte PCM16 mono WAV header and clamped samples", () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
  const view = new DataView(wav.buffer);
  const text = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
  expect(wav.length).toBe(44 + 8);
  expect([text(0), text(8), text(12), text(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
  expect(view.getUint32(4, true)).toBe(36 + 8);
  expect(view.getUint16(20, true)).toBe(1);
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint16(34, true)).toBe(16);
  expect(view.getUint32(40, true)).toBe(8);
  expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
    0, 32767, -32768, 32767,
  ]);
});

it("averages channels into mono", () => {
  expect([...downmix([new Float32Array([1, 0]), new Float32Array([0, -1])])]).toEqual([0.5, -0.5]);
});

it("refuses without a desktop speech bridge", async () => {
  vi.stubGlobal("window", {});
  expect(await transcribeOnDevice(new Blob(["x"]))).toEqual({ ok: false, retry: false });
});

it("reports a decode failure as not retryable", async () => {
  const transcribe = vi.fn();
  vi.stubGlobal("window", { rakazoDesktop: { speech: { transcribe } } });
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData() {
        return Promise.reject(new Error("bad"));
      }
    },
  );
  expect(await transcribeOnDevice(new Blob(["x"]))).toEqual({ ok: false, retry: false });
  expect(transcribe).not.toHaveBeenCalled();
});
