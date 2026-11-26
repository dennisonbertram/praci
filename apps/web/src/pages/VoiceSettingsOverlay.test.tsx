// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const voice = vi.hoisted(() => ({
  catalog: vi.fn(),
  credentials: vi.fn(),
  status: vi.fn(),
  voices: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  setVoice: vi.fn(),
  setSpeechModel: vi.fn(),
  setTranscription: vi.fn(),
  clearTranscription: vi.fn(),
}));

vi.mock("../lib/rpc", () => ({ rpc: { voice } }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((result, part, index) => `${result}${part}${values[index] ?? ""}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
    Dialog: Container,
    DialogClose: Container,
    DialogContent: Container,
    DialogTitle: Container,
    Field: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    FieldLabel: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
      <label htmlFor={htmlFor}>{children}</label>
    ),
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
  };
});

import { VoiceSettingsOverlay } from "./VoiceSettingsOverlay";

const fish = {
  id: "cred-fish",
  provider: "fish-audio",
  hasKey: true,
  isDefault: true,
  voiceId: "voice-1",
  speechModel: "",
  transcribe: true,
};
const eleven = {
  id: "cred-eleven",
  provider: "elevenlabs",
  hasKey: true,
  isDefault: false,
  voiceId: "rachel",
  speechModel: "",
  transcribe: true,
};

function speechModelInput(container: HTMLElement): HTMLInputElement | undefined {
  return [...container.querySelectorAll("input")].find((input) => {
    const label = container.querySelector(`label[for="${input.id}"]`);
    return label?.textContent === "Speech model";
  });
}

it("saves a Fish speech model on the existing provider pane", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  voice.catalog.mockResolvedValue([
    { id: "fish-audio", name: "Fish Audio", description: "", transcribe: true },
    { id: "elevenlabs", name: "ElevenLabs", description: "", transcribe: true },
  ]);
  voice.credentials.mockResolvedValue([fish, eleven]);
  voice.status.mockResolvedValue({
    configured: true,
    ready: true,
    transcribe: true,
    provider: "fish-audio",
    voiceId: "voice-1",
  });
  voice.voices.mockImplementation(async ({ provider }: { provider?: string }) =>
    provider === "elevenlabs"
      ? [{ id: "rachel", label: "Rachel" }]
      : [{ id: "voice-1", label: "Aria" }],
  );
  voice.setSpeechModel.mockImplementation(async ({ speechModel }: { speechModel: string }) => ({
    ...fish,
    speechModel,
  }));

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const button = (text: string) => {
    const found = [...container.querySelectorAll("button")].find((entry) =>
      entry.textContent?.includes(text),
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  };
  try {
    await act(async () => {
      root.render(<VoiceSettingsOverlay embedded onClose={() => undefined} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const input = speechModelInput(container);
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe("Optional");

    await act(async () => {
      button("ElevenLabs").click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(speechModelInput(container)).toBeUndefined();

    await act(async () => {
      button("Fish Audio").click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const fishInput = speechModelInput(container);
    if (!fishInput) throw new Error("Missing speech model field");
    await act(async () => {
      fishInput.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(fishInput, "s1");
      fishInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      fishInput.blur();
    });

    expect(voice.setSpeechModel).toHaveBeenCalledWith({
      provider: "fish-audio",
      speechModel: "s1",
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("saves an OpenAI-compatible server's base URL and model, and never shows the key back", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  voice.catalog.mockResolvedValue([
    {
      id: "openai-compatible",
      name: "OpenAI-compatible",
      description: "",
      transcribe: true,
      speech: false,
    },
  ]);
  voice.credentials.mockResolvedValue([]);
  let connected: string | null = null;
  voice.status.mockImplementation(async () => ({
    configured: false,
    ready: false,
    transcribe: false,
    provider: null,
    voiceId: "",
    transcriptionProvider: connected,
    transcriptionReady: false,
  }));
  voice.setTranscription.mockImplementation(async ({ provider }: { provider: string }) => {
    connected = provider;
    return { provider };
  });

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const field = (label: string) => {
    const found = [...container.querySelectorAll("input")].find(
      (input) => container.querySelector(`label[for="${input.id}"]`)?.textContent === label,
    );
    if (!found) throw new Error(`Missing field: ${label}`);
    return found;
  };
  const type = async (input: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  try {
    await act(async () => {
      root.render(<VoiceSettingsOverlay embedded onClose={() => undefined} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const connect = () =>
      [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Connect "))!;
    expect(connect().disabled).toBe(true);
    await type(field("Base URL"), "http://localhost:8000");
    await type(field("Model"), "whisper-large-v3");
    expect(field("API key (optional)").type).toBe("password");
    await type(field("API key (optional)"), "secret-key-value");
    await act(async () => {
      connect().click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(voice.setTranscription).toHaveBeenCalledWith({
      provider: "openai-compatible",
      baseUrl: "http://localhost:8000",
      model: "whisper-large-v3",
      apiKey: "secret-key-value",
    });
    expect(field("API key (optional)").value).toBe("");
    expect(container.innerHTML).not.toContain("secret-key-value");
    expect(container.textContent).toContain("Disconnect");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

async function renderWithSpeech(speech?: unknown) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  voice.catalog.mockResolvedValue([
    { id: "fish-audio", name: "Fish Audio", description: "", transcribe: true },
  ]);
  voice.credentials.mockResolvedValue([]);
  voice.status.mockResolvedValue({ configured: false, ready: false, transcribe: false });
  vi.stubGlobal(
    "window",
    Object.assign(window, { rakazoDesktop: speech ? { speech } : undefined }),
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<VoiceSettingsOverlay embedded onClose={() => undefined} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  const row = () =>
    [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("On this device"),
    );
  const pane = () => container.querySelector("[data-testid=device-speech]");
  return { container, row, pane };
}
const bridge = (state: object, extra: object = {}) => ({
  status: async () => state,
  onStatus: () => () => undefined,
  prepare: vi.fn(),
  forget: vi.fn(),
  ...extra,
});

it("hides the On this device row without a bridge or when unavailable", async () => {
  expect((await renderWithSpeech()).row()).toBeUndefined();
  expect((await renderWithSpeech(bridge({ state: "unavailable" }))).row()).toBeUndefined();
});

it("selects the device by default when ready, with a Ready label on the row", async () => {
  const { row, pane } = await renderWithSpeech(bridge({ state: "ready" }));
  expect(row()?.textContent).toContain("Ready");
  expect(pane()?.textContent).toContain("Ready. Audio stays on this Mac.");
  expect(pane()?.textContent).toContain("Stop using");
});

it("shows each state's pane after selecting the row", async () => {
  const cases: Array<[object, string]> = [
    [{ state: "not-prepared" }, "Prepare"],
    [{ state: "preparing", progress: 0.42 }, "Preparing… 42%"],
    [{ state: "error" }, "Try again"],
  ];
  for (const [state, text] of cases) {
    const { row, pane } = await renderWithSpeech(bridge(state));
    expect(pane()).toBeNull();
    await act(async () => row()?.click());
    expect(pane()?.textContent).toContain(text);
  }
  const { row, pane } = await renderWithSpeech(bridge({ state: "preparing", progress: null }));
  await act(async () => row()?.click());
  expect(pane()?.textContent).not.toContain("%");
});

it("applies the status returned by prepare when nothing is pushed", async () => {
  const { row, pane } = await renderWithSpeech(
    bridge({ state: "not-prepared" }, { prepare: async () => ({ state: "ready" }) }),
  );
  await act(async () => row()?.click());
  await act(async () => {
    [...(pane()?.querySelectorAll("button") ?? [])]
      .find((b) => b.textContent === "Prepare")
      ?.click();
  });
  expect(pane()?.textContent).toContain("Ready. Audio stays on this Mac.");
});

it("cancels a running prepare with forget", async () => {
  const forget = vi.fn(async () => ({ state: "not-prepared" }));
  const { row, pane } = await renderWithSpeech(
    bridge({ state: "preparing", progress: 0.42 }, { forget }),
  );
  await act(async () => row()?.click());
  await act(async () => {
    [...(pane()?.querySelectorAll("button") ?? [])]
      .find((b) => b.textContent === "Cancel")
      ?.click();
  });
  expect(forget).toHaveBeenCalledOnce();
  expect(pane()?.textContent).toContain("Prepare");
});

it("retries a failed settings load and clears the error after recovery", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  voice.catalog.mockRejectedValueOnce(new Error("Could not load voice settings"));
  let finishCatalog!: (value: unknown[]) => void;
  voice.catalog.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCatalog = resolve;
      }),
  );
  voice.credentials.mockResolvedValue([]);
  voice.status.mockResolvedValue({ configured: false, ready: false, transcribe: false });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<VoiceSettingsOverlay embedded onClose={() => undefined} />));
    expect(container.textContent).toContain("Could not load voice settings");
    const retry = () =>
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Try again",
      );
    expect(retry()).toBeDefined();
    await act(async () => retry()?.click());
    expect(container.textContent).toContain("Loading voice providers…");
    expect(voice.credentials).toHaveBeenCalled();
    expect(voice.status).toHaveBeenCalled();
    await act(async () =>
      finishCatalog([{ id: "fish-audio", name: "Fish Audio", description: "", transcribe: true }]),
    );
    expect(container.textContent).not.toContain("Could not load voice settings");
    expect(retry()).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function mountVoiceSettings() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<VoiceSettingsOverlay embedded onClose={() => undefined} />);
  });
  return {
    container,
    root,
    button: (text: string) =>
      [...container.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text)),
    voiceSelect: () => container.querySelector("select"),
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

function configureVoiceMocks({ credential = fish }: { credential?: typeof fish | null } = {}) {
  vi.clearAllMocks();
  let currentCredential = credential;
  voice.catalog.mockResolvedValue([
    { id: "fish-audio", name: "Fish Audio", description: "", transcribe: true },
    { id: "elevenlabs", name: "ElevenLabs", description: "", transcribe: true },
  ]);
  voice.credentials.mockImplementation(async () =>
    currentCredential
      ? [currentCredential, ...(currentCredential === fish ? [eleven] : [fish])]
      : [],
  );
  voice.status.mockResolvedValue({
    configured: Boolean(credential),
    ready: Boolean(credential),
    transcribe: true,
    provider: credential?.provider ?? "fish-audio",
    voiceId: credential?.voiceId ?? "",
  });
  voice.voices.mockImplementation(async ({ provider }: { provider?: string }) =>
    provider === "elevenlabs"
      ? [{ id: "rachel", label: "Rachel" }]
      : [
          { id: "voice-1", label: "Aria" },
          { id: "voice-2", label: "Voice two" },
        ],
  );
  return { setCredential: (next: typeof fish | null) => (currentCredential = next) };
}

it("keeps connect success and offers retry when status refresh fails", async () => {
  const { setCredential } = configureVoiceMocks({ credential: null });
  voice.connect.mockImplementation(async () => setCredential(fish));
  voice.status.mockResolvedValueOnce({ configured: false, ready: false, transcribe: false });
  voice.status.mockRejectedValueOnce(new Error("status unavailable"));
  const view = await mountVoiceSettings();
  try {
    const key = view.container.querySelector('input[type="password"]');
    if (!key) throw new Error("Missing API key field");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(key, "fake-api-key");
      key.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => view.button("Connect Fish Audio")?.click());
    expect(view.container.textContent).toContain("Connected Fish Audio.");
    expect(view.container.textContent).toContain("Could not load voice settings");
    expect(view.container.textContent).not.toContain("Could not connect this voice provider");
    expect(view.button("Try again")).toBeDefined();
    const error = [...view.container.querySelectorAll("p")].find(
      (item) => item.textContent === "Could not load voice settings",
    );
    const notice = [...view.container.querySelectorAll("p")].find(
      (item) => item.textContent === "Connected Fish Audio.",
    );
    if (!error || !notice) throw new Error("Missing load error or success notice");
    expect(error.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  } finally {
    await view.cleanup();
  }
});

it("shows the saved voice when the initial voices request fails", async () => {
  configureVoiceMocks();
  voice.voices.mockRejectedValue(undefined);
  const view = await mountVoiceSettings();
  try {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.container.querySelector("select")?.value).toBe("voice-1");
    expect(view.container.textContent).not.toContain("Could not load voice settings");
  } finally {
    await view.cleanup();
  }
});

it("keeps provider changes silent when only the voices request fails", async () => {
  configureVoiceMocks();
  voice.voices.mockResolvedValueOnce([{ id: "voice-1", label: "Aria" }]);
  voice.voices.mockRejectedValueOnce(undefined);
  const view = await mountVoiceSettings();
  try {
    await act(async () => Promise.resolve());
    await act(async () => view.button("ElevenLabs")?.click());
    expect(view.voiceSelect()?.value).toBe("rachel");
    expect(view.container.textContent).not.toContain("Could not load voice settings");
    expect(view.button("Try again")).toBeUndefined();
  } finally {
    await view.cleanup();
  }
});

it("keeps the load error when retry still cannot load voices", async () => {
  configureVoiceMocks();
  voice.catalog.mockRejectedValueOnce(new Error("Could not load voice settings"));
  voice.voices.mockRejectedValue(undefined);
  const view = await mountVoiceSettings();
  try {
    expect(view.container.textContent).toContain("Could not load voice settings");
    await act(async () => view.button("Try again")?.click());
    await act(async () => Promise.resolve());
    expect(view.container.textContent).toContain("Could not load voice settings");
    expect(view.button("Try again")).toBeDefined();
  } finally {
    await view.cleanup();
  }
});

it("shows a load error rather than a disconnect error when refresh fails", async () => {
  const { setCredential } = configureVoiceMocks();
  voice.disconnect.mockImplementation(async () => setCredential(null));
  voice.status.mockResolvedValueOnce({ configured: true, ready: true, transcribe: true });
  voice.status.mockRejectedValueOnce(new Error("status unavailable"));
  const view = await mountVoiceSettings();
  try {
    await act(async () => Promise.resolve());
    await act(async () => view.button("Disconnect")?.click());
    expect(view.container.textContent).toContain("Could not load voice settings");
    expect(view.container.textContent).not.toContain("Could not disconnect this voice provider");
    expect(view.button("Try again")).toBeDefined();
    voice.setVoice.mockResolvedValue({ ready: true, voiceId: "voice-2" });
    await act(async () => {
      const select = view.voiceSelect();
      if (!select) throw new Error("Missing voice selector");
      select.value = "voice-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(view.container.textContent).not.toContain("Could not load voice settings");
    expect(view.button("Try again")).toBeUndefined();
  } finally {
    await view.cleanup();
  }
});

it("ignores an older initial voices rejection after switching providers", async () => {
  configureVoiceMocks();
  const initialFishVoices = deferred<Array<{ id: string; label: string }>>();
  voice.voices.mockImplementation(({ provider }: { provider?: string }) =>
    provider === "fish-audio"
      ? initialFishVoices.promise
      : Promise.resolve([{ id: "rachel", label: "Rachel" }]),
  );
  const view = await mountVoiceSettings();
  try {
    await act(async () => Promise.resolve());
    await act(async () => view.button("ElevenLabs")?.click());
    expect(view.voiceSelect()?.value).toBe("rachel");
    await act(async () => initialFishVoices.reject(new Error("stale voices failure")));
    expect(view.voiceSelect()?.value).toBe("rachel");
    expect(view.container.textContent).not.toContain("Could not load voice settings");
    expect(view.button("Try again")).toBeUndefined();
  } finally {
    await view.cleanup();
  }
});

it("saves a voice without reloading the voices list", async () => {
  configureVoiceMocks();
  voice.setVoice.mockResolvedValue({ ready: true, voiceId: "voice-2" });
  const view = await mountVoiceSettings();
  try {
    await act(async () => Promise.resolve());
    expect(voice.voices).toHaveBeenCalledTimes(1);
    await act(async () => {
      const select = view.voiceSelect();
      if (!select) throw new Error("Missing voice selector");
      select.value = "voice-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(voice.voices).toHaveBeenCalledTimes(1);
  } finally {
    await view.cleanup();
  }
});

it("restores the selected voice when saving it fails", async () => {
  configureVoiceMocks();
  voice.setVoice.mockRejectedValue(undefined);
  const view = await mountVoiceSettings();
  try {
    await act(async () => Promise.resolve());
    await act(async () => {
      const select = view.voiceSelect();
      if (!select) throw new Error("Missing voice selector");
      select.value = "voice-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(view.container.textContent).toContain("Could not save that voice");
    expect(view.voiceSelect()?.value).toBe("voice-1");
    expect(view.voiceSelect()?.disabled).toBe(false);
  } finally {
    await view.cleanup();
  }
});
