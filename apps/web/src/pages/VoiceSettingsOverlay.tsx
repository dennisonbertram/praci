import { Trans, useLingui } from "@lingui/react/macro";
import type {
  DesktopSpeechStatus,
  VoiceCatalogEntry,
  VoiceCredential,
  VoiceInfo,
  VoiceStatus,
} from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { desktopBridge } from "../lib/desktop";
import { useDeviceSpeech } from "../lib/device-speech";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** On-device speech status, with the answers of prepare and forget applied at once. */
function useDeviceSpeechControl() {
  const pushed = useDeviceSpeech();
  const [local, setLocal] = useState<DesktopSpeechStatus | null>(null);
  const [pending, setPending] = useState(false);
  // A pushed status is newer than the last local answer.
  useEffect(() => setLocal(null), [pushed]);
  const status = local ?? pushed;
  const run = (action: "prepare" | "forget") => {
    setPending(true);
    if (action === "prepare") setLocal({ state: "preparing", progress: null });
    void desktopBridge()
      ?.speech?.[action]()
      .then(setLocal, () => setLocal({ state: "error" }))
      .finally(() => setPending(false));
  };
  const listed = status && status.state !== "unavailable" ? status : null;
  return { status: listed, pending, run };
}

function DeviceSpeechPane({
  status,
  pending,
  run,
}: {
  status: DesktopSpeechStatus;
  pending: boolean;
  run: (action: "prepare" | "forget") => void;
}) {
  const percent =
    status.state === "preparing" && status.progress !== null
      ? Math.round(status.progress * 100)
      : null;
  return (
    <section data-testid="device-speech">
      {status.state === "not-prepared" ? (
        <>
          <p className="text-sm text-muted-foreground">
            <Trans>
              Transcribe with Hex on this Mac. Audio stays on this computer; only text is sent to
              Praci.
            </Trans>
          </p>
          <Button type="button" className="mt-3" disabled={pending} onClick={() => run("prepare")}>
            <Trans>Prepare</Trans>
          </Button>
          <p className="mt-2 text-[12px] text-muted-foreground">
            <Trans>Downloads the speech model once.</Trans>
          </p>
        </>
      ) : null}
      {status.state === "preparing" ? (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full bg-primary ${percent === null ? "w-1/3 animate-pulse" : ""}`}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {percent === null ? <Trans>Preparing…</Trans> : <Trans>Preparing… {percent}%</Trans>}
          </p>
          {/* Forget aborts an in-flight prepare in main; it runs while prepare is still pending. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => run("forget")}
          >
            <Trans>Cancel</Trans>
          </Button>
        </>
      ) : null}
      {status.state === "ready" ? (
        <>
          <p className="text-sm text-success">
            <Trans>Ready. Audio stays on this Mac.</Trans>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={() => run("forget")}
          >
            <Trans>Stop using</Trans>
          </Button>
        </>
      ) : null}
      {status.state === "error" ? (
        <>
          <p className="text-sm text-destructive">
            <Trans>Couldn't prepare Hex.</Trans>
          </p>
          <Button type="button" className="mt-3" disabled={pending} onClick={() => run("prepare")}>
            <Trans>Try again</Trans>
          </Button>
        </>
      ) : null}
    </section>
  );
}

export function VoiceSettingsOverlay({
  onClose,
  embedded = false,
  onBusyChange,
}: {
  onClose: () => void;
  /** Render panel body only for the shared Settings shell. */
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useLingui();
  const apiKeyId = useId();
  const voiceSelectId = useId();
  const speechModelId = useId();
  const baseUrlId = useId();
  const compatModelId = useId();
  const [catalog, setCatalog] = useState<VoiceCatalogEntry[]>([]);
  const [credentials, setCredentials] = useState<VoiceCredential[]>([]);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [provider, setProvider] = useState("");
  const device = useDeviceSpeechControl();
  // Until the person picks a row, the device is shown only when it is ready.
  const [pick, setPick] = useState<"device" | "provider" | null>(null);
  const deviceSelected = pick === "device" || (pick === null && device.status?.state === "ready");
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speechModel, setSpeechModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [compatModel, setCompatModel] = useState("");
  const speechModelSave = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"connect" | "disconnect" | "voice" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only a failed load offers Try again; action errors keep their own message.
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = pending !== null;

  useEffect(() => {
    return () => onBusyChange?.(false);
  }, [onBusyChange]);

  function markPending(next: "connect" | "disconnect" | "voice" | "test" | null) {
    setPending(next);
    onBusyChange?.(next !== null);
  }

  async function refresh(nextProvider?: string): Promise<boolean> {
    const ticket = ++refreshSequence.current;
    let nextCatalog: VoiceCatalogEntry[];
    let nextCredentials: VoiceCredential[];
    let nextStatus: VoiceStatus;
    try {
      [nextCatalog, nextCredentials, nextStatus] = await Promise.all([
        rpc.voice.catalog(),
        rpc.voice.credentials(),
        rpc.voice.status(),
      ]);
    } catch (err) {
      if (ticket !== refreshSequence.current) return true;
      throw err;
    }
    if (ticket !== refreshSequence.current) return true;
    const selected = nextProvider || provider || nextStatus.provider || nextCatalog[0]?.id || "";
    setCatalog(nextCatalog);
    setCredentials(nextCredentials);
    setStatus(nextStatus);
    setProvider(selected);
    const cred = nextCredentials.find((entry) => entry.provider === selected);
    const activeVoice = cred?.voiceId ?? "";
    setVoiceId(activeVoice);
    setSpeechModel(cred?.speechModel ?? "");
    if (cred) {
      let listed: VoiceInfo[];
      try {
        listed = await rpc.voice.voices({ provider: selected });
      } catch {
        if (ticket === refreshSequence.current) {
          setVoices([]);
          return false;
        }
        return true;
      }
      if (ticket !== refreshSequence.current) return true;
      setVoices(listed);
      if (!activeVoice && listed[0]) setVoiceId(listed[0].id);
    } else {
      setVoices([]);
    }
    setLoadFailed(false);
    return true;
  }

  async function retryLoad() {
    setLoading(true);
    try {
      const loaded = await refresh();
      if (loaded) {
        setError(null);
        setLoadFailed(false);
      }
    } catch {
      setLoadFailed(true);
      setError(t`Could not load voice settings`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh()
      .catch(() => {
        setLoadFailed(true);
        setError(t`Could not load voice settings`);
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = catalog.find((entry) => entry.id === provider) ?? catalog[0];
  const credential = credentials.find((entry) => entry.provider === provider);
  const isCompat = selected?.id === "openai-compatible";
  const compatConnected = isCompat && status?.transcriptionProvider === selected?.id;
  const connectDisabled = isCompat
    ? !baseUrl.trim() ||
      !compatModel.trim() ||
      (apiKey.trim().length > 0 && apiKey.trim().length < 8)
    : apiKey.trim().length < 8;
  const voiceOptions = useMemo(
    () => (voices.length ? voices : voiceId ? [{ id: voiceId, label: voiceId }] : []),
    [voices, voiceId],
  );

  async function connectKey() {
    if (!selected || connectDisabled) return;
    setError(null);
    setNotice(null);
    markPending("connect");
    try {
      if (isCompat) {
        await rpc.voice.setTranscription({
          provider: selected.id,
          baseUrl: baseUrl.trim(),
          model: compatModel.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        });
      } else {
        await rpc.voice.connect({
          provider: selected.id,
          apiKey: apiKey.trim(),
          voiceId: voiceId || undefined,
          ...(selected.id === "fish-audio" ? { speechModel: speechModel.trim() } : {}),
        });
      }
    } catch (err) {
      setError(errorText(err, t`Could not connect this voice provider`));
      markPending(null);
      return;
    }
    setApiKey("");
    setNotice(t`Connected ${selected.name}.`);
    try {
      const loaded = await refresh(selected.id);
      if (!loaded) {
        setLoadFailed(true);
        setError(t`Could not load voice settings`);
      }
    } catch {
      setLoadFailed(true);
      setError(t`Could not load voice settings`);
    } finally {
      // The mutation succeeded; a failed settings refresh is a load error, not a connect error.
      markPending(null);
    }
  }

  async function disconnectProvider() {
    if (!credential && !compatConnected) return;
    setError(null);
    setNotice(null);
    markPending("disconnect");
    try {
      if (compatConnected) await rpc.voice.clearTranscription();
      else if (credential) await rpc.voice.disconnect({ provider: credential.provider });
    } catch (err) {
      setError(errorText(err, t`Could not disconnect this voice provider`));
      markPending(null);
      return;
    }
    setApiKey("");
    setBaseUrl("");
    setCompatModel("");
    try {
      const loaded = await refresh(selected?.id);
      if (!loaded) {
        setLoadFailed(true);
        setError(t`Could not load voice settings`);
      }
    } catch {
      setLoadFailed(true);
      setError(t`Could not load voice settings`);
    } finally {
      markPending(null);
    }
  }

  async function chooseVoice(nextVoiceId: string) {
    const previousVoiceId = voiceId;
    setVoiceId(nextVoiceId);
    if (!credential) return;
    markPending("voice");
    setError(null);
    try {
      const nextStatus = await rpc.voice.setVoice({ voiceId: nextVoiceId, provider: selected?.id });
      setStatus(nextStatus);
      setCredentials((current) =>
        current.map((entry) =>
          entry.provider === selected?.id ? { ...entry, voiceId: nextVoiceId } : entry,
        ),
      );
      setLoadFailed(false);
      setError(null);
    } catch (err) {
      setVoiceId(previousVoiceId);
      setError(errorText(err, t`Could not save that voice`));
    } finally {
      markPending(null);
    }
  }

  async function saveSpeechModel() {
    if (!credential || selected?.id !== "fish-audio") return;
    const next = speechModel.trim();
    if (next === credential.speechModel) return;
    if (speechModelSave.current === next) return;
    speechModelSave.current = next;
    setError(null);
    markPending("voice");
    try {
      const saved = await rpc.voice.setSpeechModel({ provider: selected.id, speechModel: next });
      setSpeechModel(saved.speechModel);
      setCredentials((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (err) {
      setError(errorText(err, t`Could not save that speech model`));
    } finally {
      speechModelSave.current = null;
      markPending(null);
    }
  }

  async function testVoice() {
    setError(null);
    setNotice(null);
    markPending("test");
    try {
      const { speaker } = await import("../lib/tts.js");
      await speaker.speak(t`Hi, this is how I'll sound when I read replies out loud.`);
      if (speaker.state.error) {
        setError(speaker.state.error);
        return;
      }
      setNotice(t`If you heard that, voice is ready.`);
    } catch (err) {
      setError(errorText(err, t`Could not play a test clip`));
    } finally {
      markPending(null);
    }
  }

  const body = (
    <>
      {!embedded ? (
        <div className="flex items-start justify-between px-6 pt-6 sm:px-8 sm:pt-7">
          <div>
            <DialogTitle className="text-2xl font-medium text-foreground">
              <Trans>Voice</Trans>
            </DialogTitle>
          </div>
          <DialogClose
            aria-label={t`Close voice settings`}
            disabled={busy}
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <XIcon />
          </DialogClose>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-6 py-6 sm:px-8 md:flex-row">
        <div className="flex min-h-0 shrink-0 flex-col md:w-[280px]">
          <div className="mb-3 text-[13.5px] text-muted-foreground">
            <Trans>Providers</Trans>
          </div>
          <div className="rk-scroll overflow-y-auto rounded-xl border border-border">
            {device.status ? (
              <button
                type="button"
                aria-current={deviceSelected ? "true" : undefined}
                disabled={busy}
                onClick={() => setPick("device")}
                className={`flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-start transition-colors last:border-0 disabled:pointer-events-none disabled:opacity-50 ${
                  deviceSelected ? "bg-foreground/10" : "hover:bg-accent"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-foreground">
                    <Trans>On this device</Trans>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground/80">
                    <Trans>Transcribe</Trans>
                  </span>
                </span>
                {device.status.state === "ready" ? (
                  <span className="text-[12px] text-success">
                    <Trans>Ready</Trans>
                  </span>
                ) : device.status.state === "preparing" ? (
                  <span className="text-[12px] text-muted-foreground">
                    <Trans>Preparing</Trans>
                  </span>
                ) : null}
              </button>
            ) : null}
            {catalog.map((entry) => {
              const connected =
                credentials.some((cred) => cred.provider === entry.id) ||
                status?.transcriptionProvider === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={!deviceSelected && entry.id === provider ? "true" : undefined}
                  disabled={busy}
                  onClick={() => {
                    setPick("provider");
                    setProvider(entry.id);
                    setApiKey("");
                    setError(null);
                    setNotice(null);
                    markPending("voice");
                    void refresh(entry.id)
                      .catch(() => {
                        setLoadFailed(true);
                        setError(t`Could not load voice settings`);
                      })
                      .finally(() => markPending(null));
                  }}
                  className={`flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-start transition-colors last:border-0 disabled:pointer-events-none disabled:opacity-50 ${
                    !deviceSelected && entry.id === provider
                      ? "bg-foreground/10"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-foreground">{entry.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground/80">
                      {entry.speech === false ? (
                        <Trans>Transcribe</Trans>
                      ) : entry.transcribe ? (
                        <Trans>Speak + transcribe</Trans>
                      ) : (
                        <Trans>Speak only</Trans>
                      )}
                    </span>
                  </span>
                  {connected ? (
                    <span className="text-[12px] text-success">
                      <Trans>Connected</Trans>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rk-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
          {deviceSelected && device.status ? (
            <DeviceSpeechPane {...device} status={device.status} />
          ) : (
            <>
              {loading ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>Loading voice providers…</Trans>
                </p>
              ) : null}
              {error ? (
                <div className="mb-4 flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-sm text-destructive">{error}</p>
                  {loadFailed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void retryLoad()}
                    >
                      <Trans>Try again</Trans>
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}
              {selected ? (
                <>
                  {isCompat ? (
                    <>
                      <Field className="mt-5">
                        <FieldLabel htmlFor={baseUrlId}>
                          <Trans>Base URL</Trans>
                        </FieldLabel>
                        <Input
                          id={baseUrlId}
                          value={baseUrl}
                          maxLength={2048}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="http://localhost:8000"
                          onChange={(event) => setBaseUrl(event.target.value)}
                        />
                      </Field>
                      <Field className="mt-5">
                        <FieldLabel htmlFor={compatModelId}>
                          <Trans>Model</Trans>
                        </FieldLabel>
                        <Input
                          id={compatModelId}
                          value={compatModel}
                          maxLength={120}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="whisper-large-v3"
                          onChange={(event) => setCompatModel(event.target.value)}
                        />
                      </Field>
                    </>
                  ) : null}
                  <Field className="mt-5">
                    <FieldLabel htmlFor={apiKeyId}>
                      {isCompat ? (
                        <Trans>API key (optional)</Trans>
                      ) : (
                        <Trans>{selected.name} API key</Trans>
                      )}
                    </FieldLabel>
                    <Input
                      id={apiKeyId}
                      type="password"
                      autoComplete="new-password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={credential ? t`Paste a replacement key` : t`Paste your API key`}
                    />
                  </Field>
                  <Button
                    type="button"
                    className="mt-3"
                    disabled={busy || connectDisabled}
                    onClick={() => void connectKey()}
                  >
                    {pending === "connect" ? (
                      <Trans>Connecting…</Trans>
                    ) : credential ? (
                      <Trans>Replace key</Trans>
                    ) : (
                      <Trans>Connect {selected.name}</Trans>
                    )}
                  </Button>
                  {credential || compatConnected ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={busy}
                      onClick={() => void disconnectProvider()}
                    >
                      {pending === "disconnect" ? (
                        <Trans>Disconnecting…</Trans>
                      ) : (
                        <Trans>Disconnect</Trans>
                      )}
                    </Button>
                  ) : null}

                  {credential ? (
                    <>
                      <Field className="mt-6">
                        <FieldLabel htmlFor={voiceSelectId}>
                          <Trans>Voice</Trans>
                        </FieldLabel>
                        <NativeSelect
                          id={voiceSelectId}
                          className="w-full"
                          value={voiceId}
                          disabled={busy}
                          onChange={(event) => void chooseVoice(event.target.value)}
                        >
                          {voiceOptions.map((voice) => (
                            <NativeSelectOption key={voice.id} value={voice.id}>
                              {voice.label}
                              {voice.description ? ` · ${voice.description}` : ""}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                      {selected.id === "fish-audio" ? (
                        <Field className="mt-6">
                          <FieldLabel htmlFor={speechModelId}>
                            <Trans>Speech model</Trans>
                          </FieldLabel>
                          <Input
                            id={speechModelId}
                            value={speechModel}
                            maxLength={64}
                            autoComplete="off"
                            spellCheck={false}
                            disabled={busy}
                            placeholder={t`Optional`}
                            onChange={(event) => setSpeechModel(event.target.value)}
                            onBlur={() => void saveSpeechModel()}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              event.currentTarget.blur();
                            }}
                          />
                        </Field>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-4 rounded-full"
                        disabled={busy || !status?.ready}
                        onClick={() => void testVoice()}
                      >
                        {pending === "test" ? (
                          <Trans>Playing…</Trans>
                        ) : (
                          <Trans>Hear a sample</Trans>
                        )}
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div data-testid="voice-settings" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {body}
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (busy) {
          details.cancel();
          return;
        }
        onClose();
      }}
    >
      <DialogContent
        data-testid="voice-settings"
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[min(680px,calc(100%-2rem))] w-[920px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[min(680px,calc(100%-5rem))] sm:max-w-[calc(100%-5rem)]"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
