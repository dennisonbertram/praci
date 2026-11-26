// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const tag = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tag }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: tag }));

const rpc = vi.hoisted(() => ({
  voice: { status: vi.fn() },
  spaces: { list: vi.fn(), setMeetingRecording: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({
  rpc,
  selectedSpaceId: () => null,
  withSpaceHeaders: (init?: HeadersInit) => new Headers(init),
}));
const startCapture = vi.hoisted(() => vi.fn());
vi.mock("../../lib/meeting-capture/controller", () => ({ startCapture }));

import { MeetingRecordingSettings } from "../MeetingRecordingSettings";
import { RecordButton } from "./RecordButton";
import { RecordingPill } from "./RecordingPill";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: ReturnType<typeof createRoot>[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
});

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
  return container;
}

const space = (extra: Record<string, unknown> = {}) => ({
  current: { id: "s1" },
  spaces: [{ id: "s1", meetingRecording: "remind", canSetMeetingRecording: true, ...extra }],
});
const voice = (ready: boolean) => ({ transcribe: false, transcriptionReady: ready });

const click = (el: Element | null | undefined) =>
  act(async () => el?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(label));

it("shows no Record when the space policy is off", async () => {
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space({ meetingRecording: "off" }));
  const page = await mount(<RecordButton />);
  expect(page.textContent).toBe("");
});

it("offers Add speech to text, not Record, without an engine", async () => {
  rpc.voice.status.mockResolvedValue(voice(false));
  rpc.spaces.list.mockResolvedValue(space());
  const onAddSpeech = vi.fn();
  await mount(<RecordButton onAddSpeech={onAddSpeech} />);
  expect(button("Record")).toBeUndefined();
  await click(button("Add speech to text"));
  expect(onAddSpeech).toHaveBeenCalled();
});

it("remind: one line and Start is ready at once", async () => {
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space());
  startCapture.mockResolvedValue(undefined);
  await mount(<RecordButton />);
  await click(button("Record"));
  expect(document.body.textContent).toContain("Tell everyone you're recording.");
  expect(document.body.textContent).not.toContain("Everyone agreed");
  await click(button("Start"));
  expect(startCapture).toHaveBeenCalledWith({
    title: expect.stringMatching(/^Meeting /),
    tabAudio: false,
  });
});

it("a blank title starts with the placeholder the form showed", async () => {
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space());
  startCapture.mockResolvedValue(undefined);
  await mount(<RecordButton />);
  await click(button("Record"));
  const shown = document.body.querySelector("input")?.placeholder;
  expect(shown).toMatch(/^Meeting /);
  await click(button("Start"));
  expect(startCapture).toHaveBeenCalledWith({ title: shown, tabAudio: false });
});

it("on desktop, Record call audio starts checked and is sent with Start", async () => {
  vi.stubGlobal("window", Object.assign(window, { rakazoDesktop: { platform: "darwin" } }));
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space());
  startCapture.mockResolvedValue(undefined);
  await mount(<RecordButton />);
  await click(button("Record"));
  expect(document.body.textContent).toContain("Record call audio");
  await click(button("Start"));
  expect(startCapture).toHaveBeenCalledWith({
    title: expect.stringMatching(/^Meeting /),
    tabAudio: true,
  });
  delete (window as { rakazoDesktop?: unknown }).rakazoDesktop;
});

it("confirm: Start stays disabled until the box is ticked, then sends consent", async () => {
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space({ meetingRecording: "confirm" }));
  startCapture.mockResolvedValue(undefined);
  await mount(<RecordButton />);
  await click(button("Record"));
  const start = button("Start") as HTMLButtonElement;
  expect(start.disabled).toBe(true);
  await click(document.body.querySelector("[role=checkbox]"));
  expect((button("Start") as HTMLButtonElement).disabled).toBe(false);
  await click(button("Start"));
  expect(startCapture).toHaveBeenCalledWith({
    title: expect.stringMatching(/^Meeting /),
    tabAudio: false,
    consentConfirmed: true,
  });
});

it("shows why a recording could not start", async () => {
  rpc.voice.status.mockResolvedValue(voice(true));
  rpc.spaces.list.mockResolvedValue(space());
  startCapture.mockRejectedValue(new Error("Microphone access is blocked."));
  await mount(<RecordButton />);
  await click(button("Record"));
  await click(button("Start"));
  expect(document.body.textContent).toContain("Microphone access is blocked.");
});

it("pill: recording shows the title, elapsed time and Stop", async () => {
  const onStop = vi.fn();
  const page = await mount(
    <RecordingPill
      state={{ kind: "recording", title: "Pricing review", elapsedMs: 754_000 }}
      onStop={onStop}
    />,
  );
  expect(page.textContent).toContain("Pricing review");
  expect(page.textContent).toContain("12:34");
  await click(button("Stop"));
  expect(onStop).toHaveBeenCalled();
});

it("pill: no call audio, offline and transcribing states", async () => {
  const noAudio = await mount(
    <RecordingPill
      state={{ kind: "recording", title: "A", elapsedMs: 0, noCallAudio: true }}
      onStop={() => {}}
    />,
  );
  expect(noAudio.textContent).toContain("No call audio");
  const offline = await mount(
    <RecordingPill
      state={{ kind: "recording", title: "A", elapsedMs: 0, offline: true }}
      onStop={() => {}}
    />,
  );
  expect(offline.textContent).toContain("Offline, saved here");
  const transcribing = await mount(
    <RecordingPill state={{ kind: "transcribing" }} onStop={() => {}} />,
  );
  expect(transcribing.textContent).toContain("Transcribing…");
  expect(transcribing.querySelector("button")).toBeNull();
});

it("policy card: owners and admins change it", async () => {
  rpc.spaces.list.mockResolvedValue(space());
  rpc.spaces.setMeetingRecording.mockResolvedValue({ policy: "confirm" });
  const card = await mount(<MeetingRecordingSettings />);
  const select = card.querySelector("select") as HTMLSelectElement;
  expect(select.value).toBe("remind");
  await act(async () => {
    select.value = "confirm";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rpc.spaces.setMeetingRecording).toHaveBeenCalledWith({ policy: "confirm" });
  expect(card.textContent).toContain("Everyone agreed to be recorded");
});

it("policy card: members do not see it", async () => {
  rpc.spaces.list.mockResolvedValue(space({ canSetMeetingRecording: false }));
  const card = await mount(<MeetingRecordingSettings />);
  expect(card.textContent).toBe("");
});

it("without consent for this space Record is replaced by Add speech to text", async () => {
  rpc.voice.status.mockResolvedValue({
    transcribe: false,
    transcriptionReady: true,
    transcriptionConsented: false,
  });
  rpc.spaces.list.mockResolvedValue(space());
  await mount(<RecordButton />);
  expect(button("Record")).toBeUndefined();
  expect(button("Add speech to text")).toBeDefined();
});

it("pill: a closed capture shows why and can be dismissed; a stopped microphone is named", async () => {
  const onDismiss = vi.fn();
  const failed = await mount(
    <RecordingPill
      state={{ kind: "failed", message: "Closed." }}
      onStop={() => {}}
      onDismiss={onDismiss}
    />,
  );
  expect(failed.textContent).toContain("Closed.");
  await click(button("Dismiss"));
  expect(onDismiss).toHaveBeenCalled();
  const mic = await mount(
    <RecordingPill state={{ kind: "transcribing", micStopped: true }} onStop={() => {}} />,
  );
  expect(mic.textContent).toContain("Microphone stopped");
});
