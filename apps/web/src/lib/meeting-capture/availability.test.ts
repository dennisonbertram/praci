import { expect, it } from "vitest";
import { serverTranscribes } from "./availability.js";

it("transcription consent blocks the server engine only", () => {
  const voice = { transcribe: true, transcriptionConsented: false };
  expect(serverTranscribes(voice)).toBe(false);
  expect(serverTranscribes({ ...voice, transcriptionConsented: true })).toBe(true);
  expect(serverTranscribes({})).toBe(false);
});
