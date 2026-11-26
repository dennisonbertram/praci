import type { DesktopSpeechResult, DesktopSpeechStatus } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { desktopBridge } from "./desktop";

const SAMPLE_RATE = 16_000;

/** Averages all channels into one. */
export function downmix(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + (channel[i] ?? 0);
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / channels.length;
  return out;
}

/** Mono 16-bit PCM WAV: 44-byte header, then little-endian samples. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
  });
  return bytes;
}

/** Decodes recorded audio (WebM) and resamples it to 16 kHz mono WAV. */
export async function toWav(blob: Blob): Promise<Uint8Array> {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
    decoded.getChannelData(i),
  );
  return encodeWav(downmix(channels), decoded.sampleRate);
}

/** Audio is transcribed by the desktop app; only text comes back. */
export async function transcribeOnDevice(blob: Blob): Promise<DesktopSpeechResult> {
  const speech = desktopBridge()?.speech;
  if (!speech) return { ok: false, retry: false };
  let wav: Uint8Array;
  try {
    wav = await toWav(blob);
  } catch {
    return { ok: false, retry: false };
  }
  try {
    return await speech.transcribe(wav);
  } catch {
    return { ok: false, retry: true };
  }
}

/** Live on-device speech status; null when this host has no speech bridge. */
export function useDeviceSpeech(): DesktopSpeechStatus | null {
  const [status, setStatus] = useState<DesktopSpeechStatus | null>(null);
  useEffect(() => {
    const speech = desktopBridge()?.speech;
    if (!speech) return;
    let live = true;
    const unsubscribe = speech.onStatus((next) => live && setStatus(next));
    void speech.status().then(
      (next) => live && setStatus(next),
      () => live && setStatus({ state: "error" }),
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return status;
}
